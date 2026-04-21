import { useEffect } from 'react';
import { CLIBlock, Feat, FeatGrid, SectionHeader, Token } from '@gordonbeeming/design-system';

// Page-level title/description metadata is applied via useEffect rather than
// Next's `export const metadata` since an SPA controls the document title
// at runtime instead of at render time.

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

const linkStyle: React.CSSProperties = {
  color: 'var(--primary)',
  textDecoration: 'none',
  borderBottom: '1px solid var(--primary-dim)',
};

// Cloudflare dashboard deeplinks. The `?to=/:account/...` query auto-routes
// to whichever Cloudflare account the user is signed in to, so no GUID is
// hard-coded — every forker gets the right page.
const CF_TURNSTILE = 'https://dash.cloudflare.com/?to=/:account/turnstile';
const CF_R2 = 'https://dash.cloudflare.com/?to=/:account/r2/overview';
const CF_WORKERS = 'https://dash.cloudflare.com/?to=/:account/workers/overview';
const RESEND_KEYS = 'https://resend.com/api-keys';

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} rel="noopener noreferrer" target="_blank" style={linkStyle}>
      {children}
    </a>
  );
}

export function StubSetup() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'stub — setup guide';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <>
      <header style={{ padding: '24px 0 48px' }}>
        <h1 style={pageTitle}>Ship your own stub on your own Cloudflare.</h1>
        <p style={lead}>
          Ten numbered steps, roughly twenty minutes end-to-end. You&apos;ll need Node 20+ and
          pnpm, a Cloudflare account with a domain attached, and the email you want to sign in
          with.
        </p>
      </header>

      <section style={section}>
        <SectionHeader num="01">prerequisites</SectionHeader>
        <FeatGrid>
          <Feat variant="primary" title="Node 20+ and pnpm 9+">
            <Token>node -v</Token> and <Token>pnpm -v</Token> to check. If pnpm isn&apos;t
            installed, <Token>corepack enable</Token> picks it up with nothing to install.
          </Feat>
          <Feat variant="alt" title="Cloudflare account">
            Any tier. The free plan covers a personal workload without close calls. Workers, D1,
            KV, and Turnstile are all on by default.
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
        <SectionHeader num="02">fork and install</SectionHeader>
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
        <SectionHeader num="03">create a turnstile site</SectionHeader>
        <p style={body}>
          Turnstile is a web widget, not a wrangler resource. It goes on the magic-link form to
          stop bots from burning through the rate limit. Create one in the Cloudflare
          dashboard:{' '}
          <ExtLink href={CF_TURNSTILE}>dash.cloudflare.com → Turnstile</ExtLink>.
        </p>
        <p style={body}>
          When you create the site, Cloudflare gives you a <em>site key</em> (public, goes in{' '}
          <Token bare>TURNSTILE_SITE_KEY</Token> in step 08) and a <em>secret</em> (private,
          goes in the <Token bare>TURNSTILE_SECRET</Token> wrangler secret in step 07). Keep
          both somewhere you can paste from; you&apos;ll need them two steps from now.
        </p>
        <p style={body}>
          In the site&apos;s domain list, add your real hostname (
          <Token bare>stub.yourdomain.com</Token>) and also <Token bare>localhost</Token> so the
          same site key verifies during local dev. Without <Token bare>localhost</Token>, the
          widget on <Token bare>http://localhost:5173</Token> issues tokens Cloudflare rejects at
          verify time and the log shows{' '}
          <Token bare>auth.magic.request.reject reason=turnstile_fail</Token>.
        </p>
        <p style={body}>
          The site key and secret form a pair. If your local{' '}
          <Token bare>apps/app/wrangler.toml</Token> uses your real site key, paste the matching
          real secret into <Token bare>apps/app/.dev.vars</Token> so local verification works:
        </p>
        <CLIBlock
          lines={[
            { kind: 'comment', text: '# apps/app/.dev.vars — local dev only, NEVER committed' },
            { kind: 'cmd', text: 'TURNSTILE_SECRET="<paste-your-real-turnstile-secret>"' },
          ]}
        />
        <p style={{ ...body, marginTop: 12 }}>
          If you&apos;d rather avoid real Turnstile in dev, swap both the site key in{' '}
          <Token bare>wrangler.toml</Token> and the secret in <Token bare>.dev.vars</Token> for
          Cloudflare&apos;s always-pass test pair (
          <Token bare>1x00000000000000000000AA</Token> / <Token bare>1x00…AA</Token>). The pair
          must match — a real site key with the test secret is exactly what caused the{' '}
          <Token bare>turnstile_fail</Token> above.
        </p>
      </section>

      <section style={section}>
        <SectionHeader num="04">provision the cloudflare resources</SectionHeader>
        <p style={body}>
          Log in with <Token>wrangler login</Token>, then create one D1 database and two KV
          namespaces. Each command prints the ID you need for step 05.
        </p>
        <CLIBlock
          lines={[
            { kind: 'cmd', text: 'cd apps/app' },
            { kind: 'cmd', text: 'npx wrangler login' },
            { kind: 'comment', text: '' },
            { kind: 'comment', text: '# D1 — copy the returned database_id into [[d1_databases]]' },
            { kind: 'cmd', text: 'npx wrangler d1 create stub' },
            { kind: 'comment', text: '' },
            { kind: 'comment', text: '# KV — copy each returned id into its [[kv_namespaces]] block' },
            { kind: 'cmd', text: 'npx wrangler kv namespace create SESSIONS' },
            { kind: 'cmd', text: 'npx wrangler kv namespace create RATE_LIMIT' },
          ]}
        />
      </section>

      <section style={section}>
        <SectionHeader num="05">paste the ids into wrangler.toml</SectionHeader>
        <p style={body}>
          Each <Token>create</Token> command above prints the binding block you need. The
          template file already has each block with a zeroed placeholder; swap the placeholder
          for the real value wrangler returned. For D1 it looks like this:
        </p>
        <CLIBlock
          lines={[
            { kind: 'comment', text: '# before' },
            { kind: 'cmd', text: '[[d1_databases]]' },
            { kind: 'cmd', text: 'binding = "DB"' },
            { kind: 'cmd', text: 'database_name = "stub"' },
            { kind: 'cmd', text: 'database_id = "00000000-0000-0000-0000-000000000000"' },
            { kind: 'cmd', text: 'migrations_dir = "migrations"' },
            { kind: 'comment', text: '' },
            { kind: 'comment', text: '# after — real database_id pasted' },
            { kind: 'cmd', text: '[[d1_databases]]' },
            { kind: 'cmd', text: 'binding = "DB"' },
            { kind: 'cmd', text: 'database_name = "stub"' },
            { kind: 'cmd', text: 'database_id = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"' },
            { kind: 'cmd', text: 'migrations_dir = "migrations"' },
          ]}
        />
        <p style={{ ...body, marginTop: 16 }}>
          Do the same for each <Token bare>[[kv_namespaces]]</Token> block: replace the zeroed{' '}
          <Token bare>id</Token> with the <Token bare>id</Token> wrangler printed when you
          created that namespace.
        </p>
      </section>

      <section style={section}>
        <SectionHeader num="06">apply the schema</SectionHeader>
        <p style={body}>
          One migration at <Token bare>apps/app/migrations/001_init.sql</Token> creates every
          table. Apply it to your real D1.
        </p>
        <CLIBlock
          lines={[
            { kind: 'comment', text: '# wrangler commands run from apps/app where wrangler.toml lives' },
            { kind: 'cmd', text: 'cd apps/app' },
            { kind: 'cmd', text: 'npx wrangler d1 migrations apply DB --remote' },
          ]}
        />
        <p style={{ ...body, marginTop: 12 }}>
          Swap <Token bare>--remote</Token> for <Token bare>--local</Token> if you want to try
          the schema on your laptop first.
        </p>
      </section>

      <section style={section}>
        <SectionHeader num="07">secrets</SectionHeader>
        <p style={body}>
          Secrets never live in <Token bare>wrangler.toml</Token>. You set each one with{' '}
          <Token>wrangler secret put</Token>. The command is interactive: you run it, wrangler
          prompts <Token bare>? Enter a secret value:</Token>, you paste the value, press
          Enter. Your keystrokes are hidden, so an empty-looking line while you paste is
          normal.
        </p>
        <p style={{ ...body, marginTop: 16 }}>
          Two of the secrets are random strings you generate locally. One command, two uses:
        </p>
        <CLIBlock
          lines={[
            { kind: 'comment', text: '# random 32-byte hex for SESSION_SECRET and IP_HASH_SALT' },
            { kind: 'cmd', text: 'openssl rand -hex 32' },
          ]}
        />
        <p style={{ ...body, marginTop: 16 }}>A sample interaction looks like this:</p>
        <CLIBlock
          lines={[
            { kind: 'cmd', text: '$ npx wrangler secret put SESSION_SECRET' },
            { kind: 'out', text: '? Enter a secret value:  ... (hidden — paste, then enter)' },
            { kind: 'out', text: '✨ Success! Uploaded secret SESSION_SECRET' },
          ]}
        />
        <p style={{ ...body, marginTop: 16 }}>
          First time through, the first <Token>wrangler secret put</Token> has one extra
          prompt: <Token bare>There doesn&apos;t seem to be a Worker called &quot;stub&quot;.
          Do you want to create a new Worker with that name?</Token> Answer yes. Workers
          on Cloudflare are created lazily, so the secret you&apos;re uploading needs
          somewhere to live. Wrangler spins up an empty Worker record to hold it, and
          your code lands in the same Worker when you deploy later.
        </p>
        <p style={{ ...body, marginTop: 16 }}>
          Do it four times, once per secret. Values come from:
        </p>
        <CLIBlock
          lines={[
            { kind: 'cmd', text: 'cd apps/app' },
            { kind: 'comment', text: '# SESSION_SECRET — paste a fresh `openssl rand -hex 32` value' },
            { kind: 'cmd', text: 'npx wrangler secret put SESSION_SECRET' },
            { kind: 'comment', text: '' },
            { kind: 'comment', text: '# RESEND_API_KEY — from resend.com/api-keys' },
            { kind: 'cmd', text: 'npx wrangler secret put RESEND_API_KEY' },
            { kind: 'comment', text: '' },
            { kind: 'comment', text: '# TURNSTILE_SECRET — the secret from the Turnstile site in step 03' },
            { kind: 'cmd', text: 'npx wrangler secret put TURNSTILE_SECRET' },
            { kind: 'comment', text: '' },
            { kind: 'comment', text: '# IP_HASH_SALT — another `openssl rand -hex 32` value' },
            { kind: 'cmd', text: 'npx wrangler secret put IP_HASH_SALT' },
          ]}
        />
        <p style={{ ...body, marginTop: 16 }}>
          Your Resend API key lives at{' '}
          <ExtLink href={RESEND_KEYS}>resend.com/api-keys</ExtLink>. The Turnstile secret is
          the one Cloudflare printed when you created the site in step 03.
        </p>
      </section>

      <section style={section}>
        <SectionHeader num="08">vars</SectionHeader>
        <p style={body}>
          Non-secret config lives in <Token bare>apps/app/wrangler.toml</Token> under{' '}
          <Token bare>[vars]</Token>. Open the file and set each value for your setup:
        </p>
        <CLIBlock
          lines={[
            { kind: 'cmd', text: 'OWNER_EMAIL          = "you@yourdomain.com"' },
            { kind: 'cmd', text: 'RESEND_FROM          = "stub@yourdomain.com"' },
            { kind: 'cmd', text: 'SITE_URL             = "https://stub.yourdomain.com"' },
            { kind: 'cmd', text: 'TURNSTILE_SITE_KEY   = "0x4AAA..."' },
          ]}
        />
        <p style={{ ...body, marginTop: 12 }}>
          <Token bare>TURNSTILE_SITE_KEY</Token> is the public site key from step 03 (different
          value from the secret you just uploaded).
        </p>
      </section>

      <section style={section}>
        <SectionHeader num="09">build and deploy</SectionHeader>
        <p style={body}>
          One command builds the Worker bundle and pushes it.
        </p>
        <CLIBlock
          lines={[
            { kind: 'cmd', text: 'cd apps/app' },
            { kind: 'cmd', text: 'pnpm cf:deploy' },
          ]}
        />
        <p style={{ ...body, marginTop: 12 }}>
          <Token bare>cf:deploy</Token> is defined in <Token bare>apps/app/package.json</Token>{' '}
          as <Token bare>opennextjs-cloudflare build &amp;&amp; opennextjs-cloudflare deploy</Token>.
          Running both through one script in one shell keeps them in sync; running them by hand as
          separate commands leaves room for <Token bare>.open-next/</Token> to end up in a
          half-built state that wrangler then refuses to deploy.
        </p>
        <p style={{ ...body, marginTop: 16 }}>
          The first deploy fills in the empty Worker record you created back in step 07.
          Finally, map a route to it:{' '}
          <ExtLink href={CF_WORKERS}>dash.cloudflare.com → Workers &amp; Pages</ExtLink>, open
          the <Token bare>stub</Token> Worker, and add a route for{' '}
          <Token bare>stub.yourdomain.com/*</Token>. The daily cron trigger picks itself up
          from <Token bare>wrangler.toml</Token> once the Worker is live.
        </p>
      </section>

      <section style={section}>
        <SectionHeader num="10">first login</SectionHeader>
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
        <h2 style={sectionTitle}>Optional: R2 for nightly backups</h2>
        <p style={body}>
          Stub runs fine without R2. Turn it on if you want a JSONL dump of every D1 table
          written to an R2 bucket once a day for disaster recovery. Heads up: enabling R2 on
          a Cloudflare account requires a payment method on file, even though the free tier
          covers a personal workload. If that&apos;s a blocker, skip this and come back later.
        </p>
        <p style={body}>
          Create the bucket via the dashboard or the CLI:{' '}
          <ExtLink href={CF_R2}>dash.cloudflare.com → R2</ExtLink>.
        </p>
        <CLIBlock
          lines={[
            { kind: 'cmd', text: 'cd apps/app' },
            { kind: 'cmd', text: 'npx wrangler r2 bucket create stub-backups' },
          ]}
        />
        <p style={{ ...body, marginTop: 12 }}>
          Then uncomment the <Token bare>[[r2_buckets]]</Token> block in{' '}
          <Token bare>apps/app/wrangler.toml</Token> and redeploy. The cron will start writing
          a daily dump at <Token bare>backups/YYYY-MM-DD/stub.jsonl</Token>.
        </p>
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
          <ExtLink href="https://github.com/GordonBeeming/stub">
            github.com/GordonBeeming/stub
          </ExtLink>
          . File an issue if the guide drifts from the code or a step silently breaks after a
          Cloudflare platform change. Pull requests welcome.
        </p>
      </section>
    </>
  );
}
