export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/cf';
import { getPasskeysForUser, getUserByEmail } from '@/lib/db';


// Public endpoint — the login page calls this to decide whether to render the
// passkey button. Single-tenant means there's only one possible answer and
// it isn't sensitive: either the owner has enrolled passkeys or hasn't.
export async function GET(_request: NextRequest): Promise<Response> {
  const env = getEnv();
  const user = await getUserByEmail(env.DB, env.OWNER_EMAIL);
  if (!user) {
    return NextResponse.json({ hasPasskeys: false });
  }
  const passkeys = await getPasskeysForUser(env.DB, user.id);
  return NextResponse.json({ hasPasskeys: passkeys.length > 0 });
}
