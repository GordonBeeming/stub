// Row types match the SQL schema in migrations/001_init.sql.
// D1 returns unix-second integers as JS numbers; booleans come back as 0/1.

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  created_at: number;
}

export interface PasskeyRow {
  id: string;
  user_id: string;
  public_key: ArrayBuffer;
  counter: number;
  transports: string | null;
  device_label: string | null;
  last_used_at: number | null;
  created_at: number;
}

export interface MagicTokenRow {
  token_hash: string;
  email: string;
  expires_at: number;
  consumed_at: number | null;
  created_at: number;
}

export interface LinkRow {
  id: string;
  user_id: string;
  url: string;
  expires_at: number | null;
  max_clicks: number | null;
  click_count: number;
  disabled: 0 | 1;
  created_at: number;
}

export interface LinkClickRow {
  id: number;
  link_id: string;
  ip_hash: string | null;
  ua_family: string | null;
  referrer_host: string | null;
  country: string | null;
  clicked_at: number;
}

export interface NoteRow {
  id: string;
  user_id: string | null;
  ciphertext: ArrayBuffer;
  iv: ArrayBuffer;
  expires_at: number | null;
  burn_on_read: 0 | 1;
  read_at: number | null;
  created_at: number;
}

export interface AuditRow {
  id: number;
  actor: string | null;
  action: string;
  target: string | null;
  meta: string | null;
  ip_hash: string | null;
  created_at: number;
}

export interface SessionPayload {
  sub: string; // user id
  email: string;
  iat: number;
  exp: number;
}

export type Actor = { kind: 'user'; userId: string } | { kind: 'public' } | { kind: 'system' };

// JSON-friendly shape for WebAuthn credential descriptors. Matches what the
// browser SDK expects when we hand back allowCredentials in auth options.
export type PasskeyTransport = 'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid' | 'smart-card' | 'cable';

export interface PasskeyCredentialDescriptor {
  id: string; // base64url credential id
  type: 'public-key';
  transports?: PasskeyTransport[];
}

export interface InsertPasskeyInput {
  id: string; // base64url credential id
  userId: string;
  publicKey: Uint8Array;
  counter: number;
  transports: string | null; // comma-joined list
  deviceLabel: string | null;
  createdAt: number;
}

export interface AuditInsertInput {
  actor: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown> | null;
  ipHash?: string | null;
}

// --- Link inputs ------------------------------------------------------------

export interface CreateLinkInput {
  id: string;
  userId: string;
  url: string;
  expiresAt: number | null;
  maxClicks: number | null;
}

export interface UpdateLinkPatch {
  url?: string;
  disabled?: boolean;
  expiresAt?: number | null;
  maxClicks?: number | null;
}

export interface ListLinksOptions {
  limit: number;
  cursor?: number | null;
}

export interface RecordClickInput {
  linkId: string;
  ipHash: string | null;
  uaFamily: string | null;
  referrerHost: string | null;
  country: string | null;
  clickedAt: number;
}

// Centralised short-link URL builder. Never concatenate `${siteUrl}/s/${id}`
// inline in a route handler or UI — call this so the shape stays consistent
// and a future base-path change is one edit.
export function buildShortUrl(id: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  return `${base}/s/${id}`;
}

// --- Note inputs ------------------------------------------------------------

// Metadata-only shape for list views. The dashboard must never see ciphertext
// or iv — those are only needed when the viewer actually opens the note, and
// even then the server never sees the key. Listing the blobs would also make
// pagination pages huge for no reason.
export interface NoteMetaRow {
  id: string;
  user_id: string | null;
  expires_at: number | null;
  burn_on_read: 0 | 1;
  read_at: number | null;
  created_at: number;
}

export interface CreateNoteInput {
  id: string;
  userId: string | null;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  expiresAt: number | null;
  burnOnRead: boolean;
}

export interface ListNotesOptions {
  limit: number;
  cursor?: number | null;
}

// Only the id part is used when rendering a viewer URL — the key lives in
// the fragment (`#k=…`) and never touches the server. Kept here so the app
// and the dashboard generate the same shape.
export function buildNoteUrl(id: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  return `${base}/n/${id}`;
}
