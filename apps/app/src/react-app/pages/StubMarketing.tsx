import { Link } from 'wouter';

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

const section: React.CSSProperties = { margin: '72px 0' };

// Hero wraps into a single column below ~720px — each track needs at least
// 320px before it gets its own row, which keeps the prose readable on
// mobile and avoids the squeezed-terminal look on tablets.
const heroGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 48,
  alignItems: 'start',
  padding: '24px 0 48px',
};

const heroArtifactStyle: React.CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-lg)',
  padding: '24px',
  display: 'grid',
  gap: 18,
  alignSelf: 'start',
};

const artifactEyebrow: React.CSSProperties = {
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};

const artifactBlock: React.CSSProperties = {
  display: 'grid',
  gap: 6,
};

const artifactLabel: React.CSSProperties = {
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const artifactLine: React.CSSProperties = {
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  wordBreak: 'break-all',
  lineHeight: 1.55,
};

const artifactFootnote: React.CSSProperties = {
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  lineHeight: 1.55,
};

// Hairline between blocks — keeps the worker-bundle row visually distinct
// from the URL examples above it without another header weight.
const artifactDivider: React.CSSProperties = {
  height: 1,
  background: 'var(--line-soft, var(--line))',
  margin: '6px 0',
};

export function StubMarketing() {
  return (
    <>
      <header style={heroGridStyle}>
        <div>
          <h1 style={heading}>Short links and burn notes. On your own Cloudflare.</h1>
          <p style={lead}>
            I wanted short links and burn notes without signing up to a third-party service or
            standing up a VPS just for two tiny features. That&apos;s how stub happened. It&apos;s
            a single Worker you deploy to your own Cloudflare account. Only one email can sign
            in; notes are encrypted in your browser before they ever leave it. Forking takes
            about ten minutes. The only recurring cost is your domain.
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
        </div>

        {/*
          Mini monospace "artifact" anchoring the right half of the hero.
          It's a faked-up terminal of what stub actually produces — a short
          link and a burn-note URL with the fragment key. Fills the empty
          right column with something on-brand (mono, technical, no stock
          image) and gives the eye a place to land.
        */}
        <aside style={heroArtifactStyle} aria-hidden="true">
          <div style={artifactEyebrow}>{'// what stub gives you'}</div>
          <div style={artifactBlock}>
            <div style={artifactLabel}>short link</div>
            <div style={artifactLine}>
              <span style={{ color: 'var(--text-3)' }}>stub.yourdomain.com/</span>
              <span style={{ color: 'var(--primary)' }}>ab7k2</span>
            </div>
          </div>
          <div style={artifactBlock}>
            <div style={artifactLabel}>burn note</div>
            <div style={artifactLine}>
              <span style={{ color: 'var(--text-3)' }}>stub.yourdomain.com/n/</span>
              <span style={{ color: 'var(--primary)' }}>xV3q9</span>
              <span style={{ color: 'var(--text-3)' }}>#k=</span>
              <span style={{ color: 'var(--text-2)' }}>R2fKb…</span>
            </div>
            <div style={artifactFootnote}>
              {'// '}the <code style={{ fontFamily: 'inherit', color: 'var(--text-2)' }}>#k=</code>{' '}
              part never reaches the server
            </div>
          </div>
          <div style={artifactDivider} />
          <div style={artifactBlock}>
            <div style={artifactLabel}>worker bundle</div>
            <div style={artifactLine}>
              <span style={{ color: 'var(--text)' }}>464 KB gzipped</span>
              <span style={{ color: 'var(--text-3)' }}>{' / '}3 MB cap</span>
            </div>
            <div style={artifactFootnote}>
              {'// '}~85% headroom if you want to fork and extend
            </div>
          </div>
        </aside>
      </header>

      <section style={section}>
        <h2 style={subheading}>What it does</h2>
        <p style={body}>
          Shorten a URL. Pick your own slug or let it auto-generate. Add an expiry or a click cap
          if you want. Or paste a secret and get a URL with the decryption key in the fragment.
          Share it once; the note burns on read, and the server never sees your plaintext.
        </p>
      </section>

      <section style={section}>
        <h2 style={subheading}>Why you can trust it</h2>
        <p style={body}>
          The server doesn&apos;t see what you write. Notes are encrypted in your browser with
          AES-GCM. The key lives in the URL fragment, which browsers don&apos;t send to servers.
          Sign-in is tied to a single <code style={inlineCode}>OWNER_EMAIL</code>. Submitting any
          other address returns the same response the owner gets, so the endpoint can&apos;t be
          used to figure out who the owner is. Source is MIT; fork it and audit your own copy.
        </p>
      </section>

      <section style={section}>
        <h2 style={subheading}>Fork it</h2>
        <p style={body}>
          Clone your fork and deploy it to your Cloudflare account. One CLI line to start you
          off.
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
          <span style={{ color: 'var(--primary)' }}>$</span> gh repo fork GordonBeeming/stub
          --clone
        </pre>
        <p style={body}>
          Full setup walkthrough at{' '}
          <Link
            href="/stub/setup"
            style={{
              color: 'var(--primary)',
              textDecoration: 'none',
              borderBottom: '1px solid var(--primary-dim)',
            }}
          >
            /stub/setup
          </Link>
          .
        </p>
      </section>
    </>
  );
}
