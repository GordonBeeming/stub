import { Hono } from 'hono';
import { z } from 'zod';
import { checkOwner, requireOwner, type AuthVars } from '../../lib/guards';
import {
  base64UrlDecodeToBytes,
  base64UrlEncodeBytes,
  hashIP,
  randomUrlSafeToken,
} from '../../lib/crypto';
import {
  burnNote,
  createNote,
  deleteNote,
  deleteNoteById,
  getNoteForRead,
  listNotesForUser,
  logAudit,
} from '../../lib/db';
import { clientIP } from '../../lib/links';

// The note read endpoint (GET /:id) is intentionally NOT behind requireOwner
// — anyone with the URL + fragment key should be able to read their one-shot
// note. Owner-only endpoints use explicit guards inline so the read path
// stays open.

// Hard server-side cap on decoded ciphertext. 256 KiB is generous for a text
// note, small enough that a naive caller can't DOS with megabyte blobs.
const MAX_CIPHERTEXT_BYTES = 256 * 1024;
const AES_GCM_IV_BYTES = 12;

// The server only ever sees opaque base64url blobs. The key that decrypts
// them lives in the URL fragment the creator shares — never in this body,
// never in a header, never in a query string.
const CreateBody = z.object({
  ciphertext: z.string().min(1).max(Math.ceil((MAX_CIPHERTEXT_BYTES * 4) / 3) + 16),
  iv: z.string().min(1).max(64),
  expiresAt: z.number().int().positive().nullable().optional(),
  burnOnRead: z.boolean().optional(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.coerce.number().int().positive().optional(),
});

const BulkDeleteBody = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

const GONE = { ok: false, error: 'gone' } as const;

export const noteRoutes = new Hono<{ Bindings: CloudflareEnv; Variables: AuthVars }>();

// POST /api/notes — owner-only. Stores ciphertext + iv only; never sees the
// key. Audit entry records size + burn/expire metadata for spot-checking
// activity without revealing content.
noteRoutes.post('/', requireOwner, async (c) => {
  const env = c.env;
  const session = c.get('session');

  let parsed: z.infer<typeof CreateBody>;
  try {
    parsed = CreateBody.parse(await c.req.json());
  } catch {
    return c.json({ ok: false, error: 'bad_request' }, 400);
  }

  let ciphertext: Uint8Array;
  let iv: Uint8Array;
  try {
    ciphertext = base64UrlDecodeToBytes(parsed.ciphertext);
    iv = base64UrlDecodeToBytes(parsed.iv);
  } catch {
    return c.json({ ok: false, error: 'bad_encoding' }, 400);
  }

  if (ciphertext.byteLength > MAX_CIPHERTEXT_BYTES) {
    return c.json({ ok: false, error: 'too_large' }, 413);
  }
  if (iv.byteLength !== AES_GCM_IV_BYTES) {
    return c.json({ ok: false, error: 'bad_iv' }, 400);
  }

  const id = randomUrlSafeToken(16);

  await createNote(env.DB, {
    id,
    userId: session.sub,
    ciphertext,
    iv,
    expiresAt: parsed.expiresAt ?? null,
    burnOnRead: parsed.burnOnRead ?? true,
  });

  await logAudit(env.DB, {
    actor: session.sub,
    action: 'note.create',
    target: id,
    meta: {
      size: ciphertext.byteLength,
      burnOnRead: parsed.burnOnRead ?? true,
      expiresAt: parsed.expiresAt ?? null,
    },
  });

  return c.json({ id }, 201);
});

// GET /api/notes — owner-only list. Returns metadata only; ciphertext stays
// on the single-shot read endpoint so listing a note never implicitly burns
// it.
noteRoutes.get('/', requireOwner, async (c) => {
  const env = c.env;
  const session = c.get('session');

  const parsed = listQuerySchema.safeParse({
    limit: c.req.query('limit'),
    cursor: c.req.query('cursor'),
  });
  if (!parsed.success) {
    return c.json({ ok: false, error: 'bad_query' }, 400);
  }

  const notes = await listNotesForUser(env.DB, session.sub, {
    limit: parsed.data.limit ?? 50,
    cursor: parsed.data.cursor ?? null,
  });
  return c.json({ notes });
});

// POST /api/notes/bulk-delete — mirror of links bulk-delete; owner-only.
noteRoutes.post('/bulk-delete', requireOwner, async (c) => {
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
  const results = await Promise.all(ids.map((id) => deleteNote(env.DB, id, session.sub)));
  const deleted = results.reduce((acc, ok) => acc + (ok ? 1 : 0), 0);

  await logAudit(env.DB, {
    actor: session.sub,
    action: 'note.bulk_delete',
    target: null,
    meta: { count: ids.length, deleted },
  });

  return c.json({ deleted });
});

// GET /api/notes/:id — public viewer endpoint. Atomically flips read_at the
// first time through for burn-on-read notes; a concurrent second request
// returns 410 Gone so it's clear to the caller "this existed once".
noteRoutes.get('/:id', async (c) => {
  const env = c.env;
  const id = c.req.param('id');
  if (!id || id.length > 64) {
    return c.json(GONE, 404);
  }

  const now = Math.floor(Date.now() / 1000);

  const row = await getNoteForRead(env.DB, id);
  if (!row) return c.json(GONE, 404);

  // Expired — delete on read so the bytes are gone immediately, even if the
  // daily prune hasn't run yet. Same status as "never existed" so a probing
  // client can't tell the two cases apart.
  if (row.expires_at !== null && row.expires_at < now) {
    await deleteNoteById(env.DB, id);
    return c.json(GONE, 404);
  }

  const burnOnRead = row.burn_on_read === 1;

  if (burnOnRead && row.read_at !== null) {
    return c.json({ ok: false, error: 'already_read' }, 410);
  }

  if (burnOnRead) {
    const won = await burnNote(env.DB, id, now);
    if (!won) {
      return c.json({ ok: false, error: 'already_read' }, 410);
    }
  }

  const ip = clientIP(c.req.raw.headers);
  const ipHash = ip ? await hashIP(ip, env.IP_HASH_SALT) : null;
  await logAudit(env.DB, {
    actor: 'viewer',
    action: 'note.read',
    target: id,
    ipHash,
  });

  return c.json({
    ciphertext: base64UrlEncodeBytes(new Uint8Array(row.ciphertext)),
    iv: base64UrlEncodeBytes(new Uint8Array(row.iv)),
    expiresAt: row.expires_at,
    burnOnRead,
  });
});

// DELETE /api/notes/:id — owner-only. Uses checkOwner rather than the
// middleware so the public-facing GET on the same path stays reachable.
noteRoutes.delete('/:id', async (c) => {
  const guard = await checkOwner(c);
  if (!guard.ok) return guard.response;

  const env = c.env;
  const id = c.req.param('id');
  if (!id) return c.json({ ok: false, error: 'bad_request' }, 400);

  const ok = await deleteNote(env.DB, id, guard.session.sub);
  if (!ok) return c.json({ ok: false, error: 'not_found' }, 404);

  await logAudit(env.DB, {
    actor: guard.session.sub,
    action: 'note.delete',
    target: id,
  });

  return c.json({ ok: true });
});
