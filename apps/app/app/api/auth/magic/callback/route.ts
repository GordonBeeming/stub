export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getEnv, resolveOrigin } from '@/lib/cf';
import { consumeMagicToken, getPasskeysForUser, getUserByEmail, logAudit, upsertUser } from '@/lib/db';
import { cookieSecureFor, ownerEmailMatches, signSession, setSessionCookie } from '@/lib/auth';
import { hashIP } from '@/lib/crypto';
import { logInfo, logWarn } from '@/lib/log';
import { nanoid } from 'nanoid';


export async function GET(request: NextRequest): Promise<Response> {
  const env = getEnv();
  const origin = resolveOrigin(request, env);
  const token = request.nextUrl.searchParams.get('t');
  if (!token) {
    logWarn({ evt: 'auth.magic.callback.reject', reason: 'missing_token' });
    return redirectInvalid(origin);
  }

  const row = await consumeMagicToken(env.DB, token);
  if (!row) {
    logWarn({ evt: 'auth.magic.callback.reject', reason: 'consume_failed' });
    return redirectInvalid(origin);
  }

  // Defense in depth: the row's email should always match OWNER_EMAIL (the
  // request endpoint is the only minter and it already gates), but verify
  // again so a compromised DB row can't escalate into a session.
  if (!ownerEmailMatches(row.email, env)) {
    logWarn({ evt: 'auth.magic.callback.reject', reason: 'owner_mismatch' });
    return redirectInvalid(origin);
  }

  // Find-or-create the single owner user. Use nanoid as a ulid-ish id —
  // sortable-enough and URL-safe without adding another dep.
  const existing = await getUserByEmail(env.DB, row.email);
  const userId = existing?.id ?? nanoid(24);
  const user = await upsertUser(env.DB, { id: userId, email: row.email });

  const jwt = await signSession({ sub: user.id, email: user.email }, env);
  await setSessionCookie(jwt, { secure: cookieSecureFor(request) });

  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for');
  const ipHash = ip ? await hashIP(ip.split(',')[0]!.trim(), env.IP_HASH_SALT) : null;
  await logAudit(env.DB, {
    actor: user.id,
    action: 'login.magic.consume',
    ipHash,
  });

  const passkeys = await getPasskeysForUser(env.DB, user.id);
  const next = passkeys.length === 0 ? '/enroll' : '/dashboard';
  logInfo({ evt: 'auth.magic.callback.success', next, passkeys: passkeys.length });
  return NextResponse.redirect(new URL(next, origin), 302);
}

function redirectInvalid(origin: string): Response {
  return NextResponse.redirect(new URL('/login?err=invalid', origin), 302);
}
