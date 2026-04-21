export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/cf';
import { requireOwnerApi } from '@/lib/guards';
import { deleteLink, logAudit } from '@/lib/db';

// Cap at 200 to match the single-user list page size — bigger batches are a
// sign of something automated we don't want to rubber-stamp here.
const BulkDeleteBody = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export async function POST(request: NextRequest): Promise<Response> {
  const guard = await requireOwnerApi();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = BulkDeleteBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const env = getEnv();
  const { ids } = parsed.data;

  // deleteLink is user-scoped, so an id the owner doesn't own silently no-ops
  // — which is exactly what we want for an idempotent bulk clear. D1 handles
  // parallel single-row DELETEs fine; no need to serialize.
  const results = await Promise.all(
    ids.map((id) => deleteLink(env.DB, id, guard.session.sub)),
  );
  const deleted = results.reduce((acc, ok) => acc + (ok ? 1 : 0), 0);

  await logAudit(env.DB, {
    actor: guard.session.sub,
    action: 'link.bulk_delete',
    target: null,
    meta: { count: ids.length, deleted },
  });

  return NextResponse.json({ deleted });
}
