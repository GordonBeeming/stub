// Origin resolution. With Hono there's no `getCloudflareContext()` step —
// the env comes from the context and the request is always in hand — so the
// Next-era `getEnv()` / server-component `resolveServerOrigin()` helpers go
// away. Only the request-driven `resolveOrigin` survives, and it's the same
// safety rule: localhost derives from the request, everything else locks to
// env.SITE_URL so a spoofed Host header can't rewrite public-facing URLs
// (magic-link callback URLs, for instance).

export function resolveOrigin(request: Request, env: { SITE_URL?: string }): string {
  const requestUrl = new URL(request.url);
  if (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') {
    return requestUrl.origin;
  }
  if (!env.SITE_URL) throw new Error('SITE_URL must be configured for non-local hosts');
  return env.SITE_URL;
}
