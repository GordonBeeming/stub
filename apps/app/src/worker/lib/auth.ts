import { SignJWT, jwtVerify, errors as joseErrors, type JWTPayload } from 'jose';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';
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

// Helper for routes: returns false on localhost so the cookie can actually be
// accepted by the browser over plain HTTP. The request URL is the source of
// truth — the Hono ctx is derived from it.
export function cookieSecureFor(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

// Hono-context wrappers. The Next version leaned on `cookies()` from
// `next/headers`; here we route through hono/cookie which reads from the
// request headers and writes via c.res's Set-Cookie. Same lifetime, same
// sameSite, same httpOnly — only the plumbing changed.
export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecureFor(c.req.raw),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function readSessionCookie(c: Context): string | null {
  return getCookie(c, SESSION_COOKIE) ?? null;
}

// Typed loosely on the context shape — callers can bring their own Variables
// shape (Hono middleware chains often do) without needing to cast.
export async function getSession(c: Context): Promise<SessionPayload | null> {
  const token = readSessionCookie(c);
  if (!token) return null;
  // c.env narrows to unknown here because the context shape is generic; the
  // CloudflareEnv bindings surface is the ambient type every worker context
  // carries at runtime, so we assert it rather than pushing a generic up
  // through every call site.
  const env = c.env as SessionSecretEnv;
  return verifySession(token, env);
}

// Optional refresh helper: if a cookie verified only against the previous key,
// mint a fresh one signed with the current key so later requests stop needing
// the fallback. Callers that can set cookies (route handlers) can push the
// returned token through setSessionCookie.
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
