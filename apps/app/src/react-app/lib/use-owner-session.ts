import { useEffect, useState } from 'react';
import type { MeResponse } from './api';

export type OwnerSessionState = 'loading' | 'owner' | 'anonymous';

interface OwnerSession {
  state: OwnerSessionState;
  session: { sub: string; email: string } | null;
}

// Shared hook for any page that needs to know whether the current user is
// the signed-in owner. Probes /api/auth/me on mount; a 401 means anonymous,
// 200 exposes { sub, email }. Other errors fall back to anonymous so the
// page can route to /login rather than hanging in a loading state.
export function useOwnerSession(): OwnerSession {
  const [data, setData] = useState<OwnerSession>({ state: 'loading', session: null });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) {
          setData({ state: 'anonymous', session: null });
          return;
        }
        if (!r.ok) {
          setData({ state: 'anonymous', session: null });
          return;
        }
        const body = (await r.json()) as MeResponse;
        setData({ state: 'owner', session: { sub: body.sub, email: body.email } });
      })
      .catch(() => {
        if (!cancelled) setData({ state: 'anonymous', session: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
