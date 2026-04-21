export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
// Pulled off the function's own parameter type so we don't take a direct
// dep on @simplewebauthn/types — it lives as a transitive pnpm symlink.
type AuthenticationResponseJSON = Parameters<typeof verifyAuthenticationResponse>[0]['response'];
import { getEnv, resolveOrigin } from '@/lib/cf';
import { getPasskeyById, getUserById, logAudit, updatePasskeyUsage } from '@/lib/db';
import { deleteChallenge, getChallenge } from '@/lib/kv';
import { cookieSecureFor, setSessionCookie, signSession } from '@/lib/auth';
import { hashIP } from '@/lib/crypto';


const bodySchema = z.object({
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    type: z.literal('public-key'),
    response: z.record(z.string(), z.unknown()),
    clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
    authenticatorAttachment: z.string().optional(),
  }).passthrough(),
});

export async function POST(request: NextRequest): Promise<Response> {
  const env = getEnv();

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const response = parsed.response as unknown as AuthenticationResponseJSON;

  // The response's clientDataJSON carries the challenge we issued; pull it
  // out so we can find the matching record we stashed in KV.
  const challenge = extractChallenge(response);
  if (!challenge) {
    return NextResponse.json({ ok: false, error: 'missing_challenge' }, { status: 400 });
  }

  const challengeKey = `pk:auth:${challenge}`;
  const expectedChallenge = await getChallenge(env.SESSIONS, challengeKey);
  if (!expectedChallenge) {
    return NextResponse.json({ ok: false, error: 'challenge_expired' }, { status: 400 });
  }

  const passkey = await getPasskeyById(env.DB, response.id);
  if (!passkey) {
    return NextResponse.json({ ok: false, error: 'unknown_credential' }, { status: 400 });
  }

  const expectedOrigin = resolveOrigin(request, env);
  const rpID = new URL(expectedOrigin).hostname;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: toUint8Array(passkey.public_key),
        counter: passkey.counter,
        transports: parseTransports(passkey.transports),
      },
      requireUserVerification: false,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 400 });
  }

  if (!verification.verified || !verification.authenticationInfo) {
    return NextResponse.json({ ok: false, error: 'not_verified' }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  await updatePasskeyUsage(env.DB, passkey.id, verification.authenticationInfo.newCounter, now);
  await deleteChallenge(env.SESSIONS, challengeKey);

  const user = await getUserById(env.DB, passkey.user_id);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'user_missing' }, { status: 400 });
  }

  const jwt = await signSession({ sub: user.id, email: user.email }, env);
  await setSessionCookie(jwt, { secure: cookieSecureFor(request) });

  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for');
  const ipHash = ip ? await hashIP(ip.split(',')[0]!.trim(), env.IP_HASH_SALT) : null;
  await logAudit(env.DB, {
    actor: user.id,
    action: 'login.passkey',
    target: passkey.id,
    ipHash,
  });

  return NextResponse.json({ ok: true, next: '/dashboard' });
}

// clientDataJSON is a base64url-encoded JSON string containing `.challenge`.
// We decode it here so we don't have to trust the top-level `id` as a lookup
// key for the challenge.
function extractChallenge(response: AuthenticationResponseJSON): string | null {
  try {
    const raw = response.response.clientDataJSON;
    const bytes = base64UrlDecode(raw);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as { challenge?: unknown };
    return typeof parsed.challenge === 'string' ? parsed.challenge : null;
  } catch {
    return null;
  }
}

function base64UrlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// simplewebauthn v13 narrowed `publicKey` to `Uint8Array<ArrayBuffer>` (not
// `ArrayBufferLike`). D1 hands BLOBs back as ArrayBuffer, so copy into a fresh
// ArrayBuffer-backed view to satisfy the narrowed type without casts.
function toUint8Array(buf: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const src = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const out = new Uint8Array(new ArrayBuffer(src.byteLength));
  out.set(src);
  return out;
}

function parseTransports(csv: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!csv) return undefined;
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is AuthenticatorTransportFuture => s.length > 0) as AuthenticatorTransportFuture[];
}

type AuthenticatorTransportFuture = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';
