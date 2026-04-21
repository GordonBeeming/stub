export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/cf';
import { requireOwnerApi } from '@/lib/guards';
import { base64UrlDecodeToBytes, randomUrlSafeToken } from '@/lib/crypto';
import { createNote, listNotesForUser, logAudit } from '@/lib/db';


// Hard server-side cap on decoded ciphertext. 256 KiB is generous for a
// text note, small enough that a naive caller can't DOS the worker with
// megabyte blobs. AES-GCM adds 16 bytes of auth tag on top of plaintext;
// we check the decoded size, which includes that tag.
const MAX_CIPHERTEXT_BYTES = 256 * 1024;
const AES_GCM_IV_BYTES = 12;

// The server only ever sees opaque base64url blobs. The key that decrypts
// them lives in the URL fragment the creator shares — never in this body,
// never in a header, never in a query string. If you catch yourself adding
// a `key` field here, stop and re-read CLAUDE.md.
const bodySchema = z.object({
  ciphertext: z.string().min(1).max(Math.ceil((MAX_CIPHERTEXT_BYTES * 4) / 3) + 16),
  iv: z.string().min(1).max(64),
  expiresAt: z.number().int().positive().nullable().optional(),
  burnOnRead: z.boolean().optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
  const guard = await requireOwnerApi();
  if (!guard.ok) return guard.response;

  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    parsed = bodySchema.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  let ciphertext: Uint8Array;
  let iv: Uint8Array;
  try {
    ciphertext = base64UrlDecodeToBytes(parsed.ciphertext);
    iv = base64UrlDecodeToBytes(parsed.iv);
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_encoding' }, { status: 400 });
  }

  if (ciphertext.byteLength > MAX_CIPHERTEXT_BYTES) {
    return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 });
  }
  if (iv.byteLength !== AES_GCM_IV_BYTES) {
    return NextResponse.json({ ok: false, error: 'bad_iv' }, { status: 400 });
  }

  const env = getEnv();
  const id = randomUrlSafeToken(16);

  await createNote(env.DB, {
    id,
    userId: guard.session.sub,
    ciphertext,
    iv,
    expiresAt: parsed.expiresAt ?? null,
    burnOnRead: parsed.burnOnRead ?? true,
  });

  await logAudit(env.DB, {
    actor: guard.session.sub,
    action: 'note.create',
    target: id,
    meta: {
      size: ciphertext.byteLength,
      burnOnRead: parsed.burnOnRead ?? true,
      expiresAt: parsed.expiresAt ?? null,
    },
  });

  return NextResponse.json({ id }, { status: 201 });
}

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.coerce.number().int().positive().optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const guard = await requireOwnerApi();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'bad_query' }, { status: 400 });
  }

  const env = getEnv();
  const notes = await listNotesForUser(env.DB, guard.session.sub, {
    limit: parsed.data.limit ?? 50,
    cursor: parsed.data.cursor ?? null,
  });

  // Metadata only — ciphertext never leaves the /api/notes/[id] GET, and
  // that endpoint has its own atomic-burn logic. Handing bytes back here
  // would quietly bypass the burn-on-read invariant.
  return NextResponse.json({ notes });
}
