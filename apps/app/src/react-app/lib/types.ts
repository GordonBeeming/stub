// Row types mirrored from the worker's lib/types.ts. Copied rather than
// imported so the SPA chunk doesn't pull in any Worker-side code.

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

export interface NoteMetaRow {
  id: string;
  user_id: string | null;
  expires_at: number | null;
  burn_on_read: 0 | 1;
  read_at: number | null;
  created_at: number;
}

// The passkey-list endpoint deliberately omits public_key (it's a BLOB the
// client has no use for), so the SPA-side row shape drops that field.
export interface PasskeyRow {
  id: string;
  user_id: string;
  counter: number;
  transports: string | null;
  device_label: string | null;
  last_used_at: number | null;
  created_at: number;
}

export function buildShortUrl(id: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  return `${base}/s/${id}`;
}
