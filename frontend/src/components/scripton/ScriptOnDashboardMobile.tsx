'use client';
/** Dashboard · MOBILE — carbon-copy of design/mobile-dashboard.html, wired to the same SxDash data. */
import React from 'react';
import type { SxDash } from './ScriptOnDashboard';
import { useLocale } from '@/lib/i18n';
const CSS = `
.dxm{--bg:#0b0c0f;--panel:#14161c;--hair:rgba(255,255,255,.08);--hair2:rgba(255,255,255,.14);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;background:var(--bg);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.dxm *{box-sizing:border-box;margin:0;padding:0}.dxm .ico{stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round;display:block;width:20px;height:20px}
.dxm .mtop{height:54px;flex:none;display:flex;align-items:center;gap:11px;padding:0 14px;border-bottom:1px solid var(--hair);background:linear-gradient(180deg,#15181e,#121419)}
.dxm .dr{width:34px;height:34px;border-radius:10px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:#1a1509;font-weight:800;font-size:11px;flex:none}
.dxm .ti{flex:1}.dxm .t1{font-size:14px;font-weight:700;color:var(--cream)}.dxm .t2{font-size:11px;color:var(--faint)}
.dxm .pill{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700}.dxm .pill .d{width:6px;height:6px;border-radius:50%}
.dxm .scroll{flex:1;overflow:auto;padding:16px 14px;display:flex;flex-direction:column;gap:13px}
.dxm .loopv{display:flex;flex-direction:column;gap:8px;background:linear-gradient(180deg,#16191f,#131519);border:1px solid var(--hair);border-radius:14px;padding:14px}
.dxm .lstep{display:flex;align-items:center;gap:11px}.dxm .lstep .ls{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:rgba(198,164,99,.14);color:var(--gold2);flex:none}.dxm .lstep.done .ls{background:rgba(87,179,104,.16);color:var(--green)}.dxm .lstep .lt{flex:1;font-size:12.5px;font-weight:600;color:var(--cream)}.dxm .lstep .lm{font-size:11px;color:var(--faint)}
.dxm .kpis2{display:grid;grid-template-columns:1fr 1fr;gap:11px}.dxm .kpi{background:linear-gradient(180deg,#16191f,#131519);border:1px solid var(--hair);border-radius:13px;padding:14px}.dxm .kpi .kl{font-size:10.5px;color:var(--faint);font-weight:600}.dxm .kpi .kv{font-size:22px;font-weight:800;color:var(--cream);margin-top:5px}.dxm .kpi .kc{font-size:10.5px;margin-top:4px;font-weight:600}
.dxm .card{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:9px}
.dxm .pc-h{display:flex;align-items:center;justify-content:space-between}.dxm .pc-h .t{font-size:13px;font-weight:700;color:var(--cream)}.dxm .eyebrow{font-size:10px;font-weight:700;letter-spacing:1.2px;color:var(--gold)}
.dxm .lrow{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--hair);font-size:12px}.dxm .lrow:first-of-type{border-top:none}.dxm .lrow .dot{width:8px;height:8px;border-radius:50%;flex:none}.dxm .lrow .lt{flex:1;color:var(--text)}
.dxm .badge{font-size:10px;font-weight:800;padding:3px 8px;border-radius:999px}.dxm .badge.red{background:rgba(229,99,95,.16);color:#e5635f}.dxm .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}.dxm .badge.blue{background:rgba(91,141,239,.16);color:#a9c4f7}
.dxm .dim{color:var(--mute)}
.dxm .tabbar{height:74px;flex:none;display:flex;align-items:flex-start;padding:9px 8px 0;background:#0e1015;border-top:1px solid var(--hair)}
.dxm .tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--faint);font-size:9.5px;font-weight:600;background:none;border:none;cursor:pointer}.dxm .tab .ico{width:22px;height:22px}.dxm .tab.on{color:var(--gold2)}.dxm .tab .b{width:46px;height:30px;border-radius:11px;display:grid;place-items:center}.dxm .tab.on .b{background:rgba(198,164,99,.15)}
`;
const TABS = [{ k: 'home', l: 'Home', d: <path d="M3 11l9-8 9 8M5 10v10h14V10" /> }, { k: 'library', l: 'Library', d: <path d="M4 4h6v16H4zM14 4h6v16h-6z" /> }, { k: 'reader', l: 'Reader', d: <path d="M6 2h9l5 5v15H6z" /> }, { k: 'breakdown', l: 'Breakdown', d: <path d="M12 2l9 5-9 5-9-5z" /> }, { k: 'doctor', l: 'Doctor', d: <path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9z" /> }];
export default function ScriptOnDashboardMobile({ data, onNav, onBack }: { data: SxDash; onNav: (k: string) => void; onBack: () => void; onQuick?: (k: string) => void; }) {
  const { dir, t } = useLocale();
  return (<div className="dxm" dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="mtop"><div className="dr" onClick={onBack}>TFM</div><div className="ti"><div className="t1">{data.title}</div><div className="t2">{t('Command centre')}</div></div><span className="pill" style={{ background: data.revisionColor + '28', color: data.revisionColor }}><span className="d" style={{ background: data.revisionColor }} />{data.revisionLabel.toUpperCase()}</span></div>
    <div className="scroll">
      <div className="loopv">{data.loop.slice(0, 5).map((s, i) => <div className={'lstep' + (s.done ? ' done' : '')} key={i}><span className="ls"><svg className="ico" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>{s.done ? <path d="M20 6L9 17l-5-5" /> : <path d="M12 2l9 5-9 5-9-5z" />}</svg></span><span className="lt">{s.label}</span><span className="lm">{s.caption}</span></div>)}</div>
      <div className="kpis2">{data.kpis.slice(0, 4).map((k, i) => <div className="kpi" key={i}><div className="kl">{k.label}</div><div className="kv">{k.value}</div><div className="kc" style={{ color: k.tone || 'var(--mute)' }}>{k.caption || ''}</div></div>)}</div>
      <div className="card"><div className="pc-h"><span className="t">{t('Needs attention')}</span><span className="eyebrow">{t('DOCTOR')}</span></div>
        {data.needs.map((n, i) => <div className="lrow" key={i}><span className="dot" style={{ background: n.level === 'high' ? '#e5635f' : n.level === 'med' ? 'var(--amber)' : 'var(--faint)' }} /><span className="lt">{n.text}</span><span className={'badge ' + (n.level === 'high' ? 'red' : n.level === 'med' ? 'amber' : 'blue')}>{n.badge}</span></div>)}
        {!data.needs.length && <div className="lrow"><span className="dot" style={{ background: 'var(--green)' }} /><span className="lt dim">{t('All clear.')}</span></div>}</div>
    </div>
    <div className="tabbar">{TABS.map((tab) => <button key={tab.k} className={'tab' + (tab.k === 'home' ? ' on' : '')} onClick={() => tab.k !== 'home' && onNav(tab.k)}><div className="b"><svg className="ico" viewBox="0 0 24 24">{tab.d}</svg></div>{t(tab.l)}</button>)}</div>
  </div>);
}
