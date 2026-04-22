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
    <section style={{ maxWidth: 420 }}>
      {config ? <LoginForm turnstileSiteKey={config.turnstileSiteKey} /> : null}
    </section>
  );
}
