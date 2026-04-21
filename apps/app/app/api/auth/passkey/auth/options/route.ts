export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getEnv, resolveOrigin } from '@/lib/cf';
import { getPasskeysForUser, getUserByEmail } from '@/lib/db';
import { putChallenge } from '@/lib/kv';


export async function POST(request: NextRequest): Promise<Response> {
  const env = getEnv();
  const rpID = new URL(resolveOrigin(request, env)).hostname;

  const user = await getUserByEmail(env.DB, env.OWNER_EMAIL);
  const passkeys = user ? await getPasskeysForUser(env.DB, user.id) : [];

  // If there are no passkeys, we still return valid options with an empty
  // allowCredentials list so the caller can't tell whether the owner has
  // passkeys enrolled — it'll just fail at assertion time.
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

  return NextResponse.json(options);
}

function parseTransports(csv: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!csv) return undefined;
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is AuthenticatorTransportFuture => s.length > 0) as AuthenticatorTransportFuture[];
}

type AuthenticatorTransportFuture = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';
