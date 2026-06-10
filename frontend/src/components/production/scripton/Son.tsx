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

/** Root: establishes tokens + container context + theme. Persists choice. */
export function SonRoot({ children, className = '', storageKey = 'son-theme' }: { children: ReactNode; className?: string; storageKey?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    try {
      const v = localStorage.getItem(storageKey);
      if (v === 'dark') setDark(true);
      else if (v === null) setDark(document.documentElement.classList.contains('dark'));
    } catch { /* ignore */ }
  }, [storageKey]);
  const set = (v: boolean) => { setDark(v); try { localStorage.setItem(storageKey, v ? 'dark' : 'light'); } catch { /* ignore */ } };
  // Until mounted, render the exact same markup the server produced (no theme class) to avoid
  // any hydration mismatch; the theme is applied on the client right after hydration.
  return (
    <SonCtx.Provider value={{ dark, setDark: set }}>
      <div suppressHydrationWarning className={`son ${mounted && dark ? 'son-dark' : ''} ${className}`.trim()}>{children}</div>
    </SonCtx.Provider>
  );
}

export function SonThemeToggle({ className = '' }: { className?: string }) {
  const { dark, setDark } = useSon();
  return (
    <button type="button" onClick={() => setDark(!dark)} title={dark ? 'Switch to light' : 'Switch to dark'}
      className={`son-iconbtn ${className}`} aria-label="Toggle theme">
      {dark
        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>}
    </button>
  );
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
