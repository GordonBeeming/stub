import { useEffect, useState } from 'react';
import { Route, Switch, useLocation, Link } from 'wouter';
import { DashboardNav } from '../components/DashboardNav';
import { CreatePanel } from '../components/CreatePanel';
import { LinksList } from '../components/LinksList';
import { NotesList } from '../components/NotesList';
import { LogoutButton } from '../components/LogoutButton';
import { PasskeyRevokeButton } from '../components/PasskeyRevokeButton';
import { useOwnerSession } from '../lib/use-owner-session';
import type { ConfigResponse } from '../lib/api';
import type { LinkRow, NoteMetaRow, PasskeyRow } from '../lib/types';

// Single dashboard shell. Auth is checked once at the top; the sub-routes
// render against the same session. Each sub-route fetches its own data on
// mount, mirroring what the old server components did via requireOwnerSession
// + a D1 query per page.
export function Dashboard() {
  const { state } = useOwnerSession();
  const [, navigate] = useLocation();
  const [siteUrl, setSiteUrl] = useState<string | null>(null);

  useEffect(() => {
    if (state === 'anonymous') {
      navigate('/login?err=invalid', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/config', { cache: 'force-cache' })
      .then((r) => r.json() as Promise<ConfigResponse>)
      .then((data) => {
        if (!cancelled) setSiteUrl(data.siteUrl);
      })
      .catch(() => {
        if (!cancelled) setSiteUrl(window.location.origin);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state !== 'owner' || !siteUrl) {
    return <main style={{ padding: '48px 0' }} />;
  }

  return (
    <>
      <DashboardNav />
      <Switch>
        <Route path="/dashboard" component={() => <CreateRoute siteUrl={siteUrl} />} />
        <Route path="/dashboard/links" component={() => <LinksRoute siteUrl={siteUrl} />} />
        <Route path="/dashboard/notes" component={NotesRoute} />
        <Route path="/dashboard/settings" component={SettingsRoute} />
      </Switch>
    </>
  );
}

function CreateRoute({ siteUrl }: { siteUrl: string }) {
  return <CreatePanel siteUrl={siteUrl} />;
}

function LinksRoute({ siteUrl }: { siteUrl: string }) {
  const [links, setLinks] = useState<LinkRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/links?limit=200', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ links: LinkRow[] }>)
      .then((data) => {
        if (!cancelled) setLinks(data.links);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (links === null) {
    return <p style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>loading…</p>;
  }
  return <LinksList initialLinks={links} siteUrl={siteUrl} />;
}

function NotesRoute() {
  const [notes, setNotes] = useState<NoteMetaRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/notes?limit=200', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ notes: NoteMetaRow[] }>)
      .then((data) => {
        if (!cancelled) setNotes(data.notes);
      })
      .catch(() => {
        if (!cancelled) setNotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (notes === null) {
    return <p style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>loading…</p>;
  }
  return <NotesList initialNotes={notes} />;
}

// Settings lives inside the dashboard shell so the nav + session gate stay
// consistent. Fetches passkeys from a new endpoint? No — we reuse the same
// session-aware data path by asking the server for the passkey list here.
// The old version computed it inside the server component; we replicate
// with an inline fetch against a new JSON endpoint registered below, but
// since /api/auth/me doesn't include the list, we fetch the full list via
// a dedicated passkey-list endpoint. For now call GET /api/auth/passkey
// which will be added for the dashboard settings in the future; if that
// endpoint isn't present the UI falls back to "no passkeys listed".
function SettingsRoute() {
  const { session } = useOwnerSession();
  const [passkeys, setPasskeys] = useState<PasskeyRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/passkey', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`passkey list failed (${r.status})`);
        return r.json() as Promise<{ passkeys: PasskeyRow[] }>;
      })
      .then((data) => {
        if (!cancelled) setPasskeys(data.passkeys);
      })
      .catch(() => {
        if (!cancelled) setPasskeys([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sectionTitle: React.CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    fontSize: 'clamp(20px, 2.6vw, 22px)',
    letterSpacing: '-0.01em',
    color: 'var(--text)',
    margin: '0 0 16px',
  };

  if (!session) return null;

  return (
    <>
      <section style={{ marginBottom: 56 }}>
        <h2 style={sectionTitle}>Session</h2>
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          <p style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            signed in as <span style={{ color: 'var(--text)' }}>{session.email}</span>
          </p>
          <LogoutButton />
        </div>
      </section>

      <section>
        <h2 style={sectionTitle}>Passkeys</h2>

        {passkeys === null ? (
          <p style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>loading…</p>
        ) : passkeys.length === 0 ? (
          <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>
            You haven&apos;t registered one yet. The link below walks you through it.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 16px',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-2)',
            }}
          >
            {passkeys.map((p) => (
              <li
                key={p.id}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--line-soft)',
                  display: 'grid',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 15 }}>
                    {p.device_label ?? 'unknown device'}
                  </span>
                  <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    last used {formatLastUsed(p.last_used_at)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <code
                    style={{
                      color: 'var(--text-3)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    {p.id}
                  </code>
                  <PasskeyRevokeButton
                    id={p.id}
                    label={p.device_label ?? null}
                    onRevoked={(id) => setPasskeys((prev) => (prev ? prev.filter((x) => x.id !== id) : prev))}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/enroll?add=1"
          style={{
            display: 'inline-block',
            color: 'var(--primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            textDecoration: 'none',
            borderBottom: '1px solid var(--primary-dim)',
          }}
        >
          register another
        </Link>
      </section>
    </>
  );
}

function formatLastUsed(ts: number | null): string {
  if (ts === null) return 'never';
  const date = new Date(ts * 1000);
  return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}
