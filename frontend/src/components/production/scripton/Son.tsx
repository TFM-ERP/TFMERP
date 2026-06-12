'use client';

/**
 * ScriptON Design System (SON-DS) — React primitives over the .son CSS layer
 * (src/app/scripton-ds.css). Adopted for ScriptON + ScriptON Audio now; the same
 * tokens/classes can re-skin the rest of the platform later. Container-query driven,
 * light/dark, touch-friendly.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Ctx = { dark: boolean; setDark: (v: boolean) => void };
const SonCtx = createContext<Ctx>({ dark: false, setDark: () => {} });
export const useSon = () => useContext(SonCtx);

/** Root: establishes tokens + container context. Theme FOLLOWS the global system
 *  setting (html.dark) — no per-surface theme choice anymore. */
export function SonRoot({ children, className = '' }: { children: ReactNode; className?: string; storageKey?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains('dark'));
    sync();
    const mo = new MutationObserver(sync); // live-follow the global theme toggle
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return (
    <SonCtx.Provider value={{ dark, setDark: () => {} }}>
      <div suppressHydrationWarning className={`son ${dark ? 'son-dark' : ''} ${className}`.trim()}>{children}</div>
    </SonCtx.Provider>
  );
}

/** Retired: ScriptON surfaces follow the system theme. Kept as a no-op so call sites compile. */
export function SonThemeToggle(_props: { className?: string }) {
  return null;
}

export function SonShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`son-shell ${className}`}>{children}</div>;
}

export function SonTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="son-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={active === t.key}
          className={`son-tab ${active === t.key ? 'is-active' : ''}`} onClick={() => onChange(t.key)}>{t.label}</button>
      ))}
    </div>
  );
}

export function SonCard({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`son-card ${className}`} {...rest}>{children}</div>;
}

export function SonChip({ children, color, className = '' }: { children: ReactNode; color?: string; className?: string }) {
  return <span className={`son-chip ${className}`}>{color && <span className="son-dot" style={{ background: color }} />}{children}</span>;
}

export function SonBtn({ children, primary, className = '', ...rest }: { children: ReactNode; primary?: boolean; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`son-btn ${primary ? 'is-primary' : ''} ${className}`} {...rest}>{children}</button>;
}

/** Persistent transport / mini-player bar. */
export function SonTransport({ title, sub, playing, onToggle, position = 0, children }:
  { title: string; sub?: string; playing?: boolean; onToggle?: () => void; position?: number; children?: ReactNode }) {
  return (
    <div className="son-transport">
      <button className="son-tbtn is-play" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing
          ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
          : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
      </button>
      <div className="son-tinfo">
        <div className="t1">{title}</div>
        {sub && <div className="t2">{sub}</div>}
        <div className="son-scrub"><i style={{ width: `${Math.min(100, Math.max(0, position))}%` }} /><b style={{ left: `${Math.min(100, Math.max(0, position))}%` }} /></div>
      </div>
      {children}
    </div>
  );
}
