import Link from 'next/link';

// Marketing voice per DESIGN.md §1.1 — first-person, warm, no numbered
// sections, no `//` eyebrows. Uses tokens directly rather than going
// through the in-app chrome components (Hero, SectionHeader).

const heading: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: 'clamp(28px, 4vw, 34px)',
  letterSpacing: '-0.01em',
  lineHeight: 1.2,
  color: 'var(--text)',
  margin: '0 0 16px',
};

const subheading: React.CSSProperties = {
  ...heading,
  fontSize: 'clamp(20px, 2.6vw, 24px)',
  margin: '0 0 12px',
};

const lead: React.CSSProperties = {
  color: 'var(--text-2)',
  fontSize: 17,
  lineHeight: 1.55,
  maxWidth: '56ch',
  margin: '0 0 24px',
};

const body: React.CSSProperties = {
  color: 'var(--text-2)',
  fontSize: 15,
  lineHeight: 1.65,
  maxWidth: '64ch',
  margin: '0 0 16px',
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 18px',
  background: 'var(--primary)',
  color: 'var(--bg)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  textDecoration: 'none',
  borderRadius: 'var(--radius-md)',
  fontWeight: 500,
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 18px',
  background: 'transparent',
  color: 'var(--text-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  textDecoration: 'none',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-md)',
};

const inlineCode: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--primary)',
  fontSize: '0.95em',
};

const section: React.CSSProperties = {
  margin: '72px 0',
};

export default function StubMarketingPage() {
  return (
    <>
      <header style={{ padding: '24px 0 48px' }}>
        <h1 style={heading}>Short links and burn notes. On your own Cloudflare.</h1>
        <p style={lead}>
          I wanted short links and burn notes without signing up to a third-party service or
          standing up a VPS just for two tiny features. That's how stub happened. It's a single
          Worker you deploy to your own Cloudflare account. Only one email can sign in; notes
          are encrypted in your browser before they ever leave it. Forking takes about ten
          minutes. The only recurring cost is your domain.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/stub/setup" style={primaryBtn}>
            get started
          </Link>
          <a
            href="https://github.com/GordonBeeming/stub"
            style={ghostBtn}
            rel="noopener noreferrer"
          >
            github.com/GordonBeeming/stub
          </a>
        </div>
      </header>

      <section style={section}>
        <h2 style={subheading}>What you can do with it</h2>
        <p style={body}>
          Make a short link — custom slug or auto-generated — with optional expiry or click cap.
          Or paste a secret and get a URL with the decryption key in the fragment. Share it
          once; the note burns on read, and the server never sees your plaintext.
        </p>
      </section>

      <figure
        style={{
          margin: '48px 0',
          padding: 0,
        }}
      >
        <picture>
          <source srcSet="/dashboard-dark.png" media="(prefers-color-scheme: dark)" />
          <img
            src="/dashboard-light.png"
            alt="Stub dashboard with the short-link form open, a URL field and shorten button, sub-nav across the top with new, links, notes, settings."
            width={1280}
            height={661}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
            }}
          />
        </picture>
        <figcaption
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-3)',
            marginTop: 10,
            textAlign: 'center',
            letterSpacing: '0.05em',
          }}
        >
          the dashboard, in its default &ldquo;paste a url&rdquo; state
        </figcaption>
      </figure>

      <section style={section}>
        <h2 style={subheading}>Why you can trust it</h2>
        <p style={body}>
          The server doesn&apos;t see what you write. Notes are encrypted in your browser with
          AES-GCM. The key lives in the URL fragment, which browsers don&apos;t send to servers.
          Sign-in is tied to a single <code style={inlineCode}>OWNER_EMAIL</code>. Submitting
          any other address returns the same response the owner gets, so the endpoint can&apos;t
          be used to figure out who the owner is. Source is MIT; fork it and audit your own
          copy.
        </p>
      </section>

      <section style={section}>
        <h2 style={subheading}>Fork it</h2>
        <p style={body}>
          Clone your fork and deploy it to your Cloudflare account. The walkthrough below
          covers the wrangler config and the secrets you need to set.
        </p>
        <pre
          style={{
            background: 'var(--bg-deep)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            margin: '0 0 20px',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--text-2)',
            overflowX: 'auto',
          }}
        >
          <span style={{ color: 'var(--primary)' }}>$</span> gh repo fork
          GordonBeeming/stub --clone
        </pre>
        <p style={body}>
          Full setup walkthrough at{' '}
          <Link
            href="/stub/setup"
            style={{ color: 'var(--primary)', textDecoration: 'none', borderBottom: '1px solid var(--primary-dim)' }}
          >
            /stub/setup
          </Link>
          .
        </p>
      </section>
    </>
  );
}
