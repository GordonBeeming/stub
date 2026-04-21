// KV is ephemeral state only: sessions and rate-limit counters. Durable
// data lives in D1. Don't mix them.

const SESSION_TTL_SEC = 60 * 60 * 24 * 30;

export interface StoredSession {
  userId: string;
  email: string;
  createdAt: number;
}

function sessionKey(jti: string): string {
  return `sess:${jti}`;
}

export async function putSession(kv: KVNamespace, jti: string, value: StoredSession): Promise<void> {
  await kv.put(sessionKey(jti), JSON.stringify(value), { expirationTtl: SESSION_TTL_SEC });
}

export async function getSessionStore(kv: KVNamespace, jti: string): Promise<StoredSession | null> {
  const raw = await kv.get(sessionKey(jti));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function deleteSession(kv: KVNamespace, jti: string): Promise<void> {
  await kv.delete(sessionKey(jti));
}

export interface RateLimitBucket {
  count: number;
  resetAt: number; // unix seconds
}

function rateKey(key: string): string {
  return `rl:${key}`;
}

export async function readBucket(kv: KVNamespace, key: string): Promise<RateLimitBucket | null> {
  const raw = await kv.get(rateKey(key));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RateLimitBucket;
  } catch {
    return null;
  }
}

export async function writeBucket(kv: KVNamespace, key: string, bucket: RateLimitBucket): Promise<void> {
  const ttl = Math.max(1, bucket.resetAt - Math.floor(Date.now() / 1000));
  await kv.put(rateKey(key), JSON.stringify(bucket), { expirationTtl: ttl });
}

// --- WebAuthn challenges ----------------------------------------------------
// Challenges live in KV only. Never D1 (they're ephemeral), never cookies
// (we don't want them readable client-side, and they'd leak across tabs).

const CHALLENGE_TTL_SEC = 60 * 5;

export async function putChallenge(kv: KVNamespace, key: string, challenge: string): Promise<void> {
  await kv.put(key, challenge, { expirationTtl: CHALLENGE_TTL_SEC });
}

export async function getChallenge(kv: KVNamespace, key: string): Promise<string | null> {
  return kv.get(key);
}

export async function deleteChallenge(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(key);
}
