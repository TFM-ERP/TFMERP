'use client';
/** Dashboard · TABLET — carbon-copy of design/tablet-dashboard.html, wired to the same SxDash data. */
import React from 'react';
import type { SxDash } from './ScripOnDashboard';
import { useLocale } from '@/lib/i18n';
const CSS = `
.dxt{--bg:#0b0c0f;--panel:#14161c;--hair:rgba(255,255,255,.08);--hair2:rgba(255,255,255,.14);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;background:radial-gradient(1000px 500px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.dxt *{box-sizing:border-box;margin:0;padding:0}.dxt .ico{stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round;display:block;width:15px;height:15px}
.dxt .top{height:62px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair)}
.dxt .tl{display:flex;align-items:center;gap:11px}.dxt .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;cursor:pointer}.dxt .proj{font-weight:700;font-size:15px;color:var(--cream)}
.dxt .pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700}.dxt .pill .d{width:7px;height:7px;border-radius:50%}
.dxt .seg{display:flex;gap:4px;background:#10131a;border:1px solid var(--hair);border-radius:11px;padding:4px}.dxt .segtab{display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:8px;font-size:12.5px;font-weight:600;color:var(--mute);cursor:pointer;border:none;background:transparent}.dxt .segtab.on{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink)}
.dxt .btn{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink)}.dxt .btn .ico{stroke:#1a1509}
.dxt .content{flex:1;overflow:auto;padding:20px;display:flex;flex-direction:column;gap:15px}
.dxt .h1{font-size:21px;font-weight:800;color:var(--cream)}.dxt .sub{font-size:12.5px;color:var(--mute);margin-top:3px}
.dxt .loop{display:flex;background:linear-gradient(180deg,#16191f,#131519);border:1px solid var(--hair);border-radius:13px;padding:5px}
.dxt .step{flex:1;display:flex;flex-direction:column;gap:6px;padding:11px 13px}.dxt .step+.step{border-left:1px solid var(--hair)}
.dxt .step .sl{font-size:12px;font-weight:600;color:var(--cream)}.dxt .step .pc{font-size:10.5px;color:var(--faint)}
.dxt .step .m{height:5px;border-radius:4px;background:#23262e;overflow:hidden}.dxt .step .m i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2))}.dxt .step.done .m i{background:var(--green)}
.dxt .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}
.dxt .kpi{background:linear-gradient(180deg,#16191f,#131519);border:1px solid var(--hair);border-radius:12px;padding:13px}.dxt .kpi .kl{font-size:10.5px;color:var(--faint);font-weight:600}.dxt .kpi .kv{font-size:21px;font-weight:800;color:var(--cream);margin-top:5px}.dxt .kpi .kc{font-size:10.5px;margin-top:4px;font-weight:600}
.dxt .twocol{flex:1;display:grid;grid-template-columns:1.7fr 1fr;gap:13px;min-height:0}
.dxt .col{display:flex;flex-direction:column;gap:13px;min-height:0}
.dxt .card{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:9px}
.dxt .pc-h{display:flex;align-items:center;justify-content:space-between}.dxt .pc-h .t{font-size:13px;font-weight:700;color:var(--cream)}.dxt .eyebrow{font-size:10.5px;font-weight:700;letter-spacing:1.3px;color:var(--gold)}
.dxt .lrow{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--hair);font-size:12px}.dxt .lrow:first-of-type{border-top:none}.dxt .lrow .dot{width:8px;height:8px;border-radius:50%;flex:none}.dxt .lrow .lt{flex:1;color:var(--text)}
.dxt .badge{font-size:10px;font-weight:800;padding:4px 9px;border-radius:999px}.dxt .badge.red{background:rgba(229,99,95,.16);color:#e5635f}.dxt .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}.dxt .badge.blue{background:rgba(91,141,239,.16);color:#a9c4f7}
.dxt .qa{display:grid;grid-template-columns:1fr 1fr;gap:9px}.dxt .tile{background:linear-gradient(180deg,#1b1e25,#171a20);border:1px solid var(--hair);border-radius:11px;padding:12px;cursor:pointer;text-align:left}.dxt .tile .ti{width:30px;height:30px;border-radius:9px;background:rgba(198,164,99,.14);display:grid;place-items:center;color:var(--gold2);margin-bottom:8px}.dxt .tile .ti .ico{width:16px;height:16px}.dxt .tile .tt{font-size:12.5px;font-weight:600;color:var(--cream)}
.dxt .dim{color:var(--mute)}
`;
const SEG = [{ k: 'home', l: 'Home', d: <path d="M3 11l9-8 9 8M5 10v10h14V10" /> }, { k: 'reader', l: 'Reader', d: <path d="M6 2h9l5 5v15H6z" /> }, { k: 'breakdown', l: 'Breakdown', d: <path d="M12 2l9 5-9 5-9-5z" /> }, { k: 'doctor', l: 'Doctor', d: <path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9z" /> }];
const QA = [{ k: 'coverage', t: 'Coverage' }, { k: 'diagnose', t: 'Diagnose' }, { k: 'budgetfit', t: 'Budget-fit' }, { k: 'compare', t: 'Compare' }];
export default function ScripOnDashboardTablet({ data, onNav, onBack, onQuick }: { data: SxDash; onNav: (k: string) => void; onBack: () => void; onQuick: (k: string) => void; }) {
  const { dir, t } = useLocale();
  return (<div className="dxt" dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="top"><div className="tl"><div className="logo" onClick={onBack}>TFM</div><div className="proj">{data.title}</div><span className="pill" style={{ background: data.revisionColor + '28', color: data.revisionColor }}><span className="d" style={{ background: data.revisionColor }} />{data.revisionLabel.toUpperCase()}</span></div>
      <div className="seg">{SEG.map((s) => <button key={s.k} className={'segtab' + (s.k === 'home' ? ' on' : '')} onClick={() => s.k !== 'home' && onNav(s.k)}><svg className="ico" viewBox="0 0 24 24">{s.d}</svg>{t(s.l)}</button>)}</div>
      <button className="btn" onClick={() => onQuick('coverage')}><svg className="ico" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" /></svg>{t('Coverage')}</button></div>
    <div className="content">
      <div><div className="h1">{t('Production Command Centre')}</div><div className="sub">{data.title} · {t('script to wrap, one view.')}</div></div>
      <div className="loop">{data.loop.map((s, i) => <div className={'step' + (s.done ? ' done' : '')} key={i}><div className="sl">{s.label}</div><div className="pc">{s.caption}</div><div className="m"><i style={{ width: s.pct + '%', ...(s.tone ? { background: s.tone } : {}) }} /></div></div>)}</div>
      <div className="kpis">{data.kpis.slice(0, 3).map((k, i) => <div className="kpi" key={i}><div className="kl">{k.label}</div><div className="kv">{k.value}</div><div className="kc" style={{ color: k.tone || 'var(--mute)' }}>{k.caption || ''}</div></div>)}</div>
      <div className="twocol">
        <div className="col"><div className="card" style={{ flex: 1 }}><div className="pc-h"><span className="t">{t('Needs attention')}</span><span className="eyebrow">{t('DOCTOR')}</span></div>
          {data.needs.map((n, i) => <div className="lrow" key={i}><span className="dot" style={{ background: n.level === 'high' ? '#e5635f' : n.level === 'med' ? 'var(--amber)' : 'var(--faint)' }} /><span className="lt">{n.text}</span><span className={'badge ' + (n.level === 'high' ? 'red' : n.level === 'med' ? 'amber' : 'blue')}>{n.badge}</span></div>)}
          {!data.needs.length && <div className="lrow"><span className="dot" style={{ background: 'var(--green)' }} /><span className="lt dim">{t('All clear.')}</span></div>}</div></div>
        <div className="col">
          <div className="card"><div className="pc-h"><span className="t">{t('Script status')}</span><span className="pill" style={{ background: data.revisionColor + '28', color: data.revisionColor }}><span className="d" style={{ background: data.revisionColor }} />{data.revisionLabel.toUpperCase()}</span></div>
            <div className="lrow"><span className="lt dim">{t('Coverage')}</span><span className={'badge ' + (data.status.coverageTone || 'amber')} style={{ marginInlineStart: 'auto' }}>{data.status.coverage || '—'}</span></div>
            <div className="lrow"><span className="lt dim">{t('Revisions')}</span><span className="dim" style={{ marginInlineStart: 'auto' }}>{data.status.revisions || '—'}</span></div></div>
          <div className="card" style={{ flex: 1 }}><div className="pc-h"><span className="t">{t('Quick actions')}</span></div>
            <div className="qa">{QA.map((q) => <button className="tile" key={q.k} onClick={() => onQuick(q.k)}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" /></svg></div><div className="tt">{t(q.t)}</div></button>)}</div></div>
        </div>
      </div>
    </div>
  </div>);
}
