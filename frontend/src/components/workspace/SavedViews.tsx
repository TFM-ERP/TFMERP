'use client';

/**
 * SYS-UX Phase 3 — saved views widget (ADDITIVE).
 * Drop into any data-table toolbar: pick a saved filter/sort, or save the current one.
 * Wired to savedViewsApi (/me/saved-views) with a sample fallback. Themed via tokens.
 */
import { useEffect, useRef, useState } from 'react';
import { savedViewsApi } from '@/lib/api';

export type SavedView = { id: string; name: string; query: any; shared?: boolean };

export default function SavedViews({ module, query, onApply }: { module: string; query: any; onApply: (q: any) => void }) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    savedViewsApi.list(module)
      .then((d: any) => { if (Array.isArray(d)) setViews(d); })
      .catch(() => setViews([
        { id: 'v1', name: 'Overdue · this month', query: { status: 'overdue', period: 'month' } },
        { id: 'v2', name: 'Unpaid > $10k', query: { status: 'unpaid', min: 10000 } },
      ]));
  }, [module]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const apply = (v: SavedView) => { setActiveId(v.id); onApply(v.query); setOpen(false); };
  const saveCurrent = () => {
    const name = window.prompt('Name this view');
    if (!name) return;
    const optimistic: SavedView = { id: 'tmp-' + Date.now(), name, query };
    setViews((xs) => [optimistic, ...xs]); setActiveId(optimistic.id); setOpen(false);
    savedViewsApi.create({ module, name, query })
      .then((saved: any) => { if (saved?.id) setViews((xs) => xs.map((x) => (x.id === optimistic.id ? saved : x))); })
      .catch(() => { /* keep optimistic */ });
  };
  const active = views.find((v) => v.id === activeId);

  return (
    <div ref={ref} style={{ position: 'relative', fontFamily: 'var(--font-sans)' }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: '1px solid var(--border-1)', background: 'var(--surface-2)', color: 'var(--text-2)' }}>
        <span>⌂ {active ? active.name : 'Views'}</span>
        <span style={{ color: 'var(--text-3)', fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', left: 0, top: 40, width: 260, zIndex: 70, background: 'var(--surface-1)', color: 'var(--text-1)', border: '1px solid var(--border-2)', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,.4)', overflow: 'hidden' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-3)', fontWeight: 700, padding: '11px 14px 6px' }}>Saved views</div>
          {views.length === 0 && <div style={{ padding: '6px 14px 12px', fontSize: 12, color: 'var(--text-3)' }}>None yet.</div>}
          {views.map((v) => (
            <button key={v.id} onClick={() => apply(v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'start', cursor: 'pointer', border: 'none', background: v.id === activeId ? 'var(--accent-soft)' : 'transparent', color: v.id === activeId ? 'var(--accent)' : 'var(--text-1)', padding: '9px 14px', fontSize: 12.5, fontWeight: 600 }}>
              <span style={{ flex: 1 }}>{v.name}</span>{v.shared && <span style={{ fontSize: 9, color: 'var(--text-3)' }}>shared</span>}
            </button>
          ))}
          <button onClick={saveCurrent}
            style={{ width: '100%', textAlign: 'start', cursor: 'pointer', border: 'none', borderTop: '1px solid var(--border-1)', background: 'transparent', color: 'var(--accent)', padding: '10px 14px', fontSize: 12.5, fontWeight: 700 }}>
            ＋ Save current view
          </button>
        </div>
      )}
    </div>
  );
}
