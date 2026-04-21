'use client';

import { useState } from 'react';

interface Props {
  id: string;
  label?: string | null;
}

interface ErrorBody {
  error?: string;
}

export function PasskeyRevokeButton({ id, label }: Props) {
  const [pending, setPending] = useState(false);

  async function handle() {
    if (pending) return;
    const shortId = id.slice(0, 8);
    const displayName = label ?? shortId;
    if (!window.confirm(`Revoke ${displayName}? Can't be undone.`)) return;

    setPending(true);
    try {
      const res = await fetch(`/api/auth/passkey/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        window.location.reload();
        return;
      }

      if (res.status === 409) {
        window.alert('Enroll another passkey first — revoking your only one would lock you out.');
        return;
      }

      // Best-effort parse: surface a server-provided error string when we get
      // one, otherwise fall back to the status code so the user knows something
      // went wrong rather than silently failing.
      let message = `Revoke failed (${res.status}).`;
      try {
        const body = (await res.json()) as ErrorBody;
        if (typeof body.error === 'string' && body.error.length > 0) {
          message = `Revoke failed: ${body.error}`;
        }
      } catch {
        // response wasn't JSON; keep the status-based fallback
      }
      window.alert(message);
    } catch {
      window.alert('Revoke failed: network error.');
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      style={{
        background: 'transparent',
        color: 'var(--text-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: '4px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: pending ? 'progress' : 'pointer',
      }}
    >
      {pending ? 'revoking…' : 'revoke'}
    </button>
  );
}
