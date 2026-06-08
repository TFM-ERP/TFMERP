'use client';

/**
 * TFM-System — Production module shared UI kit.
 * One source of truth for the production design system so every panel renders
 * from identical components. Accent is monochrome charcoal (#0f172a); all colour
 * comes from the semantic chip tones below.
 *
 * Tokens: accent #0f172a (slate-900) · ink slate-900 · muted slate-500 ·
 * hairline slate-200 · surface white · canvas slate-50.
 */
import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export const ACCENT = '#0f172a';

// Semantic chip tones — colour encodes meaning, never decoration.
export const TONES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600',
  cast: 'bg-violet-100 text-violet-700',   // cast / talent / people
  link: 'bg-blue-100 text-blue-700',       // location / linked entity
  need: 'bg-amber-100 text-amber-700',     // needs / permit / pending
  money: 'bg-emerald-100 text-emerald-700',// money / complete / confirmed
  risk: 'bg-rose-100 text-rose-700',       // risk / blocked / cancelled
  ink: 'bg-slate-900 text-white',          // strong / active
};

export const inputCls =
  'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none';

export function Chip({ tone = 'slate', children, className = '' }: { tone?: string; children: ReactNode; className?: string }) {
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${TONES[tone] || TONES.slate} ${className}`}>{children}</span>;
}

export function StatusPill({ tone = 'slate', children }: { tone?: string; children: ReactNode }) {
  return <Chip tone={tone}>{children}</Chip>;
}

export function Btn({ variant = 'secondary', children, className = '', ...rest }: any) {
  const base = 'text-xs inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 disabled:opacity-40 transition-colors';
  const v = variant === 'primary'
    ? 'bg-slate-900 text-white hover:bg-slate-800'
    : variant === 'danger'
    ? 'border border-rose-200 text-rose-600 hover:bg-rose-50'
    : 'border border-slate-200 text-slate-600 hover:border-slate-900';
  return <button className={`${base} ${v} ${className}`} {...rest}>{children}</button>;
}

export function PanelHeader({ icon: Icon, title, subtitle, actions }: { icon?: any; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
      <div>
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          {Icon && <Icon size={18} className="text-slate-900" />}{title}
        </h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatRow({ stats }: { stats: [string, ReactNode][] }) {
  const cols = stats.length <= 3 ? 'md:grid-cols-3' : stats.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-5';
  return (
    <div className={`grid grid-cols-2 ${cols} gap-3 mb-4`}>
      {stats.map(([label, val], i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <div className="text-2xl font-semibold text-slate-900">{val}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: [string, string][]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
      {tabs.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`text-sm px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${active === k ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function SectionLabel({ icon: Icon, children, className = '' }: { icon?: any; children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1 ${className}`}>
      {Icon && <Icon size={12} />}{children}
    </p>
  );
}

/** Expandable group card — the core "clustering" unit used across every breakdown/roster. */
export function ClusterCard({ title, meta, badges, right, defaultOpen = false, open: openProp, onToggle, children }:
  { title: ReactNode; meta?: ReactNode; badges?: ReactNode; right?: ReactNode; defaultOpen?: boolean; open?: boolean; onToggle?: () => void; children: ReactNode }) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp !== undefined ? openProp : openState;          // controlled when `open` is supplied
  const toggle = () => (onToggle ? onToggle() : setOpenState((o) => !o));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden mb-2">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button onClick={toggle} className="flex-1 flex items-center gap-2.5 text-left min-w-0">
          <ChevronRight size={15} className={`text-slate-300 transition shrink-0 ${open ? 'rotate-90' : ''}`} />
          <span className="font-medium text-slate-900 text-[15px] truncate">{title}</span>
          {badges}
        </button>
        {(meta || right) && <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-500">{meta}{right}</div>}
      </div>
      {open && <div className="border-t border-slate-100 p-4 space-y-4">{children}</div>}
    </div>
  );
}

/** Hairline data table with zebra striping — the standard scenes/rows table. */
export function DataTable({ cols, rows, minWidth = 700, align = {} }:
  { cols: string[]; rows: ReactNode[][]; minWidth?: number; align?: Record<number, 'right' | 'center'> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
            {cols.map((c, i) => <th key={i} className={`py-1.5 px-2 ${align[i] === 'right' ? 'text-right' : align[i] === 'center' ? 'text-center' : 'text-left'}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50/50' : ''}`}>
              {r.map((c, j) => <td key={j} className={`py-1.5 px-2 ${align[j] === 'right' ? 'text-right' : align[j] === 'center' ? 'text-center' : ''}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Empty-state block for "no data yet" surfaces. */
export function EmptyState({ icon: Icon, children }: { icon?: any; children: ReactNode }) {
  return (
    <div className="text-center py-14 rounded-2xl border-2 border-dashed border-slate-200">
      {Icon && <Icon className="mx-auto text-slate-300" size={36} />}
      <p className="text-slate-500 mt-2 text-sm">{children}</p>
    </div>
  );
}
