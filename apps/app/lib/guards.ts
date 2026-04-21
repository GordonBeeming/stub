import { NextResponse } from 'next/server';
import { getEnv } from './cf';
import { getSession, ownerEmailMatches } from './auth';
import type { SessionPayload } from './types';

export type GuardPageResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; redirect: string };

// For server components / page guards. Returns a discriminated union so the
// caller can decide how to redirect — Next's redirect() has to be invoked at
// the call site, not here, to keep this module pure.
export async function requireOwnerSession(): Promise<GuardPageResult> {
  const env = getEnv();
  const session = await getSession(env);
  if (!session) return { ok: false, redirect: '/login?err=invalid' };
  if (!ownerEmailMatches(session.email, env)) return { ok: false, redirect: '/login?err=invalid' };
  return { ok: true, session };
}

export type GuardApiResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: Response };

// For API route handlers. Returns a ready-to-send 401 when the session is
// missing or the email no longer matches the configured owner.
export async function requireOwnerApi(): Promise<GuardApiResult> {
  const env = getEnv();
  const session = await getSession(env);
  if (!session || !ownerEmailMatches(session.email, env)) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true, session };
}
