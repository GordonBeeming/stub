'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { base64UrlDecodeToBytes } from '@/lib/crypto';
import { decryptCiphertext, KEY_BYTES } from '@/app/_notes/crypto';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'gone' }
  | { kind: 'already-read' }
  | { kind: 'missing-key' }
  | { kind: 'bad-key' }
  | { kind: 'ready'; plaintext: string; burnOnRead: boolean };

interface NoteResponse {
  ciphertext: string;
  iv: string;
  expiresAt: number | null;
  burnOnRead: boolean;
}

const stateTitle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: 'clamp(22px, 2.8vw, 26px)',
  letterSpacing: '-0.01em',
  color: 'var(--text)',
  margin: '0 0 12px',
};

const errorTitle: React.CSSProperties = {
  ...stateTitle,
  color: 'var(--danger)',
};

const body: React.CSSProperties = {
  color: 'var(--text-2)',
  lineHeight: 1.6,
  fontSize: 15,
  maxWidth: '60ch',
};

export default function NoteViewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function run() {
      // The key lives in the fragment (`#k=<base64url>`). Fragments never
      // leave the browser — they're not in the HTTP request, not in
      // Referer, not in server logs. If it's missing or malformed, we
      // can't decrypt, so we don't even bother hitting the API.
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const match = hash.match(/^#k=([A-Za-z0-9_-]+)$/);
      if (!match || !match[1]) {
        if (!cancelled) setState({ kind: 'missing-key' });
        return;
      }

      let rawKey: Uint8Array;
      try {
        rawKey = base64UrlDecodeToBytes(match[1]);
      } catch {
        if (!cancelled) setState({ kind: 'bad-key' });
        return;
      }
      if (rawKey.length !== KEY_BYTES) {
        if (!cancelled) setState({ kind: 'bad-key' });
        return;
      }

      let res: Response;
      try {
        res = await fetch(`/api/notes/${encodeURIComponent(id!)}`, { cache: 'no-store' });
      } catch {
        if (!cancelled) setState({ kind: 'gone' });
        return;
      }

      if (res.status === 410) {
        if (!cancelled) setState({ kind: 'already-read' });
        return;
      }
      if (!res.ok) {
        if (!cancelled) setState({ kind: 'gone' });
        return;
      }

      let payload: NoteResponse;
      try {
        payload = (await res.json()) as NoteResponse;
      } catch {
        if (!cancelled) setState({ kind: 'gone' });
        return;
      }

      let plaintext: string;
      try {
        const ciphertext = base64UrlDecodeToBytes(payload.ciphertext);
        const iv = base64UrlDecodeToBytes(payload.iv);
        plaintext = await decryptCiphertext(ciphertext, iv, rawKey);
      } catch {
        // Wrong key, tampered bytes, or corrupted base64 — AES-GCM's auth
        // tag catches all three as a single failure mode.
        if (!cancelled) setState({ kind: 'bad-key' });
        return;
      }

      if (!cancelled) setState({ kind: 'ready', plaintext, burnOnRead: payload.burnOnRead });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleCopy() {
    if (state.kind !== 'ready') return;
    try {
      await navigator.clipboard.writeText(state.plaintext);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser (insecure context,
      // policy). The plaintext is still on screen — the user can select
      // and copy manually, so we just keep the button quietly unhelpful.
    }
  }

  return (
    <section style={{ maxWidth: 640 }}>
      {state.kind === 'loading' ? (
        <>
          <h2 style={stateTitle}>Decrypting…</h2>
        </>
      ) : null}

      {state.kind === 'gone' ? (
        <>
          <h2 style={stateTitle}>Nothing here</h2>
          <p style={body}>
            This note is gone. Either it was opened already, it expired, or the id doesn&apos;t
            belong to anything.
          </p>
        </>
      ) : null}

      {state.kind === 'already-read' ? (
        <>
          <h2 style={stateTitle}>Already opened</h2>
          <p style={body}>
            Someone opened this note before you. It was set to burn on read, so the plaintext is
            gone for good.
          </p>
        </>
      ) : null}

      {state.kind === 'missing-key' ? (
        <>
          <h2 style={errorTitle}>Missing key</h2>
          <p style={body}>
            This URL has no decryption key in the fragment. The sender probably trimmed the{' '}
            <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', padding: '0 4px' }}>
              #k=…
            </code>{' '}
            part by accident. Ask them to resend it.
          </p>
        </>
      ) : null}

      {state.kind === 'bad-key' ? (
        <>
          <h2 style={errorTitle}>Bad key</h2>
          <p style={body}>
            The key in the fragment doesn&apos;t decrypt this note. Either the link was tampered
            with or the URL was copied with the wrong fragment.
          </p>
        </>
      ) : null}

      {state.kind === 'ready' ? (
        <>
          <h2 style={stateTitle}>Note</h2>
          <div
            style={{
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-2)',
              padding: 16,
              marginBottom: 12,
            }}
          >
            <pre
              style={{
                margin: 0,
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {state.plaintext}
            </pre>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>

            {state.burnOnRead ? (
              <span
                style={{
                  color: 'var(--text-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                }}
              >
                This note is burned. Close the tab and it&apos;s gone.
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
