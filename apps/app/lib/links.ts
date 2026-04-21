// Link-feature utilities shared across the `/s/:id` public handler and the
// owner-facing API. Nothing here touches D1 directly — DB access goes through
// `lib/db.ts`.

const SLUG_RE = /^[a-z0-9-]+$/;
const SLUG_MIN = 3;
const SLUG_MAX = 32;

export function isValidSlug(input: string): boolean {
  if (input.length < SLUG_MIN || input.length > SLUG_MAX) return false;
  return SLUG_RE.test(input);
}

// Coarse UA family bucket. We intentionally don't parse into browser/version
// — per-click analytics here is aggregate, not forensic.
export function uaFamily(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) return 'bot';
  if (ua.includes('curl') || ua.includes('wget') || ua.includes('httpie')) return 'cli';
  if (ua.includes('ipad')) return 'tablet';
  if (ua.includes('iphone') || ua.includes('android')) return 'mobile';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'desktop-mac';
  if (ua.includes('windows')) return 'desktop-win';
  if (ua.includes('linux')) return 'desktop-linux';
  return 'other';
}

// Referrer host only — never the full URL. Keeps the data collected per click
// to the minimum needed for "where did traffic come from".
export function referrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer);
    return u.hostname || null;
  } catch {
    return null;
  }
}

export function clientIP(headers: Headers): string | null {
  const direct = headers.get('cf-connecting-ip');
  if (direct) return direct.trim();
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return null;
}
