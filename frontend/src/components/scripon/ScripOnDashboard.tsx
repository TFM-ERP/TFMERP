'use client';
/**
 * ScripON Doctor — Dashboard / command centre (carbon-copy of design/dashboard.html).
 * Self-contained, namespaced under `.sx`. Live data passed in by /scripon page; sample fallback.
 */
import React from 'react';
import { SxRail } from './ScripOnStudio';
import { useLocale } from '@/lib/i18n';

export type SxKpi = { label: string; value: string; caption?: string; tone?: string };
export type SxStep = { label: string; caption: string; pct: number; done?: boolean; tone?: string };
export type SxNeed = { text: string; badge: string; level: 'high' | 'med' | 'info' };
export type SxActivity = { text: string; when: string; color: string };
export type SxDash = {
  title: string; meta: string; revisionLabel: string; revisionColor: string;
  kpis: SxKpi[]; loop: SxStep[]; needs: SxNeed[]; activity: SxActivity[];
  status: { coverage?: string; coverageTone?: string; revisions?: string; notes?: string };
};

const CSS = `
.sx{--bg:#0b0c0f;--chrome:#121419;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--red:#e5635f;--violet:#8b7cf0;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
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
.sx .content{flex:1;overflow:auto;padding:26px 30px;display:flex;flex-direction:column;gap:20px}
.sx .phead{display:flex;align-items:flex-end;justify-content:space-between}
.sx .phead h1{font-size:24px;font-weight:800;color:var(--cream);letter-spacing:-.5px}
.sx .sub{font-size:13px;color:var(--mute);margin-top:4px}
.sx .eyebrow{font-size:11px;font-weight:700;letter-spacing:1.4px;color:var(--gold)}
.sx .loop{display:flex;align-items:stretch;background:linear-gradient(180deg,#15181e,#121419);border:1px solid var(--hair);border-radius:14px;padding:6px;overflow:hidden}
.sx .step{flex:1;display:flex;flex-direction:column;gap:7px;padding:14px 16px;position:relative}
.sx .step+.step{border-left:1px solid var(--hair)}
.sx .step .sl{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--cream)}
.sx .step .si{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;background:rgba(198,164,99,.14);color:var(--gold2)}
.sx .step .si .ico{width:14px;height:14px}
.sx .step .pc{font-size:11px;color:var(--faint);font-weight:600}
.sx .step .mtr{height:5px;border-radius:4px;background:#23262e;overflow:hidden}
.sx .step .mtr i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,var(--gold),var(--gold2))}
.sx .step.done .si{background:rgba(87,179,104,.16);color:var(--green)}
.sx .step.done .mtr i{background:var(--green)}
.sx .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
.sx .kpi{background:linear-gradient(180deg,#16191f,#131519);border:1px solid var(--hair);border-radius:13px;padding:15px}
.sx .kpi .kl{font-size:11px;color:var(--faint);font-weight:600;letter-spacing:.3px}
.sx .kpi .kv{font-size:23px;font-weight:800;color:var(--cream);margin-top:7px;letter-spacing:-.5px}
.sx .kpi .kc{font-size:11px;margin-top:5px;font-weight:600}
.sx .twocol{flex:1;display:grid;grid-template-columns:1.9fr 1fr;gap:16px;min-height:0}
.sx .col{display:flex;flex-direction:column;gap:16px;min-height:0}
.sx .panelcard{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:11px}
.sx .pc-h{display:flex;align-items:center;justify-content:space-between}
.sx .pc-h .t{font-size:13.5px;font-weight:700;color:var(--cream)}
.sx .lrow{display:flex;align-items:center;gap:11px;padding:9px 0;border-top:1px solid var(--hair)}
.sx .lrow:first-of-type{border-top:none}
.sx .lrow .dot{width:8px;height:8px;border-radius:50%;flex:none}
.sx .lrow .lt{flex:1;font-size:12.5px;color:var(--text)}
.sx .lrow .lm{font-size:11px;color:var(--faint)}
.sx .qa{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.sx .tile{background:linear-gradient(180deg,#1b1e25,#171a20);border:1px solid var(--hair);border-radius:12px;padding:13px;cursor:pointer;text-align:left}
.sx .tile:hover{border-color:rgba(198,164,99,.4)}
.sx .tile .ti{width:30px;height:30px;border-radius:9px;background:rgba(198,164,99,.14);display:grid;place-items:center;color:var(--gold2);margin-bottom:9px}
.sx .tile .ti .ico{width:16px;height:16px}
.sx .tile .tt{font-size:13px;font-weight:600;color:var(--cream)}
.sx .tile .ts{font-size:10.5px;color:var(--faint);margin-top:2px}
.sx .badge{font-size:10px;font-weight:800;letter-spacing:.4px;padding:4px 9px;border-radius:999px}
.sx .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}
.sx .badge.green{background:rgba(87,179,104,.16);color:var(--green)}
.sx .badge.red{background:rgba(229,99,95,.16);color:var(--red)}
.sx .badge.blue{background:rgba(91,141,239,.16);color:#a9c4f7}
.sx .dim{color:var(--mute)}
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

export default function ScripOnDashboard(props: { data: SxDash; onNav: (k: string) => void; onBack: () => void; onQuick: (k: string) => void; toast?: string | null }) {
  const { data } = props;
  const { dir, t } = useLocale();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="tl">
            <div className="logo" onClick={props.onBack} title={t('Back to TFM')}>TFM</div>
            <div className="proj">{data.title}</div>
            <span className="pill" style={{ background: data.revisionColor + '28', color: data.revisionColor }}><span className="d" style={{ background: data.revisionColor }} />{data.revisionLabel.toUpperCase()}</span>
            <span className="meta">{data.meta}</span>
          </div>
          <div className="tr">
            <button className="btn outline" onClick={() => props.onNav('reader')}><svg className="ico" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" /></svg>{t('Open Reader')}</button>
            <button className="btn gold" onClick={() => props.onQuick('coverage')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M6 2h9l5 5v15H6z" /></svg>{t('Generate coverage')}</button>
          </div>
        </div>
        <div className="body">
          <SxRail active="home" />
          <div className="main"><div className="content">
            <div className="phead"><div><h1>{t('Production Command Centre')}</h1><div className="sub">{data.title} · {t('the whole production, script to wrap, in one view.')}</div></div></div>
            <div className="loop">
              {data.loop.map((s, i) => (
                <div className={'step' + (s.done ? ' done' : '')} key={i}>
                  <div className="sl"><span className="si"><svg className="ico" viewBox="0 0 24 24">{s.done ? <path d="M20 6L9 17l-5-5" /> : <path d="M12 2l9 5-9 5-9-5z" />}</svg></span>{s.label}</div>
                  <div className="pc">{s.caption}</div>
                  <div className="mtr"><i style={{ width: s.pct + '%', ...(s.tone ? { background: s.tone } : {}) }} /></div>
                </div>
              ))}
            </div>
            <div className="kpis">
              {data.kpis.map((k, i) => (
                <div className="kpi" key={i}><div className="kl">{k.label}</div><div className="kv" style={k.value.length > 7 ? { fontSize: 18, paddingTop: 4 } : {}}>{k.value}</div><div className="kc" style={{ color: k.tone || 'var(--mute)' }}>{k.caption || ''}</div></div>
              ))}
            </div>
            <div className="twocol">
              <div className="col">
                <div className="panelcard" style={{ flex: 1 }}>
                  <div className="pc-h"><span className="t">{t('Needs attention')}</span><span className="eyebrow">{t('DOCTOR FLAGS')}</span></div>
                  {data.needs.map((n, i) => (
                    <div className="lrow" key={i}><span className="dot" style={{ background: n.level === 'high' ? 'var(--red)' : n.level === 'med' ? 'var(--amber)' : 'var(--faint)' }} /><span className="lt">{n.text}</span><span className={'badge ' + (n.level === 'high' ? 'red' : n.level === 'med' ? 'amber' : 'blue')}>{n.badge}</span></div>
                  ))}
                  {!data.needs.length && <div className="lrow"><span className="dot" style={{ background: 'var(--green)' }} /><span className="lt dim">{t('All clear — no open flags.')}</span></div>}
                </div>
                <div className="panelcard">
                  <div className="pc-h"><span className="t">{t('Recent activity')}</span></div>
                  {data.activity.map((a, i) => (<div className="lrow" key={i}><span className="dot" style={{ background: a.color }} /><span className="lt">{a.text}</span><span className="lm">{a.when}</span></div>))}
                  {!data.activity.length && <div className="lrow"><span className="lt dim">{t('No recent activity.')}</span></div>}
                </div>
              </div>
              <div className="col">
                <div className="panelcard">
                  <div className="pc-h"><span className="t" style={{ cursor: 'pointer' }} onClick={() => props.onNav('approvals')}>{t('Script status')} {dir === 'rtl' ? '←' : '→'}</span><span className="pill" style={{ background: data.revisionColor + '28', color: data.revisionColor }}><span className="d" style={{ background: data.revisionColor }} />{data.revisionLabel.toUpperCase()}</span></div>
                  <div className="lrow"><span className="lt dim">{t('Last coverage')}</span><span className={'badge ' + (data.status.coverageTone || 'amber')} style={{ marginInlineStart: 'auto' }}>{data.status.coverage || '—'}</span></div>
                  <div className="lrow"><span className="lt dim">{t('Revisions')}</span><span className="lm" style={{ marginInlineStart: 'auto' }}>{data.status.revisions || '—'}</span></div>
                  <div className="lrow"><span className="lt dim">{t('Open notes')}</span><span className="lm" style={{ marginInlineStart: 'auto' }}>{data.status.notes || '—'}</span></div>
                </div>
                <div className="panelcard" style={{ flex: 1 }}>
                  <div className="pc-h"><span className="t">{t('Quick actions')}</span></div>
                  <div className="qa">
                    <button className="tile" onClick={() => props.onQuick('coverage')}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" /></svg></div><div className="tt">{t('Coverage')}</div><div className="ts">{t('house format')}</div></button>
                    <button className="tile" onClick={() => props.onQuick('diagnose')}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><path d="M3 12h4l2 6 4-14 2 8h6" /></svg></div><div className="tt">{t('Diagnose')}</div><div className="ts">{t('whole script')}</div></button>
                    <button className="tile" onClick={() => props.onQuick('budgetfit')}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg></div><div className="tt">{t('Budget-fit')}</div><div className="ts">{t('to target')}</div></button>
                    <button className="tile" onClick={() => props.onQuick('compare')}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><path d="M16 3l5 5-5 5M21 8H9M8 21l-5-5 5-5M3 16h12" /></svg></div><div className="tt">{t('Compare')}</div><div className="ts">{t('versions')}</div></button>
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
