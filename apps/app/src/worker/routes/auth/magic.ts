import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { resolveOrigin } from '../../lib/cf';
import { ownerEmailMatches, signSession, setSessionCookie } from '../../lib/auth';
import { verifyTurnstile } from '../../lib/turnstile';
import { checkAndIncrement } from '../../lib/rate-limit';
import {
  consumeMagicToken,
  createMagicToken,
  getPasskeysForUser,
  getUserByEmail,
  logAudit,
  upsertUser,
} from '../../lib/db';
import { sendMagicLink } from '../../lib/email';
import { clientIP } from '../../lib/links';
import { hashIP, randomUrlSafeToken } from '../../lib/crypto';
import { logError, logInfo, logWarn } from '../../lib/log';

// Magic-link endpoints: request (POST — start the flow) and callback (GET —
// user clicks the emailed link and we mint a session). Both preserve the
// "constant response body, never leak which gate failed" behaviour of the
// original Next implementation.

const magicRequestBody = z.object({
  email: z.email().max(320),
  turnstileToken: z.string().min(1).max(2048),
});

// Identical response for every reject path — caller must not be able to tell
// whether the submitted email matches OWNER_EMAIL, whether Turnstile passed,
// or whether rate-limiting fired. Every branch returns this body + 200.
const GENERIC_OK = { ok: true } as const;

export const magicRoutes = new Hono<{ Bindings: CloudflareEnv }>();

magicRoutes.post('/request', async (c) => {
  const env = c.env;

  let parsed: z.infer<typeof magicRequestBody>;
  try {
    parsed = magicRequestBody.parse(await c.req.json());
  } catch {
    logWarn({ evt: 'auth.magic.request.reject', reason: 'bad_body' });
    return c.json(GENERIC_OK);
  }

  const ip = clientIP(c.req.raw.headers);

  const turnstile = await verifyTurnstile(parsed.turnstileToken, ip, env.TURNSTILE_SECRET);
  if (!turnstile.ok) {
    // Surface the exact siteverify failure codes so debugging the dev pair
    // (wrong secret, missing localhost on the Turnstile domain list, etc.)
    // doesn't need a second round of code changes. The response stays
    // generic; only the structured log carries detail.
    logWarn({
      evt: 'auth.magic.request.reject',
      reason: 'turnstile_fail',
      turnstileErrorCodes: turnstile.errorCodes,
    });
    return c.json(GENERIC_OK);
  }

  // Anonymous (no-IP) requests share a bucket so a caller can't bypass by
  // stripping headers.
  const rlKey = `magic:${ip ?? 'anon'}`;
  const rl = await checkAndIncrement(env.RATE_LIMIT, rlKey, { limit: 5, windowSec: 60 * 15 });
  if (!rl.allowed) {
    logWarn({ evt: 'auth.magic.request.reject', reason: 'rate_limited', resetAt: rl.resetAt });
    return c.json(GENERIC_OK);
  }

  // Owner gate mismatches log intentionally — never include the submitted
  // address so the logs cannot be used to enumerate probing attempts.
  if (!ownerEmailMatches(parsed.email, env)) {
    logWarn({ evt: 'auth.magic.request.reject', reason: 'owner_mismatch' });
    return c.json(GENERIC_OK);
  }

  const token = randomUrlSafeToken(32);
  try {
    await createMagicToken(env.DB, env.OWNER_EMAIL, token);
    const callbackUrl = `${resolveOrigin(c.req.raw, env)}/api/auth/magic/callback?t=${encodeURIComponent(token)}`;
    await sendMagicLink({ to: env.OWNER_EMAIL, url: callbackUrl, env });
    const ipHash = ip ? await hashIP(ip, env.IP_HASH_SALT) : null;
    await logAudit(env.DB, { actor: 'owner', action: 'login.magic.request', ipHash });
    logInfo({ evt: 'auth.magic.request.sent' });
  } catch (err) {
    // Caller still sees the generic response so the failure doesn't leak,
    // but logs it loud so a forker can debug.
    logError({ evt: 'auth.magic.request.error', message: err instanceof Error ? err.message : String(err) });
  }

  return c.json(GENERIC_OK);
});

magicRoutes.get('/callback', async (c) => {
  const env = c.env;
  const origin = resolveOrigin(c.req.raw, env);
  const token = c.req.query('t');
  if (!token) {
    logWarn({ evt: 'auth.magic.callback.reject', reason: 'missing_token' });
    return c.redirect(`${origin}/login?err=invalid`, 302);
  }

  const row = await consumeMagicToken(env.DB, token);
  if (!row) {
    logWarn({ evt: 'auth.magic.callback.reject', reason: 'consume_failed' });
    return c.redirect(`${origin}/login?err=invalid`, 302);
  }

  // Defense in depth: the row's email should always match OWNER_EMAIL (the
  // request endpoint is the only minter and it already gates), but verify
  // again so a compromised DB row can't escalate into a session.
  if (!ownerEmailMatches(row.email, env)) {
    logWarn({ evt: 'auth.magic.callback.reject', reason: 'owner_mismatch' });
    return c.redirect(`${origin}/login?err=invalid`, 302);
  }

  const existing = await getUserByEmail(env.DB, row.email);
  const userId = existing?.id ?? nanoid(24);
  const user = await upsertUser(env.DB, { id: userId, email: row.email });

  const jwt = await signSession({ sub: user.id, email: user.email }, env);
  setSessionCookie(c, jwt);

  const ip = clientIP(c.req.raw.headers);
  const ipHash = ip ? await hashIP(ip, env.IP_HASH_SALT) : null;
  await logAudit(env.DB, {
    actor: user.id,
    action: 'login.magic.consume',
    ipHash,
  });

  const passkeys = await getPasskeysForUser(env.DB, user.id);
  const next = passkeys.length === 0 ? '/enroll' : '/dashboard';
  logInfo({ evt: 'auth.magic.callback.success', next, passkeys: passkeys.length });
  return c.redirect(`${origin}${next}`, 302);
});
