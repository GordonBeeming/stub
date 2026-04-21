export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/cf';
import { requireOwnerApi } from '@/lib/guards';
import { deleteLink, getLinkForOwner, logAudit, updateLink } from '@/lib/db';


interface RouteContext {
  params: Promise<{ id: string }>;
}

const PatchBody = z.object({
  url: z.url().optional(),
  disabled: z.boolean().optional(),
  expiresAt: z.number().int().positive().nullable().optional(),
  maxClicks: z.number().int().positive().nullable().optional(),
});

export async function PATCH(request: NextRequest, ctx: RouteContext): Promise<Response> {
  const guard = await requireOwnerApi();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const env = getEnv();

  const existing = await getLinkForOwner(env.DB, id, guard.session.sub);
  if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const patch = parsed.data;
  const changed = await updateLink(env.DB, id, guard.session.sub, patch);
  if (!changed) {
    return NextResponse.json({ ok: false, error: 'no_change' }, { status: 400 });
  }

  const updated = await getLinkForOwner(env.DB, id, guard.session.sub);
  await logAudit(env.DB, {
    actor: guard.session.sub,
    action: 'link.update',
    target: id,
    meta: patch as Record<string, unknown>,
  });

  return NextResponse.json({ link: updated });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext): Promise<Response> {
  const guard = await requireOwnerApi();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const env = getEnv();

  const removed = await deleteLink(env.DB, id, guard.session.sub);
  if (!removed) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  await logAudit(env.DB, {
    actor: guard.session.sub,
    action: 'link.delete',
    target: id,
  });

  return NextResponse.json({ ok: true });
}
