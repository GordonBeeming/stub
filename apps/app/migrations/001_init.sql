-- 001_init.sql — initial schema for stub
-- All timestamps are unix seconds stored as INTEGER.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  device_label TEXT,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_passkeys_user ON passkeys(user_id);

CREATE TABLE magic_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_magic_tokens_expires ON magic_tokens(expires_at);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  expires_at INTEGER,
  max_clicks INTEGER,
  click_count INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_links_user_created ON links(user_id, created_at DESC);
CREATE INDEX idx_links_expires ON links(expires_at);

CREATE TABLE link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  ip_hash TEXT,
  ua_family TEXT,
  referrer_host TEXT,
  country TEXT,
  clicked_at INTEGER NOT NULL
);
CREATE INDEX idx_link_clicks_link_time ON link_clicks(link_id, clicked_at DESC);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  ciphertext BLOB NOT NULL,
  iv BLOB NOT NULL,
  expires_at INTEGER,
  burn_on_read INTEGER NOT NULL DEFAULT 1,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_notes_user_created ON notes(user_id, created_at DESC);
CREATE INDEX idx_notes_expires ON notes(expires_at);

CREATE TABLE audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT,
  action TEXT NOT NULL,
  target TEXT,
  meta TEXT,
  ip_hash TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_audit_created ON audit(created_at DESC);
