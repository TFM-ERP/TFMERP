'use client';

import { ReactNode } from 'react';

/**
 * Cinematic page header — the gold-kicker title used across the system's inner
 * list pages, matching the Film Slate / Assets marquees. Theme-aware via the
 * global token sheet (Graphite light · Charcoal Black dark); gold is the accent.
 *
 *   <CinematicHeader kicker="Production · People" title="Crew Directory" count="128 people">
 *     <button className="btn btn-primary">+ Add</button>
 *   </CinematicHeader>
 *   {chips && <CinematicChips items={[...]} value={f} onChange={setF} />}
 */
export function CinematicHeader({
  kicker, title, count, children,
}: {
  kicker?: string; title: string; count?: string | number; children?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-5 flex-wrap">
      <div className="min-w-0">
        {kicker && (
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>
            {kicker}
          </div>
        )}
        <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>
          {title}
          {count != null && <span className="text-[12px] font-normal ml-2" style={{ color: 'var(--text-3)' }}>{count}</span>}
        </h1>
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}

/** Gold/charcoal filter chips — active fills with the accent, matching tiles. */
export function CinematicChips({
  items, value, onChange, className = '',
}: {
  items: { value: string; label: string }[]; value: string; onChange: (v: string) => void; className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 mb-4 ${className}`}>
      {items.map((it) => {
        const on = value === it.value;
        return (
          <button key={it.value || 'all'} onClick={() => onChange(it.value)}
            className="rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors"
            style={on
              ? { background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--surface-1)' }
              : { background: 'var(--surface-1)', border: '1px solid var(--border-1)', color: 'var(--text-2)' }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
