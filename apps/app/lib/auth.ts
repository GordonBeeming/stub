import { SignJWT, jwtVerify, errors as joseErrors, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { timingSafeEqualHex } from './crypto';
import type { SessionPayload } from './types';

export const SESSION_COOKIE = 'stub_session';
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
const JWT_ALG = 'HS256';

// Dual-key env shape used by the verify/read paths. SESSION_SECRET_PREV is only
// populated during a rotation window so in-flight cookies signed with the old
// key keep working until they expire or the user next signs in.
export type SessionSecretEnv = {
  SESSION_SECRET: string;
  SESSION_SECRET_PREV?: string;
};

export type VerifiedWith = 'current' | 'previous';

export interface VerifiedSession {
  payload: SessionPayload;
  verifiedWith: VerifiedWith;
}

export async function signSession(
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
  env: { SESSION_SECRET: string },
): Promise<string> {
  const key = new TextEncoder().encode(env.SESSION_SECRET);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload } as JWTPayload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SEC)
    .setSubject(payload.sub)
    .sign(key);
}

// Lower-level verify that reports which key succeeded. Callers that want to
// re-sign on rotation reach for this; most code paths stick with verifySession
// / getSession and ignore the provenance.
export async function verifySessionDetailed(
  token: string,
  env: SessionSecretEnv,
): Promise<VerifiedSession | null> {
  const current = await tryVerify(token, env.SESSION_SECRET);
  if (current.ok) {
    return { payload: current.payload, verifiedWith: 'current' };
  }

  // Only fall through to the previous key for a signature mismatch. Anything
  // else (expired, malformed, wrong alg) is a terminal failure — trying the
  // other key would muddy the signal without changing the outcome.
  if (!current.signatureMismatch || !env.SESSION_SECRET_PREV) {
    return null;
  }

  const previous = await tryVerify(token, env.SESSION_SECRET_PREV);
  if (!previous.ok) return null;
  return { payload: previous.payload, verifiedWith: 'previous' };
}

export async function verifySession(
  token: string,
  env: SessionSecretEnv,
): Promise<SessionPayload | null> {
  const result = await verifySessionDetailed(token, env);
  return result?.payload ?? null;
}

interface CookieOpts {
  /** Set to false only when serving plain-HTTP localhost. Browsers silently
   *  drop Secure cookies on non-HTTPS, which kills the session flow in dev. */
  secure?: boolean;
}

export async function setSessionCookie(token: string, opts: CookieOpts = {}): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: opts.secure ?? true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

// Helper for routes: returns false on localhost so the cookie can actually be
// accepted by the browser over plain HTTP.
export function cookieSecureFor(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function readSessionCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function getSession(env: SessionSecretEnv): Promise<SessionPayload | null> {
  const token = await readSessionCookie();
  if (!token) return null;
  return verifySession(token, env);
}

// Optional refresh helper: if a cookie verified only against the previous key,
// mint a fresh one signed with the current key so later requests stop needing
// the fallback. Callers that can set cookies (route handlers, server actions)
// can push the returned token through setSessionCookie.
export async function reSignIfRotated(args: {
  session: SessionPayload | null;
  verifiedWith: VerifiedWith;
  env: { SESSION_SECRET: string };
}): Promise<string | null> {
  if (args.verifiedWith !== 'previous' || !args.session) return null;
  return signSession({ sub: args.session.sub, email: args.session.email }, args.env);
}

// Single-tenant gate. Compared after trim+lowercase on both sides; the
// compare itself is constant-time over the hex-encoded UTF-8 bytes so
// equal-length impostor addresses don't leak via timing.
export function ownerEmailMatches(input: string, env: { OWNER_EMAIL: string }): boolean {
  const a = normalizeEmail(input);
  const b = normalizeEmail(env.OWNER_EMAIL);
  if (a.length !== b.length) return false;
  return timingSafeEqualHex(utf8ToHex(a), utf8ToHex(b));
}

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

function utf8ToHex(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === undefined) continue;
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

type VerifyAttempt =
  | { ok: true; payload: SessionPayload }
  | { ok: false; signatureMismatch: boolean };

async function tryVerify(token: string, secret: string): Promise<VerifyAttempt> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: [JWT_ALG] });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return { ok: false, signatureMismatch: false };
    }
    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
      return { ok: false, signatureMismatch: false };
    }
    return {
      ok: true,
      payload: {
        sub: payload.sub,
        email: payload.email,
        iat: payload.iat,
        exp: payload.exp,
      },
    };
  } catch (err) {
    return {
      ok: false,
      signatureMismatch: err instanceof joseErrors.JWSSignatureVerificationFailed,
    };
  }
}
