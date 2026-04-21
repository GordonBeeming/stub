import { getCloudflareContext } from '@opennextjs/cloudflare';
import { headers } from 'next/headers';

// Thin wrapper so callers never import the adapter directly — keeps the
// binding surface swappable and the import path short.
export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env as CloudflareEnv;
}

export function getCfProperties() {
  return getCloudflareContext().cf;
}

export function getExecutionCtx() {
  return getCloudflareContext().ctx;
}

// Local dev derives the site origin from the incoming request so forkers can
// run stub without editing SITE_URL. Prod locks to env.SITE_URL — a spoofed
// Host header must not be able to redirect a valid magic-link or session
// callback to an attacker-controlled origin.
export function resolveOrigin(request: Request, env: { SITE_URL?: string }): string {
  const requestUrl = new URL(request.url);
  if (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') {
    return requestUrl.origin;
  }
  if (!env.SITE_URL) throw new Error('SITE_URL must be configured for non-local hosts');
  return env.SITE_URL;
}

// Server-component variant — server components don't have a `request` object,
// but they can read the incoming request's headers via `next/headers`. Same
// safety: localhost derives from the request, everything else locks to
// env.SITE_URL so a spoofed Host header can't rewrite public-facing URLs.
export async function resolveServerOrigin(env: { SITE_URL?: string }): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get('host');
  if (host && (host.startsWith('localhost') || host.startsWith('127.0.0.1'))) {
    const proto = hdrs.get('x-forwarded-proto') ?? 'http';
    return `${proto}://${host}`;
  }
  if (!env.SITE_URL) throw new Error('SITE_URL must be configured for non-local hosts');
  return env.SITE_URL;
}
