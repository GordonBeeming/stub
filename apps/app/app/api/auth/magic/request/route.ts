export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getEnv, resolveOrigin } from '@/lib/cf';
import { ownerEmailMatches } from '@/lib/auth';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkAndIncrement } from '@/lib/rate-limit';
import { createMagicToken, logAudit } from '@/lib/db';
import { sendMagicLink } from '@/lib/email';
import { hashIP, randomUrlSafeToken } from '@/lib/crypto';
import { logInfo, logWarn, logError } from '@/lib/log';


const bodySchema = z.object({
  email: z.email().max(320),
  turnstileToken: z.string().min(1).max(2048),
});

// Identical response for every path — the endpoint must not leak whether the
// submitted email matches OWNER_EMAIL, or whether Turnstile passed, or whether
// the caller was rate-limited. Any branch that would reveal state returns
// this same body + status.
const GENERIC_OK = { ok: true } as const;
function genericResponse(): Response {
  return NextResponse.json(GENERIC_OK, { status: 200 });
}

export async function POST(request: NextRequest): Promise<Response> {
  const env = getEnv();

  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    parsed = bodySchema.parse(raw);
  } catch {
    logWarn({ evt: 'auth.magic.request.reject', reason: 'bad_body' });
    return genericResponse();
  }

  const ip = getClientIp(request);

  const turnstileOk = await verifyTurnstile(parsed.turnstileToken, ip, env.TURNSTILE_SECRET);
  if (!turnstileOk) {
    logWarn({ evt: 'auth.magic.request.reject', reason: 'turnstile_fail' });
    return genericResponse();
  }

  // Anonymous (no-IP) requests share a bucket so a caller can't bypass by
  // stripping headers.
  const rlKey = `magic:${ip ?? 'anon'}`;
  const rl = await checkAndIncrement(env.RATE_LIMIT, rlKey, { limit: 5, windowSec: 60 * 15 });
  if (!rl.allowed) {
    logWarn({ evt: 'auth.magic.request.reject', reason: 'rate_limited', resetAt: rl.resetAt });
    return genericResponse();
  }

  // Owner gate mismatches log intentionally — never include the submitted
  // address so the logs cannot be used to enumerate probing attempts.
  if (!ownerEmailMatches(parsed.email, env)) {
    logWarn({ evt: 'auth.magic.request.reject', reason: 'owner_mismatch' });
    return genericResponse();
  }

  const token = randomUrlSafeToken(32);
  try {
    await createMagicToken(env.DB, env.OWNER_EMAIL, token);
    const callbackUrl = `${resolveOrigin(request, env)}/api/auth/magic/callback?t=${encodeURIComponent(token)}`;
    await sendMagicLink({ to: env.OWNER_EMAIL, url: callbackUrl, env });
    const ipHash = ip ? await hashIP(ip, env.IP_HASH_SALT) : null;
    await logAudit(env.DB, { actor: 'owner', action: 'login.magic.request', ipHash });
    logInfo({ evt: 'auth.magic.request.sent' });
  } catch (err) {
    // Caller still sees the generic response so this failure doesn't leak,
    // but it DOES need to show up in the logs so a forker can debug.
    logError({ evt: 'auth.magic.request.error', message: errMessage(err) });
  }

  return genericResponse();
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function getClientIp(request: NextRequest): string | null {
  // Cloudflare sets cf-connecting-ip on the inbound request; the standard
  // x-forwarded-for comes in as a fallback during local dev.
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return null;
}
