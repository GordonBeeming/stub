import { Hono } from 'hono';
import { z } from 'zod';
import { requireOwner, type AuthVars } from '../../lib/guards';
import {
  createLink,
  deleteLink,
  getClicksForLink,
  getLinkById,
  getLinkForOwner,
  listLinksForUser,
  logAudit,
  updateLink,
} from '../../lib/db';
import { newSlug } from '../../lib/crypto';
import { isValidSlug } from '../../lib/links';

// All endpoints here are owner-only (the sub-app mounts `requireOwner` once).
// Every handler assumes `c.get('session')` is populated.

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_SLUG_RETRIES = 3;

const CreateBody = z.object({
  url: z.url(),
  slug: z.string().min(3).max(32).optional(),
  expiresAt: z.number().int().positive().nullable().optional(),
  maxClicks: z.number().int().positive().nullable().optional(),
});

const PatchBody = z.object({
  url: z.url().optional(),
  disabled: z.boolean().optional(),
  expiresAt: z.number().int().positive().nullable().optional(),
  maxClicks: z.number().int().positive().nullable().optional(),
});

const BulkDeleteBody = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

const EXPORT_LINK_BATCH = 200;
const EXPORT_CLICKS_PER_LINK = 1000;
const CLICK_LIMIT = 100;

export const linkRoutes = new Hono<{ Bindings: CloudflareEnv; Variables: AuthVars }>();

linkRoutes.use('*', requireOwner);

// GET /api/links — list for owner, paginated by created_at cursor.
linkRoutes.get('/', async (c) => {
  const env = c.env;
  const session = c.get('session');
  const limitParam = c.req.query('limit');
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT;
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(MAX_LIMIT, parsedLimit))
    : DEFAULT_LIMIT;

  const cursorParam = c.req.query('cursor');
  const cursor = cursorParam ? Number.parseInt(cursorParam, 10) : null;
  const safeCursor = cursor !== null && Number.isFinite(cursor) ? cursor : null;

  const links = await listLinksForUser(env.DB, session.sub, { limit, cursor: safeCursor });
  return c.json({ links });
});

// POST /api/links — create a new short link. Slug behavior:
//   - caller-supplied: one attempt; conflict returns 409 so the UI can surface
//     it to the user.
//   - auto-generated: retry up to MAX_SLUG_RETRIES times in the astronomically
//     unlikely event of a collision on the random alphabet.
linkRoutes.post('/', async (c) => {
  const env = c.env;
  const session = c.get('session');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400);
  }

  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid_input', issues: parsed.error.issues }, 400);
  }

  const { url, slug, expiresAt, maxClicks } = parsed.data;

  if (slug !== undefined && !isValidSlug(slug)) {
    return c.json({ ok: false, error: 'invalid_slug' }, 400);
  }

  let chosenId: string | null = null;
  if (slug) {
    const existing = await getLinkById(env.DB, slug);
    if (existing) {
      return c.json({ ok: false, error: 'slug_taken' }, 409);
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
      return c.json({ ok: false, error: 'slug_generation_failed' }, 500);
    }
  }

  const link = await createLink(env.DB, {
    id: chosenId,
    userId: session.sub,
    url,
    expiresAt: expiresAt ?? null,
    maxClicks: maxClicks ?? null,
  });

  await logAudit(env.DB, {
    actor: session.sub,
    action: 'link.create',
    target: link.id,
    meta: { url, expiresAt: link.expires_at, maxClicks: link.max_clicks },
  });

  return c.json({ link }, 201);
});

// POST /api/links/bulk-delete — idempotent mass removal. Capped at 200 ids to
// keep manual UI bulk-selects working while blocking scripts from doing
// thousand-row sweeps through this endpoint.
linkRoutes.post('/bulk-delete', async (c) => {
  const env = c.env;
  const session = c.get('session');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400);
  }

  const parsed = BulkDeleteBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid_input', issues: parsed.error.issues }, 400);
  }

  const { ids } = parsed.data;
  // deleteLink is user-scoped — ids the owner doesn't own silently no-op,
  // which is exactly what we want for an idempotent clear.
  const results = await Promise.all(ids.map((id) => deleteLink(env.DB, id, session.sub)));
  const deleted = results.reduce((acc, ok) => acc + (ok ? 1 : 0), 0);

  await logAudit(env.DB, {
    actor: session.sub,
    action: 'link.bulk_delete',
    target: null,
    meta: { count: ids.length, deleted },
  });

  return c.json({ deleted });
});

// GET /api/links/export — NDJSON stream of every link + its clicks. Rotating
// through page cursors keeps memory bounded even for large libraries.
linkRoutes.get('/export', async (c) => {
  const env = c.env;
  const session = c.get('session');
  const userId = session.sub;

  // Audit first so an interrupted stream still leaves an export record.
  await logAudit(env.DB, { actor: userId, action: 'link.export' });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        let cursor: number | null = null;
        while (true) {
          const links = await listLinksForUser(env.DB, userId, {
            limit: EXPORT_LINK_BATCH,
            cursor,
          });
          if (links.length === 0) break;

          for (const link of links) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'link', row: link }) + '\n'));
            const clicks = await getClicksForLink(env.DB, link.id, EXPORT_CLICKS_PER_LINK);
            for (const click of clicks) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ type: 'click', row: click }) + '\n'),
              );
            }
          }

          const last = links[links.length - 1];
          if (!last || links.length < EXPORT_LINK_BATCH) break;
          cursor = last.created_at;
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'content-disposition': 'attachment; filename="stub-links.jsonl"',
    },
  });
});

// GET /api/links/:id/clicks — analytics per link.
linkRoutes.get('/:id/clicks', async (c) => {
  const env = c.env;
  const session = c.get('session');
  const id = c.req.param('id');

  // Ownership check before returning clicks — the clicks FK cascades from
  // links but doesn't carry user_id itself.
  const link = await getLinkForOwner(env.DB, id, session.sub);
  if (!link) return c.json({ ok: false, error: 'not_found' }, 404);

  const clicks = await getClicksForLink(env.DB, id, CLICK_LIMIT);
  return c.json({ clicks });
});

// PATCH /api/links/:id — partial update for url, disabled, expiresAt, maxClicks.
linkRoutes.patch('/:id', async (c) => {
  const env = c.env;
  const session = c.get('session');
  const id = c.req.param('id');

  const existing = await getLinkForOwner(env.DB, id, session.sub);
  if (!existing) return c.json({ ok: false, error: 'not_found' }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400);
  }

  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid_input', issues: parsed.error.issues }, 400);
  }

  const patch = parsed.data;
  const changed = await updateLink(env.DB, id, session.sub, patch);
  if (!changed) {
    return c.json({ ok: false, error: 'no_change' }, 400);
  }

  const updated = await getLinkForOwner(env.DB, id, session.sub);
  await logAudit(env.DB, {
    actor: session.sub,
    action: 'link.update',
    target: id,
    meta: patch as Record<string, unknown>,
  });

  return c.json({ link: updated });
});

// DELETE /api/links/:id — owner-scoped. Cascades the clicks rows via the FK.
linkRoutes.delete('/:id', async (c) => {
  const env = c.env;
  const session = c.get('session');
  const id = c.req.param('id');

  const removed = await deleteLink(env.DB, id, session.sub);
  if (!removed) return c.json({ ok: false, error: 'not_found' }, 404);

  await logAudit(env.DB, {
    actor: session.sub,
    action: 'link.delete',
    target: id,
  });

  return c.json({ ok: true });
});
