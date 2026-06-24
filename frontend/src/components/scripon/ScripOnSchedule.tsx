'use client';
/** ScripON Doctor — Schedule & Budget (carbon-copy of design/schedule.html). Stripboard ⇄ budget loop.
 *  Self-contained, namespaced `.sx`. Board ⇄ scheduling.board, budget ⇄ breakdown.budgetPreview. */
import React from 'react';
import { SxRail } from './ScripOnStudio';
import { useLocale } from '@/lib/i18n';

export type SxStrip = { num: string; slug: string; pp: string; cast: string; bg: string; fg: string };
export type SxDay = { label: string; sub: string; pp: string; ppTone: string; strips: SxStrip[] };
export type SxBudRow = { name: string; val: string; pct: number; tone: string };
export type SxKpi = { label: string; value: string; caption?: string; tone?: string };

const CSS = `
.sx{--bg:#0b0c0f;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--red:#e5635f;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
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
.sx .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.sx .kpi{background:linear-gradient(180deg,#16191f,#131519);border:1px solid var(--hair);border-radius:13px;padding:15px}
.sx .kpi .kl{font-size:11px;color:var(--faint);font-weight:600;letter-spacing:.3px}
.sx .kpi .kv{font-size:23px;font-weight:800;color:var(--cream);margin-top:7px;letter-spacing:-.5px}
.sx .kpi .kc{font-size:11px;margin-top:5px;font-weight:600}
.sx .bgrid{display:grid;grid-template-columns:1.85fr 1fr;gap:16px;flex:1;min-height:0}
.sx .board{flex:1;display:flex;gap:12px;min-height:0;overflow:auto}
.sx .day{flex:1;min-width:228px;background:var(--panel);border:1px solid var(--hair);border-radius:12px;display:flex;flex-direction:column}
.sx .dayh{padding:10px 12px;border-bottom:1px solid var(--hair);display:flex;align-items:center;justify-content:space-between}
.sx .dayh .dn{font-size:12.5px;font-weight:700;color:var(--cream)}
.sx .dayh .dm{font-size:10.5px;color:var(--faint)}
.sx .daybody{padding:9px;display:flex;flex-direction:column;gap:7px;overflow:auto}
.sx .strip{border-radius:7px;padding:8px 9px;display:grid;grid-template-columns:26px 1fr auto;grid-template-rows:auto auto;gap:1px 8px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.3)}
.sx .strip .snum{grid-row:1/3;align-self:center;font-weight:800;font-size:13px;opacity:.8}
.sx .strip .sslug{font-size:11.5px;font-weight:700;line-height:1.2}
.sx .strip .spp{font-size:10px;font-weight:700;text-align:right;opacity:.75}
.sx .strip .scast{font-size:9.5px;grid-column:2/4;opacity:.7;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx .badge{font-size:10px;font-weight:800;letter-spacing:.4px;padding:4px 9px;border-radius:999px}
.sx .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}.sx .badge.green{background:rgba(87,179,104,.16);color:var(--green)}.sx .badge.red{background:rgba(229,99,95,.16);color:var(--red)}
.sx .col{display:flex;flex-direction:column;gap:16px;min-height:0}
.sx .panelcard{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:11px}
.sx .pc-h{display:flex;align-items:center;justify-content:space-between}
.sx .pc-h .t{font-size:13.5px;font-weight:700;color:var(--cream)}
.sx .budrow{display:flex;flex-direction:column;gap:5px;padding:10px 0;border-top:1px solid var(--hair)}
.sx .budrow:first-of-type{border-top:none}
.sx .budrow .bt{display:flex;justify-content:space-between;font-size:12.5px}
.sx .budrow .bt .bk{color:var(--text);font-weight:600}
.sx .budrow .bt .bv{color:var(--mute);font-variant-numeric:tabular-nums}
.sx .bbar{height:6px;border-radius:4px;background:#23262e;overflow:hidden}
.sx .bbar i{display:block;height:100%;border-radius:4px}
.sx .lrow{display:flex;align-items:center;gap:11px}
.sx .lrow .dot{width:8px;height:8px;border-radius:50%;flex:none}
.sx .lrow .lt{flex:1;font-size:12.5px;color:var(--text)}
.sx .kv{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--hair);font-size:12.5px}
.sx .kv .k{color:var(--faint)}.sx .kv .v{color:var(--text);font-weight:600}
.sx .run{height:46px;border-radius:12px;background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;border:none;width:100%;margin-top:6px}
.sx .run .ico{width:16px;height:16px;stroke-width:2}
.sx .empty{flex:1;display:grid;place-items:center;font-size:12.5px;color:var(--faint);text-align:center;padding:30px}
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

export default function ScripOnSchedule(props: {
  title: string; revisionLabel?: string; revisionColor?: string; meta: string;
  kpis: SxKpi[]; days: SxDay[]; budget: SxBudRow[]; suggestion: { text: string; saves: string; cost: string } | null;
  onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void; toast?: string | null;
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
            <button className="btn ghost" onClick={() => props.onAction('recalc')}><svg className="ico" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8" /></svg>{t('Recalc from breakdown')}</button>
            <button className="btn outline" onClick={() => props.onAction('budgetfit')}><svg className="ico" viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>{t('Budget-fit')}</button>
            <button className="btn gold" onClick={() => props.onAction('optimise')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 2l9 5-9 5-9-5z" /></svg>{t('Optimise schedule')}</button>
          </div>
        </div>
        <div className="body">
          <SxRail active="schedule" />
          <div className="main"><div className="content">
            <div className="phead"><h1>{t('Schedule & Budget')}</h1><div className="sub">{t('One loop: each strip carries its cost, each cut updates the day count and the bottom line.')}</div></div>
            <div className="kpis">
              {props.kpis.map((k, i) => (<div className="kpi" key={i}><div className="kl">{t(k.label, k.label)}</div><div className="kv" style={{ color: k.tone || 'var(--cream)' }}>{k.value}</div><div className="kc" style={{ color: k.tone || 'var(--mute)' }}>{t(k.caption || '', k.caption || '')}</div></div>))}
            </div>
            <div className="bgrid">
              {props.days.length ? (
                <div className="board">
                  {props.days.map((d, i) => (
                    <div className="day" key={i}>
                      <div className="dayh"><div><div className="dn">{d.label}</div><div className="dm">{d.sub}</div></div><span className={'badge ' + d.ppTone}>{d.pp}</span></div>
                      <div className="daybody">
                        {d.strips.map((s, j) => (
                          <div className="strip" key={j} style={{ background: s.bg, color: s.fg }}><span className="snum">{s.num}</span><span className="sslug">{s.slug}</span><span className="spp">{s.pp}</span><span className="scast">{s.cast}</span></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="panelcard"><div className="empty">{t('No strips scheduled yet. Use “Optimise schedule” or sync the breakdown to build the stripboard.')}</div></div>}
              <div className="col">
                <div className="panelcard">
                  <div className="pc-h"><span className="t">{t('Budget by category')}</span><span className="eyebrow">{t('EFC')}</span></div>
                  {props.budget.map((b, i) => (<div className="budrow" key={i}><div className="bt"><span className="bk">{t(b.name, b.name)}</span><span className="bv">{b.val}</span></div><div className="bbar"><i style={{ width: b.pct + '%', background: b.tone }} /></div></div>))}
                  {!props.budget.length && <div className="sub">{t('No budget preview available yet.')}</div>}
                </div>
                <div className="panelcard" style={{ flex: 1 }}>
                  <div className="pc-h"><span className="t">{t('Budget-fit suggests')}</span><span className="eyebrow">{t('DOCTOR')}</span></div>
                  {props.suggestion ? (<>
                    <div className="lrow"><span className="dot" style={{ background: 'var(--gold)' }} /><span className="lt">{props.suggestion.text}</span></div>
                    <div className="kv"><span className="k">{t('Saves')}</span><span className="v" style={{ color: 'var(--green)' }}>{props.suggestion.saves}</span></div>
                    <div className="kv"><span className="k">{t('Cost')}</span><span className="v">{props.suggestion.cost}</span></div>
                  </>) : <div className="sub">{t('Run Budget-fit to get costed consolidation options.')}</div>}
                  <button className="run" onClick={() => props.onAction('budgetfit')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>{t('Open Budget-fit')}</button>
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
