import { sha256Hex } from './crypto';
import type {
  AuditInsertInput,
  CreateLinkInput,
  CreateNoteInput,
  InsertPasskeyInput,
  LinkClickRow,
  LinkRow,
  ListLinksOptions,
  ListNotesOptions,
  MagicTokenRow,
  NoteMetaRow,
  NoteRow,
  PasskeyRow,
  RecordClickInput,
  UpdateLinkPatch,
  UserRow,
} from './types';

// Auth + user primitives only. Link / note / audit CRUD helpers live with
// their owning agents — add them here, not inline in route handlers.

const MAGIC_TOKEN_TTL_SEC = 60 * 10;

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  const row = await db
    .prepare('SELECT id, email, display_name, created_at FROM users WHERE email = ?1')
    .bind(email.trim().toLowerCase())
    .first<UserRow>();
  return row ?? null;
}

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
  const row = await db
    .prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?1')
    .bind(id)
    .first<UserRow>();
  return row ?? null;
}

export interface UpsertUserInput {
  id: string;
  email: string;
  displayName?: string | null;
}

// INSERT … ON CONFLICT updates display_name if the caller passed one, but
// never touches email (normalized on insert) or created_at.
export async function upsertUser(db: D1Database, input: UpsertUserInput): Promise<UserRow> {
  const now = Math.floor(Date.now() / 1000);
  const email = input.email.trim().toLowerCase();
  await db
    .prepare(
      `INSERT INTO users (id, email, display_name, created_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(email) DO UPDATE SET
         display_name = COALESCE(excluded.display_name, users.display_name)`,
    )
    .bind(input.id, email, input.displayName ?? null, now)
    .run();
  const row = await getUserByEmail(db, email);
  if (!row) throw new Error('upsertUser: row missing after write');
  return row;
}

export interface CreateMagicTokenResult {
  token: string; // raw, returned to caller once so it can be emailed
  tokenHash: string;
  expiresAt: number;
}

export async function createMagicToken(
  db: D1Database,
  email: string,
  rawToken: string,
): Promise<CreateMagicTokenResult> {
  const tokenHash = await sha256Hex(rawToken);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + MAGIC_TOKEN_TTL_SEC;
  await db
    .prepare(
      `INSERT INTO magic_tokens (token_hash, email, expires_at, consumed_at, created_at)
       VALUES (?1, ?2, ?3, NULL, ?4)`,
    )
    .bind(tokenHash, email.trim().toLowerCase(), expiresAt, now)
    .run();
  return { token: rawToken, tokenHash, expiresAt };
}

// Returns the row only if the token exists, has not expired, and has not
// already been consumed. Marks it consumed atomically.
export async function consumeMagicToken(db: D1Database, rawToken: string): Promise<MagicTokenRow | null> {
  const tokenHash = await sha256Hex(rawToken);
  const now = Math.floor(Date.now() / 1000);

  const row = await db
    .prepare('SELECT token_hash, email, expires_at, consumed_at, created_at FROM magic_tokens WHERE token_hash = ?1')
    .bind(tokenHash)
    .first<MagicTokenRow>();
  if (!row) return null;
  if (row.consumed_at !== null) return null;
  if (row.expires_at < now) return null;

  const result = await db
    .prepare('UPDATE magic_tokens SET consumed_at = ?1 WHERE token_hash = ?2 AND consumed_at IS NULL')
    .bind(now, tokenHash)
    .run();
  if (!result.success || result.meta.changes === 0) return null;

  return { ...row, consumed_at: now };
}

export async function pruneExpiredMagicTokens(db: D1Database): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const res = await db.prepare('DELETE FROM magic_tokens WHERE expires_at < ?1').bind(now).run();
  return res.meta.changes ?? 0;
}

// --- Passkeys ---------------------------------------------------------------

export async function getPasskeysForUser(db: D1Database, userId: string): Promise<PasskeyRow[]> {
  const res = await db
    .prepare(
      `SELECT id, user_id, public_key, counter, transports, device_label, last_used_at, created_at
         FROM passkeys WHERE user_id = ?1 ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<PasskeyRow>();
  return res.results ?? [];
}

export async function getPasskeyById(db: D1Database, credentialId: string): Promise<PasskeyRow | null> {
  const row = await db
    .prepare(
      `SELECT id, user_id, public_key, counter, transports, device_label, last_used_at, created_at
         FROM passkeys WHERE id = ?1`,
    )
    .bind(credentialId)
    .first<PasskeyRow>();
  return row ?? null;
}

export async function insertPasskey(db: D1Database, row: InsertPasskeyInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO passkeys (id, user_id, public_key, counter, transports, device_label, last_used_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7)`,
    )
    .bind(
      row.id,
      row.userId,
      row.publicKey,
      row.counter,
      row.transports,
      row.deviceLabel,
      row.createdAt,
    )
    .run();
}

export async function updatePasskeyUsage(
  db: D1Database,
  credentialId: string,
  counter: number,
  now: number,
): Promise<void> {
  await db
    .prepare('UPDATE passkeys SET counter = ?1, last_used_at = ?2 WHERE id = ?3')
    .bind(counter, now, credentialId)
    .run();
}

export async function deletePasskey(db: D1Database, credentialId: string, userId: string): Promise<boolean> {
  const res = await db
    .prepare('DELETE FROM passkeys WHERE id = ?1 AND user_id = ?2')
    .bind(credentialId, userId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

// --- Audit ------------------------------------------------------------------

export async function logAudit(db: D1Database, input: AuditInsertInput): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const metaJson = input.meta ? JSON.stringify(input.meta) : null;
  await db
    .prepare(
      `INSERT INTO audit (actor, action, target, meta, ip_hash, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(input.actor, input.action, input.target ?? null, metaJson, input.ipHash ?? null, now)
    .run();
}

// --- Cron pruning -----------------------------------------------------------
// Maintenance helpers called by the daily scheduled handler. Kept in db.ts so
// every module touching D1 imports from one place; nothing here is
// route-specific.

// Burned notes linger for a day so the "you opened this once" UX still shows
// a helpful message — after that the ciphertext goes away for good.
const BURN_RETENTION_SEC = 86_400;

export async function pruneExpiredNotes(db: D1Database): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const res = await db
    .prepare('DELETE FROM notes WHERE expires_at IS NOT NULL AND expires_at < ?1')
    .bind(now)
    .run();
  return res.meta.changes ?? 0;
}

export async function pruneReadBurnedNotes(db: D1Database): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - BURN_RETENTION_SEC;
  const res = await db
    .prepare('DELETE FROM notes WHERE burn_on_read = 1 AND read_at IS NOT NULL AND read_at < ?1')
    .bind(cutoff)
    .run();
  return res.meta.changes ?? 0;
}

// Soft-disable rather than DELETE: link_clicks rows (and their stats) stay
// intact, so the user can still see what a now-expired short link did.
export async function disableExpiredLinks(db: D1Database): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const res = await db
    .prepare('UPDATE links SET disabled = 1 WHERE disabled = 0 AND expires_at IS NOT NULL AND expires_at < ?1')
    .bind(now)
    .run();
  return res.meta.changes ?? 0;
}

// --- Table dump (for R2 backup) --------------------------------------------

// D1 returns BLOB columns as ArrayBuffer; JSON.stringify turns those into
// `{}`. Convert to base64 so the JSONL dump is faithful and restorable.
function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof ArrayBuffer) {
      out[key] = { $b64: arrayBufferToBase64(value) };
    } else if (value instanceof Uint8Array) {
      out[key] = { $b64: arrayBufferToBase64(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer) };
    } else {
      out[key] = value;
    }
  }
  return out;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export async function dumpTableJsonl(db: D1Database, table: string): Promise<string> {
  // SQLite identifiers can't be bound as parameters. `table` is never user
  // input here — the caller passes a constant from a whitelist in cron.ts.
  const res = await db.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>();
  const rows = res.results ?? [];
  return rows.map((row) => JSON.stringify({ table, row: serializeRow(row) })).join('\n');
}

// --- Links ------------------------------------------------------------------

const LINK_COLS =
  'id, user_id, url, expires_at, max_clicks, click_count, disabled, created_at';

export async function createLink(db: D1Database, input: CreateLinkInput): Promise<LinkRow> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO links (id, user_id, url, expires_at, max_clicks, click_count, disabled, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, ?6)`,
    )
    .bind(input.id, input.userId, input.url, input.expiresAt, input.maxClicks, now)
    .run();
  const row = await getLinkById(db, input.id);
  if (!row) throw new Error('createLink: row missing after insert');
  return row;
}

export async function getLinkById(db: D1Database, id: string): Promise<LinkRow | null> {
  const row = await db
    .prepare(`SELECT ${LINK_COLS} FROM links WHERE id = ?1`)
    .bind(id)
    .first<LinkRow>();
  return row ?? null;
}

// Owner-scoped read. Returns null whether the row is missing or belongs to a
// different user — the caller can't tell the difference, which is the point.
export async function getLinkForOwner(
  db: D1Database,
  id: string,
  userId: string,
): Promise<LinkRow | null> {
  const row = await db
    .prepare(`SELECT ${LINK_COLS} FROM links WHERE id = ?1 AND user_id = ?2`)
    .bind(id, userId)
    .first<LinkRow>();
  return row ?? null;
}

export async function listLinksForUser(
  db: D1Database,
  userId: string,
  opts: ListLinksOptions,
): Promise<LinkRow[]> {
  const limit = Math.max(1, Math.min(200, Math.floor(opts.limit)));
  if (opts.cursor !== null && opts.cursor !== undefined) {
    const res = await db
      .prepare(
        `SELECT ${LINK_COLS} FROM links
           WHERE user_id = ?1 AND created_at < ?2
           ORDER BY created_at DESC LIMIT ?3`,
      )
      .bind(userId, opts.cursor, limit)
      .all<LinkRow>();
    return res.results ?? [];
  }
  const res = await db
    .prepare(
      `SELECT ${LINK_COLS} FROM links
         WHERE user_id = ?1
         ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<LinkRow>();
  return res.results ?? [];
}

// Returns true iff the row existed, belonged to userId, and at least one
// field changed. Empty patches resolve to false without touching D1.
export async function updateLink(
  db: D1Database,
  id: string,
  userId: string,
  patch: UpdateLinkPatch,
): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.url !== undefined) {
    sets.push(`url = ?${idx++}`);
    values.push(patch.url);
  }
  if (patch.disabled !== undefined) {
    sets.push(`disabled = ?${idx++}`);
    values.push(patch.disabled ? 1 : 0);
  }
  if (patch.expiresAt !== undefined) {
    sets.push(`expires_at = ?${idx++}`);
    values.push(patch.expiresAt);
  }
  if (patch.maxClicks !== undefined) {
    sets.push(`max_clicks = ?${idx++}`);
    values.push(patch.maxClicks);
  }

  if (sets.length === 0) return false;

  const idBinding = idx++;
  const userBinding = idx++;
  values.push(id, userId);

  const res = await db
    .prepare(
      `UPDATE links SET ${sets.join(', ')} WHERE id = ?${idBinding} AND user_id = ?${userBinding}`,
    )
    .bind(...values)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function deleteLink(db: D1Database, id: string, userId: string): Promise<boolean> {
  // link_clicks rows cascade via FK (ON DELETE CASCADE in the schema).
  const res = await db
    .prepare('DELETE FROM links WHERE id = ?1 AND user_id = ?2')
    .bind(id, userId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

// Batched so the insert + counter bump land in one round-trip. The counter is
// incremented with a read-free UPDATE so concurrent clicks can't lose a count.
export async function recordClick(db: D1Database, click: RecordClickInput): Promise<void> {
  const insert = db
    .prepare(
      `INSERT INTO link_clicks (link_id, ip_hash, ua_family, referrer_host, country, clicked_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(
      click.linkId,
      click.ipHash,
      click.uaFamily,
      click.referrerHost,
      click.country,
      click.clickedAt,
    );
  const bump = db
    .prepare('UPDATE links SET click_count = click_count + 1 WHERE id = ?1')
    .bind(click.linkId);
  await db.batch([insert, bump]);
}

export async function getClicksForLink(
  db: D1Database,
  linkId: string,
  limit: number,
): Promise<LinkClickRow[]> {
  const cap = Math.max(1, Math.min(500, Math.floor(limit)));
  const res = await db
    .prepare(
      `SELECT id, link_id, ip_hash, ua_family, referrer_host, country, clicked_at
         FROM link_clicks WHERE link_id = ?1 ORDER BY clicked_at DESC LIMIT ?2`,
    )
    .bind(linkId, cap)
    .all<LinkClickRow>();
  return res.results ?? [];
}

// --- Notes ------------------------------------------------------------------

const NOTE_META_COLS =
  'id, user_id, expires_at, burn_on_read, read_at, created_at';
const NOTE_FULL_COLS =
  'id, user_id, ciphertext, iv, expires_at, burn_on_read, read_at, created_at';

export async function createNote(db: D1Database, input: CreateNoteInput): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO notes (id, user_id, ciphertext, iv, expires_at, burn_on_read, read_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7)`,
    )
    .bind(
      input.id,
      input.userId,
      input.ciphertext,
      input.iv,
      input.expiresAt,
      input.burnOnRead ? 1 : 0,
      now,
    )
    .run();
}

// Loads the full row including ciphertext/iv. Callers that only need
// metadata (list views, janitor logic) must use listNotesForUser or the
// audit path — never hand this row back to a list endpoint.
export async function getNoteForRead(db: D1Database, id: string): Promise<NoteRow | null> {
  const row = await db
    .prepare(`SELECT ${NOTE_FULL_COLS} FROM notes WHERE id = ?1`)
    .bind(id)
    .first<NoteRow>();
  return row ?? null;
}

// Atomic burn. Returns true iff this call was the one that flipped read_at
// from NULL, so the caller can safely hand back ciphertext exactly once
// even under concurrent readers racing on the same id.
export async function burnNote(db: D1Database, id: string, now: number): Promise<boolean> {
  const res = await db
    .prepare('UPDATE notes SET read_at = ?1 WHERE id = ?2 AND read_at IS NULL')
    .bind(now, id)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function deleteNoteById(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare('DELETE FROM notes WHERE id = ?1').bind(id).run();
  return (res.meta.changes ?? 0) > 0;
}

export async function listNotesForUser(
  db: D1Database,
  userId: string,
  opts: ListNotesOptions,
): Promise<NoteMetaRow[]> {
  const limit = Math.max(1, Math.min(200, Math.floor(opts.limit)));
  if (opts.cursor !== null && opts.cursor !== undefined) {
    const res = await db
      .prepare(
        `SELECT ${NOTE_META_COLS} FROM notes
           WHERE user_id = ?1 AND created_at < ?2
           ORDER BY created_at DESC LIMIT ?3`,
      )
      .bind(userId, opts.cursor, limit)
      .all<NoteMetaRow>();
    return res.results ?? [];
  }
  const res = await db
    .prepare(
      `SELECT ${NOTE_META_COLS} FROM notes
         WHERE user_id = ?1
         ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<NoteMetaRow>();
  return res.results ?? [];
}

// Owner deletion. The `OR user_id IS NULL` branch stays as a safety net so
// the owner can still sweep any legacy NULL-owner rows left over from an
// earlier version that allowed anonymous note creation. Current code never
// inserts with user_id = NULL. When ownerUserId is null the call is refused
// outright so no anonymous path can ever trigger deletion.
export async function deleteNote(
  db: D1Database,
  id: string,
  ownerUserId: string | null,
): Promise<boolean> {
  if (ownerUserId === null) return false;
  const res = await db
    .prepare('DELETE FROM notes WHERE id = ?1 AND (user_id = ?2 OR user_id IS NULL)')
    .bind(id, ownerUserId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}
