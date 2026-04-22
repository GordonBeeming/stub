import { useState } from 'react';
import { Link } from 'wouter';
import { startRegistration } from '@simplewebauthn/browser';
import { Comment } from '@gordonbeeming/design-system';
import { SectionTitle } from './SectionTitle';

interface Props {
  addingMore: boolean;
}

type Status = 'idle' | 'running' | 'error';

export function EnrollFlow({ addingMore }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleEnroll() {
    setStatus('running');
    setMessage(null);
    try {
      const optsRes = await fetch('/api/auth/passkey/register/options', { method: 'POST' });
      if (!optsRes.ok) throw new Error('options failed');
      const options = (await optsRes.json()) as Parameters<typeof startRegistration>[0]['optionsJSON'];

      const registration = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response: registration }),
      });
      const verify = (await verifyRes.json()) as { ok?: boolean };
      if (!verify.ok) throw new Error('verify failed');

      window.location.assign('/dashboard');
    } catch {
      setStatus('error');
      setMessage('Passkey enrollment didn\'t complete. Try again, or skip for now.');
    }
  }

  return (
    <>
      <SectionTitle eyebrow={addingMore ? 'add passkey' : 'enrol passkey'}>
        {addingMore ? 'Add another passkey' : 'Enrol a passkey'}
      </SectionTitle>

      <p style={{ color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
        Your browser will ask you to confirm with Touch ID, Windows Hello, or a hardware key.
        Once it&apos;s set, future sign-ins skip the email step.
      </p>

      {message ? (
        <p style={{ marginBottom: 16 }}>
          <Comment>{message}</Comment>
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleEnroll}
          disabled={status === 'running'}
          style={{
            background: 'var(--primary)',
            color: 'var(--on-primary)',
            border: 0,
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            fontWeight: 500,
            cursor: status === 'running' ? 'progress' : 'pointer',
            opacity: status === 'running' ? 0.6 : 1,
          }}
        >
          {status === 'running' ? 'waiting for authenticator…' : 'add passkey'}
        </button>

        <Link
          href="/dashboard"
          style={{
            color: 'var(--text-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            alignSelf: 'center',
          }}
        >
          skip for now
        </Link>
      </div>
    </>
  );
}
