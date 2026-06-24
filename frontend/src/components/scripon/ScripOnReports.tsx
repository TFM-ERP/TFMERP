'use client';
/** ScripON Doctor — Reports & Exports (carbon-copy of design/reports.html). Gallery ⇄ reports.catalog, preview ⇄ scripton.latestCoverage. */
import React from 'react';
import { SxRail } from './ScripOnStudio';
import { useLocale } from '@/lib/i18n';

export type SxReport = { key: string; title: string; badge: string; badgeClass: string; meta: string };
export type SxPreview = { title: string; badge: string; badgeTone: string; lines: { label?: string; text: string }[] };

const CSS = `
.sx{--bg:#0b0c0f;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--paper:#F7F4EC;--ink:#23231f;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--red:#e5635f;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
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
.sx .filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sx .chip{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:600;color:var(--mute);background:#171a20;border:1px solid var(--hair);cursor:pointer}
.sx .chip.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:var(--gold2)}
.sx .rgrid{display:grid;grid-template-columns:1.55fr 1fr;gap:16px;flex:1;min-height:0}
.sx .rlist{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-content:start;overflow:auto}
.sx .rcard{background:var(--panel);border:1px solid var(--hair);border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px;cursor:pointer;text-align:left}
.sx .rcard:hover{border-color:var(--hair2)}
.sx .rcard.on{border-color:rgba(198,164,99,.5);background:#181a16}
.sx .ricon{width:42px;height:42px;border-radius:10px;background:rgba(198,164,99,.13);display:grid;place-items:center;color:var(--gold2);flex:none}
.sx .rb{flex:1;min-width:0}.sx .rt{font-size:13.5px;font-weight:700;color:var(--cream)}.sx .rm{font-size:11px;color:var(--faint);margin-top:3px}
.sx .badge{font-size:10px;font-weight:800;letter-spacing:.4px;padding:4px 9px;border-radius:999px}
.sx .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}.sx .badge.green{background:rgba(87,179,104,.16);color:var(--green)}.sx .badge.blue{background:rgba(91,141,239,.16);color:#a9c4f7}.sx .badge.red{background:rgba(229,99,95,.16);color:var(--red)}
.sx .col{display:flex;flex-direction:column;gap:16px;min-height:0}
.sx .ppr{background:var(--paper);color:var(--ink);border-radius:8px;padding:18px 20px;font-family:'Courier Prime',ui-monospace,monospace;box-shadow:0 10px 30px -8px rgba(0,0,0,.6)}
.sx .ppr .ph{display:flex;justify-content:space-between;border-bottom:1.5px solid #cdc6b2;padding-bottom:8px;margin-bottom:10px}
.sx .ppr .pt2{font-weight:700;font-size:12px;letter-spacing:.5px}
.sx .ppr .pl{font-size:11px;line-height:1.7;margin-top:6px}.sx .ppr .pl b{background:#efe7cf}
.sx .panelcard{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:11px}
.sx .pc-h{display:flex;align-items:center;justify-content:space-between}.sx .pc-h .t{font-size:13.5px;font-weight:700;color:var(--cream)}
.sx .qa{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.sx .tile{background:linear-gradient(180deg,#1b1e25,#171a20);border:1px solid var(--hair);border-radius:12px;padding:13px;cursor:pointer;text-align:left}
.sx .tile:hover{border-color:rgba(198,164,99,.4)}
.sx .tile .ti{width:30px;height:30px;border-radius:9px;background:rgba(198,164,99,.14);display:grid;place-items:center;color:var(--gold2);margin-bottom:9px}
.sx .tile .ti .ico{width:16px;height:16px}
.sx .tile .tt{font-size:13px;font-weight:600;color:var(--cream)}.sx .tile .ts{font-size:10.5px;color:var(--faint);margin-top:2px}
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
const EXPORTS = [
  { k: 'pdf', t: 'PDF', s: 'studio layout', d: <path d="M6 2h9l5 5v15H6z" /> },
  { k: 'xlsx', t: 'Excel', s: 'data tables', d: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></> },
  { k: 'fdx', t: 'Final Draft', s: '.fdx', d: <path d="M4 17l6-6-6-6M12 19h8" /> },
  { k: 'share', t: 'Share link', s: 'view-only', d: <path d="M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14" /> },
];

export default function ScripOnReports(props: {
  title: string; revisionLabel?: string; revisionColor?: string; meta: string;
  filters: string[]; activeFilter: string; onFilter: (f: string) => void;
  reports: SxReport[]; activeKey?: string; onSelect: (k: string) => void;
  preview: SxPreview; onExport: (fmt: string) => void; onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void; toast?: string | null;
}) {
  const { dir, t } = useLocale();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="tl">
            <div className="logo" onClick={props.onBack} title={t('Back to TFM')}>TFM</div>
            <div className="proj">{props.title}</div>
            {props.revisionLabel && <span className="pill" style={{ background: (props.revisionColor || '#5b8def') + '28', color: props.revisionColor || '#5b8def' }}><span className="d" style={{ background: props.revisionColor || '#5b8def' }} />{props.revisionLabel.toUpperCase()}</span>}
            <span className="meta">{props.meta}</span>
          </div>
          <div className="tr">
            <button className="btn ghost" onClick={() => props.onAction('schedule')}><svg className="ico" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 9h18" /></svg>{t('Schedule a report')}</button>
            <button className="btn outline" onClick={() => props.onAction('new')}><svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>{t('New report')}</button>
            <button className="btn gold" onClick={() => props.onExport('all')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>{t('Export all')}</button>
          </div>
        </div>
        <div className="body">
          <SxRail active="reports" />
          <div className="main"><div className="content">
            <div className="phead"><h1>{t('Reports & Exports')}</h1><div className="sub">{t('Industry-standard documents, generated from live data — coverage, schedule, budget, DPR. Export to PDF, Excel, Final Draft.')}</div></div>
            <div className="filters">{props.filters.map((f) => (<button key={f} className={'chip' + (f === props.activeFilter ? ' on' : '')} onClick={() => props.onFilter(f)}>{f}</button>))}</div>
            <div className="rgrid">
              <div className="rlist">
                {props.reports.map((r) => (
                  <button key={r.key} className={'rcard' + (r.key === props.activeKey ? ' on' : '')} onClick={() => props.onSelect(r.key)}>
                    <div className="ricon"><svg className="ico" viewBox="0 0 24 24" style={{ width: 22, height: 22 }}><path d="M6 2h9l5 5v15H6zM15 2v5h5M9 13h6M9 17h4" /></svg></div>
                    <div className="rb"><div className="rt">{r.title}</div><div className="rm">{r.meta}</div></div>
                    <span className={'badge ' + r.badgeClass}>{r.badge}</span>
                  </button>
                ))}
              </div>
              <div className="col">
                <div className="ppr">
                  <div className="ph"><span className="pt2">{props.preview.title}</span><span className="pt2">{props.preview.badge}</span></div>
                  {props.preview.lines.map((l, i) => (<div className="pl" key={i}>{l.label && <b>{l.label} </b>}{l.text}</div>))}
                </div>
                <div className="panelcard" style={{ flex: 1 }}>
                  <div className="pc-h"><span className="t">{t('Export this report')}</span><span className="eyebrow">{t('VISIBLE ACTIONS')}</span></div>
                  <div className="qa">
                    {EXPORTS.map((e) => (<button className="tile" key={e.k} onClick={() => props.onExport(e.k)}><div className="ti"><svg className="ico" viewBox="0 0 24 24">{e.d}</svg></div><div className="tt">{t(e.t)}</div><div className="ts">{t(e.s)}</div></button>))}
                  </div>
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
