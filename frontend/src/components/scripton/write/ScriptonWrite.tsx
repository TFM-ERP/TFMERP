'use client';
/**
 * ScriptON · Write (the canvas) — route /scripton/reader under the `new` shell
 * flag. Slice 1: the Story Spine + the script-paper canvas (read-only). Reuses
 * the Reader's Courier `.page` paper rendering; the spine replaces the scene-nav
 * and the Revision Pass panel (slice 2) replaces the doctor dock, per the loved
 * mockup (scripon-v4-revision-pass.html) + Figma 1:2.
 */
import { useMemo, useRef, useState } from 'react';
import { SxRail } from '@/components/scripton/ScriptOnStudio';
import { ScriptPaper } from '@/components/scripton/scriptPaper';
import ScriptonTopBar from '@/components/scripton/topbar/ScriptonTopBar';
import { useLocale } from '@/lib/i18n';
import type { SxScene } from '@/components/scripton/ScriptOnReader';

const ACTS = [
  { name: 'I', color: '#5b8def' },
  { name: 'II', color: '#C6A463' },
  { name: 'III', color: '#57b368' },
];
const actOf = (i: number, n: number) => (n <= 1 ? 0 : Math.min(2, Math.floor((i / n) * 3)));

const CSS = `
.sx.write{--bg:#0a0b0e;--panel:#14161c;--ink:#0e1014;--paper:#F7F4EC;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#15120B;--cream:#F4EEE0;--text:#E7E3D8;--mut:#9aa1ab;--faint:#6b727d;--green:#57b368;--blue:#5b8def;position:relative;display:flex;flex-direction:column;height:100%;background:var(--bg);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.write *{box-sizing:border-box;margin:0;padding:0}
.sx.write svg{display:block}
.sx.write .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx.write .top{height:56px;flex:0 0 56px;display:flex;align-items:center;gap:14px;padding:0 18px;background:linear-gradient(180deg,#14161c,#101216);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx.write .subtop{height:44px;flex:0 0 44px;display:flex;align-items:center;gap:14px;padding:0 18px;background:#101216;border-bottom:1px solid var(--hair);position:relative;z-index:2}
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
.sx.write .main{flex:1;display:flex;min-height:0;position:relative}
.sx.write .stagebtn{display:inline-flex;align-items:center;gap:6px;background:rgba(198,164,99,.14);border:1px solid rgba(198,164,99,.4);color:var(--gold2);font-size:12px;font-weight:600;border-radius:9px;padding:7px 12px;cursor:pointer;white-space:nowrap}
.sx.write .stagebtn:disabled{opacity:.5;cursor:default}

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

/* Revision Pass panel */
.sx.write .pass{width:344px;flex:none;border-inline-start:1px solid var(--hair);background:#0c0d11;display:flex;flex-direction:column;min-height:0}
.sx.write .passh{padding:15px 16px 12px;border-bottom:1px solid var(--hair);flex:0 0 auto}
.sx.write .passh .eye{font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--gold)}
.sx.write .passh .pt{font-family:var(--sx-title);font-size:18px;color:var(--cream);margin-top:3px}
.sx.write .meter{margin-top:11px}
.sx.write .meter .mt{display:flex;justify-content:space-between;font-size:11px;color:var(--mut);margin-bottom:5px}
.sx.write .meter .mt b{color:var(--green)}
.sx.write .track{height:6px;border-radius:4px;background:#23262e;overflow:hidden}
.sx.write .track i{display:block;height:100%;background:linear-gradient(90deg,var(--green),#7ed99a)}
.sx.write .passlist{flex:1;min-height:0;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.sx.write .passrow{background:var(--panel);border:1px solid var(--hair);border-radius:12px;padding:11px 12px}
.sx.write .prh{display:flex;align-items:center;gap:9px}
.sx.write .pic{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;font-size:12px;flex:none;background:rgba(255,255,255,.05)}
.sx.write .pn{font-size:12.5px;font-weight:600;color:var(--cream)}
.sx.write .ptag{font-size:10px;color:var(--faint);margin-top:1px}
.sx.write .psum{font-size:11.5px;color:var(--mut);margin-top:7px;line-height:1.4}
.sx.write .diff{margin-top:7px;font-size:11px;font-family:"Courier Prime",monospace;line-height:1.55}
.sx.write .diff .del{color:#e08585;text-decoration:line-through}
.sx.write .diff .add{color:#7ed99a}
.sx.write .bridge{margin:0 14px 4px;background:rgba(198,164,99,.07);border:1px solid rgba(198,164,99,.25);border-radius:11px;padding:11px 12px;font-size:11.5px;color:var(--gold2);line-height:1.4;flex:0 0 auto}
.sx.write .passfoot{padding:12px 14px;border-top:1px solid var(--hair);display:flex;flex-direction:column;gap:8px;flex:0 0 auto}
.sx.write .renderbtn{width:100%;text-align:center;background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;font-size:13px;border:none;border-radius:10px;padding:11px;cursor:pointer}
.sx.write .footrow{display:flex;gap:8px}
.sx.write .footrow span{flex:1;text-align:center;border:1px solid var(--hair);border-radius:9px;padding:8px;color:var(--mut);font-size:11.5px;cursor:pointer}
.sx.write .passempty{flex:1;display:grid;place-items:center;text-align:center;color:var(--faint);font-size:12.5px;padding:24px}
.sx.write[data-vp="tablet"] .pass{width:300px}

/* Stage-a-change composer */
.sx.write .composer{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);width:560px;max-width:calc(100% - 120px);max-height:calc(100% - 28px);display:flex;flex-direction:column;z-index:8;background:var(--panel);border:1px solid rgba(198,164,99,.35);border-radius:14px;overflow:hidden;box-shadow:0 30px 70px -20px #000}
.sx.write .comph{display:flex;align-items:center;gap:9px;padding:11px 14px;border-bottom:1px solid var(--hair);background:rgba(198,164,99,.05)}
.sx.write .comph .ci{width:24px;height:24px;border-radius:7px;background:rgba(198,164,99,.18);color:var(--gold2);display:grid;place-items:center;font-size:12px;flex:none}
.sx.write .comph .ct{font-size:13px;font-weight:600;color:var(--cream)}
.sx.write .comph .cs{font-size:10.5px;color:var(--faint);margin-top:1px}
.sx.write .comph .x{margin-inline-start:auto;color:var(--faint);cursor:pointer;font-size:13px}
.sx.write .compbody{padding:12px 14px;display:flex;flex-direction:column;gap:11px;flex:1;min-height:0;overflow:auto}
.sx.write .lab{font-size:9.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--gold);margin-bottom:6px}
.sx.write .chips{display:flex;flex-wrap:wrap;gap:6px}
.sx.write .chip{font-size:11.5px;color:var(--text);background:#171a21;border:1px solid var(--hair);border-radius:999px;padding:5px 11px;cursor:pointer}
.sx.write .chip.on{color:var(--goldink);background:linear-gradient(180deg,var(--gold2),var(--gold));border-color:transparent;font-weight:600}
.sx.write .opt{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid var(--hair);border-radius:9px;background:var(--ink);cursor:pointer;margin-bottom:6px}
.sx.write .opt.sel{border-color:rgba(198,164,99,.45);background:rgba(198,164,99,.06)}
.sx.write .dotc{width:7px;height:7px;border-radius:50%;flex:none}
.sx.write .ot{font-size:12px;color:var(--cream);font-weight:500;flex:1}
.sx.write .imp{margin-inline-start:auto;font-size:10.5px;font-weight:700}
.sx.write .imp.up{color:var(--green)}.sx.write .imp.dn{color:var(--gold2)}.sx.write .imp.nn{color:var(--mut)}
.sx.write .cflict{font-size:11.5px;color:#e08585;background:rgba(229,99,95,.1);border:1px solid rgba(229,99,95,.35);border-radius:9px;padding:9px 11px;line-height:1.4}
.sx.write .cstagebar{display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--hair);background:rgba(255,255,255,.015)}
.sx.write .cstage{flex:2;text-align:center;background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;font-size:12.5px;border-radius:9px;padding:10px;cursor:pointer}
.sx.write .cghost{flex:1;text-align:center;border:1px solid var(--hair);border-radius:9px;padding:10px;color:var(--mut);font-size:12.5px;cursor:pointer}
.sx.write .previewbar{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:7;background:rgba(198,164,99,.16);border:1px solid rgba(198,164,99,.4);color:var(--gold2);font-size:11.5px;font-weight:600;border-radius:999px;padding:7px 14px;max-width:calc(100% - 120px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center}
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

export type PassChange = { id: string; kind: string; sceneNumber?: number | string; label?: string; tag?: string; summary?: string; before?: string; after?: string };
export type PassVM = { passId?: string; changeCount: number; continuity: number; versionLabel: string; changes: PassChange[]; bridge?: string };

export type WriteProps = {
  title: string; revisionLabel: string; revisionColor: string;
  scenes: SxScene[]; activeId?: string; onSelectScene: (id: string) => void;
  pageCount?: number | string; loading?: boolean;
  stagedSceneIds?: string[]; pass?: PassVM | null;
  onNav: (k: string) => void; onBack: () => void; onRender?: () => void; onPassAction?: (k: string) => void;
  onStage?: (change: any) => Promise<{ ok: boolean; conflict?: string }>;
  toast?: string | null; vp: 'mobile' | 'tablet' | 'desktop';
};

const KIND_ICON: Record<string, string> = { revise: '✎', 'canon-shift': '◆', 're-ending': '↺' };
const KIND_COLOR: Record<string, string> = { revise: 'var(--gold2)', 'canon-shift': 'var(--blue)', 're-ending': 'var(--green)' };

// Composer kind tabs + the AI-composed options (bounded by the existing generate
// path; quality is out of scope per the handoff). Some carry candidate facts so
// the kernel's detectConflicts can warn/block before a change joins the pass.
const KIND_TABS: [string, string][] = [['re-ending', 'Re-ending'], ['revise', 'Rewrite'], ['emotion', 'Stronger emotion'], ['budgetfit', 'Budget-fit'], ['regenerate', 'Regenerate']];
type Opt = { id: string; label: string; tag: string; impact: 'up' | 'down' | 'neutral'; facts?: any[]; before?: string; after?: string };
// The cliff re-ending's before/after prose (carried so the Render→Compare diff is real).
const CLIFF_BEFORE = '65  EXT. CLIFFS — DAY\nDawn. A wall of red rock. ANTARAH sets his hands to the stone.\nAntarah scales the cliff in three easy pulls, barely looking down.\n\n          ANTARAH\nA man is what his sword remembers.\n\nHe reaches the cave mouth.';
const CLIFF_AFTER = '65  EXT. CLIFFS — DAY\nDAWN. A wall of red rock. ANTARAH sets his hands to the stone —\nand stops. The drop falls away. The old fear he never names.\nHe freezes — breathes — then climbs, knuckles white.\n\n          ANTARAH\nA man is what his sword remembers. Today it remembers this too.\n\nHe reaches the cave mouth, and does not look down.';
const OPTIONS: Record<string, Opt[]> = {
  're-ending': [
    { id: 'r1', label: 'Redemptive climb — earns the cave', tag: '+arc', impact: 'up', before: CLIFF_BEFORE, after: CLIFF_AFTER },
    { id: 'r2', label: 'Tragic slip — Antarah falls to his death', tag: 'alt', impact: 'neutral', facts: [{ kind: 'CHARACTER', subject: 'ANTARAH', predicate: 'status', object: 'dead', validFrom: 65, validTo: null }] },
    { id: 'r3', label: 'Swap cliff → gorge ledge (reuse S58)', tag: '−$140k', impact: 'down', facts: [{ kind: 'WORLD', subject: 'CLIMAX_SITE', predicate: 'location', object: 'gorge ledge', validFrom: 65, validTo: null }], before: CLIFF_BEFORE, after: CLIFF_AFTER },
  ],
  revise: [
    { id: 'w1', label: 'Tighten the approach to two beats', tag: '−1pp', impact: 'down' },
    { id: 'w2', label: 'Sharpen the threat — name the cost', tag: '+tension', impact: 'up' },
  ],
  emotion: [
    { id: 'e1', label: 'Key the fear higher before the turn', tag: '+arc', impact: 'up' },
    { id: 'e2', label: 'Hold the silence one beat longer', tag: '+dread', impact: 'up' },
  ],
  budgetfit: [
    { id: 'b1', label: 'Merge the night exteriors', tag: '−$90k', impact: 'down' },
    { id: 'b2', label: 'Day-for-night the gantry', tag: '−$40k', impact: 'down' },
  ],
  regenerate: [
    { id: 'g1', label: 'Regenerate this scene from the spine', tag: 'fresh', impact: 'neutral' },
  ],
};
const IMP_CLASS: Record<string, string> = { up: 'up', down: 'dn', neutral: 'nn' };

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

  // ── Stage-a-change composer ──
  const [composerOpen, setComposerOpen] = useState(false);
  const [kindTab, setKindTab] = useState('re-ending');
  const [selOpt, setSelOpt] = useState('');
  const [conflict, setConflict] = useState<string | null>(null);
  const [preview, setPreview] = useState<Opt | null>(null);
  const [staging, setStaging] = useState(false);
  const opts = OPTIONS[kindTab] || [];
  const chosen = opts.find((o) => o.id === selOpt) || opts[0];
  const doStage = async () => {
    if (!chosen || !active || !props.onStage) return;
    setStaging(true); setConflict(null);
    const res = await props.onStage({ sceneId: active.id, sceneNumber: active.sceneNumber, kind: kindTab, label: chosen.label, tag: chosen.tag, summary: chosen.label, facts: chosen.facts || [], before: chosen.before, after: chosen.after });
    setStaging(false);
    if (res.ok) { setComposerOpen(false); setSelOpt(''); setPreview(null); }
    else setConflict(res.conflict || 'Staging was blocked.');
  };

  // group scene indices by act for the spine
  const byAct: number[][] = [[], [], []];
  scenes.forEach((_, i) => byAct[actOf(i, n)].push(i));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx write" data-vp={props.vp} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <ScriptonTopBar vp={props.vp} onBack={props.onBack} continuity={props.pass?.continuity} />
        <div className="subtop">
          <div className="pageind">
            <span className="nudge" onClick={() => goScene(activeIdx - 1)}>‹</span>
            <b>{t('Scene')} {n ? activeIdx + 1 : '—'}</b> / {n || '—'}
            <span className="nudge" onClick={() => goScene(activeIdx + 1)}>›</span>
          </div>
          {props.vp !== 'mobile' ? (
            <button className="stagebtn" onClick={() => { setComposerOpen((o) => !o); setConflict(null); }} disabled={!scenes.length}>
              ＋ {t('Stage a change')}{active ? ' · ' + t('Scene') + ' ' + (activeIdx + 1) : ''}
            </button>
          ) : null}
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
            {/* Revision Pass panel (read) — desktop/tablet; mobile leads with the paper */}
            {props.vp !== 'mobile' && (
              <div className="pass">
                {props.pass ? (
                  <>
                    <div className="passh">
                      <div className="eye">{t('Revision Pass')} {props.pass.versionLabel}</div>
                      <div className="pt">{props.pass.changeCount} {t('changes staged')}</div>
                      <div className="meter">
                        <div className="mt"><span>{t('Continuity across the pass')}</span><b>{props.pass.continuity}%</b></div>
                        <div className="track"><i style={{ width: props.pass.continuity + '%' }} /></div>
                      </div>
                    </div>
                    <div className="passlist">
                      {props.pass.changes.map((c) => (
                        <div className="passrow" key={c.id}>
                          <div className="prh">
                            <span className="pic" style={{ color: KIND_COLOR[c.kind] || 'var(--gold2)' }}>{KIND_ICON[c.kind] || '✎'}</span>
                            <div><div className="pn">{t('Scene')} {c.sceneNumber ?? '—'} · {c.label}</div><div className="ptag">{c.tag}</div></div>
                          </div>
                          {c.before || c.after ? (
                            <div className="diff"><div className="del">− {c.before}</div><div className="add">+ {c.after}</div></div>
                          ) : c.summary ? <div className="psum">{c.summary}</div> : null}
                        </div>
                      ))}
                    </div>
                    {props.pass.bridge ? <div className="bridge">↳ {props.pass.bridge}</div> : null}
                    <div className="passfoot">
                      <button className="renderbtn" onClick={props.onRender}>{t('Render new draft')} {props.pass.versionLabel} →</button>
                      <div className="footrow"><span onClick={() => props.onPassAction?.('save')}>{t('Save pass')}</span><span onClick={() => props.onPassAction?.('preview')}>{t('Preview all')}</span><span onClick={() => props.onPassAction?.('discard')}>{t('Discard')}</span></div>
                    </div>
                  </>
                ) : (
                  <div className="passempty">{t('No changes staged — stage one to start a Revision Pass.')}</div>
                )}
              </div>
            )}
            {/* Stage-a-change composer */}
            {composerOpen && active && props.vp !== 'mobile' && (
              <div className="composer">
                <div className="comph">
                  <span className="ci">✦</span>
                  <div><div className="ct">{t('Stage a change')} · {t('Scene')} {activeIdx + 1}</div><div className="cs">{t('composed — continuity-checked before it joins the pass')}</div></div>
                  <span className="x" onClick={() => { setComposerOpen(false); setConflict(null); }}>✕</span>
                </div>
                <div className="compbody">
                  <div><div className="lab">{t('HOW TO CHANGE IT')}</div>
                    <div className="chips">{KIND_TABS.map(([k, l]) => <span key={k} className={'chip' + (k === kindTab ? ' on' : '')} onClick={() => { setKindTab(k); setSelOpt(''); setConflict(null); }}>{t(l)}</span>)}</div>
                  </div>
                  <div><div className="lab">{t('COMPOSE THE CHANGE')}</div>
                    {opts.map((o) => (
                      <div key={o.id} className={'opt' + (o.id === chosen?.id ? ' sel' : '')} onClick={() => { setSelOpt(o.id); setConflict(null); }}>
                        <span className="dotc" style={{ background: o.impact === 'up' ? 'var(--green)' : o.impact === 'down' ? 'var(--gold2)' : 'var(--mut)' }} />
                        <div className="ot">{o.label}</div>
                        <span className={'imp ' + IMP_CLASS[o.impact]}>{o.tag}</span>
                      </div>
                    ))}
                  </div>
                  {conflict ? <div className="cflict">⚠ {conflict}</div> : null}
                </div>
                <div className="cstagebar">
                  <span className="cstage" onClick={() => !staging && doStage()} style={{ opacity: staging ? 0.6 : 1 }}>{staging ? t('Checking continuity…') : '＋ ' + t('Stage this change')}</span>
                  <span className="cghost" onClick={() => setPreview(chosen || null)}>{t('Preview on page')}</span>
                </div>
              </div>
            )}
            {preview && (
              <div className="previewbar">{t('PREVIEW')} · {t('Scene')} {activeIdx + 1}: {preview.label}<span onClick={() => setPreview(null)} style={{ cursor: 'pointer', marginInlineStart: 10 }}>✕</span></div>
            )}
          </div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
