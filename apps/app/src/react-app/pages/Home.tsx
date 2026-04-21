import { useEffect } from 'react';
import { useLocation } from 'wouter';

// Root route: probe /api/auth/me and bounce to /dashboard or /login. The
// Next-era home page did the same thing server-side via a redirect; in an
// SPA we do it after hydration so the user lands on the right place.
export function Home() {
  const [, navigate] = useLocation();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => {
        if (cancelled) return;
        navigate(r.ok ? '/dashboard' : '/login', { replace: true });
      })
      .catch(() => {
        if (cancelled) return;
        navigate('/login', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main style={{ padding: '48px 0' }}>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
        {'// routing…'}
      </p>
    </main>
  );
}
