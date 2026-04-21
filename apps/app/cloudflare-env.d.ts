// Typed surface for Cloudflare bindings + vars declared in wrangler.toml.
// Access in server code via `getEnv()` from `lib/cf.ts`.

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

declare namespace NodeJS {
  // Merges CloudflareEnv bindings into NodeJS.ProcessEnv so process.env.X is
  // typed. The empty body is intentional — this is a declaration-merging
  // extension, not a stand-alone interface with its own members.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ProcessEnv extends Partial<CloudflareEnv> {}
}
