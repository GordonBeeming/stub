'use client';

import { useCallback, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { base64UrlEncodeBytes } from '@/lib/crypto';
import { buildShortUrl, type LinkRow } from '@/lib/types';
import { encryptPlaintext } from '@/app/_notes/crypto';

export interface CreatePanelProps {
  siteUrl: string;
}

type Mode = 'link' | 'note';

interface LinkFormState {
  url: string;
  slug: string;
  expiresAt: string;
  maxClicks: string;
}

interface NoteFormState {
  plaintext: string;
  // TTL encoded as seconds; empty string means "no expiry" so it round-trips
  // cleanly through the <select>.
  ttlSeconds: string;
  burnOnRead: boolean;
}

interface ResultState {
  mode: Mode;
  url: string;
}

const EMPTY_LINK: LinkFormState = { url: '', slug: '', expiresAt: '', maxClicks: '' };
const EMPTY_NOTE: NoteFormState = {
  plaintext: '',
  ttlSeconds: String(24 * 3600),
  burnOnRead: true,
};

export function CreatePanel({ siteUrl }: CreatePanelProps) {
  const [mode, setMode] = useState<Mode>('link');
  const [linkForm, setLinkForm] = useState<LinkFormState>(EMPTY_LINK);
  const [noteForm, setNoteForm] = useState<NoteFormState>(EMPTY_NOTE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [copied, setCopied] = useState(false);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setError(null);
    setResult(null);
    setCopied(false);
    setLinkForm(EMPTY_LINK);
    setNoteForm(EMPTY_NOTE);
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setCopied(false);
    setError(null);
    setLinkForm(EMPTY_LINK);
    setNoteForm(EMPTY_NOTE);
  }, []);

  const onLinkSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (pending) return;
      setError(null);
      setPending(true);
      try {
        const body: Record<string, unknown> = { url: linkForm.url.trim() };
        if (linkForm.slug.trim()) body.slug = linkForm.slug.trim();
        if (linkForm.expiresAt) {
          const ts = Math.floor(new Date(linkForm.expiresAt).getTime() / 1000);
          if (Number.isFinite(ts) && ts > 0) body.expiresAt = ts;
        }
        if (linkForm.maxClicks.trim()) {
          const n = Number.parseInt(linkForm.maxClicks, 10);
          if (Number.isFinite(n) && n > 0) body.maxClicks = n;
        }

        const res = await fetch('/api/links', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { link?: LinkRow; error?: string };
        if (!res.ok || !json.link) {
          setError(json.error ?? `request failed (${res.status})`);
          return;
        }
        setResult({ mode: 'link', url: buildShortUrl(json.link.id, siteUrl) });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'unknown error');
      } finally {
        setPending(false);
      }
    },
    [linkForm, pending, siteUrl],
  );

  const onNoteSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (pending) return;
      if (!noteForm.plaintext) return;
      setError(null);
      setPending(true);

      let ciphertext: Uint8Array;
      let iv: Uint8Array;
      let rawKey: Uint8Array;
      try {
        const bundle = await encryptPlaintext(noteForm.plaintext);
        ciphertext = bundle.ciphertext;
        iv = bundle.iv;
        rawKey = bundle.rawKey;
      } catch {
        setError('encryption failed in the browser. try again.');
        setPending(false);
        return;
      }

      let expiresAt: number | null = null;
      if (noteForm.ttlSeconds) {
        const secs = Number.parseInt(noteForm.ttlSeconds, 10);
        if (Number.isFinite(secs) && secs > 0) {
          expiresAt = Math.floor(Date.now() / 1000) + secs;
        }
      }

      try {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ciphertext: base64UrlEncodeBytes(ciphertext),
            iv: base64UrlEncodeBytes(iv),
            expiresAt,
            burnOnRead: noteForm.burnOnRead,
          }),
        });
        if (!res.ok) {
          if (res.status === 413) {
            setError('note is too large (256 KiB cap).');
          } else {
            setError('server rejected the note.');
          }
          return;
        }
        const data = (await res.json()) as { id: string };
        // window.location.origin so the fragment-carrying URL stays on the
        // same host that just produced the key. Using siteUrl would cross
        // origins in local dev and silently strip the fragment on paste.
        const url = `${window.location.origin}/n/${data.id}#k=${base64UrlEncodeBytes(rawKey)}`;
        setResult({ mode: 'note', url });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'could not create the note.');
      } finally {
        setPending(false);
      }
    },
    [noteForm, pending],
  );

  const onCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context). URL is still on-screen.
    }
  }, [result]);

  return (
    <div style={panelStyle}>
      <div role="tablist" aria-label="create a stub" style={toggleRowStyle}>
        <SegButton active={mode === 'link'} onClick={() => switchMode('link')}>
          short link
        </SegButton>
        <SegButton active={mode === 'note'} onClick={() => switchMode('note')}>
          burn note
        </SegButton>
      </div>

      {mode === 'link' ? (
        <form onSubmit={onLinkSubmit} style={formStyle}>
          <input
            type="url"
            required
            placeholder="https://example.com/path"
            value={linkForm.url}
            onChange={(e) => {
              setLinkForm((f) => ({ ...f, url: e.target.value }));
              if (error) setError(null);
            }}
            style={bigInputStyle}
            aria-label="destination url"
          />

          {error ? <p style={errorStyle}>{'// '}{error}</p> : null}

          <div style={submitRowStyle}>
            <button type="submit" disabled={pending} style={primaryBtn}>
              {pending ? 'shortening…' : 'shorten'}
            </button>
          </div>

          <details style={detailsStyle}>
            <summary style={summaryStyle}>{'// advanced options'}</summary>
            <div style={advGridStyle}>
              <Field label="custom slug">
                <input
                  type="text"
                  pattern="[a-z0-9\-]{3,32}"
                  placeholder="auto-generated"
                  value={linkForm.slug}
                  onChange={(e) => setLinkForm((f) => ({ ...f, slug: e.target.value }))}
                  style={smallInputStyle}
                />
              </Field>
              <Field label="expires at">
                <input
                  type="datetime-local"
                  value={linkForm.expiresAt}
                  onChange={(e) => setLinkForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  style={smallInputStyle}
                />
              </Field>
              <Field label="max clicks">
                <input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="∞"
                  value={linkForm.maxClicks}
                  onChange={(e) => setLinkForm((f) => ({ ...f, maxClicks: e.target.value }))}
                  style={smallInputStyle}
                />
              </Field>
            </div>
          </details>
        </form>
      ) : (
        <form onSubmit={onNoteSubmit} style={formStyle}>
          <textarea
            required
            rows={8}
            placeholder="paste the secret here. encrypted in your browser before it leaves."
            value={noteForm.plaintext}
            onChange={(e) => {
              setNoteForm((f) => ({ ...f, plaintext: e.target.value }));
              if (error) setError(null);
            }}
            style={textareaStyle}
            aria-label="plaintext to encrypt"
          />

          {error ? <p style={errorStyle}>{'// '}{error}</p> : null}

          <div style={submitRowStyle}>
            <button
              type="submit"
              disabled={pending || !noteForm.plaintext}
              style={primaryBtn}
            >
              {pending ? 'encrypting…' : 'generate share link'}
            </button>
          </div>

          <details style={detailsStyle}>
            <summary style={summaryStyle}>{'// advanced options'}</summary>
            <div style={advGridStyle}>
              <Field label="expires in">
                <select
                  value={noteForm.ttlSeconds}
                  onChange={(e) =>
                    setNoteForm((f) => ({ ...f, ttlSeconds: e.target.value }))
                  }
                  style={smallInputStyle}
                >
                  <option value={String(3600)}>1 hour</option>
                  <option value={String(24 * 3600)}>24 hours</option>
                  <option value={String(7 * 24 * 3600)}>7 days</option>
                  <option value="">no expiry</option>
                </select>
              </Field>
              <Field label="burn on read">
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={noteForm.burnOnRead}
                    onChange={(e) =>
                      setNoteForm((f) => ({ ...f, burnOnRead: e.target.checked }))
                    }
                    style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span>delete after first read</span>
                </label>
              </Field>
            </div>
          </details>
        </form>
      )}

      {result ? (
        <>
          <div style={resultCardStyle}>
            <div style={eyebrowStyle}>
              {result.mode === 'link' ? '// your link' : '// your share url'}
            </div>
            <div style={resultRowStyle}>
              <code style={resultUrlStyle}>{result.url}</code>
              <button
                type="button"
                onClick={onCopy}
                style={copied ? copyBtnActive : copyBtn}
              >
                {copied ? 'copied' : 'copy'}
              </button>
            </div>
            {result.mode === 'note' ? (
              <p style={noteCaptionStyle}>
                {'// the key lives in the '}
                <code style={{ color: 'var(--text-2)' }}>#k=</code>
                {' fragment and never touches the server.'}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={reset} style={resetLinkStyle}>
            {'// create another'}
          </button>
        </>
      ) : null}
    </div>
  );
}

interface SegButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function SegButton({ active, onClick, children }: SegButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={active ? segBtnActive : segBtnIdle}
    >
      {children}
    </button>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

// --- styles -----------------------------------------------------------------

const panelStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
};

const toggleRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const segBtnIdle: CSSProperties = {
  background: 'transparent',
  color: 'var(--text-2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 16px',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  cursor: 'pointer',
  transition: 'color 0.15s ease, border-color 0.15s ease',
};

const segBtnActive: CSSProperties = {
  ...segBtnIdle,
  color: 'var(--primary)',
  borderColor: 'var(--primary)',
};

const formStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
};

const bigInputStyle: CSSProperties = {
  width: '100%',
  background: 'var(--bg-2)',
  color: 'var(--text)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-md)',
  padding: '14px 16px',
  fontFamily: 'var(--font-mono)',
  fontSize: 14,
  boxSizing: 'border-box',
};

const textareaStyle: CSSProperties = {
  ...bigInputStyle,
  resize: 'vertical',
  lineHeight: 1.55,
};

const submitRowStyle: CSSProperties = {
  display: 'flex',
};

const primaryBtn: CSSProperties = {
  background: 'var(--primary)',
  color: '#000',
  border: 0,
  borderRadius: 'var(--radius-md)',
  padding: '12px 20px',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  width: '100%',
};

const detailsStyle: CSSProperties = {
  border: '1px solid var(--line-soft)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-2)',
  padding: '12px 16px',
};

const summaryStyle: CSSProperties = {
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  listStyle: 'none',
};

const advGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
  marginTop: 12,
};

const labelStyle: CSSProperties = {
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
};

const smallInputStyle: CSSProperties = {
  background: 'var(--bg)',
  color: 'var(--text)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 10px',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
};

const checkboxLabelStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 8,
  alignItems: 'center',
  color: 'var(--text-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  padding: '8px 0',
};

const errorStyle: CSSProperties = {
  color: 'var(--danger)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  margin: 0,
};

const resultCardStyle: CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--line)',
  borderLeft: '2px solid var(--primary)',
  borderRadius: 'var(--radius-md)',
  padding: '20px 24px',
  display: 'grid',
  gap: 10,
  marginTop: 8,
};

const eyebrowStyle: CSSProperties = {
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
};

const resultRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  justifyContent: 'space-between',
};

const resultUrlStyle: CSSProperties = {
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 15,
  wordBreak: 'break-all',
  flex: '1 1 280px',
};

const copyBtn: CSSProperties = {
  background: 'transparent',
  color: 'var(--text-2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-md)',
  padding: '6px 12px',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  cursor: 'pointer',
  transition: 'color 0.15s ease, border-color 0.15s ease',
};

const copyBtnActive: CSSProperties = {
  ...copyBtn,
  color: 'var(--primary)',
  borderColor: 'var(--primary)',
};

const noteCaptionStyle: CSSProperties = {
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  margin: 0,
};

const resetLinkStyle: CSSProperties = {
  background: 'transparent',
  color: 'var(--text-3)',
  border: 0,
  padding: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  textAlign: 'left',
  cursor: 'pointer',
  justifySelf: 'start',
};
