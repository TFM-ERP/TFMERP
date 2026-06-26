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
.sx.cmp{--bg:#0a0b0e;--panel:#14161c;--panel2:#1a1d24;--col:#101218;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#15120B;--cream:#F4EEE0;--text:#E7E3D8;--mut:#9aa1ab;--faint:#6b727d;--green:#57b368;--blue:#5b8def;--red:#e5635f;--amber:#e0a23b;--violet:#9b8cf0;position:relative;display:flex;flex-direction:column;height:100%;background:var(--bg);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.cmp *{box-sizing:border-box;margin:0;padding:0}
.sx.cmp svg{display:block}
.sx.cmp .ico{width:16px;height:16px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx.cmp .top{height:56px;flex:0 0 56px;display:flex;align-items:center;gap:13px;padding:0 18px;background:linear-gradient(180deg,#14161c,#101216);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx.cmp .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;cursor:pointer;flex:none}
.sx.cmp .proj{font-weight:700;font-size:15px;color:var(--cream);font-family:var(--sx-title)}
.sx.cmp .cring{margin-inline-start:auto;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--hair2);border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;color:var(--green)}
.sx.cmp .cring .dot{width:7px;height:7px;border-radius:50%;background:var(--green)}
.sx.cmp .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx.cmp .rail{width:74px;flex:0 0 74px;background:#0e1015;border-inline-end:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px;overflow-y:auto}
.sx.cmp .ritem{width:58px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);cursor:pointer;position:relative;border:none;background:transparent}
.sx.cmp .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mut)}
.sx.cmp .ritem .lbl{font-size:9px;font-weight:600}
.sx.cmp .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink)}
.sx.cmp .ritem.on .lbl{color:var(--gold2)}
.sx.cmp .ritem.on:before{content:"";position:absolute;inset-inline-start:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
.sx.cmp .main{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}
/* header banner */
.sx.cmp .banner{display:flex;align-items:center;gap:14px;padding:15px 22px;border-bottom:1px solid var(--hair);background:linear-gradient(180deg,rgba(87,179,104,.05),transparent);flex:0 0 auto}
.sx.cmp .chk{width:30px;height:30px;border-radius:9px;background:rgba(87,179,104,.16);color:var(--green);display:grid;place-items:center;flex:none}
.sx.cmp .bttl{font-family:var(--sx-title);font-size:18px;font-weight:700;color:var(--cream)}
.sx.cmp .bmeta{font-size:12px;color:var(--mut);margin-top:2px}
.sx.cmp .bctl{margin-inline-start:auto;display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}
.sx.cmp .btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid var(--hair);background:#1b1e25;color:var(--mut);white-space:nowrap}
.sx.cmp .btn.danger{color:var(--red);border-color:rgba(229,99,95,.4);background:transparent}
.sx.cmp .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;border-color:transparent}
.sx.cmp .btn:disabled{opacity:.55;cursor:default}
/* layout */
.sx.cmp .wrap{flex:1;min-height:0;display:grid;grid-template-columns:1fr 344px;gap:0}
.sx.cmp .diff{min-height:0;display:grid;grid-template-columns:1fr 1fr;overflow:auto;padding:18px 18px 40px;gap:16px}
.sx.cmp .colhead{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.3px;color:var(--mut);margin-bottom:11px}
.sx.cmp .colhead .d{width:8px;height:8px;border-radius:50%;flex:none}
.sx.cmp .scol{background:var(--col);border:1px solid var(--hair);border-radius:12px;padding:18px 18px;font-family:"Courier Prime",ui-monospace,monospace;font-size:12px;line-height:1.05}
.sx.cmp .blk{margin-bottom:22px}
.sx.cmp .blk:last-child{margin-bottom:0}
.sx.cmp .ln{display:block;white-space:pre-wrap;word-wrap:break-word;padding:1px 0;color:var(--text)}
.sx.cmp .ln.slug{font-weight:700;color:var(--gold2);text-transform:uppercase;margin-bottom:8px}
.sx.cmp .ln.del{color:var(--red);text-decoration:line-through;opacity:.62}
.sx.cmp .ln.add{border-inline-start:3px solid var(--green);background:rgba(87,179,104,.13);padding-inline-start:9px;margin-inline-start:-12px;color:#cfe9d4}
.sx.cmp .ln.empty{min-height:1.05em}
/* THIS RENDER panel */
.sx.cmp .render{border-inline-start:1px solid var(--hair);background:#0c0d11;overflow:auto;padding:18px 18px 40px;display:flex;flex-direction:column;gap:18px;min-height:0}
.sx.cmp .rhead{display:flex;align-items:center;justify-content:space-between}
.sx.cmp .rhead .rt{font-size:10.5px;font-weight:800;letter-spacing:1.1px;color:var(--gold)}
.sx.cmp .rhead .rs{font-size:12px;font-weight:700;color:var(--green);display:inline-flex;align-items:center;gap:6px}
.sx.cmp .sect .lab{font-size:9.5px;font-weight:700;letter-spacing:.7px;color:var(--faint);margin-bottom:9px;text-transform:uppercase}
.sx.cmp .row{display:flex;gap:9px;align-items:flex-start;margin-bottom:9px;font-size:12px;line-height:1.4}
.sx.cmp .row .ic{flex:none;margin-top:1px}
.sx.cmp .row .ic.ok{color:var(--green)}.sx.cmp .row .ic.dotc{width:7px;height:7px;border-radius:50%;margin-top:6px}
.sx.cmp .row .tx{color:var(--text)}.sx.cmp .row .tx b{color:var(--cream);font-weight:600}
.sx.cmp .row .tx .sub{color:var(--faint);font-size:11px}
.sx.cmp .note{margin-top:auto;background:rgba(198,164,99,.06);border:1px solid rgba(198,164,99,.22);border-radius:11px;padding:12px 13px;font-size:11.5px;color:var(--gold2);line-height:1.5}
/* chips (tablet/mobile condensed panel) */
.sx.cmp .chips{display:flex;flex-wrap:wrap;gap:8px}
.sx.cmp .chip{font-size:11.5px;font-weight:600;border-radius:999px;padding:6px 12px;border:1px solid var(--hair)}
.sx.cmp .empty{flex:1;display:grid;place-items:center;text-align:center;color:var(--faint);font-size:13px;padding:40px}
.sx.cmp .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px}
/* stacked (tablet/mobile per 51:3) */
.sx.cmp[data-vp="tablet"] .wrap,.sx.cmp[data-vp="mobile"] .wrap{display:flex;flex-direction:column;overflow:auto}
.sx.cmp[data-vp="tablet"] .diff,.sx.cmp[data-vp="mobile"] .diff{display:flex;flex-direction:column;overflow:visible;flex:0 0 auto}
.sx.cmp[data-vp="tablet"] .scol,.sx.cmp[data-vp="mobile"] .scol{min-height:0}
.sx.cmp[data-vp="tablet"] .render,.sx.cmp[data-vp="mobile"] .render{border-inline-start:none;border-top:1px solid var(--hair);flex:0 0 auto}
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
      <div className="sx cmp" data-vp={vp} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <ScriptonTopBar vp={vp} onBack={props.onBack} continuity={props.result?.continuity} />
        <div className="body">
          <SxRail active="revisions" onNav={props.onNav} />
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
                  <div className="colhead"><span className="d" style={{ background: 'var(--green)' }} />{newLbl.toUpperCase()} · {t('rendered')}</div>
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
                    {r.decision && <span className="chip" style={{ color: 'var(--mut)' }}>{t('Decision recorded')}</span>}
                    {bridge.note && <span className="chip" style={{ color: 'var(--violet)', borderColor: 'rgba(155,140,240,.4)', background: 'rgba(155,140,240,.08)' }}>{t('Auto-fix')}: {t('DAWN bridge')}</span>}
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
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
