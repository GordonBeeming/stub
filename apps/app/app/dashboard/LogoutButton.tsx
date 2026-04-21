'use client';

import { useState } from 'react';

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function handle() {
    if (pending) return;
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if the network call fails, redirect anyway — the cookie is
      // HttpOnly so there's no client-side cleanup to do either way.
    }
    window.location.assign('/login');
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
        padding: '6px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: pending ? 'progress' : 'pointer',
      }}
    >
      {pending ? 'signing out…' : 'sign out'}
    </button>
  );
}
