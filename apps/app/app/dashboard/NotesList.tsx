'use client';

import { useState } from 'react';
import type { NoteMetaRow } from '@/lib/types';

const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: 'clamp(20px, 2.6vw, 22px)',
  letterSpacing: '-0.01em',
  color: 'var(--text)',
  margin: '0 0 16px',
};

export interface NotesListProps {
  initialNotes: NoteMetaRow[];
}

export function NotesList({ initialNotes }: NotesListProps) {
  // Server-rendered: the initial payload is authoritative. We mutate in
  // response to per-row / bulk deletes so the UI stays consistent without a
  // round-trip for the whole list — a full refresh would need a router
  // refresh from the parent page anyway.
  const [notes, setNotes] = useState<NoteMetaRow[]>(initialNotes);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [bulkPending, setBulkPending] = useState(false);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set<string>());
  }

  async function handleBulkDelete() {
    if (bulkPending) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = window.confirm(`Delete ${ids.length} note${ids.length === 1 ? '' : 's'}? Can't be undone.`);
    if (!ok) return;
    setBulkPending(true);
    try {
      const res = await fetch('/api/notes/bulk-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) return;
      const targets = new Set(ids);
      setNotes((prev) => prev.filter((n) => !targets.has(n.id)));
      setSelectedIds(new Set<string>());
    } finally {
      setBulkPending(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm('Delete this note? Can\'t be undone.');
    if (!ok) return;
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // Leave the row in place on failure; the next page load will reconcile.
    }
  }

  return (
    <section style={{ marginBottom: 56 }}>
      <h2 style={sectionTitle}>Your notes</h2>

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
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkPending}
            style={{
              background: 'transparent',
              color: 'var(--danger)',
              border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
              borderRadius: 'var(--radius-md)',
              padding: '4px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: bulkPending ? 'progress' : 'pointer',
            }}
          >
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

      {notes.length === 0 ? (
        <p style={{ color: 'var(--text-2)' }}>no notes yet.</p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-2)',
          }}
        >
          {notes.map((n) => (
            <li
              key={n.id}
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--line-soft)',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 12,
                alignItems: 'start',
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(n.id)}
                onChange={() => toggleSelected(n.id)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer', marginTop: 4 }}
                aria-label={`select ${n.id}`}
              />
              <div style={{ display: 'grid', gap: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                  }}
                >
                  <code style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {n.id}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleDelete(n.id)}
                    style={{
                      background: 'transparent',
                      color: 'var(--danger)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-md)',
                      padding: '2px 8px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    delete
                  </button>
                </div>
                <span
                  style={{
                    color: 'var(--text-3)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                  }}
                >
                  {describeNote(n)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function describeNote(n: NoteMetaRow): string {
  const parts: string[] = [];
  parts.push(`created ${formatTs(n.created_at)}`);
  if (n.read_at !== null) parts.push(`read ${formatTs(n.read_at)}`);
  if (n.expires_at !== null) parts.push(`expires ${formatTs(n.expires_at)}`);
  parts.push(n.burn_on_read === 1 ? 'burn-on-read' : 'multi-read');
  return parts.join(' · ');
}

function formatTs(ts: number): string {
  const date = new Date(ts * 1000);
  return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}
