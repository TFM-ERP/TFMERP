'use client';
/**
 * ScriptON · Canon — route /scripton/canon under the `new` shell flag. The
 * bi-temporal canon graph, read from the merged kernel's CanonFact store.
 * Presentational; the page fetches facts via the canon read endpoint.
 * Tabs filter by CanonKind; the graph is the RELATIONSHIP view; the right
 * panel + timeline are computed with resolveCanonAt (mirrors the kernel).
 */
import { useState } from 'react';
import { SxRail } from '@/components/scripton/ScriptOnStudio';
import { useLocale } from '@/lib/i18n';
import ScriptonTopBar from '@/components/scripton/topbar/ScriptonTopBar';
import {
  TABS, factsForTab, entityList, buildGraph, entityFacts, panelFacts, timelinePoints, humanPred,
  type Fact, type CanonTab,
} from './scripton-canon.logic';

const CSS = `
.sx.canon{position:relative;display:flex;flex-direction:column;height:100%;background:#0a0b0e;color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.canon *{box-sizing:border-box;margin:0;padding:0}
.sx.canon svg{display:block}
.sx.canon .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx.canon .tl{display:flex;align-items:center;gap:12px;min-width:0}
.sx.canon .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer;flex:none}
.sx.canon .proj{font-weight:700;font-size:15.5px;color:var(--cream);font-family:var(--sx-title);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.canon .pill{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.sx.canon .pill .d{width:7px;height:7px;border-radius:50%;flex:none}
.sx.canon .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx.canon .rail{width:76px;flex:0 0 76px;background:#0c0d11;border-inline-end:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px;overflow-y:auto}
.sx.canon .ritem{width:58px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);cursor:pointer;position:relative;border:none;background:transparent}
.sx.canon .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mute)}
.sx.canon .ritem .lbl{font-size:9px;font-weight:600}
.sx.canon .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink);box-shadow:0 6px 16px -4px rgba(198,164,99,.5)}
.sx.canon .ritem.on .lbl{color:var(--gold2)}
.sx.canon .ritem.on:before{content:"";position:absolute;inset-inline-start:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
.sx.canon .main{flex:1;min-width:0;display:flex;flex-direction:column}
.sx.canon .content{flex:1;min-height:0;overflow:hidden;padding:26px 40px;display:flex;flex-direction:column;gap:14px}
.sx.canon .phead{flex:0 0 auto}
.sx.canon .phead h1{font-family:var(--sx-title);font-size:21px;font-weight:600;color:var(--cream);letter-spacing:-.3px}
.sx.canon .phead .sub{font-size:12px;color:var(--faint);margin-top:7px}
.sx.canon .tabs{display:flex;gap:7px;flex:0 0 auto;flex-wrap:wrap}
.sx.canon .tab{padding:6px 12px;border-radius:999px;font-size:12px;font-weight:500;color:var(--mute);background:transparent;border:1px solid rgba(255,255,255,.1);cursor:pointer}
.sx.canon .tab.on{background:var(--gold2);border-color:transparent;color:#15120b;font-weight:600}
.sx.canon .cols{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,2.34fr) minmax(0,1fr);gap:20px}
.sx.canon .gpanel{min-height:0;background:#181b22;border:1px solid var(--hair);border-radius:14px;padding:8px;display:flex;flex-direction:column;overflow:hidden}
.sx.canon .gpanel svg{width:100%;height:100%;flex:1;min-height:0}
.sx.canon .glegend{flex:0 0 auto;display:flex;gap:14px;padding:6px 10px;font-size:10px;color:var(--faint)}
.sx.canon .glegend i{display:inline-block;width:14px;height:0;border-top:2px solid var(--gold);vertical-align:middle;margin-inline-end:5px}
.sx.canon .glegend i.dash{border-top-style:dashed;border-color:var(--faint)}
.sx.canon .flist{min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px}
.sx.canon .frow{background:var(--panel2);border:1px solid var(--hair);border-radius:11px;padding:11px 13px}
.sx.canon .fsub{font-size:10.5px;color:var(--faint);margin-top:3px}

/* Right panel — single #0c0d11 entity card (node 18:2) */
.sx.canon .side{min-height:0;background:#0c0d11;border:1px solid var(--hair);border-radius:14px;padding:17px;display:flex;flex-direction:column;gap:0;overflow:auto}
.sx.canon .ehrow{display:flex;align-items:center;gap:8px}
.sx.canon .edot{width:12px;height:12px;border-radius:50%;flex:none;background:var(--gold)}
.sx.canon .ehead{font-family:var(--sx-title);font-size:18px;font-weight:600;color:var(--cream)}
.sx.canon .erole{font-size:11px;color:var(--faint);margin-top:7px}
.sx.canon .seclabel{font-size:9.5px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:var(--gold);margin:16px 0 8px}
/* Fact cards (node 18:7 / highlighted 18:11) */
.sx.canon .fact{display:flex;gap:8px;padding:10px 12px;background:#0e1014;border:1px solid rgba(255,255,255,.06);border-radius:10px;margin-bottom:8px}
.sx.canon .fact.hl{background:rgba(198,164,99,.07);border-color:rgba(198,164,99,.3)}
.sx.canon .fdot{width:7px;height:7px;border-radius:50%;flex:none;margin-top:4px}
.sx.canon .fst{font-size:12.5px;font-weight:500;color:var(--cream);line-height:1.15}
.sx.canon .fst.muted{color:var(--faint);text-decoration:line-through;text-decoration-color:rgba(255,255,255,.2)}
.sx.canon .fmeta{font-size:9.5px;color:var(--faint);margin-top:4px}
.sx.canon .fmeta.hl{color:var(--gold2)}
.sx.canon .note{font-size:10.5px;color:var(--mute);line-height:1.45;margin-top:8px}
.sx.canon .bitemp{font-size:9px;font-weight:600;letter-spacing:.6px;color:var(--faint);margin:18px 0 8px}
.sx.canon .tl{display:flex;flex-direction:column;gap:0}
.sx.canon .tlp{display:flex;gap:10px;align-items:flex-start;padding:7px 0;position:relative}
.sx.canon .tlp:before{content:"";position:absolute;inset-inline-start:13px;top:18px;bottom:-4px;width:2px;background:var(--hair)}
.sx.canon .tlp:last-child:before{display:none}
.sx.canon .tlnum{width:28px;height:22px;border-radius:6px;flex:none;display:grid;place-items:center;font-size:10px;font-weight:800;background:rgba(198,164,99,.14);color:var(--gold2);font-family:var(--sx-mono)}
.sx.canon .tlc{font-size:11.5px;color:var(--text);line-height:1.4;padding-top:2px}
.sx.canon .panelbox{background:#181b22;border:1px solid var(--hair);border-radius:14px;padding:14px}
.sx.canon .empty{flex:1;display:grid;place-items:center;text-align:center;color:var(--faint);font-size:13px;padding:30px}
.sx.canon .sk{background:linear-gradient(90deg,#16181e,#1c1f27,#16181e);background-size:200% 100%;animation:ckp 1.3s ease-in-out infinite;border-radius:12px}
@keyframes ckp{0%{background-position:200% 0}100%{background-position:-200% 0}}
.sx.canon .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px}

.sx.canon[data-vp="tablet"] .cols{grid-template-columns:1fr;grid-template-rows:minmax(280px,1fr) auto}
.sx.canon[data-vp="tablet"] .content{padding:18px}
/* Mobile: facts-first — entity list + facts + timeline; graph collapses to a list */
.sx.canon[data-vp="mobile"] .content{padding:14px 12px;gap:10px}
.sx.canon[data-vp="mobile"] .cols{display:block;flex:1;min-height:0;overflow:auto}
.sx.canon[data-vp="mobile"] .gpanel{display:none}
.sx.canon[data-vp="mobile"] .phead h1{font-size:21px}
`;

// Per-relationship edge colours (node 6:2): match the relationship semantics by
// keyword so the colouring is data-driven, not bound to specific entity names.
// loves→teal, enslaved→red, father/parent→blue, mother→violet, ally→gold.
const REL_COLORS: { re: RegExp; c: string }[] = [
  { re: /lov|marri|wed|betroth/i, c: '#48b6a0' },
  { re: /enslav|captur|serv|owns?/i, c: '#e5635f' },
  { re: /father|sire|son|paternal/i, c: '#5b8def' },
  { re: /mother|maternal|daughter/i, c: '#8b7cf0' },
  { re: /all(y|ied|iance)|friend|protect/i, c: '#C6A463' },
];
const edgeColor = (label: string) => REL_COLORS.find((r) => r.re.test(label))?.c || '#E6D2A2';

export type CanonProps = {
  title: string; revisionLabel: string; revisionColor: string;
  facts: Fact[]; versionLabel: string; loading?: boolean;
  onNav: (k: string) => void; onBack: () => void; toast?: string | null;
  vp: 'mobile' | 'tablet' | 'desktop';
};

export default function ScriptonCanon(props: CanonProps) {
  const { dir, t } = useLocale();
  const [tab, setTab] = useState<CanonTab>('Relationships');
  const facts = props.facts || [];
  const ents = entityList(facts);
  const [selected, setSelected] = useState<string>('');
  const sel = selected || ents[0]?.name || '';
  const graph = buildGraph(facts);
  const entFacts = entityFacts(facts, sel);
  const pf = panelFacts(entFacts);
  const tl = timelinePoints(entFacts);
  const tabFacts = factsForTab(facts, tab);
  const role = entFacts[0]?.kind ? humanPred(entFacts.find((f) => f.kind === 'CHARACTER')?.object || '') : '';

  // Graph geometry — central node = selected, others on a ring (Doctor's technique).
  const W = 520, H = 380, cx = W / 2, cy = H / 2, R = 132;
  const nodeIds = graph.nodes.map((n) => n.id);
  const center = nodeIds.includes(sel) ? sel : nodeIds[0];
  const ring = nodeIds.filter((id) => id !== center);
  const pos: Record<string, { x: number; y: number }> = {};
  if (center) pos[center] = { x: cx, y: cy };
  ring.forEach((id, i) => { const a = (i / Math.max(1, ring.length)) * Math.PI * 2 - Math.PI / 2; pos[id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx canon" data-vp={props.vp} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <ScriptonTopBar vp={props.vp} onBack={props.onBack} />
        <div className="body">
          <SxRail active="canon" onNav={props.onNav} />
          <div className="main"><div className="content">
            <div className="phead">
              <h1>{t('Canon')}</h1>
              <div className="sub">{t('Story memory · enforced on every generation')} · {facts.length} {t('facts')} · {t('synced from')} {props.versionLabel}</div>
            </div>

            {props.loading ? (
              <div className="cols"><div className="sk" /><div className="sk" /></div>
            ) : facts.length === 0 ? (
              <div className="panelbox empty">{t('No canon yet — render a version to extract its facts. Canon is written by the extract→render loop, not by hand.')}</div>
            ) : (
              <>
                <div className="tabs">
                  {TABS.map((tb) => <button key={tb} className={'tab' + (tb === tab ? ' on' : '')} onClick={() => setTab(tb)}>{t(tb)}</button>)}
                </div>
                <div className="cols">
                  {/* Center — graph (Relationships) or fact list (other kinds) */}
                  <div className="gpanel">
                    {tab === 'Relationships' ? (
                      graph.edges.length ? (
                        <>
                          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
                            <g>{graph.edges.map((e, i) => {
                              const a = pos[e.from], b = pos[e.to]; if (!a || !b) return null;
                              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                              const ec = edgeColor(e.label);
                              return (
                                <g key={i}>
                                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.superseded ? 'rgba(126,126,133,.45)' : ec} strokeWidth={e.superseded ? 1.2 : 1.6} strokeDasharray={e.superseded ? '5 4' : undefined} />
                                  {(() => {
                                    // Stagger labels above/below the line + sit them on a chip so
                                    // adjacent relationship labels ("alliance with" / "retired") don't collide.
                                    const lbl = e.label + (e.superseded ? ' · retired' : '');
                                    // Separate active vs retired labels for the SAME node pair (e.g.
                                    // "alliance with" above the line, "alliance with · retired" below)
                                    // so they never stack; chip backs each for contrast.
                                    const off = e.superseded ? 13 : -6;
                                    const w = lbl.length * 5.3 + 8;
                                    return (
                                      <>
                                        <rect x={mx - w / 2} y={my + off - 9} width={w} height={12.5} rx={3} fill="rgba(10,11,14,.82)" />
                                        <text x={mx} y={my + off} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={e.superseded ? '#7e7e85' : ec}>{lbl}</text>
                                      </>
                                    );
                                  })()}
                                </g>
                              );
                            })}</g>
                            <g fontFamily="var(--sx-body)" textAnchor="middle">{nodeIds.map((id) => {
                              const pp = pos[id]; if (!pp) return null; const isC = id === center;
                              return (
                                <g key={id} style={{ cursor: 'pointer' }} onClick={() => setSelected(id)}>
                                  <circle cx={pp.x} cy={pp.y} r={isC ? 30 : 22} fill={isC ? 'url(#cg)' : '#171a21'} stroke={isC ? 'transparent' : (id === sel ? 'var(--gold)' : 'rgba(255,255,255,.12)')} strokeWidth={isC ? 0 : 1.4} />
                                  <text x={pp.x} y={pp.y + 3.5} fontSize={isC ? 10 : 8.5} fontWeight="800" fill={isC ? '#15120B' : '#E8E6E0'}>{id.length > 9 ? id.slice(0, 8) + '…' : id}</text>
                                </g>
                              );
                            })}</g>
                            <defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E6D2A2" /><stop offset="1" stopColor="#C6A463" /></linearGradient></defs>
                          </svg>
                          <div className="glegend"><span><i />{t('active relation')}</span><span><i className="dash" />{t('superseded / retired')}</span></div>
                        </>
                      ) : <div className="empty">{t('No relationships in canon yet.')}</div>
                    ) : (
                      tabFacts.length ? (
                        <div className="flist" style={{ padding: 6 }}>
                          {tabFacts.map((f, i) => (
                            <button key={i} className="frow" style={{ textAlign: 'start', cursor: 'pointer' }} onClick={() => setSelected(f.subject)}>
                              <div className="fst" style={f.status === 'SUPERSEDED' ? { color: 'var(--faint)', textDecoration: 'line-through' } : undefined}>{f.statement}</div>
                              <div className="fsub">{f.subject} · {t('Established S')}{f.validFrom}{f.status === 'SUPERSEDED' ? ' · ' + t('retired') : ''}</div>
                            </button>
                          ))}
                        </div>
                      ) : <div className="empty">{t('No')} {t(tab)} {t('facts in canon yet.')}</div>
                    )}
                  </div>

                  {/* Right — single entity card + bi-temporal timeline (node 18:2) */}
                  <div className="side">
                    <div className="ehrow"><span className="edot" /><div className="ehead">{sel}</div></div>
                    <div className="erole">{role ? role : ents.find((e) => e.name === sel)?.count + ' ' + t('canon facts')}</div>
                    <div className="seclabel">{t('Canon facts')}</div>
                    {pf.map((f, i) => (
                      <div className={'fact' + (f.isNew ? ' hl' : '')} key={i}>
                        <span className="fdot" style={{ background: f.superseded ? 'var(--faint)' : f.isNew ? 'var(--amber)' : 'var(--green)' }} />
                        <div>
                          <div className={'fst' + (f.superseded ? ' muted' : '')}>{f.statement}</div>
                          <div className={'fmeta' + (f.isNew ? ' hl' : '')}>{t('Established S')}{f.established} · {f.superseded ? t('retired') : f.isNew ? t('new · supersedes a retired fact') : t('active')}</div>
                        </div>
                      </div>
                    ))}
                    <div className="note">{t('Every rewrite, summary, bible, pitch & adaptation is checked against these facts before it’s accepted.')}</div>
                    {tl.length > 1 ? (
                      <>
                        <div className="bitemp">{t('BI-TEMPORAL — canon changes with the story')}</div>
                        <div className="tl">
                          {tl.map((p, i) => (
                            <div className="tlp" key={i}><span className="tlnum">S{p.at}</span><span className="tlc">{p.caption}</span></div>
                          ))}
                        </div>
                      </>
                    ) : null}
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
