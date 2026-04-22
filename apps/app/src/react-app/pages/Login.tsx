import { useEffect, useState } from 'react';
import { LoginForm } from '../components/LoginForm';
import type { ConfigResponse } from '../lib/api';

export function Login() {
  const [config, setConfig] = useState<ConfigResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/config', { cache: 'force-cache' })
      .then((r) => r.json() as Promise<ConfigResponse>)
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled) setConfig({ turnstileSiteKey: '', siteUrl: window.location.origin });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section style={authCardWrap}>
      <div style={authCard}>
        {config ? <LoginForm turnstileSiteKey={config.turnstileSiteKey} /> : null}
      </div>
    </section>
  );
}

// Auth pages (login, enroll) sit inside a panel so the form reads as a
// bounded surface rather than floating against the whole page width. The
// wrap centres the card on wide viewports while leaving it flush-left on
// narrow screens where gutters already handle the framing.
const authCardWrap: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '16px 0 32px',
};

const authCard: React.CSSProperties = {
  width: '100%',
  maxWidth: 440,
  background: 'var(--bg-2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-lg)',
  padding: '32px 28px',
};
