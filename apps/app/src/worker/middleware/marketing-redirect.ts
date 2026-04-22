import type { MiddlewareHandler } from 'hono';

// Marketing canonicalisation: gordonbeeming.com/stub is the canonical URL
// (proxied in by cloudflare-xylem-worker), so any direct hit to the app
// host's /stub* paths gets 301'd to the canonical host. Without this,
// crawlers could index duplicate content on two origins and users could
// share links to the non-canonical copy.
const APP_HOST = 'stub.gordonbeeming.com';
const MARKETING_ORIGIN = 'https://gordonbeeming.com';

export const marketingRedirect: MiddlewareHandler<{ Bindings: CloudflareEnv }> = async (c, next) => {
  const host = c.req.header('host');
  if (host !== APP_HOST) return next();

  const url = new URL(c.req.url);
  if (url.pathname !== '/stub' && !url.pathname.startsWith('/stub/')) return next();

  return c.redirect(`${MARKETING_ORIGIN}${url.pathname}${url.search}`, 301);
};
