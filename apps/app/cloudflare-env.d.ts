// Typed surface for Cloudflare bindings + vars declared in wrangler.toml.
// Bindings are accessed via `c.env.X` in Hono handlers; the Hono app is
// parameterized with `{ Bindings: CloudflareEnv }` so every handler gets
// the typed env without a separate getEnv() helper.

interface CloudflareEnv {
  // Bindings
  DB: D1Database;
  SESSIONS: KVNamespace;
  RATE_LIMIT: KVNamespace;
  BACKUPS?: R2Bucket;
  ASSETS: Fetcher;

  // Vars
  OWNER_EMAIL: string;
  RESEND_FROM: string;
  SITE_URL: string;
  TURNSTILE_SITE_KEY: string;

  // Secrets (set via `wrangler secret put`)
  SESSION_SECRET: string;
  // Previous SESSION_SECRET, kept during a rotation window so cookies signed
  // with the old key still verify. Leave unset outside of rotations.
  SESSION_SECRET_PREV?: string;
  RESEND_API_KEY: string;
  TURNSTILE_SECRET: string;
  IP_HASH_SALT: string;
}
