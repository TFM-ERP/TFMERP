'use client';
/**
 * ScriptON · Doctor (single-canvas) — route /scripton/doctor under the `new`
 * shell flag. Collapses the old Coverage|Diagnostics tabs into one dashboard
 * (Figma 38:2): verdict banner → left (scorecard + scene-flow + emotional arc)
 * → right (diagnostics/continuity + conflict detector + 2×4 transforms).
 * Presentational only — fed by the existing doctor/page.tsx wiring + modals.
 * Kernel-only bits (conflict detector, "after staged pass" arc) degrade.
 */
import { SxRail } from '@/components/scripton/shared/sx';
import { useLocale } from '@/lib/i18n';
import ScriptonTopBar from '@/components/scripton/topbar/ScriptonTopBar';
import ScriptonShell from '@/components/scripton/ScriptonShell';
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
.sx.doctor{--teal:#48b6a0;position:relative;display:flex;flex-direction:column;height:100%;background:#0a0b0e;color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.doctor *{box-sizing:border-box;margin:0;padding:0}
.sx.doctor svg{display:block}
.sx.doctor .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx.doctor .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx.doctor .tl{display:flex;align-items:center;gap:12px;min-width:0}
.sx.doctor .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer;flex:none}
.sx.doctor .proj{font-weight:700;font-size:15.5px;color:var(--cream);font-family:var(--sx-title);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.doctor .pill{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.sx.doctor .pill .d{width:7px;height:7px;border-radius:50%;flex:none}
.sx.doctor .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx.doctor .main{flex:1;min-width:0;display:flex;flex-direction:column}
.sx.doctor .content{flex:1;overflow:auto;padding:26px 40px 40px;display:flex;flex-direction:column;gap:16px}
.sx.doctor .content>*{flex:0 0 auto}
.sx.doctor .phead h1{font-family:var(--sx-title);font-size:21px;font-weight:600;color:#f4eee0;letter-spacing:-.2px;font-variation-settings:"SOFT" 0,"WONK" 1}
.sx.doctor .phead .sub{font-size:12px;color:#6b727d;margin-top:9px}

/* Verdict banner */
.sx.doctor .verdict{display:flex;align-items:center;gap:14px;background:#181b22;border:1px solid var(--hair);border-radius:14px;padding:15px 17px;min-height:76px}
.sx.doctor .gchip{width:44px;height:44px;border-radius:11px;display:grid;place-items:center;font-family:var(--sx-title);font-size:19px;font-weight:600;flex:none;font-variation-settings:"SOFT" 0,"WONK" 1}
.sx.doctor .vmid{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.sx.doctor .vrec{display:inline-flex;align-items:center;align-self:flex-start;font-size:10px;font-weight:600;letter-spacing:.4px;padding:3px 9px;border-radius:999px}
.sx.doctor .vlog{font-size:12px;color:#9aa1ab;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.sx.doctor .vright{display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex:none}
.sx.doctor .vcomps{font-size:11px;color:#6b727d;max-width:220px;text-align:end}
.sx.doctor .link{font-size:11.5px;font-weight:500;color:#e6d2a2;cursor:pointer;background:none;border:none;white-space:nowrap}

/* Panels + columns */
.sx.doctor .cols{display:grid;grid-template-columns:600px 664px;gap:20px;align-items:start}
.sx.doctor .colstack{display:flex;flex-direction:column;gap:16px;min-width:0}
.sx.doctor .panel{background:#181b22;border:1px solid var(--hair);border-radius:14px;padding:15px 17px 17px}
.sx.doctor .ph{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;min-height:14px}
.sx.doctor .eyebrow{font-size:9.5px;font-weight:600;letter-spacing:.8px;color:var(--gold);text-transform:uppercase}
.sx.doctor .phsub{font-size:10.5px;color:#6b727d;font-weight:400}

/* Scorecard */
.sx.doctor .score{display:grid;grid-template-columns:repeat(5,106px);gap:7px}
.sx.doctor .stile{background:#0e1014;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:9px 11px;height:82px;display:flex;flex-direction:column;justify-content:space-between}
.sx.doctor .stile .sg{font-family:var(--sx-title);font-size:24px;font-weight:600;line-height:1;font-variation-settings:"SOFT" 0,"WONK" 1}
.sx.doctor .stile .sl{font-size:11px;color:#f4eee0;font-weight:600}
.sx.doctor .summary{font-size:12px;color:#9aa1ab;line-height:1.5;margin-top:14px}
.sx.doctor .flowcap{font-size:9px;color:#6b727d;letter-spacing:.6px;text-transform:uppercase;font-weight:600;margin-top:16px}
.sx.doctor .flow{display:flex;align-items:flex-end;gap:3px;height:60px;margin-top:8px}
.sx.doctor .flow i{flex:1;min-width:2px;border-radius:2px 2px 0 0;display:block}

/* Emotional arc */
.sx.doctor .arcwrap{position:relative}
.sx.doctor .arcx{display:flex;justify-content:space-between;font-size:9px;color:#6b727d;margin-top:6px}
.sx.doctor .cap{font-size:10px;color:#6b727d;margin-top:8px;line-height:1.4}

/* Diagnostics */
.sx.doctor .drow{display:flex;gap:11px;align-items:center;background:#0e1014;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:9px 13px;min-height:52px;margin-bottom:8px}
.sx.doctor .drow:last-of-type{margin-bottom:0}
.sx.doctor .dsc{font-family:var(--sx-mono);font-size:10.5px;color:var(--gold2);flex:none;width:30px}
.sx.doctor .dmid{flex:1;min-width:0}
.sx.doctor .dslug{font-size:12.5px;font-weight:600;color:#f4eee0}
.sx.doctor .dnote{font-size:10.5px;color:#9aa1ab;margin-top:3px;line-height:1.4}
.sx.doctor .dtag{font-size:9px;font-weight:600;letter-spacing:.4px;padding:3px 8px;border-radius:999px;flex:none}
.sx.doctor .conflict{background:rgba(87,179,104,.06);border:1px solid rgba(87,179,104,.25);border-radius:10px;padding:9px 13px;margin-top:8px;min-height:56px;display:flex;flex-direction:column;gap:3px;justify-content:center}
.sx.doctor .conflict .ct{font-size:11.5px;font-weight:600;color:#f4eee0}
.sx.doctor .conflict .cn{font-size:10.5px;color:#9aa1ab;line-height:1.4}
.sx.doctor .conflict .ok{color:var(--green);font-weight:600}

/* Transforms */
.sx.doctor .tgrid{display:grid;grid-template-columns:repeat(4,150px);gap:8px}
.sx.doctor .ttile{display:flex;flex-direction:column;background:#0e1014;border:1px solid rgba(255,255,255,.06);border-radius:11px;padding:11px;height:72px;cursor:pointer;text-align:start;transition:border-color .15s,transform .12s}
.sx.doctor .ttile:hover{border-color:rgba(198,164,99,.5);transform:translateY(-1px)}
.sx.doctor .thead{display:flex;align-items:center;gap:8px}
.sx.doctor .tdot{width:9px;height:9px;border-radius:50%;flex:none}
.sx.doctor .tdesc{font-size:9.5px;color:#9aa1ab}
.sx.doctor .tname{font-size:12px;font-weight:600;color:#f4eee0;margin-top:auto}

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
.sx.doctor[data-vp="tablet"] .score{grid-template-columns:repeat(5,minmax(0,1fr))}
.sx.doctor[data-vp="tablet"] .tgrid{grid-template-columns:repeat(4,minmax(0,1fr))}
/* Mobile: single column, scorecard wraps, transforms 2-up */
.sx.doctor[data-vp="mobile"] .content{padding:16px 13px;gap:14px}
.sx.doctor[data-vp="mobile"] .cols{grid-template-columns:1fr}
.sx.doctor[data-vp="mobile"] .panel{padding:11px}
.sx.doctor[data-vp="mobile"] .score{grid-template-columns:repeat(5,minmax(0,1fr));gap:3px}
.sx.doctor[data-vp="mobile"] .stile{padding:8px 6px;height:auto}
.sx.doctor[data-vp="mobile"] .stile .sg{font-size:17px}
.sx.doctor[data-vp="mobile"] .stile .sl{font-size:8px}
.sx.doctor[data-vp="mobile"] .tgrid{grid-template-columns:repeat(2,minmax(0,1fr))}
.sx.doctor[data-vp="mobile"] .verdict{flex-direction:column;align-items:flex-start;gap:11px}
.sx.doctor[data-vp="mobile"] .vright{align-items:flex-start}
.sx.doctor[data-vp="mobile"] .phead h1{font-size:20px}
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
      <ScriptonShell screen="doctor" active="doctor" vp={props.vp} onBack={props.onBack} topbar={{ scriptScoped: false }} overlay={props.toast ? <div className="toast">{props.toast}</div> : null}>
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
                    <div className="gchip" style={{ color: v.gradeColor, background: v.gradeColor + '29' }}>{v.grade}</div>
                    <div className="vmid">
                      {v.rec ? <span className="vrec" style={{ background: v.recColor + '29', color: v.recColor }}>{v.rec}</span> : null}
                      <div className="vlog">{v.logline || t('Coverage complete — open the full report for the breakdown.')}</div>
                    </div>
                    <div className="vright">
                      {v.comps.length ? <div className="vcomps">{t('Comps')}: {v.comps.slice(0, 3).join(' · ')}</div> : null}
                      <button className="link" onClick={props.onFullReport}>{t('Full report')} →</button>
                    </div>
                  </div>
                ) : (
                  <div className="verdict">
                    <div className="gchip" style={{ color: 'var(--faint)', background: 'rgba(255,255,255,.05)' }}>—</div>
                    <div className="vmid"><div className="vlog">{t('No coverage yet — generate it to read the verdict, scorecard and notes.')}</div></div>
                    <div className="vright"><button className="btn gold" disabled={props.covLoading} onClick={props.onGenerate}>{props.covLoading ? t('Generating…') : t('Generate coverage')}</button></div>
                  </div>
                )}

                <div className="cols">
                  {/* Left — Coverage */}
                  <div className="colstack">
                    <div className="panel">
                      <div className="ph"><span className="eyebrow">{t('Coverage Scorecard')}</span></div>
                      <div className="score">
                        {tiles.map((tl) => (
                          <div className="stile" key={tl.key}><div className="sg" style={{ color: tl.color }}>{tl.grade}</div><div className="sl">{t(tl.label)}</div></div>
                        ))}
                      </div>
                      {summary ? <div className="summary">{summary}</div> : null}
                      {bars.length ? <div className="flowcap">{t('Scene flow')}</div> : null}
                      <div className="flow">
                        {bars.length ? bars.map((b, i) => <i key={i} style={{ height: b.pct + '%', background: b.color }} />) : <div className="muted">{t('Scene flow appears once analytics run.')}</div>}
                      </div>
                    </div>

                    <div className="panel arcwrap">
                      <div className="ph"><span className="eyebrow">{t('Emotional Arc')} — {props.title}</span></div>
                      {arc ? (
                        <>
                          <svg viewBox="0 0 220 46" preserveAspectRatio="none" style={{ width: '100%', height: 130 }}>
                            <polyline fill="none" stroke="var(--mute)" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" points={arc} />
                          </svg>
                          <div className="arcx"><span>{t('fear')}</span><span>{t('resolve')}</span><span>{t('triumph')}</span></div>
                          <div className="cap">{t('dotted = current · stage a pass to overlay the projected arc')}</div>
                        </>
                      ) : <div className="muted">{t('The emotional arc appears once analytics run.')}</div>}
                    </div>
                  </div>

                  {/* Right — Diagnostics + Transforms */}
                  <div className="colstack">
                    <div className="panel">
                      <div className="ph"><span className="eyebrow">{t('Diagnostics & Continuity')}</span>{!rows.length ? <button className="btn ghost" disabled={props.diagLoading} onClick={props.onRunDiag} style={{ height: 28 }}>{props.diagLoading ? t('Running…') : t('Run')}</button> : null}</div>
                      {rows.length ? rows.slice(0, 6).map((r, i) => (
                        <div className="drow" key={i}>
                          <div className="dmid"><div className="dslug">{r.scene} · {r.slug || t('scene')}</div>{r.note ? <div className="dnote">{r.note}</div> : null}</div>
                          <span className="dtag" style={{ background: r.tagColor + '29', color: r.tagColor }}>{r.tag}</span>
                        </div>
                      )) : <div className="muted">{t('Run diagnostics to surface per-scene notes.')}</div>}
                      {/* Conflict detector — kernel-degraded */}
                      <div className="conflict">
                        <div className="ct">{t('Conflict Detector')}</div>
                        <div className="cn">{props.kernelInert === false ? <>{t('No continuity conflicts in the current pass.')} <span className="ok">✓</span></> : t('Continuity is grounded in your pages. Stage a pass to check it against canon.')}</div>
                      </div>
                    </div>

                    <div className="panel">
                      <div className="ph"><span className="eyebrow">{t('Fixes & Transforms')}</span><span className="phsub">{t('one click → stages a change in the pass')}</span></div>
                      <div className="tgrid">
                        {TRANSFORM_TILES.map((tile) => (
                          <button className="ttile" key={tile.key} onClick={() => props.onAction(tile.action)}>
                            <span className="thead"><span className="tdot" style={{ background: tile.dot }} /><span className="tdesc">{t(tile.desc)}</span></span>
                            <span className="tname">{t(tile.name)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div></div>
      </ScriptonShell>
    </>
  );
}

function DoctorSkeleton() {
  return (
    <>
      <div className="sk" style={{ height: 76, borderRadius: 14 }} />
      <div className="cols">
        <div className="colstack"><div className="sk" style={{ height: 300, borderRadius: 14 }} /><div className="sk" style={{ height: 212, borderRadius: 14 }} /></div>
        <div className="colstack"><div className="sk" style={{ height: 300, borderRadius: 14 }} /><div className="sk" style={{ height: 212, borderRadius: 14 }} /></div>
      </div>
    </>
  );
}
