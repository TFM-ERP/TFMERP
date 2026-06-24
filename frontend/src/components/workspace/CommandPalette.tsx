'use client';

/**
 * SYS-UX Phase 3 — ⌘K / Ctrl-K command palette (ADDITIVE).
 * Self-contained: listens for the shortcut, filters destinations + actions, arrow/enter to go.
 * Themed via tokens. Mount it anywhere (demo route now; app-wide behind a flag later).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type CmdItem = { label: string; href?: string; group?: string; hint?: string; run?: () => void };

export default function CommandPalette({ items, hotkey = true, openSignal = 0 }: { items: CmdItem[]; hotkey?: boolean; openSignal?: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkey]);

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  useEffect(() => { if (openSignal > 0) setOpen(true); }, [openSignal]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) => (i.label + ' ' + (i.group ?? '') + ' ' + (i.hint ?? '')).toLowerCase().includes(term));
  }, [q, items]);

  useEffect(() => { setIdx((i) => Math.min(i, Math.max(0, results.length - 1))); }, [results.length]);

  const choose = (it?: CmdItem) => {
    if (!it) return;
    setOpen(false);
    if (it.run) it.run();
    else if (it.href) router.push(it.href);
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[idx]); }
  };

  if (!open) return null;

  return (
    <div onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}>
      <div onClick={(e) => e.stopPropagation()} onKeyDown={onListKey}
        style={{ width: 'min(560px, 92vw)', maxHeight: '64vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-1)', color: 'var(--text-1)', border: '1px solid var(--border-2)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.5)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--border-1)' }}>
          <span style={{ color: 'var(--text-3)', fontSize: 15 }}>🔎</span>
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="Jump to a module, page, or action…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-1)', fontSize: 15 }} />
          <span style={{ fontSize: 10.5, color: 'var(--text-3)', border: '1px solid var(--border-2)', borderRadius: 5, padding: '2px 6px' }}>ESC</span>
        </div>
        <div style={{ overflow: 'auto', padding: 6 }}>
          {results.length === 0 && <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No matches.</div>}
          {results.map((it, i) => (
            <button key={(it.href ?? it.label) + i} onMouseEnter={() => setIdx(i)} onClick={() => choose(it)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'start', cursor: 'pointer', border: 'none', borderRadius: 9, padding: '10px 12px', marginBottom: 2,
                background: i === idx ? 'var(--accent-soft)' : 'transparent', color: i === idx ? 'var(--accent)' : 'var(--text-1)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{it.label}</span>
              {it.group && <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{it.group}</span>}
              {i === idx && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>↵</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-1)', fontSize: 11, color: 'var(--text-3)', display: 'flex', gap: 14 }}>
          <span>↑↓ navigate</span><span>↵ open</span><span>⌘K toggle</span>
        </div>
      </div>
    </div>
  );
}
