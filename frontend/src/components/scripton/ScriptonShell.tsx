'use client';
/**
 * ScriptonShell — the ONE shell every ScriptON (new-shell) route renders: the shared top bar
 * (ScriptonTopBar) + the 76px workspace rail (SxRail) + a content slot. Screens pass only their
 * body as `children`; the chrome is assembled here once, so no route can lose the bar/rail or
 * drift. Replaces the per-screen `<div className="sx X"><ScriptonTopBar/><div className="body">
 * <SxRail/>…</div></div>` boilerplate that previously diverged screen-to-screen.
 *
 * Notes:
 * - `screen` is the CSS modifier (e.g. 'canon'): bodies are scoped `.sx.<screen> …`, so the shell
 *   MUST apply `sx <screen>` + the fixed full-screen positioning each container relied on.
 * - `topbar` is spread onto ScriptonTopBar — pass-through for centerTitle/noSearch (Develop) and
 *   scriptId/continuity/versionLabel (Compare/Write/Develop). Don't hardcode bar props here.
 * - `rail={false}` drops the rail (portrait); `bodyClassName` overrides the body wrapper class
 *   (Develop portrait uses 'pbody'). `overlay` renders at the .sx level (toasts/modals).
 */
import type { ReactNode } from 'react';
import { useLocale } from '@/lib/i18n';
import ScriptonTopBar, { type ScriptonTopBarProps } from './topbar/ScriptonTopBar';
import { SxRail } from './shared/sx';

export type ScriptonShellProps = {
  screen: string;                                    // CSS modifier + identity, e.g. 'canon' | 'vers' | 'develop'
  active: string;                                    // rail active key, e.g. 'revisions'
  vp: 'mobile' | 'tablet' | 'desktop';
  onBack?: () => void;
  onNav?: (k: string) => void;
  topbar?: Partial<ScriptonTopBarProps>;             // pass-through onto ScriptonTopBar
  rail?: boolean;                                    // default true; false → no rail (portrait)
  bodyClassName?: string;                            // default 'body'; Develop portrait → 'pbody'
  overlay?: ReactNode;                               // .sx-level siblings (toast / modals)
  children: ReactNode;                               // the screen's body content
};

export default function ScriptonShell(props: ScriptonShellProps) {
  const { dir } = useLocale();
  const { screen, active, vp, onBack, onNav, topbar, rail = true, bodyClassName = 'body', overlay, children } = props;
  return (
    <div className={'sx ' + screen} data-vp={vp} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ScriptonTopBar vp={vp} onBack={onBack} {...topbar} />
      <div className={bodyClassName}>
        {rail && <SxRail active={active} onNav={onNav} />}
        {children}
      </div>
      {overlay}
    </div>
  );
}
