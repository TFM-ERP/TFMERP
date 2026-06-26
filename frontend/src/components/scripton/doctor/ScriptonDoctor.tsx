'use client';
/**
 * ScriptON · Doctor (single-canvas) — route /scripton/doctor under the `new`
 * shell flag. Collapses the old Coverage|Diagnostics tabs into one dashboard
 * (Figma 38:2): verdict banner → left (scorecard + scene-flow + emotional arc)
 * → right (diagnostics/continuity + conflict detector + 2×4 transforms).
 * Presentational only — fed by the existing doctor/page.tsx wiring + modals.
 * Kernel-only bits (conflict detector, "after staged pass" arc) degrade.
 */
import { SxRail } from '@/components/scripton/ScriptOnStudio';
import { useLocale } from '@/lib/i18n';
import ScriptonTopBar from '@/components/scripton/topbar/ScriptonTopBar';
import {
  scorecardTiles, verdictBanner, sceneFlowBars, arcPoints, diagRows, TRANSFORM_TILES,
  type DiagRow,
} from './scripton-doctor.logic';

const firstSentence = (s?: string) => {
  if (!s) return '';
  const m = String(s).split(/(?<=[.!?])\s/)[0];
  return m.length > 160 ? m.slice(0, 157) + '…' : m;
};

const CSS = `
.sx.doctor{--bg:#0b0c0f;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--violet:#8b7cf0;--pink:#d6649a;--red:#e5635f;--teal:#48b6a0;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.doctor *{box-sizing:border-box;margin:0;padding:0}
.sx.doctor:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(700px 280px at 72% -6%,rgba(198,164,99,.09),transparent 70%);z-index:0}
.sx.doctor svg{display:block}
.sx.doctor .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx.doctor .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx.doctor .tl{display:flex;align-items:center;gap:12px;min-width:0}
.sx.doctor .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer;flex:none}
.sx.doctor .proj{font-weight:700;font-size:15.5px;color:var(--cream);font-family:var(--sx-title);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.doctor .pill{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.sx.doctor .pill .d{width:7px;height:7px;border-radius:50%;flex:none}
.sx.doctor .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx.doctor .rail{width:74px;flex:0 0 74px;background:#0e1015;border-inline-end:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px;overflow-y:auto}
.sx.doctor .ritem{width:58px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);cursor:pointer;position:relative;border:none;background:transparent}
.sx.doctor .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mute)}
.sx.doctor .ritem .lbl{font-size:9px;font-weight:600}
.sx.doctor .ritem:hover .box{border-color:var(--hair2);color:var(--cream)}
.sx.doctor .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink);box-shadow:0 6px 16px -4px rgba(198,164,99,.5)}
.sx.doctor .ritem.on .lbl{color:var(--gold2)}
.sx.doctor .ritem.on:before{content:"";position:absolute;inset-inline-start:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
.sx.doctor .main{flex:1;min-width:0;display:flex;flex-direction:column}
.sx.doctor .content{flex:1;overflow:auto;padding:24px 28px;display:flex;flex-direction:column;gap:18px}
.sx.doctor .content>*{flex:0 0 auto}
.sx.doctor .phead h1{font-family:var(--sx-title);font-size:26px;font-weight:500;color:var(--cream);letter-spacing:-.3px}
.sx.doctor .phead .sub{font-size:12.5px;color:var(--mute);margin-top:4px}

/* Verdict banner */
.sx.doctor .verdict{display:flex;align-items:center;gap:16px;background:linear-gradient(120deg,#141416 0%,#0E0E10 55%,#1c1407 130%);border:1px solid #232326;border-radius:16px;padding:16px 18px}
.sx.doctor .gchip{width:52px;height:52px;border-radius:13px;display:grid;place-items:center;font-size:22px;font-weight:800;flex:none;background:rgba(255,255,255,.05);border:1px solid var(--hair2)}
.sx.doctor .vmid{flex:1;min-width:0}
.sx.doctor .vrec{display:inline-flex;align-items:center;font-size:10.5px;font-weight:800;letter-spacing:.5px;padding:3px 9px;border-radius:999px;margin-bottom:5px}
.sx.doctor .vlog{font-size:14px;color:var(--text);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.sx.doctor .vright{display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex:none}
.sx.doctor .vcomps{font-size:11px;color:var(--faint);max-width:200px;text-align:end}
.sx.doctor .link{font-size:12px;font-weight:600;color:var(--gold2);cursor:pointer;background:none;border:none;white-space:nowrap}

/* Panels + columns */
.sx.doctor .cols{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
.sx.doctor .colstack{display:flex;flex-direction:column;gap:18px;min-width:0}
.sx.doctor .panel{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:15px}
.sx.doctor .ph{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.sx.doctor .ph .t{font-size:13px;font-weight:700;color:var(--cream)}
.sx.doctor .eyebrow{font-size:9.5px;font-weight:700;letter-spacing:.6px;color:var(--faint);text-transform:uppercase}

/* Scorecard */
.sx.doctor .score{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.sx.doctor .stile{background:var(--panel2);border:1px solid var(--hair);border-radius:11px;padding:10px 6px;text-align:center}
.sx.doctor .stile .sg{font-size:22px;font-weight:800;letter-spacing:-.5px}
.sx.doctor .stile .sl{font-size:9.5px;color:var(--faint);font-weight:600;margin-top:2px;text-transform:uppercase;letter-spacing:.3px}
.sx.doctor .summary{font-size:12px;color:var(--mute);line-height:1.5;margin-top:12px}
.sx.doctor .flow{display:flex;align-items:flex-end;gap:3px;height:48px;margin-top:14px}
.sx.doctor .flow i{flex:1;min-width:2px;border-radius:2px 2px 0 0;display:block}
.sx.doctor .flowcap{font-size:9.5px;color:var(--faint);letter-spacing:.5px;text-transform:uppercase;margin-top:6px}

/* Emotional arc */
.sx.doctor .arcwrap{position:relative}
.sx.doctor .arcx{display:flex;justify-content:space-between;font-size:9.5px;color:var(--faint);margin-top:6px;text-transform:uppercase;letter-spacing:.4px}
.sx.doctor .cap{font-size:11px;color:var(--faint);margin-top:8px;line-height:1.4}

/* Diagnostics */
.sx.doctor .drow{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--hair)}
.sx.doctor .drow:first-of-type{border-top:none}
.sx.doctor .dsc{font-family:"Courier Prime",monospace;font-size:10.5px;color:var(--gold2);flex:none;width:34px;padding-top:1px}
.sx.doctor .dmid{flex:1;min-width:0}
.sx.doctor .dslug{font-size:12px;font-weight:600;color:var(--cream)}
.sx.doctor .dnote{font-size:11px;color:var(--mute);margin-top:1px;line-height:1.4}
.sx.doctor .dtag{font-size:9px;font-weight:800;letter-spacing:.4px;padding:3px 7px;border-radius:999px;flex:none}
.sx.doctor .conflict{background:var(--panel2);border:1px solid var(--hair);border-radius:11px;padding:11px 12px;margin-top:12px;display:flex;gap:9px;align-items:flex-start;font-size:11.5px;color:var(--mute);line-height:1.4}
.sx.doctor .conflict .ok{color:var(--green);flex:none;font-weight:800}

/* Transforms */
.sx.doctor .tgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
.sx.doctor .ttile{display:flex;gap:10px;align-items:center;background:var(--panel2);border:1px solid var(--hair);border-radius:11px;padding:11px 12px;cursor:pointer;text-align:start;transition:border-color .15s,transform .12s}
.sx.doctor .ttile:hover{border-color:rgba(198,164,99,.5);transform:translateY(-1px)}
.sx.doctor .tdot{width:9px;height:9px;border-radius:50%;flex:none}
.sx.doctor .tname{font-size:12.5px;font-weight:700;color:var(--cream)}
.sx.doctor .tdesc{font-size:10px;color:var(--faint);margin-top:1px}

/* Buttons / states */
.sx.doctor .btn{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid transparent;white-space:nowrap}
.sx.doctor .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700}
.sx.doctor .btn.ghost{background:#1b1e25;border-color:var(--hair);color:var(--text)}
.sx.doctor .muted{font-size:12px;color:var(--faint);padding:10px 0}
.sx.doctor .sk{background:linear-gradient(90deg,#16181e,#1c1f27,#16181e);background-size:200% 100%;animation:dkp 1.3s ease-in-out infinite;border-radius:10px}
@keyframes dkp{0%{background-position:200% 0}100%{background-position:-200% 0}}
.sx.doctor .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px;box-shadow:0 14px 40px -12px rgba(0,0,0,.7)}

/* Tablet: columns stack, scorecard 5 stays, transforms 2-up */
.sx.doctor[data-vp="tablet"] .cols{grid-template-columns:1fr}
.sx.doctor[data-vp="tablet"] .content{padding:20px 18px}
/* Mobile: single column, scorecard wraps, transforms 2-up */
.sx.doctor[data-vp="mobile"] .content{padding:16px 13px;gap:14px}
.sx.doctor[data-vp="mobile"] .cols{grid-template-columns:1fr}
.sx.doctor[data-vp="mobile"] .panel{padding:11px}
.sx.doctor[data-vp="mobile"] .score{grid-template-columns:repeat(5,minmax(0,1fr));gap:3px}
.sx.doctor[data-vp="mobile"] .stile{padding:8px 1px}
.sx.doctor[data-vp="mobile"] .stile .sg{font-size:17px}
.sx.doctor[data-vp="mobile"] .stile .sl{font-size:7px;letter-spacing:0}
.sx.doctor[data-vp="mobile"] .verdict{flex-direction:column;align-items:flex-start;gap:11px}
.sx.doctor[data-vp="mobile"] .vright{align-items:flex-start}
.sx.doctor[data-vp="mobile"] .phead h1{font-size:22px}
`;

export type DoctorCanvasProps = {
  title: string; revisionLabel: string; revisionColor: string; meta: string;
  coverageRaw: any | null; analytics: any | null; diagnostics: any[] | null;
  covLoading?: boolean; diagLoading?: boolean; kernelInert?: boolean;
  onGenerate: () => void; onRunDiag: () => void; onAction: (k: string) => void;
  onNav: (k: string) => void; onBack: () => void; onFullReport: () => void;
  toast?: string | null; vp: 'mobile' | 'tablet' | 'desktop';
};

export default function ScriptonDoctor(props: DoctorCanvasProps) {
  const { dir, t } = useLocale();
  const loading = props.covLoading && !props.coverageRaw;
  const v = verdictBanner(props.coverageRaw);
  const tiles = scorecardTiles(props.coverageRaw?.grades);
  const summary = firstSentence(props.coverageRaw?.synopsis) || (v.hasData ? '' : '');
  const perScene = props.analytics?.pacing?.perScene;
  const bars = sceneFlowBars(perScene);
  const arc = arcPoints(perScene);
  const rows: DiagRow[] = diagRows(props.diagnostics);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx doctor" data-vp={props.vp} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <ScriptonTopBar vp={props.vp} onBack={props.onBack} />
        <div className="body">
          <SxRail active="doctor" />
          <div className="main"><div className="content">
            <div className="phead">
              <h1>{t('Doctor')}</h1>
              <div className="sub">{props.meta}</div>
            </div>

            {loading ? <DoctorSkeleton /> : (
              <>
                {/* Verdict banner */}
                {v.hasData ? (
                  <div className="verdict">
                    <div className="gchip" style={{ color: v.gradeColor }}>{v.grade}</div>
                    <div className="vmid">
                      {v.rec ? <span className="vrec" style={{ background: v.recColor + '22', color: v.recColor }}>{v.rec}</span> : null}
                      <div className="vlog">{v.logline || t('Coverage complete — open the full report for the breakdown.')}</div>
                    </div>
                    <div className="vright">
                      {v.comps.length ? <div className="vcomps">{t('Comps')}: {v.comps.slice(0, 3).join(' · ')}</div> : null}
                      <button className="link" onClick={props.onFullReport}>{t('Full report')} →</button>
                    </div>
                  </div>
                ) : (
                  <div className="verdict">
                    <div className="gchip" style={{ color: 'var(--faint)' }}>—</div>
                    <div className="vmid"><div className="vlog">{t('No coverage yet — generate it to read the verdict, scorecard and notes.')}</div></div>
                    <div className="vright"><button className="btn gold" disabled={props.covLoading} onClick={props.onGenerate}>{props.covLoading ? t('Generating…') : t('Generate coverage')}</button></div>
                  </div>
                )}

                <div className="cols">
                  {/* Left — Coverage */}
                  <div className="colstack">
                    <div className="panel">
                      <div className="ph"><span className="t">{t('Coverage Scorecard')}</span><span className="eyebrow">{t('GRADES')}</span></div>
                      <div className="score">
                        {tiles.map((tl) => (
                          <div className="stile" key={tl.key}><div className="sg" style={{ color: tl.color }}>{tl.grade}</div><div className="sl">{t(tl.label)}</div></div>
                        ))}
                      </div>
                      {summary ? <div className="summary">{summary}</div> : null}
                      <div className="flow">
                        {bars.length ? bars.map((b, i) => <i key={i} style={{ height: b.pct + '%', background: b.color }} />) : <div className="muted">{t('Scene flow appears once analytics run.')}</div>}
                      </div>
                      {bars.length ? <div className="flowcap">{t('Scene flow · per-scene health')}</div> : null}
                    </div>

                    <div className="panel arcwrap">
                      <div className="ph"><span className="t">{t('Emotional Arc')} — {props.title}</span><span className="eyebrow">{t('ARC')}</span></div>
                      {arc ? (
                        <>
                          <svg viewBox="0 0 220 46" style={{ width: '100%', height: 64 }}>
                            <polyline fill="none" stroke="var(--mute)" strokeWidth="2" strokeDasharray="4 3" points={arc} />
                          </svg>
                          <div className="arcx"><span>{t('fear')}</span><span>{t('resolve')}</span><span>{t('triumph')}</span></div>
                          <div className="cap">{t('Dotted = current arc. Stage a pass to overlay the projected arc.')}</div>
                        </>
                      ) : <div className="muted">{t('The emotional arc appears once analytics run.')}</div>}
                    </div>
                  </div>

                  {/* Right — Diagnostics + Transforms */}
                  <div className="colstack">
                    <div className="panel">
                      <div className="ph"><span className="t">{t('Diagnostics & Continuity')}</span>{!rows.length ? <button className="btn ghost" disabled={props.diagLoading} onClick={props.onRunDiag} style={{ height: 28 }}>{props.diagLoading ? t('Running…') : t('Run')}</button> : <span className="eyebrow">{rows.length} {t('SCENES')}</span>}</div>
                      {rows.length ? rows.slice(0, 6).map((r, i) => (
                        <div className="drow" key={i}>
                          <span className="dsc">{r.scene}</span>
                          <div className="dmid"><div className="dslug">{r.slug || t('scene')}</div>{r.note ? <div className="dnote">{r.note}</div> : null}</div>
                          <span className="dtag" style={{ background: r.tagColor + '22', color: r.tagColor }}>{r.tag}</span>
                        </div>
                      )) : <div className="muted">{t('Run diagnostics to surface per-scene notes.')}</div>}
                      {/* Conflict detector — kernel-degraded */}
                      <div className="conflict"><span className="ok">✓</span>{props.kernelInert === false ? t('No continuity conflicts in the current pass.') : t('Continuity is grounded in your pages. Stage a pass to check it against canon.')}</div>
                    </div>

                    <div className="panel">
                      <div className="ph"><span className="t">{t('Fixes & Transforms')}</span><span className="eyebrow">{t('ONE CLICK → STAGES A CHANGE')}</span></div>
                      <div className="tgrid">
                        {TRANSFORM_TILES.map((tile) => (
                          <button className="ttile" key={tile.key} onClick={() => props.onAction(tile.action)}>
                            <span className="tdot" style={{ background: tile.dot }} />
                            <span><span className="tname" style={{ display: 'block' }}>{t(tile.name)}</span><span className="tdesc">{t(tile.desc)}</span></span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div></div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}

function DoctorSkeleton() {
  return (
    <>
      <div className="sk" style={{ height: 86, borderRadius: 16 }} />
      <div className="cols">
        <div className="colstack"><div className="sk" style={{ height: 220, borderRadius: 14 }} /><div className="sk" style={{ height: 140, borderRadius: 14 }} /></div>
        <div className="colstack"><div className="sk" style={{ height: 200, borderRadius: 14 }} /><div className="sk" style={{ height: 180, borderRadius: 14 }} /></div>
      </div>
    </>
  );
}
