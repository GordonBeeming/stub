import { Hono } from 'hono';
import { clearSessionCookie, getSession, ownerEmailMatches } from '../../lib/auth';
import { getPasskeysForUser, getUserByEmail, logAudit } from '../../lib/db';
import { clientIP } from '../../lib/links';
import { hashIP } from '../../lib/crypto';

// Tiny session-adjacent endpoints: /state reports whether the owner already
// has passkeys (so the login form can show the passkey button), /logout
// clears the cookie and audits the attempt.

export const sessionRoutes = new Hono<{ Bindings: CloudflareEnv }>();

// GET /api/auth/state — public. Single-tenant means there's only one possible
// answer and it isn't sensitive: either the owner has enrolled passkeys, or
// hasn't. Used by the login page to decide whether to render the passkey
// button up-front or hide it behind a magic-link detour.
sessionRoutes.get('/state', async (c) => {
  const env = c.env;
  const user = await getUserByEmail(env.DB, env.OWNER_EMAIL);
  if (!user) return c.json({ hasPasskeys: false });
  const passkeys = await getPasskeysForUser(env.DB, user.id);
  return c.json({ hasPasskeys: passkeys.length > 0 });
});

// GET /api/auth/me — client-side session probe. Returns the session payload
// (id + email) when the caller has a valid owner session, 401 otherwise.
// The SPA needs this for routing decisions: the old Next app did it
// server-side with `requireOwnerSession` inside `app/dashboard/layout.tsx`,
// but a SPA doesn't get a server-render pass, so we expose the same check
// over JSON.
sessionRoutes.get('/me', async (c) => {
  const env = c.env;
  const session = await getSession(c);
  if (!session || !ownerEmailMatches(session.email, env)) {
    return c.json({ ok: false, error: 'unauthorized' }, 401);
  }
  return c.json({ ok: true, sub: session.sub, email: session.email });
});

// POST /api/auth/logout — always returns success. Audits the attempt even
// when there was no live session so the trail shows every time the endpoint
// was hit, not just successful sign-outs.
sessionRoutes.post('/logout', async (c) => {
  const env = c.env;
  const session = await getSession(c);

  clearSessionCookie(c);

  const ip = clientIP(c.req.raw.headers);
  const ipHash = ip ? await hashIP(ip, env.IP_HASH_SALT) : null;
  await logAudit(env.DB, {
    actor: session?.sub ?? 'public',
    action: 'logout',
    ipHash,
  });

  return c.json({ ok: true });
});
