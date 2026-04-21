export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/cf';
import { requireOwnerApi } from '@/lib/guards';
import { createLink, getLinkById, listLinksForUser, logAudit } from '@/lib/db';
import { newSlug } from '@/lib/crypto';
import { isValidSlug } from '@/lib/links';


const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_SLUG_RETRIES = 3;

export async function GET(request: NextRequest): Promise<Response> {
  const guard = await requireOwnerApi();
  if (!guard.ok) return guard.response;

  const env = getEnv();
  const params = request.nextUrl.searchParams;

  const limitParam = params.get('limit');
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT;
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(MAX_LIMIT, parsedLimit))
    : DEFAULT_LIMIT;

  const cursorParam = params.get('cursor');
  const cursor = cursorParam ? Number.parseInt(cursorParam, 10) : null;
  const safeCursor = cursor !== null && Number.isFinite(cursor) ? cursor : null;

  const links = await listLinksForUser(env.DB, guard.session.sub, {
    limit,
    cursor: safeCursor,
  });
  return NextResponse.json({ links });
}

const CreateBody = z.object({
  url: z.url(),
  slug: z.string().min(3).max(32).optional(),
  expiresAt: z.number().int().positive().nullable().optional(),
  maxClicks: z.number().int().positive().nullable().optional(),
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

  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { url, slug, expiresAt, maxClicks } = parsed.data;

  if (slug !== undefined && !isValidSlug(slug)) {
    return NextResponse.json({ ok: false, error: 'invalid_slug' }, { status: 400 });
  }

  const env = getEnv();

  // Custom slug: one attempt, conflict = 409 so the UI can surface it. Random
  // slug: retry a handful of times in the impossibly-unlikely collision case.
  let chosenId: string | null = null;
  if (slug) {
    const existing = await getLinkById(env.DB, slug);
    if (existing) {
      return NextResponse.json({ ok: false, error: 'slug_taken' }, { status: 409 });
    }
    chosenId = slug;
  } else {
    for (let i = 0; i < MAX_SLUG_RETRIES; i++) {
      const candidate = newSlug();
      const existing = await getLinkById(env.DB, candidate);
      if (!existing) {
        chosenId = candidate;
        break;
      }
    }
    if (!chosenId) {
      return NextResponse.json({ ok: false, error: 'slug_generation_failed' }, { status: 500 });
    }
  }

  const link = await createLink(env.DB, {
    id: chosenId,
    userId: guard.session.sub,
    url,
    expiresAt: expiresAt ?? null,
    maxClicks: maxClicks ?? null,
  });

  await logAudit(env.DB, {
    actor: guard.session.sub,
    action: 'link.create',
    target: link.id,
    meta: { url, expiresAt: link.expires_at, maxClicks: link.max_clicks },
  });

  return NextResponse.json({ link }, { status: 201 });
}
