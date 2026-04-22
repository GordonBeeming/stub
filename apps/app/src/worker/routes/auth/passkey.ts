import { Hono } from 'hono';
import { z } from 'zod';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { resolveOrigin } from '../../lib/cf';
import { setSessionCookie, signSession } from '../../lib/auth';
import { requireOwner, type AuthVars } from '../../lib/guards';
import {
  deletePasskey,
  getPasskeyById,
  getPasskeysForUser,
  getUserById,
  getUserByEmail,
  insertPasskey,
  logAudit,
  updatePasskeyUsage,
} from '../../lib/db';
import { deleteChallenge, getChallenge, putChallenge } from '../../lib/kv';
import { clientIP } from '../../lib/links';
import { hashIP } from '../../lib/crypto';

// Pulled off the functions' own parameter types so we don't take a direct
// dep on @simplewebauthn/types — it's only present transitively.
type RegistrationResponseJSON = Parameters<typeof verifyRegistrationResponse>[0]['response'];
type AuthenticationResponseJSON = Parameters<typeof verifyAuthenticationResponse>[0]['response'];

type AuthenticatorTransportFuture = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';

function parseTransports(csv: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!csv) return undefined;
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is AuthenticatorTransportFuture => s.length > 0) as AuthenticatorTransportFuture[];
}

// simplewebauthn v13 narrowed `publicKey` to `Uint8Array<ArrayBuffer>`. D1
// hands BLOBs back as ArrayBuffer; copy into a fresh ArrayBuffer-backed view
// so the narrowed type is satisfied without a cast.
function toUint8Array(buf: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const src = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const out = new Uint8Array(new ArrayBuffer(src.byteLength));
  out.set(src);
  return out;
}

function base64UrlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// clientDataJSON is a base64url-encoded JSON string containing `.challenge`.
// Decoding it here avoids trusting the top-level `id` as a lookup key.
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

function labelFromUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  const lc = ua.toLowerCase();
  if (lc.includes('iphone')) return 'iPhone';
  if (lc.includes('ipad')) return 'iPad';
  if (lc.includes('android')) return 'Android';
  if (lc.includes('mac os x') || lc.includes('macintosh')) return 'Mac';
  if (lc.includes('windows')) return 'Windows';
  if (lc.includes('linux')) return 'Linux';
  return null;
}

const registerVerifyBody = z.object({
  response: z.record(z.string(), z.unknown()),
});

const authVerifyBody = z.object({
  response: z
    .object({
      id: z.string(),
      rawId: z.string(),
      type: z.literal('public-key'),
      response: z.record(z.string(), z.unknown()),
      clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
      authenticatorAttachment: z.string().optional(),
    })
    .passthrough(),
});

export const passkeyRoutes = new Hono<{ Bindings: CloudflareEnv; Variables: AuthVars }>();

// --- Listing ---------------------------------------------------------------
// GET /api/auth/passkey — owner-only. Replaces the server-component DB call
// the Next /dashboard/settings page made directly. Returns rows the SPA can
// render as a list; the public_key blob is omitted because it's useless to
// the client and just bloats the payload.

passkeyRoutes.get('/', requireOwner, async (c) => {
  const env = c.env;
  const session = c.get('session');
  const rows = await getPasskeysForUser(env.DB, session.sub);
  const passkeys = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    counter: row.counter,
    transports: row.transports,
    device_label: row.device_label,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
  }));
  return c.json({ passkeys });
});

// --- Registration -----------------------------------------------------------

passkeyRoutes.post('/register/options', requireOwner, async (c) => {
  const env = c.env;
  const session = c.get('session');
  const rpID = new URL(resolveOrigin(c.req.raw, env)).hostname;
  const rpName = 'stub';

  const existing = await getPasskeysForUser(env.DB, session.sub);

  const options = await generateRegistrationOptions({
    rpID,
    rpName,
    userID: new TextEncoder().encode(session.sub),
    userName: session.email,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
    // Prevent re-registering an existing credential on the same authenticator.
    excludeCredentials: existing.map((p) => ({
      id: p.id,
      transports: parseTransports(p.transports),
    })),
  });

  await putChallenge(env.SESSIONS, `pk:reg:${session.sub}`, options.challenge);

  return c.json(options);
});

passkeyRoutes.post('/register/verify', requireOwner, async (c) => {
  const env = c.env;
  const session = c.get('session');

  let parsed: z.infer<typeof registerVerifyBody>;
  try {
    parsed = registerVerifyBody.parse(await c.req.json());
  } catch {
    return c.json({ ok: false, error: 'invalid_body' }, 400);
  }

  const challengeKey = `pk:reg:${session.sub}`;
  const expectedChallenge = await getChallenge(env.SESSIONS, challengeKey);
  if (!expectedChallenge) {
    return c.json({ ok: false, error: 'challenge_expired' }, 400);
  }

  const expectedOrigin = resolveOrigin(c.req.raw, env);
  const rpID = new URL(expectedOrigin).hostname;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.response as unknown as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch {
    return c.json({ ok: false, error: 'verification_failed' }, 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ ok: false, error: 'not_verified' }, 400);
  }

  const credential = verification.registrationInfo.credential;
  const credentialId = credential.id;
  const publicKey = credential.publicKey;
  const counter = credential.counter;
  const transports =
    Array.isArray(credential.transports) && credential.transports.length > 0
      ? credential.transports.join(',')
      : null;

  const deviceLabel = labelFromUserAgent(c.req.header('user-agent') ?? null);

  await insertPasskey(env.DB, {
    id: credentialId,
    userId: session.sub,
    publicKey,
    counter,
    transports,
    deviceLabel,
    createdAt: Math.floor(Date.now() / 1000),
  });

  await deleteChallenge(env.SESSIONS, challengeKey);

  const ip = clientIP(c.req.raw.headers);
  const ipHash = ip ? await hashIP(ip, env.IP_HASH_SALT) : null;
  await logAudit(env.DB, {
    actor: session.sub,
    action: 'passkey.register',
    target: credentialId,
    ipHash,
  });

  return c.json({ ok: true });
});

// --- Authentication ---------------------------------------------------------

passkeyRoutes.post('/auth/options', async (c) => {
  const env = c.env;
  const rpID = new URL(resolveOrigin(c.req.raw, env)).hostname;

  const user = await getUserByEmail(env.DB, env.OWNER_EMAIL);
  const passkeys = user ? await getPasskeysForUser(env.DB, user.id) : [];

  // When no passkeys are enrolled we still return valid options with an empty
  // allowCredentials list so the caller can't tell whether the owner has
  // passkeys yet — it'll just fail at assertion time.
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: passkeys.map((p) => ({
      id: p.id,
      transports: parseTransports(p.transports),
    })),
  });

  // Keyed by challenge so verify can look it up without a session cookie.
  await putChallenge(env.SESSIONS, `pk:auth:${options.challenge}`, options.challenge);

  return c.json(options);
});

passkeyRoutes.post('/auth/verify', async (c) => {
  const env = c.env;

  let parsed: z.infer<typeof authVerifyBody>;
  try {
    parsed = authVerifyBody.parse(await c.req.json());
  } catch {
    return c.json({ ok: false, error: 'invalid_body' }, 400);
  }

  const response = parsed.response as unknown as AuthenticationResponseJSON;

  const challenge = extractChallenge(response);
  if (!challenge) {
    return c.json({ ok: false, error: 'missing_challenge' }, 400);
  }

  const challengeKey = `pk:auth:${challenge}`;
  const expectedChallenge = await getChallenge(env.SESSIONS, challengeKey);
  if (!expectedChallenge) {
    return c.json({ ok: false, error: 'challenge_expired' }, 400);
  }

  const passkey = await getPasskeyById(env.DB, response.id);
  if (!passkey) {
    return c.json({ ok: false, error: 'unknown_credential' }, 400);
  }

  const expectedOrigin = resolveOrigin(c.req.raw, env);
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
    return c.json({ ok: false, error: 'verification_failed' }, 400);
  }

  if (!verification.verified || !verification.authenticationInfo) {
    return c.json({ ok: false, error: 'not_verified' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  await updatePasskeyUsage(env.DB, passkey.id, verification.authenticationInfo.newCounter, now);
  await deleteChallenge(env.SESSIONS, challengeKey);

  const user = await getUserById(env.DB, passkey.user_id);
  if (!user) {
    return c.json({ ok: false, error: 'user_missing' }, 400);
  }

  const jwt = await signSession({ sub: user.id, email: user.email }, env);
  setSessionCookie(c, jwt);

  const ip = clientIP(c.req.raw.headers);
  const ipHash = ip ? await hashIP(ip, env.IP_HASH_SALT) : null;
  await logAudit(env.DB, {
    actor: user.id,
    action: 'login.passkey',
    target: passkey.id,
    ipHash,
  });

  return c.json({ ok: true, next: '/dashboard' });
});

// --- Revocation -------------------------------------------------------------
// DELETE /api/auth/passkey/:id — owner-scoped. Refuses to revoke the last
// remaining passkey so the owner never loses every way back in; the recovery
// path is still the magic link, but accidentally locking yourself out via the
// dashboard would be a bad UX.

passkeyRoutes.delete('/:id', requireOwner, async (c) => {
  const env = c.env;
  const session = c.get('session');
  const id = c.req.param('id');

  const existing = await getPasskeysForUser(env.DB, session.sub);
  if (existing.length <= 1 && existing.some((p) => p.id === id)) {
    return c.json({ ok: false, error: 'last_passkey' }, 409);
  }

  const removed = await deletePasskey(env.DB, id, session.sub);
  if (!removed) return c.json({ ok: false, error: 'not_found' }, 404);

  await logAudit(env.DB, {
    actor: session.sub,
    action: 'passkey.revoke',
    target: id,
  });

  return c.json({ ok: true });
});
