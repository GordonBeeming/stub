import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { EnrollFlow } from '../components/EnrollFlow';
import { useOwnerSession } from '../lib/use-owner-session';
import type { PasskeyRow } from '../lib/types';

// Mirror of the Next-era /enroll page. Behavior identical: owner-only, and
// if the owner already has a passkey it skips straight to /dashboard unless
// the `?add=1` query flag is set.
export function Enroll() {
  const search = useSearch();
  const addingMore = new URLSearchParams(search).get('add') === '1';

  const { state, session } = useOwnerSession();
  const [, navigate] = useLocation();
  const [decided, setDecided] = useState<null | 'show' | 'skip'>(null);

  useEffect(() => {
    if (state === 'anonymous') {
      navigate('/login?err=invalid', { replace: true });
      return;
    }
    if (state !== 'owner' || !session) return;

    let cancelled = false;
    // The owner's passkey list lives at /api/auth/state (public) in terms of
    // "does anyone have passkeys?", but to get the count for THIS owner we
    // hit the session-specific /api/notes-adjacent? No — there's no endpoint
    // exposing the list directly. Instead, the enroll options endpoint can
    // be called with the owner session and will include the existing
    // credentials via excludeCredentials; but the simpler read path is the
    // public /api/auth/state boolean: if it says hasPasskeys and we aren't
    // explicitly adding more, bounce to the dashboard.
    fetch('/api/auth/state', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ hasPasskeys: boolean }>)
      .then((data) => {
        if (cancelled) return;
        if (data.hasPasskeys && !addingMore) {
          setDecided('skip');
          navigate('/dashboard', { replace: true });
        } else {
          setDecided('show');
        }
      })
      .catch(() => {
        if (!cancelled) setDecided('show');
      });
    return () => {
      cancelled = true;
    };
  }, [state, session, addingMore, navigate]);

  if (state === 'loading' || decided === null || decided === 'skip') {
    return <main style={{ padding: '48px 0' }} />;
  }

  return (
    <section style={authCardWrap}>
      <div style={authCard}>
        <EnrollFlow addingMore={addingMore} />
      </div>
    </section>
  );
}

// Match the /login framing so both hops through the auth flow feel like
// the same surface rather than two unrelated layouts.
const authCardWrap: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '16px 0 32px',
};

const authCard: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  background: 'var(--bg-2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-lg)',
  padding: '32px 28px',
};

// Local PasskeyRow import keeps the tree-shake happy — the Enroll page
// doesn't use it directly, but re-exporting keeps the file's typecheck
// honest if future changes want the list.
export type { PasskeyRow };
