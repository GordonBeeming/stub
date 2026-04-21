export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/cf';
import { requireOwnerApi } from '@/lib/guards';
import { base64UrlEncodeBytes, hashIP } from '@/lib/crypto';
import { burnNote, deleteNote, deleteNoteById, getNoteForRead, logAudit } from '@/lib/db';


// Same 404 body regardless of whether the note never existed, expired, or
// was already burned for a different reader. The viewer UI surfaces a
// friendly "this note is gone" message either way.
const GONE = { ok: false, error: 'gone' } as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json(GONE, { status: 404 });
  }

  const env = getEnv();
  const now = Math.floor(Date.now() / 1000);

  const row = await getNoteForRead(env.DB, id);
  if (!row) {
    return NextResponse.json(GONE, { status: 404 });
  }

  // Expired — delete on read so the bytes are gone immediately, even if
  // the daily prune hasn't run yet. Same status as "never existed" so a
  // poking client can't use timing or messages to distinguish the two.
  if (row.expires_at !== null && row.expires_at < now) {
    await deleteNoteById(env.DB, id);
    return NextResponse.json(GONE, { status: 404 });
  }

  const burnOnRead = row.burn_on_read === 1;

  // Already-burned view: a second reader never sees the plaintext. 410 Gone
  // so callers can tell "this link was valid once" apart from "never was".
  if (burnOnRead && row.read_at !== null) {
    return NextResponse.json({ ok: false, error: 'already_read' }, { status: 410 });
  }

  // Only flip read_at if this is the first reader. burnNote returns false
  // when a concurrent request won the race; treat that branch exactly like
  // the already-burned case above — no ciphertext leaves the server.
  if (burnOnRead) {
    const won = await burnNote(env.DB, id, now);
    if (!won) {
      return NextResponse.json({ ok: false, error: 'already_read' }, { status: 410 });
    }
  }

  const ip = getClientIp(request);
  const ipHash = ip ? await hashIP(ip, env.IP_HASH_SALT) : null;
  await logAudit(env.DB, {
    actor: 'viewer',
    action: 'note.read',
    target: id,
    ipHash,
  });

  return NextResponse.json({
    ciphertext: base64UrlEncodeBytes(new Uint8Array(row.ciphertext)),
    iv: base64UrlEncodeBytes(new Uint8Array(row.iv)),
    expiresAt: row.expires_at,
    burnOnRead,
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireOwnerApi();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const env = getEnv();
  // deleteNote covers both owner-created and public (NULL user_id) rows.
  // The janitor story: the owner is the only human who can purge public
  // notes by id — anonymous callers can't reach this route at all.
  const ok = await deleteNote(env.DB, id, guard.session.sub);
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  await logAudit(env.DB, {
    actor: guard.session.sub,
    action: 'note.delete',
    target: id,
  });

  return NextResponse.json({ ok: true });
}

function getClientIp(request: NextRequest): string | null {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return null;
}
