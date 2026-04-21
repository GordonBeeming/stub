export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/cf';
import { requireOwnerApi } from '@/lib/guards';
import { deletePasskey, getPasskeysForUser, logAudit } from '@/lib/db';


interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, ctx: RouteContext): Promise<Response> {
  const guard = await requireOwnerApi();
  if (!guard.ok) return guard.response;

  // Credential ids are base64url but arrive URL-encoded in the path segment;
  // Next decodes the dynamic param for us, so `id` is the raw stored value.
  const { id } = await ctx.params;
  const env = getEnv();

  // Refuse to revoke the only remaining passkey. Otherwise the owner loses
  // every way back in and has to fall back to the magic-link recovery path.
  const existing = await getPasskeysForUser(env.DB, guard.session.sub);
  if (existing.length <= 1 && existing.some((p) => p.id === id)) {
    return NextResponse.json({ ok: false, error: 'last_passkey' }, { status: 409 });
  }

  const removed = await deletePasskey(env.DB, id, guard.session.sub);
  if (!removed) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  await logAudit(env.DB, {
    actor: guard.session.sub,
    action: 'passkey.revoke',
    target: id,
  });

  return NextResponse.json({ ok: true });
}
