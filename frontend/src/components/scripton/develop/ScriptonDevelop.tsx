'use client';
/**
 * ScriptON · Develop — the structural rebuild (Figma node 69:2), behind scripton.osShell.
 * A two-pane cinematic workspace: ladder rail · stage canvas · spine/comps context.
 * Built slice-by-slice (A top bar → B two-pane shell → C per-stage canvas → D ladder+controls
 * → E render-screen glow → F responsive). `old` restores the current Builder.
 *
 * Uses the shared `.sx` design tokens (globals.css, Gate 0 #40) — NO inline palette block.
 *
 * Slice A: the unified top bar minus global search, with the centered Develop title + sub
 * (node 91:2 / 69:82-83), the workspace rail (Build active), and a placeholder stage body
 * (the two-pane content lands in slice B, wired to the real develop data — no mocks).
 */
import { useLocale } from '@/lib/i18n';
import { SxRail } from '@/components/scripton/ScriptOnStudio';
import ScriptonTopBar from '@/components/scripton/topbar/ScriptonTopBar';

export type ScriptonDevelopProps = {
  vp: 'mobile' | 'tablet' | 'desktop';
  onBack?: () => void;
};

// Node 69:2 — the body sits on #0a0b0e; the 76px rail on #0c0d11; panels #14161c hairlined.
const CSS = `
.sx.develop{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;height:100%;background:#0a0b0e;color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.develop *{box-sizing:border-box;margin:0;padding:0}
.sx.develop svg{display:block}
.sx.develop .body{flex:1;display:flex;min-height:0}
/* Workspace rail (SxRail renders the markup; the host screen styles it) — node 69:34: 76px / #0c0d11 */
.sx.develop .rail{width:76px;flex:0 0 76px;background:#0c0d11;border-inline-end:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px;overflow-y:auto}
.sx.develop .ritem{width:58px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);cursor:pointer;position:relative;border:none;background:transparent}
.sx.develop .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mute)}
.sx.develop .ritem .lbl{font-size:9px;font-weight:600}
.sx.develop .ritem:hover .box{border-color:var(--hair2);color:var(--cream)}
.sx.develop .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink);box-shadow:0 6px 16px -4px rgba(198,164,99,.5)}
.sx.develop .ritem.on .lbl{color:var(--gold2)}
.sx.develop .ritem.on:before{content:"";position:absolute;inset-inline-start:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
/* Stage area — placeholder until slice B wires the two-pane shell to real develop data */
.sx.develop .stagewrap{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;padding:28px}
.sx.develop .ph{color:var(--faint);font-size:12.5px}
`;

export default function ScriptonDevelop(props: ScriptonDevelopProps) {
  const { dir } = useLocale();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx develop" data-vp={props.vp} dir={dir}>
        <ScriptonTopBar
          vp={props.vp}
          onBack={props.onBack}
          centerTitle={{ title: 'Develop', sub: 'Nothing is written until the spine is agreed.' }}
        />
        <div className="body">
          <SxRail active="develop" />
          <div className="stagewrap">
            <div className="ph">Two-pane workspace — slice B.</div>
          </div>
        </div>
      </div>
    </>
  );
}
