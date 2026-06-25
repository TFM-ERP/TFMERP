'use client';
/**
 * ScriptON Doctor — Doctor workspace (carbon-copy of design/doctor.html). Coverage + diagnostics surface.
 * Self-contained, namespaced `.sx`. Live data from productionApi.scripton (coverage/diagnostics).
 */
import React from 'react';
import { SxRail } from './ScriptOnStudio';
import { useLocale } from '@/lib/i18n';

export type SxGauge = { label: string; value: string; color: string; pct: number };
export type SxPt = { text: string; tone: 'good' | 'warn' | 'bad' };
export type SxCoverage = { logline?: string; synopsis?: string; strengths: SxPt[]; concerns: SxPt[]; comps: string[] } | null;
export type SxDiag = { sceneNumber?: string; slugline?: string; verdict?: string; objective?: string; obstacle?: string };
export type SxTab = 'Coverage' | 'Diagnostics' | 'Rewrite' | 'Compare' | 'Develop';

const CSS = `
.sx{--bg:#0b0c0f;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--violet:#8b7cf0;--red:#e5635f;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx *{box-sizing:border-box;margin:0;padding:0}
.sx:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(700px 280px at 72% -6%,rgba(198,164,99,.09),transparent 70%);z-index:0}
.sx svg{display:block}
.sx .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx .tl{display:flex;align-items:center;gap:12px}
.sx .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer}
.sx .proj{font-weight:700;font-size:15.5px;color:var(--cream)}
.sx .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.3px}
.sx .pill .d{width:7px;height:7px;border-radius:50%}
.sx .meta{color:var(--faint);font-size:12px;font-weight:500}
.sx .tr{display:flex;align-items:center;gap:8px}
.sx .btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;color:var(--text);white-space:nowrap;background:transparent}
.sx .btn .ico{width:15px;height:15px}
.sx .btn.kbd{background:transparent;border:1px solid var(--hair);color:var(--faint)}
.sx .btn.ghost{background:#1b1e25;border-color:var(--hair);color:var(--mute)}
.sx .btn.outline{background:#1c1d1a;border-color:rgba(198,164,99,.55);color:var(--gold2)}
.sx .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;box-shadow:0 6px 18px -4px rgba(198,164,99,.45),inset 0 1px 0 rgba(255,255,255,.3)}
.sx .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx .rail{width:74px;flex:0 0 74px;background:#0e1015;border-right:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px}
.sx .ritem{width:58px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);cursor:pointer;position:relative;border:none;background:transparent}
.sx .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mute)}
.sx .ritem .lbl{font-size:9px;font-weight:600}
.sx .ritem:hover .box{border-color:var(--hair2);color:var(--cream)}
.sx .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink);box-shadow:0 6px 16px -4px rgba(198,164,99,.5)}
.sx .ritem.on .lbl{color:var(--gold2)}
.sx .ritem.on:before{content:"";position:absolute;left:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
.sx .main{flex:1;min-width:0;display:flex;flex-direction:column}
.sx .content{flex:1;overflow:hidden;padding:24px 30px;display:flex;flex-direction:column;gap:16px}
.sx .phead h1{font-size:24px;font-weight:800;color:var(--cream);letter-spacing:-.5px}
.sx .sub{font-size:13px;color:var(--mute);margin-top:4px}
.sx .eyebrow{font-size:11px;font-weight:700;letter-spacing:1.4px;color:var(--gold)}
.sx .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
.sx .kpi{background:linear-gradient(180deg,#16191f,#131519);border:1px solid var(--hair);border-radius:13px;padding:15px}
.sx .kpi .kl{font-size:11px;color:var(--faint);font-weight:600;letter-spacing:.3px}
.sx .grade{font-size:26px;font-weight:800;letter-spacing:-.5px;margin-top:6px}
.sx .mtr{height:5px;border-radius:4px;background:#23262e;overflow:hidden;margin-top:8px}
.sx .mtr i{display:block;height:100%;border-radius:4px}
.sx .tabs{display:flex;gap:8px;align-items:center}
.sx .tab{padding:9px 16px;border-radius:11px;font-size:13px;font-weight:600;color:var(--mute);background:#171a20;border:1px solid var(--hair);cursor:pointer;display:flex;align-items:center;gap:7px}
.sx .tab .ico{width:15px;height:15px}
.sx .tab.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:var(--gold2)}
.sx .drgrid{flex:1;display:grid;grid-template-columns:1.75fr 1fr;gap:16px;min-height:0}
.sx .report{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:22px 24px;overflow:auto;display:flex;flex-direction:column;gap:15px}
.sx .rsec h3{font-size:11px;font-weight:700;letter-spacing:1.2px;color:var(--gold);margin-bottom:7px}
.sx .logline{font-size:16px;line-height:1.5;color:var(--cream);font-weight:500}
.sx .synop{font-size:13px;line-height:1.65;color:var(--mute)}
.sx .pts{display:flex;flex-direction:column;gap:8px}
.sx .pt{display:flex;gap:10px;font-size:12.5px;line-height:1.45;color:var(--text)}
.sx .pt .pi{flex:none;margin-top:1px;font-weight:800}
.sx .chips{display:flex;flex-wrap:wrap;gap:8px}
.sx .chip{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:600;color:var(--gold2);background:rgba(198,164,99,.14);border:1px solid rgba(198,164,99,.3)}
.sx .col{display:flex;flex-direction:column;gap:16px;min-height:0}
.sx .panelcard{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:11px}
.sx .pc-h{display:flex;align-items:center;justify-content:space-between}
.sx .pc-h .t{font-size:13.5px;font-weight:700;color:var(--cream)}
.sx .actbar{display:flex;align-items:center;gap:10px;font-size:12px}
.sx .actbar .al{width:46px;color:var(--faint);font-weight:600}
.sx .meter2{height:7px;border-radius:5px;background:#23262e;overflow:hidden;flex:1}
.sx .meter2 i{display:block;height:100%}
.sx .qa{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.sx .tile{background:linear-gradient(180deg,#1b1e25,#171a20);border:1px solid var(--hair);border-radius:12px;padding:13px;cursor:pointer;text-align:left}
.sx .tile:hover{border-color:rgba(198,164,99,.4)}
.sx .tile .ti{width:30px;height:30px;border-radius:9px;background:rgba(198,164,99,.14);display:grid;place-items:center;color:var(--gold2);margin-bottom:9px}
.sx .tile .ti .ico{width:16px;height:16px}
.sx .tile .tt{font-size:13px;font-weight:600;color:var(--cream)}
.sx .tile .ts{font-size:10.5px;color:var(--faint);margin-top:2px}
.sx .run{margin-top:2px;height:46px;border-radius:12px;background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;font-size:13.5px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;border:none;width:100%}
.sx .run .ico{width:16px;height:16px;stroke-width:2}
.sx .lrow{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--hair);font-size:11.5px;color:var(--faint)}
.sx .lrow:first-of-type{border-top:none}
.sx .diag{display:flex;flex-direction:column;gap:9px}
.sx .dcard{background:#171a20;border:1px solid var(--hair);border-radius:11px;padding:12px 13px}
.sx .dcard .dh{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}
.sx .dcard .dn{font-size:12.5px;font-weight:700;color:var(--cream)}
.sx .dcard .dx{font-size:11.5px;color:var(--mute);line-height:1.45}
.sx .badge{font-size:10px;font-weight:800;letter-spacing:.4px;padding:4px 9px;border-radius:999px}
.sx .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}.sx .badge.green{background:rgba(87,179,104,.16);color:var(--green)}.sx .badge.red{background:rgba(229,99,95,.16);color:var(--red)}
.sx .empty{font-size:12.5px;color:var(--faint);border:1px dashed var(--hair2);border-radius:12px;padding:30px 20px;text-align:center;line-height:1.6;margin:auto 0}
.sx .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px;box-shadow:0 14px 40px -12px rgba(0,0,0,.7)}
`;

const RAIL: { k: string; lbl: string; d: React.ReactNode }[] = [
  { k: 'home', lbl: 'Home', d: <path d="M3 11l9-8 9 8M5 10v10h14V10" /> },
  { k: 'library', lbl: 'Library', d: <path d="M4 4h6v16H4zM14 4h6v16h-6z" /> },
  { k: 'reader', lbl: 'Reader', d: <path d="M6 2h9l5 5v15H6zM15 2v5h5M9 13h7M9 17h7" /> },
  { k: 'breakdown', lbl: 'Breakdown', d: <path d="M12 2l9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5" /> },
  { k: 'schedule', lbl: 'Schedule', d: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></> },
  { k: 'doctor', lbl: 'Doctor', d: <path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9z" /> },
  { k: 'studio', lbl: 'Studio', d: <path d="M5 3v4M3 5h4M13 3l3 7 7 3-7 3-3 7-3-7-7-3z" /> },
  { k: 'greenlight', lbl: 'Greenlight', d: <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM9 12l2 2 4-4" /> },
  { k: 'reports', lbl: 'Reports', d: <path d="M3 3v18h18M7 14l3-3 3 3 5-6" /> },
];
const TABS: { k: SxTab; d: React.ReactNode }[] = [
  { k: 'Coverage', d: <path d="M6 2h9l5 5v15H6z" /> },
  { k: 'Diagnostics', d: <path d="M3 12h4l2 6 4-14 2 8h6" /> },
  { k: 'Rewrite', d: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /> },
  { k: 'Compare', d: <path d="M16 3l5 5-5 5M21 8H9M8 21l-5-5 5-5M3 16h12" /> },
  { k: 'Develop', d: <path d="M12 2v6m0 8v6M2 12h6m8 0h6" /> },
];
const ACTIONS = [
  { k: 'diagnose', t: 'Diagnose scene', s: 'wants · obstacle', d: <path d="M3 12h4l2 6 4-14 2 8h6" /> },
  { k: 'rewrite', t: 'Rewrite slate', s: 'tighten', d: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /> },
  { k: 'budgetfit', t: 'Budget-fit', s: 'to target', d: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /> },
  { k: 'compare', t: 'Compare', s: 'vs prev', d: <path d="M16 3l5 5-5 5M21 8H9M8 21l-5-5 5-5M3 16h12" /> },
  { k: 'punchup', t: 'Punch-up', s: 'dialogue', d: <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM8 12h8" /> },
  { k: 'comps', t: 'Generate comps', s: 'market', d: <path d="M20 6H10M20 12H10M20 18H10M4 6h.01M4 12h.01M4 18h.01" /> },
];
const PI = { good: { c: 'var(--green)', s: '✓' }, warn: { c: 'var(--amber)', s: '!' }, bad: { c: 'var(--red)', s: '×' } };

export default function ScriptOnDoctor(props: {
  title: string; revisionLabel: string; revisionColor: string; meta: string;
  gauges: SxGauge[]; activeTab: SxTab; onTab: (t: SxTab) => void;
  coverage: SxCoverage; covLoading?: boolean; onGenerate: () => void;
  diagnostics: SxDiag[] | null; diagLoading?: boolean; onRunDiag: () => void;
  actHealth: { label: string; pct: number; tone: string; note: string }[];
  analyticsNode?: React.ReactNode;
  notesNode?: React.ReactNode;
  onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void; toast?: string | null;
}) {
  const { dir, t } = useLocale();
  const cov = props.coverage;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="tl">
            <div className="logo" onClick={props.onBack} title={t('Back to TFM')}>TFM</div>
            <div className="proj">{props.title}</div>
            <span className="pill" style={{ background: props.revisionColor + '28', color: props.revisionColor }}><span className="d" style={{ background: props.revisionColor }} />{props.revisionLabel.toUpperCase()}</span>
            <span className="meta">{props.meta}</span>
          </div>
          <div className="tr">
            <button className="btn ghost" onClick={() => props.onAction('history')}><svg className="ico" viewBox="0 0 24 24"><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>{t('History')}</button>
            <button className="btn ghost" onClick={() => props.onAction('package')}><svg className="ico" viewBox="0 0 24 24"><path d="M21 16V8l-9-5-9 5v8l9 5zM3 8l9 5 9-5M12 22V13" /></svg>{t('Package')}</button>
            <button className="btn ghost" onClick={() => props.onAction('format')}><svg className="ico" viewBox="0 0 24 24"><path d="M16 3l5 5-5 5M21 8H9M8 21l-5-5 5-5M3 16h12" /></svg>{t('Format')}</button>
            <button className="btn outline" onClick={() => props.onAction('exportpdf')}><svg className="ico" viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>{t('Export coverage PDF')}</button>
            <button className="btn gold" onClick={props.onRunDiag}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9z" /></svg>{t('Run full diagnostic')}</button>
          </div>
        </div>
        <div className="body">
          <SxRail active="doctor" />
          <div className="main"><div className="content">
            <div className="phead"><h1>{t('Script Doctor')}</h1><div className="sub">{t('Studio-grade coverage and story diagnostics — every note cites a scene, never invented.')}</div></div>
            <div className="kpis">
              {props.gauges.map((g, i) => (
                <div className="kpi" key={i}><div className="kl">{g.label}</div><div className="grade" style={{ color: g.color, fontSize: g.value.length > 3 ? 18 : 26, paddingTop: g.value.length > 3 ? 6 : 0 }}>{g.value}</div><div className="mtr"><i style={{ width: g.pct + '%', background: g.color }} /></div></div>
              ))}
            </div>
            <div className="tabs">
              {TABS.map((tb) => (<button key={tb.k} className={'tab' + (props.activeTab === tb.k ? ' on' : '')} onClick={() => props.onTab(tb.k)}><svg className="ico" viewBox="0 0 24 24">{tb.d}</svg>{tb.k === 'Rewrite' ? t('Rewrite slate') : t(tb.k)}</button>))}
            </div>
            <div className="drgrid">
              <div className="report">
                {props.activeTab === 'Coverage' && (
                  props.covLoading ? <div className="empty">{t('Reading the script and writing coverage…')}</div>
                    : cov ? (<>
                      {cov.logline && <div className="rsec"><h3>{t('LOGLINE')}</h3><div className="logline">{cov.logline}</div></div>}
                      {cov.synopsis && <div className="rsec"><h3>{t('SYNOPSIS')}</h3><div className="synop">{cov.synopsis}</div></div>}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                        <div className="rsec"><h3>{t('STRENGTHS')}</h3><div className="pts">{cov.strengths.length ? cov.strengths.map((p, i) => <div className="pt" key={i}><span className="pi" style={{ color: PI[p.tone].c }}>{PI[p.tone].s}</span>{p.text}</div>) : <div className="synop">—</div>}</div></div>
                        <div className="rsec"><h3>{t('CONCERNS')}</h3><div className="pts">{cov.concerns.length ? cov.concerns.map((p, i) => <div className="pt" key={i}><span className="pi" style={{ color: PI[p.tone].c }}>{PI[p.tone].s}</span>{p.text}</div>) : <div className="synop">—</div>}</div></div>
                      </div>
                      {cov.comps.length > 0 && <div className="rsec"><h3>{t('COMPARABLES')}</h3><div className="chips">{cov.comps.map((c, i) => <span className="chip" key={i}>{c}</span>)}</div></div>}
                      {props.notesNode}
                    </>) : (
                      <div className="empty">{t('No coverage yet for this revision.')}<br />{t('Generate studio-format coverage — logline, synopsis, grades, comps and character breakdown — grounded in the parsed scenes.')}<br /><br /><button className="btn gold" style={{ margin: '0 auto' }} onClick={props.onGenerate}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M6 2h9l5 5v15H6z" /></svg>{t('Generate coverage')}</button></div>
                    )
                )}
                {props.activeTab === 'Diagnostics' && (
                  props.diagLoading ? <div className="empty">{t('Diagnosing every scene…')}</div>
                    : props.diagnostics && props.diagnostics.length ? (
                      <div className="diag">{props.diagnostics.map((d, i) => (
                        <div className="dcard" key={i}><div className="dh"><span className="dn">{d.sceneNumber ? d.sceneNumber + '. ' : ''}{d.slugline || t('Scene')}</span><span className={'badge ' + (d.verdict === 'CUT' ? 'red' : d.verdict === 'KEEP' ? 'green' : 'amber')}>{d.verdict || '—'}</span></div><div className="dx">{[d.objective && t('Wants') + ': ' + d.objective, d.obstacle && t('Obstacle') + ': ' + d.obstacle].filter(Boolean).join(' · ') || '—'}</div></div>
                      ))}</div>
                    ) : <div className="empty">{t('Run diagnostics to read every scene — who wants what, the obstacle, the subtext, and whether the power shifts.')}<br /><br /><button className="btn gold" style={{ margin: '0 auto' }} onClick={props.onRunDiag}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>{t('Run diagnostics')}</button></div>
                )}
                {props.activeTab === 'Rewrite' && <div className="empty">{t('The rewrite slate (genre transpose · emotion re-key · ending re-engineering · humour · scene-intensity) ships in engine phase P2 — each variant lands as a branched revision.')}</div>}
                {props.activeTab === 'Compare' && <div className="empty">{t('Open a side-by-side version compare.')}<br /><br /><button className="btn gold" style={{ margin: '0 auto' }} onClick={() => props.onAction('compare')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M16 3l5 5-5 5M21 8H9M8 21l-5-5 5-5M3 16h12" /></svg>{t('Compare revisions')}</button></div>}
                {props.activeTab === 'Develop' && <div className="empty">{t('Development & Adaptation studios (seed→script, book→script) ship in engine phase P6.')}</div>}
              </div>
              <div className="col">
                {props.analyticsNode ? props.analyticsNode : (<div className="panelcard">
                  <div className="pc-h"><span className="t">{t('Act health')}</span><span className="eyebrow">{t('PACE MAP')}</span></div>
                  {props.actHealth.map((a, i) => (<div className="actbar" key={i}><span className="al">{a.label}</span><span className="meter2"><i style={{ width: a.pct + '%', background: a.tone }} /></span><span style={{ color: a.tone, fontWeight: 700 }}>{a.note}</span></div>))}
                </div>)}
                <div className="panelcard" style={{ flex: 1 }}>
                  <div className="pc-h"><span className="t">{t('Doctor actions')}</span><span className="eyebrow">{t('ON THIS SCRIPT')}</span></div>
                  <div className="qa">
                    {ACTIONS.map((a) => (<button className="tile" key={a.k} onClick={() => props.onAction(a.k)}><div className="ti"><svg className="ico" viewBox="0 0 24 24">{a.d}</svg></div><div className="tt">{t(a.t)}</div><div className="ts">{t(a.s)}</div></button>))}
                  </div>
                  <div className="lrow">{t('Single AiService gateway · every run logged to AiRun')}</div>
                  <button className="run" onClick={() => props.onAction('rewrite')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>{t('Open rewrite slate')}</button>
                </div>
              </div>
            </div>
          </div></div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
