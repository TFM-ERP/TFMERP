'use client';
/**
 * ScriptON · Write (the canvas) — route /scripton/reader under the `new` shell
 * flag. Slice 1: the Story Spine + the script-paper canvas (read-only). Reuses
 * the Reader's Courier `.page` paper rendering; the spine replaces the scene-nav
 * and the Revision Pass panel (slice 2) replaces the doctor dock, per the loved
 * mockup (scripon-v4-revision-pass.html) + Figma 1:2.
 */
import { useMemo, useRef } from 'react';
import { SxRail } from '@/components/scripton/ScriptOnStudio';
import { ScriptPaper } from '@/components/scripton/scriptPaper';
import { useLocale } from '@/lib/i18n';
import type { SxScene } from '@/components/scripton/ScriptOnReader';

const ACTS = [
  { name: 'I', color: '#5b8def' },
  { name: 'II', color: '#C6A463' },
  { name: 'III', color: '#57b368' },
];
const actOf = (i: number, n: number) => (n <= 1 ? 0 : Math.min(2, Math.floor((i / n) * 3)));

const CSS = `
.sx.write{--bg:#0a0b0e;--panel:#14161c;--ink:#0e1014;--paper:#16181e;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#15120B;--cream:#F4EEE0;--text:#E7E3D8;--mut:#9aa1ab;--faint:#6b727d;--green:#57b368;--blue:#5b8def;position:relative;display:flex;flex-direction:column;height:100%;background:var(--bg);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.write *{box-sizing:border-box;margin:0;padding:0}
.sx.write svg{display:block}
.sx.write .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx.write .top{height:56px;flex:0 0 56px;display:flex;align-items:center;gap:14px;padding:0 18px;background:linear-gradient(180deg,#14161c,#101216);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx.write .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;cursor:pointer;flex:none}
.sx.write .proj{font-weight:700;font-size:15px;color:var(--cream);font-family:var(--sx-title);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.write .pill{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.sx.write .pill .d{width:7px;height:7px;border-radius:50%;flex:none}
.sx.write .pageind{margin:0 auto;display:flex;align-items:center;gap:10px;color:var(--mut);font-size:12px}
.sx.write .pageind b{color:var(--cream);font-weight:600}
.sx.write .nudge{width:26px;height:26px;border:1px solid var(--hair);border-radius:7px;display:grid;place-items:center;color:var(--mut);cursor:pointer;background:transparent}
.sx.write .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx.write .rail{width:74px;flex:0 0 74px;background:#0e1015;border-inline-end:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px;overflow-y:auto}
.sx.write .ritem{width:58px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);cursor:pointer;position:relative;border:none;background:transparent}
.sx.write .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mut)}
.sx.write .ritem .lbl{font-size:9px;font-weight:600}
.sx.write .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink)}
.sx.write .ritem.on .lbl{color:var(--gold2)}
.sx.write .ritem.on:before{content:"";position:absolute;inset-inline-start:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
.sx.write .main{flex:1;display:flex;min-height:0}

/* Story Spine */
.sx.write .spine{width:66px;flex:none;border-inline-end:1px solid var(--hair);background:#0c0d11;position:relative;display:flex;flex-direction:column}
.sx.write .spine .cap{font-size:8.5px;font-weight:700;letter-spacing:1px;color:var(--faint);text-align:center;padding:10px 0 6px;text-transform:uppercase;flex:0 0 auto}
.sx.write .spinetrack{flex:1;min-height:0;display:flex;flex-direction:column;padding:4px 0 10px}
.sx.write .spact{flex:1;min-height:0;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:0;border-top:2px solid var(--hair)}
.sx.write .spactlbl{font-family:var(--sx-title);font-size:11px;font-weight:600;margin:6px 0 4px;opacity:.85}
.sx.write .spdot{width:9px;height:9px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:#1a1d24;cursor:pointer;margin:3px 0;flex:none}
.sx.write .spdot.on{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;box-shadow:0 0 0 3px rgba(198,164,99,.18)}
.sx.write .spdot.staged{box-shadow:0 0 0 2px rgba(198,164,99,.5)}

/* Canvas (paper) */
.sx.write .canvas{flex:1;min-width:0;overflow:auto;background:linear-gradient(180deg,#0b0c0f,#090a0c);display:flex;justify-content:center;padding:26px 0 60px}
.sx.write .empty{color:var(--faint);font-size:13px;text-align:center;padding:40px;align-self:flex-start}
.sx.write .sk{background:linear-gradient(90deg,#16181e,#1c1f27,#16181e);background-size:200% 100%;animation:wkp 1.3s ease-in-out infinite;border-radius:8px}
@keyframes wkp{0%{background-position:200% 0}100%{background-position:-200% 0}}
.sx.write .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px}

/* Tablet: spine narrows */
.sx.write[data-vp="tablet"] .spine{width:48px}
/* Mobile: paper leads, spine becomes a slim top scrubber is overkill for slice 1 — keep a slim spine */
.sx.write[data-vp="mobile"] .spine{width:30px}
.sx.write[data-vp="mobile"] .spact .spactlbl{display:none}
`;

const fmtSlug = (s: SxScene) => s.slugline || [s.intExt, s.dayNight].filter(Boolean).join('. ').toUpperCase() || 'SCENE';

export type WriteProps = {
  title: string; revisionLabel: string; revisionColor: string;
  scenes: SxScene[]; activeId?: string; onSelectScene: (id: string) => void;
  pageCount?: number | string; loading?: boolean;
  stagedSceneIds?: string[];
  onNav: (k: string) => void; onBack: () => void; toast?: string | null;
  vp: 'mobile' | 'tablet' | 'desktop';
};

export default function ScriptonWrite(props: WriteProps) {
  const { dir, t } = useLocale();
  const scenes = props.scenes || [];
  const n = scenes.length;
  const active = scenes.find((s) => s.id === props.activeId) || scenes[0];
  const activeIdx = Math.max(0, scenes.findIndex((s) => s.id === active?.id));
  const staged = new Set(props.stagedSceneIds || []);
  const canvasRef = useRef<HTMLDivElement>(null);
  // Build the screenplay text from scenes for the shared ScriptPaper renderer
  // (the same component the Reader/print use — not a forked paper).
  const scriptText = useMemo(() => scenes.map((s) => {
    const slug = fmtSlug(s); const action = (s.description || '').trim();
    return slug + (action ? '\n\n' + action : '');
  }).join('\n\n'), [scenes]);
  // Spine click → select the scene + scroll the canvas to its heading (Nth .uvp-slug).
  const goScene = (i: number) => {
    if (i < 0 || i >= scenes.length) return;
    props.onSelectScene(scenes[i].id);
    const host = canvasRef.current; if (!host) return;
    const slug = host.querySelectorAll('.uvp-slug')[i] as HTMLElement | undefined;
    if (slug) slug.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // group scene indices by act for the spine
  const byAct: number[][] = [[], [], []];
  scenes.forEach((_, i) => byAct[actOf(i, n)].push(i));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx write" data-vp={props.vp} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="logo" onClick={props.onBack} title={t('Back to TFM')}>TFM</div>
          <div className="proj">{props.title}</div>
          <span className="pill" style={{ background: props.revisionColor + '28', color: props.revisionColor }}>
            <span className="d" style={{ background: props.revisionColor }} />{props.revisionLabel.toUpperCase()}
          </span>
          <div className="pageind">
            <span className="nudge" onClick={() => goScene(activeIdx - 1)}>‹</span>
            <b>{t('Scene')} {n ? activeIdx + 1 : '—'}</b> / {n || '—'}
            <span className="nudge" onClick={() => goScene(activeIdx + 1)}>›</span>
          </div>
        </div>
        <div className="body">
          <SxRail active="write" onNav={props.onNav} />
          <div className="main">
            {/* Story Spine */}
            <div className="spine">
              <div className="cap">{t('Spine')}</div>
              <div className="spinetrack">
                {ACTS.map((act, ai) => (
                  <div className="spact" key={ai} style={{ borderTopColor: act.color + '88', flexGrow: Math.max(1, byAct[ai].length) }}>
                    <div className="spactlbl" style={{ color: act.color }}>{act.name}</div>
                    {byAct[ai].map((i) => (
                      <button key={scenes[i].id} className={'spdot' + (i === activeIdx ? ' on' : '') + (staged.has(scenes[i].id) ? ' staged' : '')}
                        title={`${t('Scene')} ${i + 1}`} onClick={() => goScene(i)} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {/* Canvas — the shared ScriptPaper renderer (continuous Courier A4) */}
            <div className="canvas" ref={canvasRef}>
              {props.loading ? (
                <div className="sk" style={{ height: 760, width: 600, maxWidth: '94%', borderRadius: 6 }} />
              ) : !scenes.length ? (
                <div className="empty">{t('No scenes in this revision yet.')}</div>
              ) : (
                <ScriptPaper text={scriptText} />
              )}
            </div>
          </div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
