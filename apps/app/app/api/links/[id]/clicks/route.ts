export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/cf';
import { requireOwnerApi } from '@/lib/guards';
import { getClicksForLink, getLinkForOwner } from '@/lib/db';


const CLICK_LIMIT = 100;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, ctx: RouteContext): Promise<Response> {
  const guard = await requireOwnerApi();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const env = getEnv();

  // Check ownership before returning clicks — the clicks FK cascades from
  // links but doesn't carry user_id itself.
  const link = await getLinkForOwner(env.DB, id, guard.session.sub);
  if (!link) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const clicks = await getClicksForLink(env.DB, id, CLICK_LIMIT);
  return NextResponse.json({ clicks });
}
