import { readBucket, writeBucket } from './kv';

export interface RateLimitOptions {
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// Fixed-window counter in KV. Cheap and good-enough for auth endpoints.
// KV is eventually consistent across regions, so under true burst load the
// effective limit can be ~2x within the window — that's acceptable here.
export async function checkAndIncrement(
  kv: KVNamespace,
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const existing = await readBucket(kv, key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowSec;
    await writeBucket(kv, key, { count: 1, resetAt });
    return { allowed: true, remaining: opts.limit - 1, resetAt };
  }

  if (existing.count >= opts.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  const next = { count: existing.count + 1, resetAt: existing.resetAt };
  await writeBucket(kv, key, next);
  return { allowed: true, remaining: opts.limit - next.count, resetAt: next.resetAt };
}
