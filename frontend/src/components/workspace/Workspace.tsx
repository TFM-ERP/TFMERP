'use client';

/**
 * SYS-UX Phase 0 — the Workspace shell (ADDITIVE; not wired into any page yet).
 * One content-first layout every heavy module will inherit:
 *   <Workspace> <Rail/> <Main><Toolbar/><Canvas/></Main> <Panel/> </Workspace>
 * Rail collapses to icons; Panel is the progressive-disclosure drawer; full-screen
 * hides chrome for focus (the Script Reader pattern). All colors come from tokens,
 * so it themes automatically once data-theme is set on an ancestor.
 */
import { createContext, useContext, useState, type ReactNode, type CSSProperties } from 'react';

interface ShellState {
  railCollapsed: boolean; toggleRail: () => void;
  panelOpen: boolean; togglePanel: () => void;
  fullscreen: boolean; toggleFullscreen: () => void;
}
const Ctx = createContext<ShellState | null>(null);
function useShell(): ShellState {
  const c = useContext(Ctx);
  if (!c) throw new Error('Workspace parts must be rendered inside <Workspace>');
  return c;
}
/** Toolbar buttons use this to collapse the rail, toggle the panel, or go full-screen. */
export function useWorkspace(): ShellState { return useShell(); }

export function Workspace({ children, defaultRailCollapsed = false, defaultPanelOpen = true }: {
  children: ReactNode; defaultRailCollapsed?: boolean; defaultPanelOpen?: boolean;
}) {
  const [railCollapsed, setRail] = useState(defaultRailCollapsed);
  const [panelOpen, setPanel] = useState(defaultPanelOpen);
  const [fullscreen, setFull] = useState(false);
  const state: ShellState = {
    railCollapsed, toggleRail: () => setRail((v) => !v),
    panelOpen, togglePanel: () => setPanel((v) => !v),
    fullscreen, toggleFullscreen: () => setFull((v) => !v),
  };
  const wrap: CSSProperties = {
    display: 'flex', height: '100%', minHeight: 0,
    background: 'var(--surface-0)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)',
  };
  return <Ctx.Provider value={state}><div style={wrap}>{children}</div></Ctx.Provider>;
}

export function Rail({ children }: { children: ReactNode }) {
  const { railCollapsed, fullscreen } = useShell();
  if (fullscreen) return null;
  const style: CSSProperties = {
    width: railCollapsed ? 64 : 220, flexShrink: 0, overflow: 'hidden',
    borderRight: '1px solid var(--border-1)', background: 'var(--surface-1)',
    transition: 'width .18s ease', padding: 'var(--space-3) var(--space-2)',
  };
  return <aside data-rail-collapsed={railCollapsed} style={style}>{children}</aside>;
}

export function Main({ children }: { children: ReactNode }) {
  return <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>{children}</main>;
}

export function Toolbar({ children }: { children: ReactNode }) {
  const style: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-1)',
    background: 'var(--surface-1)', flexShrink: 0,
  };
  return <div style={style}>{children}</div>;
}

export function Canvas({ children }: { children: ReactNode }) {
  return <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-5)', minHeight: 0 }}>{children}</div>;
}

export function Panel({ children, title, width = 300 }: { children: ReactNode; title?: string; width?: number }) {
  const { panelOpen, fullscreen } = useShell();
  if (!panelOpen || fullscreen) return null;
  const head: CSSProperties = {
    padding: 'var(--space-3) var(--space-4)', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-3)',
    borderBottom: '1px solid var(--border-1)',
  };
  return (
    <aside style={{ width, flexShrink: 0, borderLeft: '1px solid var(--border-1)', background: 'var(--surface-1)', overflow: 'auto' }}>
      {title ? <div style={head}>{title}</div> : null}
      <div style={{ padding: 'var(--space-4)' }}>{children}</div>
    </aside>
  );
}
