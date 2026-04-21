export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getEnv } from '@/lib/cf';
import { getPasskeysForUser } from '@/lib/db';
import { requireOwnerSession } from '@/lib/guards';
import { LogoutButton } from '../LogoutButton';
import { PasskeyRevokeButton } from '../PasskeyRevokeButton';

const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: 'clamp(20px, 2.6vw, 22px)',
  letterSpacing: '-0.01em',
  color: 'var(--text)',
  margin: '0 0 16px',
};

export default async function SettingsPage() {
  const guard = await requireOwnerSession();
  if (!guard.ok) redirect(guard.redirect);

  const env = getEnv();
  const passkeys = await getPasskeysForUser(env.DB, guard.session.sub);

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
            signed in as <span style={{ color: 'var(--text)' }}>{guard.session.email}</span>
          </p>
          <LogoutButton />
        </div>
      </section>

      <section>
        <h2 style={sectionTitle}>Passkeys</h2>

        {passkeys.length === 0 ? (
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
                  <PasskeyRevokeButton id={p.id} label={p.device_label ?? null} />
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
