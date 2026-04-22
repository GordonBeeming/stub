import { useCallback, useEffect, useState } from 'react';
import { NameList, NameRow } from '@gordonbeeming/design-system';
import { buildShortUrl, type LinkClickRow, type LinkRow } from '../lib/types';
import { SectionTitle } from './SectionTitle';

export interface LinksListProps {
  initialLinks: LinkRow[];
  siteUrl: string;
}

const cellPad: React.CSSProperties = { padding: '0 14px' };

export function LinksList({ initialLinks, siteUrl }: LinksListProps) {
  const [links, setLinks] = useState<LinkRow[]>(initialLinks);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [bulkPending, setBulkPending] = useState(false);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set<string>());
  }, []);

  const onBulkDelete = useCallback(async () => {
    if (bulkPending) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`delete ${ids.length} link${ids.length === 1 ? '' : 's'}? this can't be undone.`)) return;

    setBulkPending(true);
    try {
      const res = await fetch('/api/links/bulk-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) return;
      const targets = new Set(ids);
      setLinks((prev) => prev.filter((l) => !targets.has(l.id)));
      setSelectedIds(new Set<string>());
    } finally {
      setBulkPending(false);
    }
  }, [bulkPending, selectedIds]);

  const onToggleDisabled = useCallback(async (link: LinkRow) => {
    const next = link.disabled === 1 ? false : true;
    const res = await fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ disabled: next }),
    });
    if (!res.ok) return;
    const json = (await res.json()) as { link: LinkRow };
    setLinks((prev) => prev.map((l) => (l.id === link.id ? json.link : l)));
  }, []);

  const onDelete = useCallback(async (link: LinkRow) => {
    if (!window.confirm(`delete /${link.id}? this can't be undone.`)) return;
    const res = await fetch(`/api/links/${link.id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
  }, []);

  return (
    <>
      <SectionTitle eyebrow="short links">Your links</SectionTitle>
      {selectedIds.size > 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 12px',
            marginBottom: 12,
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-2)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {selectedIds.size} selected
          </span>
          <button type="button" onClick={onBulkDelete} disabled={bulkPending} style={dangerBtn}>
            {bulkPending ? 'deleting…' : 'delete'}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            style={{
              background: 'transparent',
              color: 'var(--text-3)',
              border: 0,
              padding: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            clear
          </button>
        </div>
      ) : null}

      {links.length === 0 ? (
        <p style={{ color: 'var(--text-2)' }}>no links yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 0 }}>
          <NameList>
            {links.map((link) => (
              <div
                key={link.id}
                style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'stretch' }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 12px',
                    borderRight: '1px solid var(--line-soft)',
                    cursor: 'pointer',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(link.id)}
                    onChange={() => toggleSelected(link.id)}
                    style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                    aria-label={`select ${link.id}`}
                  />
                </label>
                <LinkListItem
                  link={link}
                  siteUrl={siteUrl}
                  onToggleDisabled={() => onToggleDisabled(link)}
                  onDelete={() => onDelete(link)}
                />
              </div>
            ))}
          </NameList>
        </div>
      )}
    </>
  );
}

interface LinkListItemProps {
  link: LinkRow;
  siteUrl: string;
  onToggleDisabled: () => void;
  onDelete: () => void;
}

function LinkListItem({ link, siteUrl, onToggleDisabled, onDelete }: LinkListItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [clicks, setClicks] = useState<LinkClickRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shortUrl = buildShortUrl(link.id, siteUrl);
  const badge = resolveBadge(link);

  useEffect(() => {
    if (!expanded || clicks !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/links/${link.id}/clicks`)
      .then((r) => r.json() as Promise<{ clicks?: LinkClickRow[] }>)
      .then((j) => {
        if (cancelled) return;
        setClicks(j.clicks ?? []);
      })
      .catch(() => {
        if (!cancelled) setClicks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, clicks, loading, link.id]);

  async function onCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be blocked (insecure context). Fall back silently
      // — the URL is still visible in the row for manual copy.
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        <NameRow
          word={link.id}
          badge={badge ? { label: badge.label, variant: badge.variant } : undefined}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            <span
              style={{
                color: 'var(--text-2)',
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '48ch',
              }}
            >
              {link.url}
            </span>
            <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {link.click_count.toLocaleString()} click{link.click_count === 1 ? '' : 's'}
              {link.max_clicks !== null ? ` / ${link.max_clicks.toLocaleString()}` : ''}
              {link.expires_at !== null ? ` · expires ${formatTs(link.expires_at)}` : ''}
            </span>
          </div>
        </NameRow>
      </div>

      {expanded ? (
        <div
          style={{
            background: 'var(--bg-3)',
            borderTop: '1px solid var(--line-soft)',
            padding: '14px 16px',
            display: 'grid',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <code
              style={{
                color: 'var(--primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                wordBreak: 'break-all',
              }}
            >
              {shortUrl}
            </code>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={onCopy} style={ghostBtn}>
                {copied ? 'copied' : 'copy'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleDisabled();
                }}
                style={ghostBtn}
              >
                {link.disabled === 1 ? 'enable' : 'disable'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                style={dangerBtn}
              >
                delete
              </button>
            </div>
          </div>

          <div>
            <div
              style={{
                color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              recent clicks
            </div>
            {loading ? (
              <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>loading…</p>
            ) : !clicks || clicks.length === 0 ? (
              <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>no clicks yet.</p>
            ) : (
              <div
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-2)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '180px 1fr 90px 90px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-3)',
                    borderBottom: '1px solid var(--line-soft)',
                    padding: '8px 0',
                  }}
                >
                  <div style={cellPad}>when</div>
                  <div style={cellPad}>referrer</div>
                  <div style={cellPad}>ua</div>
                  <div style={cellPad}>country</div>
                </div>
                {clicks.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '180px 1fr 90px 90px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--text-2)',
                      borderBottom: '1px solid var(--line-soft)',
                      padding: '6px 0',
                    }}
                  >
                    <div style={cellPad}>{formatTs(c.clicked_at)}</div>
                    <div style={cellPad}>{c.referrer_host ?? '—'}</div>
                    <div style={cellPad}>{c.ua_family ?? '—'}</div>
                    <div style={cellPad}>{c.country ?? '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Badge = { label: string; variant: 'top' | 'alt' | 'quirky' };

function resolveBadge(link: LinkRow): Badge | null {
  const now = Math.floor(Date.now() / 1000);
  if (link.disabled === 1) return { label: 'disabled', variant: 'quirky' };
  if (link.expires_at !== null && link.expires_at < now) return { label: 'expired', variant: 'quirky' };
  if (link.max_clicks !== null && link.click_count >= link.max_clicks) {
    return { label: 'exhausted', variant: 'quirky' };
  }
  return { label: 'live', variant: 'top' };
}

function formatTs(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-md)',
  padding: '6px 10px',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const dangerBtn: React.CSSProperties = {
  ...ghostBtn,
  color: 'var(--danger)',
  borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)',
};
