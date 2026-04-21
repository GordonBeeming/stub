export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/cf';
import { clearSessionCookie, getSession } from '@/lib/auth';
import { logAudit } from '@/lib/db';
import { hashIP } from '@/lib/crypto';


export async function POST(request: NextRequest): Promise<Response> {
  const env = getEnv();
  const session = await getSession(env);

  await clearSessionCookie();

  // Audit the logout even when the session is already absent — that way the
  // trail shows every time the endpoint was hit, not just successful sessions.
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for');
  const ipHash = ip ? await hashIP(ip.split(',')[0]!.trim(), env.IP_HASH_SALT) : null;
  await logAudit(env.DB, {
    actor: session?.sub ?? 'public',
    action: 'logout',
    ipHash,
  });

  return NextResponse.json({ ok: true });
}
