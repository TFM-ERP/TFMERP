'use client';
/**
 * ScriptON · Versions — the default (cold) view of the Versions workspace
 * (/scripton/revisions, no ?pass): the BuildVersion timeline + the semantic-diff
 * preview + the append-only DecisionRecord log. Design: Figma 6:79. The compact
 * diff reuses the Render→Compare diff logic; "open full compare" deep-links to the
 * compare mode (?pass=). Branches display read-only (none in P0 → linear spine).
 */
import { useMemo, useEffect, useRef } from 'react';
import { SxRail } from '@/components/scripton/shared/sx';
import { useLocale } from '@/lib/i18n';
import ScriptonTopBar from '@/components/scripton/topbar/ScriptonTopBar';
import ScriptonShell from '@/components/scripton/ScriptonShell';
import { unifiedDiff, detectBridge, isSlugLine, type DiffLine } from '@/components/scripton/compare/scripton-compare.logic';
import { deriveTags, diffAnnotations, diffPairLabel } from './scripton-versions.logic';
import type { CompareResult } from '@/components/scripton/compare/ScriptonCompare';

export type VersionNode = { id: string; n: number; label: string; active: boolean; date?: string; passId: string | null; changeCount: number; continuity: number | null };
export type Decision = { id: string; title: string; status: string; context: string; decision: string; consequences: string; supersedesId?: string | null; createdAt?: string };
export type VersionsData = { versions: VersionNode[]; pending: { passId: string; changeCount: number; rendering: boolean } | null; decisions: Decision[] };
export type VersionsProps = {
  title: string; data: VersionsData; vp: 'mobile' | 'tablet' | 'desktop';
  selectedId: string; onSelect: (node: VersionNode) => void;
  diff: CompareResult | null; diffLoading: boolean;
  onOpenCompare: (passId: string) => void;
  onNav: (k: string) => void; onBack: () => void; toast?: string | null;
};

const TAG_STYLE: Record<string, { c: string; b: string }> = {
  scenes: { c: '#57b368', b: 'rgba(87,179,104,.14)' },
  canon: { c: '#48b6a0', b: 'rgba(72,182,160,.14)' },
  tone: { c: '#8b7cf0', b: 'rgba(139,124,240,.14)' },
  budget: { c: '#57b368', b: 'rgba(87,179,104,.14)' },
};

const CSS = `
.sx.vers{position:relative;display:flex;flex-direction:column;height:100%;background:#0a0b0e;color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.vers *{box-sizing:border-box;margin:0;padding:0}
.sx.vers svg{display:block}
.sx.vers .top{height:56px;flex:0 0 56px;display:flex;align-items:center;gap:13px;padding:0 18px;background:linear-gradient(180deg,#14161c,#101216);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx.vers .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;cursor:pointer;flex:none}
.sx.vers .proj{font-weight:700;font-size:15px;color:var(--cream);font-family:var(--sx-title)}
.sx.vers .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx.vers .main{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}
.sx.vers .phead{padding:26px 40px 8px;flex:0 0 auto}
.sx.vers .phead h1{font-family:var(--sx-title);font-size:21px;font-weight:600;color:var(--cream);letter-spacing:-.2px;font-variation-settings:"SOFT" 0,"WONK" 1}
.sx.vers .phead .sub{font-size:12px;color:var(--faint);margin-top:6px}
.sx.vers .grid{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:12px 40px 28px;overflow:hidden}
/* timeline (renamed .tl → .vtl: .tl collided with the shared top bar's left cluster and turned it into a card) */
.sx.vers .vtl{background:#181b22;border:1px solid var(--hair);border-radius:14px;padding:26px 26px 26px 30px;overflow:auto;position:relative}
.sx.vers .spine{position:relative;padding-inline-start:30px}
.sx.vers .spine:before{content:"";position:absolute;inset-inline-start:5px;top:8px;bottom:8px;width:2px;background:var(--hair2)}
.sx.vers .node{position:relative;margin-bottom:18px}
.sx.vers .node:last-child{margin-bottom:0}
.sx.vers .dot{position:absolute;inset-inline-start:-30px;top:18px;width:13px;height:13px;border-radius:50%;background:var(--blue);border:2px solid #0a0b0e;transform:translateX(-1px)}
.sx.vers .node.active .dot{background:var(--gold);box-shadow:0 0 0 4px rgba(198,164,99,.25)}
.sx.vers .node.pending .dot{background:transparent;border:2px dashed var(--faint)}
.sx.vers .node.branch .dot{background:var(--violet)}
.sx.vers .vcard{background:#0e1014;border:1px solid var(--hair);border-radius:12px;padding:13px 15px;cursor:pointer;text-align:start;width:100%;display:block}
.sx.vers .vcard:hover{border-color:var(--hair2)}
.sx.vers .node.active .vcard{border-color:rgba(198,164,99,.5);background:rgba(198,164,99,.05)}
.sx.vers .node.sel .vcard{box-shadow:0 0 0 1px rgba(198,164,99,.5)}
.sx.vers .node.pending .vcard{border-style:dashed;cursor:default;color:var(--mute)}
.sx.vers .vt{font-size:13px;font-weight:700;color:var(--cream)}
.sx.vers .node.active .vt{color:var(--gold2)}
.sx.vers .node.pending .vt{color:var(--gold2)}
.sx.vers .vsub{font-size:11px;color:var(--text);margin-top:3px;line-height:1.4}
.sx.vers .vmeta{font-size:10px;color:var(--faint);margin-top:4px}
.sx.vers .branchwrap{position:relative;margin:-6px 0 18px 40px}
.sx.vers .branchwrap:before{content:"";position:absolute;inset-inline-start:-34px;top:-10px;width:34px;height:26px;border-inline-start:2px dashed var(--violet);border-bottom:2px dashed var(--violet);border-end-start-radius:10px;opacity:.5}
/* right column */
.sx.vers .rightcol{display:flex;flex-direction:column;gap:18px;min-height:0}
.sx.vers .card{background:#181b22;border:1px solid var(--hair);border-radius:14px;padding:17px 19px;display:flex;flex-direction:column;min-height:0}
.sx.vers .card.diff{flex:1.1}
.sx.vers .card.log{flex:1}
.sx.vers .ch{font-family:var(--sx-body);font-size:14px;font-weight:600;color:var(--cream)}
.sx.vers .csub{font-size:11px;color:var(--faint);margin-top:3px}
.sx.vers .tags{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0}
.sx.vers .tag{font-size:10.5px;font-weight:500;border-radius:999px;padding:4px 10px}
.sx.vers .dblock{background:#0e1014;border:none;border-radius:10px;padding:14px 16px;font-family:var(--sx-mono);font-size:11px;line-height:1.55;overflow:auto;flex:1;min-height:0}
.sx.vers .ln{display:block;white-space:pre-wrap;word-wrap:break-word}
.sx.vers .ln.slug{font-weight:700;color:var(--gold2);text-transform:uppercase}
.sx.vers .ln.del{color:#f0a8a3;text-decoration:line-through}
.sx.vers .ln.add{color:#a6e5ba;border-inline-start:2px solid var(--green);padding-inline-start:8px;margin-inline-start:-10px}
.sx.vers .ann{margin-top:9px;color:var(--mute)}
.sx.vers .ann .ins{color:var(--violet)}
.sx.vers .ann .chg{color:var(--green)}
.sx.vers .blk{margin-bottom:14px}.sx.vers .blk:last-child{margin-bottom:0}
.sx.vers .note{font-size:10.5px;color:var(--mute);margin-top:12px;line-height:1.5}
.sx.vers .full{margin-top:10px;display:inline-flex;align-items:center;gap:6px;color:var(--gold2);font-size:12px;font-weight:600;cursor:pointer;background:none;border:none;padding:0}
.sx.vers .skel{flex:1;border-radius:11px;background:linear-gradient(90deg,#16181e,#1c1f27,#16181e);background-size:200% 100%;animation:vk 1.3s ease-in-out infinite}@keyframes vk{0%{background-position:200% 0}100%{background-position:-200% 0}}
.sx.vers .empty{flex:1;display:grid;place-items:center;text-align:center;color:var(--faint);font-size:12.5px;padding:24px}
/* decision log */
.sx.vers .logwrap{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:11px;margin-top:6px}
.sx.vers .dec{background:#0e1014;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:11px 13px}
.sx.vers .dech{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.sx.vers .dect{font-size:12.5px;font-weight:600;color:var(--cream)}
.sx.vers .badge{font-size:9px;font-weight:600;letter-spacing:.4px;border-radius:999px;padding:3px 8px;flex:none}
.sx.vers .badge.acc{color:var(--green);background:rgba(87,179,104,.16)}
.sx.vers .badge.prop{color:var(--amber);background:rgba(224,162,59,.16)}
.sx.vers .decb{font-size:11px;color:var(--mute);margin-top:7px;line-height:1.5}
.sx.vers .decb b{color:var(--text);font-weight:600}
.sx.vers .lognote{font-size:10px;color:var(--faint);margin-top:10px;line-height:1.5;flex:0 0 auto}
.sx.vers .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px}
/* responsive: stack */
.sx.vers[data-vp="tablet"] .grid,.sx.vers[data-vp="mobile"] .grid{display:flex;flex-direction:column;overflow:auto}
.sx.vers[data-vp="tablet"] .vtl,.sx.vers[data-vp="mobile"] .vtl{flex:0 0 auto;overflow:visible}
.sx.vers[data-vp="tablet"] .rightcol,.sx.vers[data-vp="mobile"] .rightcol{flex:0 0 auto}
.sx.vers[data-vp="tablet"] .dblock,.sx.vers[data-vp="mobile"] .dblock{max-height:340px}
.sx.vers[data-vp="tablet"] .logwrap,.sx.vers[data-vp="mobile"] .logwrap{overflow:visible}
`;

const Line = ({ l }: { l: DiffLine }) => (
  <span className={'ln' + (l.cls ? ' ' + l.cls : '') + (isSlugLine(l.t) ? ' slug' : '')}>{l.t || ' '}</span>
);
const fmtDate = (d?: string) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return ''; }
};

export default function ScriptonVersions(props: VersionsProps) {
  const { dir, t } = useLocale();
  const { data, diff } = props;
  const versions = data?.versions || [];
  const decisions = data?.decisions || [];
  const nextN = (versions.length ? versions[versions.length - 1].n : 0) + 1;

  const selected = versions.find((v) => v.id === props.selectedId) || null;
  const selIdx = versions.findIndex((v) => v.id === props.selectedId);
  const prevLabel = selIdx > 0 ? versions[selIdx - 1].label : null;
  const pairLabel = diffPairLabel(selected, prevLabel);

  // Unified per-scene diff (red removed + added together, the semantic-preview look).
  const diffBlocks = useMemo(() => (diff?.applied || []).map((c: any, i: number) => ({ key: (c?.sceneId || 'c') + ':' + i, lines: unifiedDiff(c?.before ?? '', c?.after ?? '') })), [diff]);
  const tags = useMemo(() => deriveTags(diff?.applied || [], diff?.canonWritten || []), [diff]);
  const annotations = useMemo(() => diffAnnotations(diff?.canonWritten || [], detectBridge(diff?.applied || []).note), [diff]);

  // Keep the selected/active node in view (the timeline can be long).
  const tlRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = tlRef.current; if (!host) return;
    const el = host.querySelector('.node.sel') as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [props.selectedId, data?.versions?.length]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <ScriptonShell screen="vers" active="revisions" vp={props.vp} onBack={props.onBack} onNav={props.onNav} topbar={{ scriptScoped: false }} overlay={props.toast ? <div className="toast">{props.toast}</div> : null}>
          <div className="main">
            <div className="phead">
              <h1>{t('Versions')}</h1>
              <div className="sub">{t('Every draft, branch & decision — non-destructive. Semantic diff, not line diff.')}</div>
            </div>
            <div className="grid">
              {/* ── Timeline ── */}
              <div className="vtl" ref={tlRef}>
                <div className="spine">
                  {versions.length === 0 ? <div className="empty">{t('No versions yet — render a pass to start the timeline.')}</div> : versions.map((v) => (
                    <div className={'node' + (v.active ? ' active' : '') + (v.id === props.selectedId ? ' sel' : '')} key={v.id}>
                      <span className="dot" />
                      <button className="vcard" onClick={() => v.passId && props.onSelect(v)}>
                        <div className="vt">{v.label}{v.active ? ' · ' + t('Active draft') : ''}</div>
                        <div className="vmeta">{[fmtDate(v.date), v.changeCount ? `${v.changeCount} ${t('scenes changed')}` : t('rendered from Build'), v.continuity != null ? v.continuity + '%' : ''].filter(Boolean).join(' · ')}</div>
                      </button>
                    </div>
                  ))}
                  {data?.pending && (
                    <div className="node pending">
                      <span className="dot" />
                      <div className="vcard">
                        <div className="vt">V{nextN} · {data.pending.rendering ? t('Rendering') : t('Pending')} {data.pending.changeCount} {t('changes…')}</div>
                        <div className="vmeta">{t('now')} · {t('from the open Revision Pass')}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right column ── */}
              <div className="rightcol">
                {/* Semantic diff */}
                <div className="card diff">
                  <div className="ch">{t('Semantic diff')} · {pairLabel}</div>
                  {props.diffLoading ? <div className="skel" style={{ marginTop: 14, minHeight: 160 }} />
                    : !selected?.passId ? <div className="empty">{t('Render a pass to see a diff.')}</div>
                      : (
                        <>
                          {tags.length > 0 && <div className="tags">{tags.map((tg, i) => <span key={i} className="tag" style={{ color: TAG_STYLE[tg.kind].c, background: TAG_STYLE[tg.kind].b }}>{tg.label}</span>)}</div>}
                          <div className="dblock">
                            {diffBlocks.length ? diffBlocks.map((b) => (
                              <div className="blk" key={b.key}>{b.lines.map((l, i) => <Line key={i} l={l} />)}</div>
                            )) : <span className="ln" style={{ color: 'var(--faint)' }}>{t('No scene-level changes.')}</span>}
                            {annotations.length > 0 && (
                              <div className="ann">{annotations.map((a, i) => <span key={i} className="ln"><span className={a.startsWith('+') ? 'ins' : 'chg'}>{a}</span></span>)}</div>
                            )}
                          </div>
                          <div className="note">{t('Sentence-level diff — surfaces meaning changes, hides rephrasing noise. Semantic conflicts are flagged for human review.')}</div>
                          {selected?.passId && <button className="full" onClick={() => props.onOpenCompare(selected.passId!)}>{t('open full compare')} →</button>}
                        </>
                      )}
                </div>

                {/* Decision log */}
                <div className="card log">
                  <div className="ch">{t('Decision log')} · {t('creative decisions')}</div>
                  <div className="csub">{t('Why each choice was made — append-only, survives team turnover.')}</div>
                  {decisions.length === 0 ? <div className="empty">{t('No decisions yet.')}</div> : (
                    <div className="logwrap">
                      {decisions.map((d) => {
                        const prop = String(d.status).toUpperCase() === 'PROPOSED';
                        return (
                          <div className="dec" key={d.id}>
                            <div className="dech"><span className="dect">{d.title}</span><span className={'badge ' + (prop ? 'prop' : 'acc')}>{prop ? t('PROPOSED') : t('ACCEPTED')}</span></div>
                            <div className="decb">
                              {d.context ? <><b>{t('Context')}:</b> {d.context} </> : null}
                              {d.decision ? <><b>{t('Decision')}:</b> {d.decision} </> : null}
                              {d.consequences ? <><b>{t('Consequence')}:</b> {d.consequences}</> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="lognote">{t('Superseded decisions are never deleted — they are linked, so the reasoning trail stays intact.')}</div>
                </div>
              </div>
            </div>
          </div>
      </ScriptonShell>
    </>
  );
}
