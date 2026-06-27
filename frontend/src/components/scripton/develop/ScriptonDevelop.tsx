'use client';
/**
 * ScriptON · Develop — the structural rebuild (Figma node 69:2), behind scripton.osShell.
 * A two-pane cinematic workspace: ladder rail · stage canvas · spine/comps context.
 * Built slice-by-slice (A top bar → B two-pane shell → C per-stage canvas → D ladder+controls
 * → E render-screen glow → F responsive). `old` restores the current Builder.
 *
 * Uses the shared `.sx` design tokens (globals.css, Gate 0 #40) — NO inline palette block.
 *
 * Slice B: the two-pane body (right of the OS rail), wired to the page's REAL develop data —
 * no mocks. Ladder rail (real stages + done/active/pending), stage canvas (the focused stage's
 * cleaned body — full per-kind rendering is slice C), spine + comparables. The top bar's ring +
 * V ▾ are wired from the OPEN BUILD's linked kernel script (continuity + active version), so they
 * populate for builds whose script has renders (honestly hidden when it has none — no fake number).
 */
import { useEffect, useMemo, useState } from 'react';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { SxRail, cleanStageText, type SxLadder, type SxSpine } from '@/components/scripton/ScriptOnStudio';
import ScriptonTopBar from '@/components/scripton/topbar/ScriptonTopBar';

export type ScriptonDevelopProps = {
  vp: 'mobile' | 'tablet' | 'desktop';
  onBack?: () => void;
  projectId: string | null;
  buildId?: string;
  ladder: SxLadder[];            // real develop stages (name/kind/state/body/version…)
  spine: SxSpine[];              // the agreed brief — Format / Logline / Framework / Stage
  comps: string[];               // real comparables (empty → honest empty state, no mock chips)
  genBusy: string | null;        // the stage kind currently generating (global), or null
  onAdvance: () => void;         // generate the next stage
  onRegenerate: (kind: string) => void;   // regenerate the focused stage
  onSwitchVersion: (stageId: string, dir: number) => void; // ‹ Vn › prev/next on the focused stage
};

const TOTAL = 8;
const LABEL: Record<string, string> = { LOGLINE: 'Logline', SYNOPSIS: 'Synopsis', TREATMENT: 'Treatment', BEATS: 'Beats', SCENES: 'Scenes', STEP_OUTLINE: 'Step Outline', DRAFT: 'Draft', COVERAGE: 'Coverage' };

// Node 69:2 — body #0a0b0e; 76px rail #0c0d11; panels #14161c hairlined; track/chip/pending #1b1e25 (--track).
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

/* ── Two-pane body (node 69:81): 40 pad · 280 ladder · 20 · canvas · 16 · 268 context ── */
.sx.develop .dvbody{flex:1;min-height:0;display:flex;padding:28px 40px 44px}
.sx.develop .panel{background:var(--panel);border:1px solid var(--hair);border-radius:14px;display:flex;flex-direction:column;overflow:hidden}

/* Ladder rail (92:2) */
.sx.develop .ladderrail{width:280px;flex:none;margin-inline-end:20px}
.sx.develop .lhead{display:flex;align-items:flex-start;gap:9px;padding:15px 15px 13px}
.sx.develop .ltile{width:28px;height:28px;flex:none;border-radius:8px;background:var(--gold);display:grid;place-items:center;color:var(--goldink);font-size:13px;font-weight:600}
.sx.develop .lhh{display:flex;flex-direction:column;gap:4px;padding-top:1px}
.sx.develop .lht{font-family:var(--sx-body);font-weight:600;font-size:12.5px;color:var(--cream)}
.sx.develop .lhs{font-size:10px;color:var(--faint)}
.sx.develop .lrows{flex:1;min-height:0;overflow-y:auto;padding:0 7px}
.sx.develop .lrow{height:42px;display:flex;align-items:center;padding:0 9px;border-radius:10px;position:relative;cursor:pointer;margin-bottom:2px}
.sx.develop .lrow:hover{background:rgba(255,255,255,.03)}
.sx.develop .lrow.on{background:rgba(198,164,99,.10)}
.sx.develop .lrow.on:hover{background:rgba(198,164,99,.13)}
.sx.develop .lrow.on:before{content:"";position:absolute;inset-inline-start:0;top:9px;height:24px;width:3px;border-radius:3px;background:var(--gold)}
.sx.develop .ldot{width:18px;height:18px;flex:none;border-radius:9px;display:grid;place-items:center;margin-inline-end:9px;font-size:9px;font-weight:600}
.sx.develop .lrow.done .ldot{background:rgba(87,179,104,.2);color:var(--green)}
.sx.develop .lrow.on .ldot{background:var(--gold);color:var(--goldink);font-size:8px}
.sx.develop .lrow.wait .ldot{background:transparent;border:1.6px solid rgba(255,255,255,.18)}
.sx.develop .ltext{display:flex;flex-direction:column;gap:3px;min-width:0}
.sx.develop .lname{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.develop .lrow.done .lname{color:#b9c0b3}
.sx.develop .lrow.on .lname{color:var(--gold2)}
.sx.develop .lrow.wait .lname{color:var(--mute)}
.sx.develop .lsub{font-size:10px;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.develop .lfoot{padding:14px 15px 15px;border-top:1px solid var(--hair)}
.sx.develop .lfr{display:flex;align-items:center;justify-content:space-between;font-size:10.5px;color:var(--faint);margin-bottom:8px}
.sx.develop .lfr .lfn{font-weight:500}
.sx.develop .ltrack{height:6px;border-radius:99px;background:var(--track);overflow:hidden}
.sx.develop .ltrack i{display:block;height:6px;border-radius:99px;background:var(--gold)}

/* Stage canvas (93:2) */
.sx.develop .stagecanvas{flex:1;min-width:0;margin-inline-end:16px}
.sx.develop .cvhead{position:relative;padding:17px 23px 0;flex:none}
.sx.develop .cvname{font-family:var(--sx-title);font-weight:600;font-size:20px;color:var(--cream)}
.sx.develop .cvmeta{font-size:11px;color:var(--faint);margin-top:9px}
.sx.develop .cvctrl{position:absolute;top:17px;inset-inline-end:23px;display:flex;align-items:center;gap:12px}
.sx.develop .vsw{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--mute)}
.sx.develop .vsw b{color:var(--cream);font-weight:600}
.sx.develop .vsw span{cursor:pointer;font-size:13px;color:var(--faint);user-select:none}
.sx.develop .vsw span:hover{color:var(--gold2)}
.sx.develop .regen{background:none;border:none;color:var(--gold);font-size:17px;cursor:pointer;line-height:1}
.sx.develop .cvdiv{height:1px;background:var(--hair);margin:17px 19px 0}
.sx.develop .cvbody{flex:1;min-height:0;overflow-y:auto;padding:20px 23px}
.sx.develop .cvbody p{font-size:13px;line-height:20px;color:var(--text);margin-bottom:14px;white-space:pre-wrap}
.sx.develop .cvempty{font-size:13px;color:var(--faint);line-height:20px}
.sx.develop .cvfoot{flex:none;border-top:1px solid var(--hair);padding:14px 23px}
.sx.develop .stbar{display:flex;align-items:center;gap:11px}
.sx.develop .spin{width:14px;height:14px;flex:none;border:2px solid var(--gold2);border-radius:7px;border-top-color:transparent;animation:dvspin 1s linear infinite}
@media (prefers-reduced-motion: reduce){.sx.develop .spin{animation:none}.sx.develop .ltrack .ind{animation:none;width:100%}}
@keyframes dvspin{to{transform:rotate(360deg)}}
.sx.develop .sttext{font-size:12.5px;font-weight:500;color:var(--gold2);flex:1;min-width:0}
.sx.develop .sttrack{height:5px;border-radius:99px;background:var(--track);overflow:hidden;margin-top:11px}
.sx.develop .sttrack .ind{display:block;height:5px;width:40%;border-radius:99px;background:var(--gold);animation:dvsweep 1.5s ease-in-out infinite}
@keyframes dvsweep{0%{margin-inline-start:-40%}100%{margin-inline-start:100%}}
.sx.develop .acts{display:flex;align-items:center;gap:10px}
.sx.develop .btn{height:34px;padding:0 15px;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid var(--hair2);background:transparent;color:var(--cream);display:inline-flex;align-items:center;gap:7px}
.sx.develop .btn:hover{border-color:var(--gold2)}
.sx.develop .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink)}
.sx.develop .btn.gold:hover{filter:brightness(1.05)}

/* Right context (94:2 spine, 94:14 comps) */
.sx.develop .ctxcol{width:268px;flex:none;display:flex;flex-direction:column;gap:16px;min-height:0}
.sx.develop .spine{flex:none}
.sx.develop .comps{flex:1;min-height:0}
.sx.develop .ctxin{padding:17px}
.sx.develop .ctxhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.sx.develop .ctxtitle{font-weight:600;font-size:13px;color:var(--cream)}
.sx.develop .badge{padding:4px 9px;border-radius:999px;background:rgba(198,164,99,.14);font-weight:600;font-size:9.5px;letter-spacing:.5px;color:var(--gold2)}
.sx.develop .srow{margin-top:14px}
.sx.develop .slabel{font-weight:600;font-size:10px;letter-spacing:.5px;color:var(--faint);margin-bottom:6px}
.sx.develop .sval{font-size:12.5px;line-height:18px;color:var(--text)}
.sx.develop .csub{font-size:11px;line-height:16px;color:var(--faint);margin:4px 0 14px}
.sx.develop .chips{display:flex;flex-wrap:wrap;gap:8px}
.sx.develop .chip{padding:5px 11px;border-radius:999px;background:rgba(198,164,99,.13);font-weight:500;font-size:12px;color:var(--gold2)}
.sx.develop .cnote{font-size:11px;line-height:16px;color:var(--mute);margin-top:16px}
.sx.develop .cempty{font-size:11.5px;line-height:16px;color:var(--faint);margin-top:6px}
`;

function StatusBar({ t, label }: { t: (k: string) => string; label: string }) {
  return (
    <div>
      <div className="stbar">
        <span className="spin" />
        <span className="sttext">{t('Generating')} {label} — {t('this can take a minute or two')}</span>
      </div>
      <div className="sttrack"><span className="ind" /></div>
    </div>
  );
}

export default function ScriptonDevelop(props: ScriptonDevelopProps) {
  const { t, dir } = useLocale();
  const ladder = props.ladder || [];

  // Counters (node §2): done = stages with a *completed* version (the current/active stage is 'on').
  const done = useMemo(() => ladder.filter((l) => l.state === 'done').length, [ladder]);
  const pct = Math.round((done / TOTAL) * 100);

  // The focused stage — defaults to the furthest-developed stage (the current 'on'); ladder rows switch it.
  const defaultKind = useMemo(() => {
    const last = [...ladder].reverse().find((l) => l.versionId || l.state === 'on');
    return last?.kind || ladder[0]?.kind || '';
  }, [ladder]);
  const [focusKind, setFocusKind] = useState<string>(defaultKind);
  useEffect(() => { setFocusKind(defaultKind); }, [defaultKind]);

  const active = ladder.find((l) => l.kind === focusKind) || ladder.find((l) => l.state === 'on') || ladder[ladder.length - 1];
  const activeIdx = Math.max(0, ladder.findIndex((l) => l.kind === active?.kind));
  const nextStage = ladder.find((l) => !l.versionId); // next stage with no version yet
  const bodyText = useMemo(() => (active?.body ? cleanStageText(active.body) : ''), [active?.body]);
  const paras = bodyText ? bodyText.split(/\n{2,}/).filter((p) => p.trim()) : [];

  // Top-bar ring + V ▾ — resolve the OPEN BUILD's linked kernel script, then its active version's
  // continuity + label. Builds whose script has renders light up; otherwise honestly hidden (no fake).
  const [hdr, setHdr] = useState<{ continuity: number | null; versionLabel: string | null; title: string | null }>({ continuity: null, versionLabel: null, title: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!props.projectId || !props.buildId) return;
      try {
        const [a, b] = await Promise.all([
          productionApi.scripton.development.listBuilds(props.projectId).catch(() => ({ data: [] as any[] })),
          productionApi.scripton.development.listBuilds(props.projectId, true).catch(() => ({ data: [] as any[] })),
        ]);
        const builds = [...(Array.isArray((a as any).data) ? (a as any).data : []), ...(Array.isArray((b as any).data) ? (b as any).data : [])];
        const build = builds.find((x: any) => x.id === props.buildId);
        const sid = build?.linkedScriptId;
        if (!sid) { if (alive) setHdr((h) => ({ ...h, title: build?.name || null })); return; }
        const vr: any = await productionApi.scripton.versions(sid);
        const vs: any[] = vr.data?.versions || [];
        const av = vs.find((v) => v.active) || vs[vs.length - 1];
        if (alive) setHdr({ continuity: av && typeof av.continuity === 'number' ? av.continuity : null, versionLabel: av?.label || (av ? 'V' + av.n : null), title: build?.name || null });
      } catch { /* degrade — ring/V stay hidden */ }
    })();
    return () => { alive = false; };
  }, [props.projectId, props.buildId]);

  const stageLabel = (kind?: string) => t(LABEL[kind || ''] || kind || '');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx develop" data-vp={props.vp} dir={dir}>
        <ScriptonTopBar
          vp={props.vp}
          onBack={props.onBack}
          centerTitle={{ title: 'Develop', sub: 'Nothing is written until the spine is agreed.' }}
          continuity={hdr.continuity}
          versionLabel={hdr.versionLabel ?? undefined}
          scriptTitle={hdr.title ?? undefined}
        />
        <div className="body">
          <SxRail active="develop" />
          <div className="dvbody">
            {/* ── Ladder rail (92:2) ── */}
            <div className="panel ladderrail">
              <div className="lhead">
                <div className="ltile">✦</div>
                <div className="lhh">
                  <div className="lht">{t('The ladder')}</div>
                  <div className="lhs">{done} / {TOTAL} {t('stages')}</div>
                </div>
              </div>
              <div className="lrows">
                {ladder.map((l, i) => {
                  const sub = l.state === 'on' && props.genBusy ? t('writing…') : (l.versionN ? 'V' + l.versionN + (l.framework ? ' · ' + l.framework : '') : (l.state === 'wait' ? t('pending') : (l.sub || '')));
                  const dot = l.state === 'done' ? '✓' : l.state === 'on' ? '●' : '';
                  return (
                    <button key={l.kind || i} className={'lrow ' + l.state} onClick={() => l.kind && setFocusKind(l.kind)} title={l.name}>
                      <span className="ldot">{dot}</span>
                      <span className="ltext"><span className="lname">{l.name}</span><span className="lsub">{sub}</span></span>
                    </button>
                  );
                })}
              </div>
              <div className="lfoot">
                <div className="lfr"><span>{t('Pipeline')}</span><span className="lfn">{done} / {TOTAL}</span></div>
                <div className="ltrack"><i style={{ width: pct + '%' }} /></div>
              </div>
            </div>

            {/* ── Stage canvas (93:2) ── */}
            <div className="panel stagecanvas">
              <div className="cvhead">
                <div className="cvname">{stageLabel(active?.kind)}</div>
                <div className="cvmeta">{t('Stage')} {activeIdx + 1} {t('of')} {TOTAL}{active?.framework ? ' · ' + active.framework : ''}</div>
                <div className="cvctrl">
                  {active?.versionN ? (
                    <span className="vsw">
                      <span onClick={() => active.stageId && props.onSwitchVersion(active.stageId, -1)}>‹</span>
                      <b>V{active.versionN}</b>
                      <span onClick={() => active.stageId && props.onSwitchVersion(active.stageId, 1)}>›</span>
                    </span>
                  ) : null}
                  <button className="regen" title={t('Regenerate')} onClick={() => active?.kind && props.onRegenerate(active.kind)}>⟳</button>
                </div>
              </div>
              <div className="cvdiv" />
              <div className="cvbody">
                {paras.length ? paras.map((p, i) => <p key={i}>{p}</p>) : <div className="cvempty">{t('Not written yet — generate this stage from the one before it.')}</div>}
              </div>
              <div className="cvfoot">
                {props.genBusy ? (
                  <StatusBar t={t} label={stageLabel(props.genBusy)} />
                ) : (
                  <div className="acts">
                    {nextStage ? <button className="btn gold" onClick={props.onAdvance}>{t('Generate')} {stageLabel(nextStage.kind)} →</button> : null}
                    {active?.kind ? <button className="btn" onClick={() => props.onRegenerate(active.kind!)}>⟳ {t('Regenerate')} {stageLabel(active.kind)}</button> : null}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right context: spine (94:2) + comparables (94:14) ── */}
            <div className="ctxcol">
              <div className="panel spine">
                <div className="ctxin">
                  <div className="ctxhead">
                    <div className="ctxtitle">{t('The spine')}</div>
                    <div className="badge">{t('AGREED FIRST')}</div>
                  </div>
                  {props.spine.map((s, i) => (
                    <div className="srow" key={i}>
                      <div className="slabel">{s.k.toUpperCase()}</div>
                      <div className="sval">{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel comps">
                <div className="ctxin">
                  <div className="ctxhead"><div className="ctxtitle">{t('Comparables')}</div></div>
                  <div className="csub">{t('Auto — closest titles by tone, scale & market.')}</div>
                  {props.comps.length ? (
                    <div className="chips">{props.comps.map((c, i) => <span className="chip" key={i}>{c}</span>)}</div>
                  ) : (
                    <div className="cempty">{t('No comparables yet — they surface with coverage.')}</div>
                  )}
                  <div className="cnote">{t('Comparables steer tone, scale & market — not plot.')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
