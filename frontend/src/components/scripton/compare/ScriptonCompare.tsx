'use client';
/**
 * ScriptON · Render → Compare — the post-render V{prev}↔V{new} diff + render summary,
 * a mode of the Versions workspace (route /scripton/revisions, rail = Versions).
 * Design: Figma 31:2 (desktop) + 51:3 (stacked). Columns are dark Courier with a
 * line-level diff (red removed / green added on changed scenes) — the Figma uses the
 * screenplay paper LOOK on a dark column, not the cream A4 sheet. Behind osShell.
 */
import { useMemo } from 'react';
import { SxRail } from '@/components/scripton/ScriptOnStudio';
import { useLocale } from '@/lib/i18n';
import ScriptonTopBar from '@/components/scripton/topbar/ScriptonTopBar';
import ScriptonShell from '@/components/scripton/ScriptonShell';
import { toSceneDiffs, detectBridge, isSlugLine, type DiffLine } from './scripton-compare.logic';

export type CompareResult = {
  passId: string; status?: string; scriptId?: string; buildId?: string | null;
  version: { id: string; n: number; label: string } | null;
  prevVersion: { id: string; n: number; label: string } | null;
  continuity: number | null; changeCount: number;
  applied: { sceneId: string; sceneNumber: any; label: string; tag: string; kind: string; before: string; after: string }[];
  canonWritten: { kind: string; subject: string; predicate: string; object: string; statement: string; validFrom: any }[];
  decision: { title: string; status: string; context: string } | null;
};
export type CompareProps = {
  title: string; result: CompareResult; vp: 'mobile' | 'tablet' | 'desktop';
  onNav: (k: string) => void; onBack: () => void;
  onSetActive: () => void; onKeep: () => void; onDiscard: () => void;
  busy?: string | null; toast?: string | null;
};

const CSS = `
.sx.cmp{--col:#16181e;position:relative;display:flex;flex-direction:column;height:100%;background:#0a0b0e;color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.cmp *{box-sizing:border-box;margin:0;padding:0}
.sx.cmp svg{display:block}
.sx.cmp .ico{width:16px;height:16px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx.cmp .top{height:56px;flex:0 0 56px;display:flex;align-items:center;gap:13px;padding:0 18px;background:linear-gradient(180deg,#14161c,#101216);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx.cmp .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;cursor:pointer;flex:none}
.sx.cmp .proj{font-weight:700;font-size:15px;color:var(--cream);font-family:var(--sx-title)}
.sx.cmp .cring{margin-inline-start:auto;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--hair2);border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;color:var(--green)}
.sx.cmp .cring .dot{width:7px;height:7px;border-radius:50%;background:var(--green)}
.sx.cmp .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx.cmp .main{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}
/* header banner */
.sx.cmp .banner{display:flex;align-items:center;gap:12px;padding:14px 24px;border-bottom:1px solid rgba(87,179,104,.18);background:rgba(87,179,104,.04);flex:0 0 auto}
.sx.cmp .chk{width:28px;height:28px;border-radius:8px;background:rgba(87,179,104,.18);color:var(--green);display:grid;place-items:center;flex:none}
.sx.cmp .bttl{font-family:var(--sx-title);font-size:15px;font-weight:600;color:var(--cream)}
.sx.cmp .bmeta{font-size:11px;color:var(--mute);margin-top:3px}
.sx.cmp .bctl{margin-inline-start:auto;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.sx.cmp .btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 16px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.4);background:transparent;color:var(--mute);white-space:nowrap}
.sx.cmp .btn.danger{color:var(--red);border-color:rgba(229,99,95,.4);background:transparent}
.sx.cmp .btn.gold{background:var(--gold2);color:var(--goldink);font-weight:600;border-color:transparent}
.sx.cmp .btn:disabled{opacity:.55;cursor:default}
/* layout */
.sx.cmp .wrap{flex:1;min-height:0;display:grid;grid-template-columns:1fr 348px;gap:0}
.sx.cmp .diff{min-height:0;display:grid;grid-template-columns:1fr 1fr;overflow:auto;padding:20px 24px 40px 32px;gap:24px}
.sx.cmp .colhead{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:600;letter-spacing:.2px;color:var(--mute);margin-bottom:12px}
.sx.cmp .colhead .d{width:8px;height:8px;border-radius:50%;flex:none}
.sx.cmp .scol{background:var(--col);border:1px solid var(--hair2);border-radius:6px;padding:23px 25px;font-family:var(--sx-mono);font-size:11.5px;line-height:1.05}
.sx.cmp .blk{margin-bottom:22px}
.sx.cmp .blk:last-child{margin-bottom:0}
.sx.cmp .ln{display:block;white-space:pre-wrap;word-wrap:break-word;margin-bottom:13px;color:#d6d4cc}
.sx.cmp .ln.slug{font-weight:700;color:var(--gold2);text-transform:uppercase;margin-bottom:11px}
.sx.cmp .ln.del{color:#f0a8a3;text-decoration:line-through;opacity:.9}
.sx.cmp .ln.add{border-inline-start:2px solid var(--green);background:rgba(87,179,104,.13);padding:2px 0 2px 12px;margin-inline-start:-12px;border-radius:4px;color:#a8e5bd}
.sx.cmp .ln.empty{min-height:1.05em;margin-bottom:0}
/* THIS RENDER panel */
.sx.cmp .render{margin:20px 24px 40px 0;background:#0c0d11;border:1px solid var(--hair);border-radius:14px;overflow:auto;padding:17px;display:flex;flex-direction:column;gap:16px;min-height:0}
.sx.cmp .rhead{display:flex;align-items:center;justify-content:space-between}
.sx.cmp .rhead .rt{font-size:9.5px;font-weight:600;letter-spacing:.8px;color:var(--gold)}
.sx.cmp .rhead .rs{font-size:11px;font-weight:600;color:var(--green);display:inline-flex;align-items:center;gap:6px}
.sx.cmp .sect .lab{font-size:9px;font-weight:600;letter-spacing:.6px;color:var(--faint);margin-bottom:9px;text-transform:uppercase}
.sx.cmp .row{display:flex;gap:9px;align-items:flex-start;margin-bottom:9px;font-size:11.5px;line-height:1.35}
.sx.cmp .row .ic{flex:none;margin-top:1px}
.sx.cmp .row .ic.ok{color:var(--green)}.sx.cmp .row .ic.dotc{width:7px;height:7px;border-radius:50%;margin-top:5px}
.sx.cmp .row .tx{color:var(--mute)}.sx.cmp .row .tx b{color:var(--cream);font-weight:500}
.sx.cmp .row .tx .sub{color:var(--faint);font-size:11px}
.sx.cmp .render .sect:first-of-type .row{font-size:12px}
.sx.cmp .render .sect:first-of-type .row .tx,.sx.cmp .render .sect:first-of-type .row .tx b{color:var(--cream);font-weight:500}
.sx.cmp .note{margin-top:auto;background:rgba(87,179,104,.06);border:1px solid rgba(87,179,104,.22);border-radius:10px;padding:10px 13px;font-size:11px;color:var(--mute);line-height:1.5}
/* chips (tablet/mobile condensed panel) */
.sx.cmp .chips{display:flex;flex-wrap:wrap;gap:8px}
.sx.cmp .chip{font-size:11.5px;font-weight:600;border-radius:999px;padding:6px 12px;border:1px solid var(--hair)}
.sx.cmp .empty{flex:1;display:grid;place-items:center;text-align:center;color:var(--faint);font-size:13px;padding:40px}
.sx.cmp .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:var(--track);border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px}
/* stacked (tablet/mobile per 51:3) */
.sx.cmp[data-vp="tablet"] .wrap,.sx.cmp[data-vp="mobile"] .wrap{display:flex;flex-direction:column;overflow:auto}
.sx.cmp[data-vp="tablet"] .diff,.sx.cmp[data-vp="mobile"] .diff{display:flex;flex-direction:column;overflow:visible;flex:0 0 auto;padding:20px 20px 0;gap:18px}
.sx.cmp[data-vp="tablet"] .scol,.sx.cmp[data-vp="mobile"] .scol{min-height:0;border-radius:8px;font-size:12px}
.sx.cmp[data-vp="tablet"] .render,.sx.cmp[data-vp="mobile"] .render{margin:20px;background:var(--panel);border-radius:14px;flex:0 0 auto}
.sx.cmp[data-vp="mobile"] .banner{flex-wrap:wrap}
`;

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
const Line = ({ l }: { l: DiffLine }) => (
  <span className={'ln' + (l.cls ? ' ' + l.cls : '') + (isSlugLine(l.t) ? ' slug' : '') + (l.t.trim() ? '' : ' empty')}>{l.t || ' '}</span>
);

export default function ScriptonCompare(props: CompareProps) {
  const { dir, t } = useLocale();
  const r = props.result;
  const vp = props.vp;
  const stacked = vp !== 'desktop';
  const sceneDiffs = useMemo(() => toSceneDiffs(r.applied || []), [r.applied]);
  const bridge = useMemo(() => detectBridge(r.applied || []), [r.applied]);
  const newLbl = r.version?.label || (r.version ? 'V' + r.version.n : t('rendered'));
  const prevLbl = r.prevVersion?.label || t('previous');
  const score = r.continuity != null ? r.continuity + '%' : '—';
  const k = r.changeCount ?? (r.applied || []).length;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <ScriptonShell screen="cmp" active="revisions" vp={vp} onBack={props.onBack} onNav={props.onNav} topbar={{ scriptId: props.result?.scriptId, continuity: props.result?.continuity, versionLabel: props.result?.version?.label || (props.result?.version ? 'V' + props.result.version.n : undefined) }} overlay={props.toast ? <div className="toast">{props.toast}</div> : null}>
          <div className="main">
            {/* Header banner */}
            <div className="banner">
              <span className="chk"><svg className="ico" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg></span>
              <div>
                <div className="bttl">{t('Rendered')} {newLbl}</div>
                <div className="bmeta">{t('from the Revision Pass')} · {k} {t('changes applied')} · {t('continuity')} {score} · {bridge.count} {t('auto-fix')}</div>
              </div>
              <div className="bctl">
                {!stacked && <button className="btn danger" disabled={!!props.busy} onClick={props.onDiscard}>{t('Discard')} {newLbl}</button>}
                <button className="btn" disabled={!!props.busy} onClick={props.onKeep}>{t('Keep')} {prevLbl} {t('active')}</button>
                <button className="btn gold" disabled={!!props.busy} onClick={props.onSetActive}>✓ {t('Set')} {newLbl} {t('active')}</button>
              </div>
            </div>

            <div className="wrap">
              {/* Two-column diff */}
              <div className="diff">
                <div>
                  <div className="colhead"><span className="d" style={{ background: 'var(--blue)' }} />{prevLbl.toUpperCase()} · {t('previous (active)')}</div>
                  <div className="scol">
                    {sceneDiffs.length ? sceneDiffs.map((b) => (
                      <div className="blk" key={'p' + b.key}>{b.prev.map((l, i) => <Line key={i} l={l} />)}</div>
                    )) : <span className="ln" style={{ color: 'var(--faint)' }}>{t('No changed scenes.')}</span>}
                  </div>
                </div>
                <div>
                  <div className="colhead" style={{ color: 'var(--gold2)' }}><span className="d" style={{ background: 'var(--green)' }} />{newLbl.toUpperCase()} · {t('rendered')}</div>
                  <div className="scol">
                    {sceneDiffs.length ? sceneDiffs.map((b) => (
                      <div className="blk" key={'n' + b.key}>{b.next.map((l, i) => <Line key={i} l={l} />)}</div>
                    )) : <span className="ln" style={{ color: 'var(--faint)' }}>{t('No changed scenes.')}</span>}
                  </div>
                </div>
              </div>

              {/* THIS RENDER */}
              <div className="render">
                <div className="rhead"><span className="rt">{t('THIS RENDER')}</span><span className="rs"><span className="dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />{score}</span></div>

                {stacked ? (
                  <div className="chips">
                    {r.canonWritten.slice(0, 4).map((f, i) => <span key={i} className="chip" style={{ color: 'var(--green)', borderColor: 'rgba(87,179,104,.4)', background: 'rgba(87,179,104,.08)' }}>{cap(f.subject)} → {f.object}</span>)}
                    {r.decision && <span className="chip" style={{ color: 'var(--mute)' }}>{t('Decision recorded')}</span>}
                    {bridge.note && <span className="chip" style={{ color: 'var(--violet)', borderColor: 'rgba(139,124,240,.4)', background: 'rgba(139,124,240,.14)' }}>{t('Auto-fix')}: {t('DAWN bridge')}</span>}
                  </div>
                ) : (
                  <>
                    <div className="sect">
                      <div className="lab">{t('APPLIED')} · {k} {t('CHANGES')}</div>
                      {(r.applied || []).map((c, i) => (
                        <div className="row" key={i}><span className="ic ok"><svg className="ico" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg></span><span className="tx"><b>{t('Scene')} {c.sceneNumber ?? '—'}</b> · {c.label}{c.tag ? <span className="sub"> · {c.tag}</span> : null}</span></div>
                      ))}
                    </div>
                    <div className="sect">
                      <div className="lab">{t('CANON WRITTEN')}</div>
                      {r.canonWritten.length ? r.canonWritten.map((f, i) => (
                        <div className="row" key={i}><span className="ic dotc" style={{ background: 'var(--green)' }} /><span className="tx"><b>{cap(f.subject)} → {f.object}</b>{f.validFrom != null ? <span className="sub"> ({t('valid from')} S{f.validFrom})</span> : null}</span></div>
                      )) : <div className="row"><span className="tx sub">{t('No new canon this render.')}</span></div>}
                    </div>
                    <div className="sect">
                      <div className="lab">{t('DECISION RECORDED')}</div>
                      <div className="row"><span className="ic dotc" style={{ background: 'var(--amber)' }} /><span className="tx"><b>{r.decision?.title || t('Render pass')}</b> — {cap(r.decision?.status || 'Accepted')}</span></div>
                    </div>
                    <div className="sect">
                      <div className="lab">{t('AUTO-FIX APPLIED')}</div>
                      {bridge.note ? <div className="row"><span className="ic dotc" style={{ background: 'var(--violet)' }} /><span className="tx">{bridge.note}</span></div>
                        : <div className="row"><span className="tx sub">{t('No bridges needed.')}</span></div>}
                    </div>
                  </>
                )}
                <div className="note">{prevLbl} {t('is preserved and still readable. Switch the active version back anytime — nothing was overwritten.')}</div>
              </div>
            </div>
          </div>
      </ScriptonShell>
    </>
  );
}
