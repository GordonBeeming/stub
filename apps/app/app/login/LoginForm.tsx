'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';
import { Comment } from '@gordonbeeming/design-system';

const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: 'clamp(22px, 2.8vw, 26px)',
  letterSpacing: '-0.01em',
  color: 'var(--text)',
  margin: '0 0 20px',
};

type Status = 'idle' | 'submitting' | 'sent' | 'passkey' | 'error';

interface Props {
  turnstileSiteKey: string;
}

// The Turnstile widget loads globally and exposes a `turnstile` object once
// ready. We intentionally re-declare the minimal surface we use rather than
// pull in the full types package.
declare global {
  interface Window {
    turnstile?: {
      render: (el: string | HTMLElement, opts: TurnstileOpts) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

interface TurnstileOpts {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
}

export function LoginForm({ turnstileSiteKey }: Props) {
  const params = useSearchParams();
  const err = params.get('err');

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [hasPasskeys, setHasPasskeys] = useState(false);

  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const turnstileToken = useRef<string | null>(null);

  // Ask the server whether any passkeys exist so we know whether to render
  // the passkey button. Kept narrow — the endpoint returns one boolean.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/state', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ hasPasskeys: boolean }>)
      .then((data) => {
        if (!cancelled) setHasPasskeys(data.hasPasskeys);
      })
      .catch(() => {
        // Non-fatal — worst case we hide the passkey button on a flaky
        // network. Magic link still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!turnstileSiteKey) return;
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-turnstile', '');
      document.head.appendChild(script);
    }

    const start = window.setInterval(() => {
      if (!window.turnstile || !widgetRef.current || widgetId.current) return;
      window.clearInterval(start);
      widgetId.current = window.turnstile.render(widgetRef.current, {
        sitekey: turnstileSiteKey,
        theme: 'dark',
        callback: (token: string) => {
          turnstileToken.current = token;
        },
        'error-callback': () => {
          turnstileToken.current = null;
        },
        'expired-callback': () => {
          turnstileToken.current = null;
        },
      });
    }, 100);

    return () => {
      window.clearInterval(start);
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          // Widget cleanup is best-effort — nothing to surface here.
        }
        widgetId.current = null;
      }
    };
  }, [turnstileSiteKey]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');

    const body = {
      email: email.trim(),
      turnstileToken: turnstileToken.current ?? '',
    };

    try {
      await fetch('/api/auth/magic/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // The endpoint always returns the same body on success; network errors
      // still land on the same neutral confirmation so no timing info leaks.
    }

    // Neutral copy regardless of server outcome.
    setStatus('sent');
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    turnstileToken.current = null;
  }

  async function handlePasskey() {
    setStatus('passkey');
    setPasskeyError(null);
    try {
      const optsRes = await fetch('/api/auth/passkey/auth/options', { method: 'POST' });
      if (!optsRes.ok) throw new Error('options failed');
      const options = (await optsRes.json()) as Parameters<typeof startAuthentication>[0]['optionsJSON'];

      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/passkey/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response: assertion }),
      });
      const verify = (await verifyRes.json()) as { ok?: boolean; next?: string };
      if (!verify.ok || !verify.next) throw new Error('verify failed');
      window.location.assign(verify.next);
    } catch {
      setPasskeyError('That passkey didn\'t work. Try the magic link instead.');
      setStatus('idle');
    }
  }

  return (
    <>
      <h2 style={sectionTitle}>Sign in</h2>

      {err === 'invalid' ? (
        <p style={{ marginBottom: 16 }}>
          <Comment>That link is no longer valid. Request a new one below.</Comment>
        </p>
      ) : null}

      {status === 'sent' ? (
        <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
          If that address is the owner, a link is on its way. It expires in 10 minutes.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <label
            style={{
              display: 'grid',
              gap: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
            }}
          >
            email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                letterSpacing: 'normal',
                textTransform: 'none',
                padding: '10px 12px',
              }}
            />
          </label>

          <div ref={widgetRef} />

          <button
            type="submit"
            disabled={status === 'submitting' || !email}
            style={{
              background: 'var(--primary)',
              color: '#000',
              border: 0,
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              fontWeight: 500,
              cursor: status === 'submitting' ? 'progress' : 'pointer',
              opacity: status === 'submitting' || !email ? 0.6 : 1,
            }}
          >
            {status === 'submitting' ? 'sending…' : 'send me a link'}
          </button>
        </form>
      )}

      {hasPasskeys ? (
        <div style={{ marginTop: 24 }}>
          <button
            type="button"
            onClick={handlePasskey}
            disabled={status === 'passkey'}
            style={{
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              fontWeight: 500,
              cursor: status === 'passkey' ? 'progress' : 'pointer',
              width: '100%',
            }}
          >
            {status === 'passkey' ? 'waiting for passkey…' : 'sign in with a passkey'}
          </button>
          {passkeyError ? (
            <p style={{ marginTop: 8 }}>
              <Comment>{passkeyError}</Comment>
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
