export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getEnv, resolveOrigin } from '@/lib/cf';
import { requireOwnerApi } from '@/lib/guards';
import { getPasskeysForUser } from '@/lib/db';
import { putChallenge } from '@/lib/kv';


export async function POST(request: NextRequest): Promise<Response> {
  const guard = await requireOwnerApi();
  if (!guard.ok) return guard.response;

  const env = getEnv();
  const rpID = new URL(resolveOrigin(request, env)).hostname;
  const rpName = 'stub';

  const existing = await getPasskeysForUser(env.DB, guard.session.sub);

  const options = await generateRegistrationOptions({
    rpID,
    rpName,
    userID: new TextEncoder().encode(guard.session.sub),
    userName: guard.session.email,
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

  await putChallenge(env.SESSIONS, `pk:reg:${guard.session.sub}`, options.challenge);

  return NextResponse.json(options);
}

function parseTransports(csv: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!csv) return undefined;
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is AuthenticatorTransportFuture => s.length > 0) as AuthenticatorTransportFuture[];
}

// Local alias so we don't need to re-export the simplewebauthn type upstream.
type AuthenticatorTransportFuture = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';
