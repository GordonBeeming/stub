export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
// RegistrationResponseJSON ships via the transitive @simplewebauthn/types
// package. We import it through the server's deps re-export path to keep
// it on a single dependency, rather than adding a direct pkg dep.
type RegistrationResponseJSON = Parameters<typeof verifyRegistrationResponse>[0]['response'];
import { getEnv, resolveOrigin } from '@/lib/cf';
import { requireOwnerApi } from '@/lib/guards';
import { deleteChallenge, getChallenge } from '@/lib/kv';
import { insertPasskey, logAudit } from '@/lib/db';
import { hashIP } from '@/lib/crypto';


// We accept the browser-SDK JSON shape as-is and let simplewebauthn do the
// structural validation — zod only checks we got an object with the fields
// we'll read for the device-label hint.
const bodySchema = z.object({
  response: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest): Promise<Response> {
  const guard = await requireOwnerApi();
  if (!guard.ok) return guard.response;

  const env = getEnv();

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const challengeKey = `pk:reg:${guard.session.sub}`;
  const expectedChallenge = await getChallenge(env.SESSIONS, challengeKey);
  if (!expectedChallenge) {
    return NextResponse.json({ ok: false, error: 'challenge_expired' }, { status: 400 });
  }

  const expectedOrigin = resolveOrigin(request, env);
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
    return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ ok: false, error: 'not_verified' }, { status: 400 });
  }

  const credential = verification.registrationInfo.credential;
  // simplewebauthn v11 returns `credential.id` as a base64url string and
  // `credential.publicKey` as a Uint8Array (COSE key bytes). We persist both
  // and the running counter so we can detect cloned authenticators later.
  const credentialId = credential.id;
  const publicKey = credential.publicKey;
  const counter = credential.counter;
  const transports = Array.isArray(credential.transports) && credential.transports.length > 0
    ? credential.transports.join(',')
    : null;

  const deviceLabel = labelFromUserAgent(request.headers.get('user-agent'));

  await insertPasskey(env.DB, {
    id: credentialId,
    userId: guard.session.sub,
    publicKey,
    counter,
    transports,
    deviceLabel,
    createdAt: Math.floor(Date.now() / 1000),
  });

  await deleteChallenge(env.SESSIONS, challengeKey);

  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for');
  const ipHash = ip ? await hashIP(ip.split(',')[0]!.trim(), env.IP_HASH_SALT) : null;
  await logAudit(env.DB, {
    actor: guard.session.sub,
    action: 'passkey.register',
    target: credentialId,
    ipHash,
  });

  return NextResponse.json({ ok: true });
}

// Cheap, privacy-preserving device hint derived from the UA string. We don't
// store the raw UA — just a short descriptor the owner can recognize when
// revoking a credential from the dashboard.
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
