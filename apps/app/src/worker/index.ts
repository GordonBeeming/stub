import { Hono } from 'hono';
import { marketingRedirect } from './middleware/marketing-redirect';
import { magicRoutes } from './routes/auth/magic';
import { passkeyRoutes } from './routes/auth/passkey';
import { sessionRoutes } from './routes/auth/session';
import { linkRoutes } from './routes/api/links';
import { noteRoutes } from './routes/api/notes';
import { redirectRoutes } from './routes/redirect';
import { runDailyCron } from './lib/cron';

// Top-level Hono app. Each feature area mounts its own sub-app under a
// dedicated prefix so the handlers stay focused and the route tree reads
// like the URL map.
//
// Anything NOT matched here falls through to the assets binding declared
// in wrangler.toml, which serves the React SPA (Workers Assets handles
// SPA fallback via `not_found_handling = "single-page-application"`).
const app = new Hono<{ Bindings: CloudflareEnv }>();

// The marketing pages are canonical at gordonbeeming.com/stub. If a request
// arrives at stub.gordonbeeming.com/stub* we 301 back to the canonical
// host so we never serve two copies of the same content.
app.use('*', marketingRedirect);

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    stack: 'hono+react-spa',
    ts: new Date().toISOString(),
  }),
);

// Public bootstrap config consumed by the SPA on first render. Only safe
// values go here — the Turnstile site key is public by design (it pairs
// with the private secret stored as a wrangler secret), and SITE_URL is
// the canonical app origin the client uses to build share URLs. Secrets
// never land in this payload.
app.get('/api/config', (c) =>
  c.json({
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY,
    siteUrl: c.env.SITE_URL,
  }),
);

// Auth surface — split by sub-flow for clarity. The mount paths mirror the
// old Next routes so the React SPA can keep calling the same URLs.
app.route('/api/auth/magic', magicRoutes);
app.route('/api/auth/passkey', passkeyRoutes);
app.route('/api/auth', sessionRoutes);

// Owner APIs for short links and burn notes.
app.route('/api/links', linkRoutes);
app.route('/api/notes', noteRoutes);

// Public short-link redirect. Every /s/:id request goes through here; the
// SPA router never sees these paths because the Worker responds first.
app.route('/s', redirectRoutes);

// Fall-through to the assets binding. With `not_found_handling =
// "single-page-application"` in wrangler.toml, any unmatched path that
// isn't an existing asset file resolves to the SPA's index.html so
// client-side routing can take over (/dashboard, /stub, /n/:id, etc).
// Without this wildcard, Hono's default 404 handler wins over the SPA
// fallback — even API routes that would otherwise 404 never reach assets.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

// Export a plain ExportedHandler — Hono's fetch is the HTTP entry, and we
// attach a scheduled() hook alongside so wrangler's daily cron trigger
// still gets a handler to call. C7 fills in the real cron body.
export default {
  fetch: app.fetch,

  async scheduled(_controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    // waitUntil keeps the isolate alive through the whole prune + backup
    // run; scheduled() itself can return as soon as the work is in flight.
    ctx.waitUntil(runDailyCron(env));
  },
} satisfies ExportedHandler<CloudflareEnv>;
