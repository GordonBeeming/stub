import { CLIBlock, Feat, FeatGrid, Token } from '@gordonbeeming/design-system';

export const metadata = {
  title: 'stub — setup guide',
  description:
    'Clone stub, point it at your own Cloudflare account, and ship your own short-link and burn-note service in under half an hour.',
};

const pageTitle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: 'clamp(28px, 4vw, 34px)',
  letterSpacing: '-0.01em',
  lineHeight: 1.2,
  color: 'var(--text)',
  margin: '0 0 16px',
};

const sectionTitle: React.CSSProperties = {
  ...pageTitle,
  fontSize: 'clamp(20px, 2.6vw, 24px)',
  margin: '0 0 12px',
};

const lead: React.CSSProperties = {
  color: 'var(--text-2)',
  fontSize: 17,
  lineHeight: 1.55,
  maxWidth: '60ch',
  margin: '0 0 24px',
};

const body: React.CSSProperties = {
  color: 'var(--text-2)',
  fontSize: 15,
  lineHeight: 1.65,
  maxWidth: '66ch',
  margin: '0 0 16px',
};

const section: React.CSSProperties = { margin: '64px 0' };

export default function SetupGuidePage() {
  return (
    <>
      <header style={{ padding: '24px 0 48px' }}>
        <h1 style={pageTitle}>Ship your own stub on your own Cloudflare.</h1>
        <p style={lead}>
          Roughly twenty minutes from a fresh clone to your first link. You&apos;ll need Node
          20+ and pnpm, a Cloudflare account with a domain attached, and the email you want to
          sign in with.
        </p>
      </header>

      <section style={section}>
        <h2 style={sectionTitle}>Prerequisites</h2>
        <FeatGrid>
          <Feat variant="primary" title="Node 20+ and pnpm 9+">
            <Token>node -v</Token> and <Token>pnpm -v</Token> to check. If pnpm isn&apos;t
            installed, <Token>corepack enable</Token> picks it up with nothing to install.
          </Feat>
          <Feat variant="alt" title="Cloudflare account">
            Any tier. The free plan covers a personal workload without close calls. Workers, D1,
            KV, R2, and Turnstile are all on by default.
          </Feat>
          <Feat variant="primary" title="Domain on Cloudflare">
            The domain lives in your Cloudflare account so you can point a Worker route at it. A
            sub-domain like <Token bare>stub.yourdomain.com</Token> works.
          </Feat>
          <Feat variant="alt" title="Resend account">
            3,000 emails a month on the free tier. Plenty for one owner. If you&apos;d rather
            use a different provider, swap the adapter in{' '}
            <Token bare>apps/app/lib/email.ts</Token>.
          </Feat>
        </FeatGrid>
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Fork and install</h2>
        <p style={body}>Fork on GitHub, clone your fork, install the workspace.</p>
        <CLIBlock
          lines={[
            { kind: 'cmd', text: 'gh repo fork GordonBeeming/stub --clone' },
            { kind: 'cmd', text: 'cd stub' },
            { kind: 'cmd', text: 'pnpm install' },
            { kind: 'cmd', text: 'cp apps/app/wrangler.example.toml apps/app/wrangler.toml' },
          ]}
        />
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Provision the Cloudflare resources</h2>
        <p style={body}>
          Log in with <Token>wrangler login</Token>, then run the commands below. Each one
          prints an ID or confirms a bucket; paste every ID into the matching binding in{' '}
          <Token bare>apps/app/wrangler.toml</Token>.
        </p>
        <CLIBlock
          lines={[
            { kind: 'cmd', text: 'cd apps/app' },
            { kind: 'cmd', text: 'npx wrangler login' },
            { kind: 'comment', text: '' },
            { kind: 'cmd', text: 'npx wrangler d1 create stub' },
            { kind: 'cmd', text: 'npx wrangler kv namespace create SESSIONS' },
            { kind: 'cmd', text: 'npx wrangler kv namespace create RATE_LIMIT' },
            { kind: 'cmd', text: 'npx wrangler r2 bucket create stub-backups' },
          ]}
        />
        <p style={{ ...body, marginTop: 16 }}>
          Turnstile is a web widget, not a wrangler resource. Create a site in the Cloudflare
          dashboard under <Token bare>Turnstile</Token> and hold onto the site key and secret
          for the next step.
        </p>
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Apply the schema</h2>
        <p style={body}>
          There&apos;s a single migration at{' '}
          <Token bare>apps/app/migrations/001_init.sql</Token> that creates every table. Apply
          it to your real D1.
        </p>
        <CLIBlock
          lines={[
            { kind: 'cmd', text: 'npx wrangler d1 migrations apply DB --remote' },
          ]}
        />
        <p style={{ ...body, marginTop: 12 }}>
          Swap <Token bare>--remote</Token> for <Token bare>--local</Token> if you want to try
          the schema on your laptop first.
        </p>
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Secrets and vars</h2>
        <p style={body}>
          Secrets never live in <Token bare>wrangler.toml</Token>. Set each one with{' '}
          <Token>wrangler secret put</Token>. Vars (non-secret config) go in the file itself
          under <Token bare>[vars]</Token>.
        </p>
        <CLIBlock
          lines={[
            { kind: 'cmd', text: 'npx wrangler secret put SESSION_SECRET' },
            { kind: 'comment', text: '# 32+ random bytes; `openssl rand -hex 32` is fine' },
            { kind: 'cmd', text: 'npx wrangler secret put RESEND_API_KEY' },
            { kind: 'cmd', text: 'npx wrangler secret put TURNSTILE_SECRET' },
            { kind: 'cmd', text: 'npx wrangler secret put IP_HASH_SALT' },
            { kind: 'comment', text: '# any random string; rotating it anonymises older click data' },
          ]}
        />
        <p style={{ ...body, marginTop: 16, marginBottom: 8 }}>
          Then open <Token bare>apps/app/wrangler.toml</Token> and set each value in{' '}
          <Token bare>[vars]</Token> for your setup:
        </p>
        <CLIBlock
          lines={[
            { kind: 'cmd', text: 'OWNER_EMAIL          = "you@yourdomain.com"' },
            { kind: 'cmd', text: 'RESEND_FROM          = "stub@yourdomain.com"' },
            { kind: 'cmd', text: 'SITE_URL             = "https://stub.yourdomain.com"' },
            { kind: 'cmd', text: 'TURNSTILE_SITE_KEY   = "0x4AAA..."' },
          ]}
        />
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Build and deploy</h2>
        <p style={body}>
          <Token>opennextjs-cloudflare build</Token> compiles the Next app for a Worker.{' '}
          <Token>deploy</Token> pushes it.
        </p>
        <CLIBlock
          lines={[
            { kind: 'comment', text: '# from the repo root' },
            { kind: 'cmd', text: 'pnpm build' },
            { kind: 'cmd', text: 'cd apps/app' },
            { kind: 'cmd', text: 'npx opennextjs-cloudflare build' },
            { kind: 'cmd', text: 'npx opennextjs-cloudflare deploy' },
          ]}
        />
        <p style={{ ...body, marginTop: 16 }}>
          In the Cloudflare dashboard, map <Token bare>stub.yourdomain.com/*</Token> to the
          Worker. The daily cron trigger picks itself up from{' '}
          <Token bare>wrangler.toml</Token> once the Worker is live.
        </p>
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>First login</h2>
        <p style={body}>
          Visit <Token bare>https://stub.yourdomain.com/login</Token>, enter the address you
          set as <Token bare>OWNER_EMAIL</Token>, and you&apos;ll get a magic link by email.
          Click it, enrol a passkey, and from there on passkey sign-in skips the email
          round-trip. The magic link stays as a recovery path if you ever lose every passkey.
        </p>
        <p style={body}>
          Submitting any other address returns the same response the owner sees but never
          emits an email, so the form doesn&apos;t leak who the owner is.
        </p>
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Local dev</h2>
        <p style={body}>
          The Next dev server runs against a local D1 and KV mock. Put development-only secret
          values in <Token bare>apps/app/.dev.vars</Token> (see{' '}
          <Token bare>.dev.vars.example</Token>). Real credentials don&apos;t belong there.
        </p>
        <CLIBlock
          lines={[
            { kind: 'comment', text: '# from the repo root' },
            { kind: 'cmd', text: 'pnpm dev' },
            { kind: 'comment', text: '' },
            { kind: 'comment', text: '# or run under the opennext preview with real bindings' },
            { kind: 'cmd', text: 'pnpm --filter @stub/app cf:preview' },
          ]}
        />
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>When things break</h2>
        <FeatGrid>
          <Feat variant="primary" title="The magic link never arrives">
            Check that <Token bare>RESEND_API_KEY</Token> is set and{' '}
            <Token bare>RESEND_FROM</Token> is on a verified domain. Run{' '}
            <Token>wrangler tail</Token> while you submit the form: a rate-limit hit or an
            owner-email mismatch logs an audit line without sending anything.
          </Feat>
          <Feat variant="alt" title="No passkey prompt appears">
            WebAuthn needs HTTPS or localhost. Most browsers also refuse passkeys when the page
            resolves to a different hostname than the Worker. Keep <Token bare>SITE_URL</Token>{' '}
            and the route hostname aligned.
          </Feat>
          <Feat variant="primary" title="D1 writes silently fail">
            The migration probably didn&apos;t run against the remote DB. Run{' '}
            <Token>wrangler d1 migrations apply DB --remote</Token> and try again.
          </Feat>
        </FeatGrid>
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Rotating the session secret</h2>
        <p style={body}>
          Swapping <Token bare>SESSION_SECRET</Token> by itself signs every browser out. To
          avoid that, stub reads an optional second secret,{' '}
          <Token bare>SESSION_SECRET_PREV</Token>, and falls back to it when a cookie
          won&apos;t verify against the active key. Fresh sign-ins always use the active one,
          so cookies signed with the old key age out cleanly.
        </p>
        <CLIBlock
          lines={[
            { kind: 'comment', text: '# 1. copy the current secret into the previous slot' },
            { kind: 'cmd', text: 'npx wrangler secret put SESSION_SECRET_PREV' },
            { kind: 'comment', text: '' },
            { kind: 'comment', text: '# 2. write a fresh random value into the active slot' },
            { kind: 'cmd', text: 'npx wrangler secret put SESSION_SECRET' },
            { kind: 'comment', text: '' },
            { kind: 'comment', text: '# 3. deploy so the Worker picks up both' },
            { kind: 'cmd', text: 'npx opennextjs-cloudflare deploy' },
            { kind: 'comment', text: '' },
            { kind: 'comment', text: '# 4. once old cookies have expired, drop the previous slot' },
            { kind: 'cmd', text: 'npx wrangler secret delete SESSION_SECRET_PREV' },
          ]}
        />
        <p style={{ ...body, marginTop: 16 }}>
          Session cookies live for 30 days, so that window covers the worst case. Pick a
          shorter one if you&apos;d rather retire the old key sooner and sign back in yourself.
        </p>
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>License and feedback</h2>
        <p style={body}>
          MIT, at{' '}
          <a
            href="https://github.com/GordonBeeming/stub"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary)', textDecoration: 'none', borderBottom: '1px solid var(--primary-dim)' }}
          >
            github.com/GordonBeeming/stub
          </a>
          . File an issue if the guide drifts from the code or a step silently breaks after a
          Cloudflare platform change. Pull requests welcome.
        </p>
      </section>
    </>
  );
}
