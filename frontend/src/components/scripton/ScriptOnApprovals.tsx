'use client';
/** ScriptON Doctor — Approval Workflow (carbon-copy of design/approvals.html). Routing pipeline + sign-off chain.
 *  Self-contained, namespaced `.sx`. Pipeline is the designed workflow (not yet backed); chain binds to the active revision. */
import React from 'react';
import { SxRail } from './ScriptOnStudio';
import { useLocale } from '@/lib/i18n';

export type SxKCard = { title: string; sub: string; av: string; avColor: string; when: string; selected?: boolean };
export type SxKCol = { label: string; color: string; count: number; cards: SxKCard[] };
export type SxStep = { name: string; role: string; state: 'done' | 'current' | 'pending' };

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
.sx .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700}.sx .pill .d{width:7px;height:7px;border-radius:50%}
.sx .meta{color:var(--faint);font-size:12px;font-weight:500}
.sx .tr{display:flex;align-items:center;gap:8px}
.sx .btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;color:var(--text);white-space:nowrap;background:transparent}
.sx .btn .ico{width:15px;height:15px}
.sx .btn.ghost{background:#1b1e25;border-color:var(--hair);color:var(--mute)}
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
.sx .apgrid{flex:1;display:grid;grid-template-columns:1fr 320px;gap:16px;min-height:0}
.sx .kanban{display:flex;gap:11px;min-height:0;overflow:auto}
.sx .kcol{flex:1;min-width:188px;background:var(--panel);border:1px solid var(--hair);border-radius:13px;display:flex;flex-direction:column}
.sx .kch{padding:11px 13px;border-bottom:1px solid var(--hair);display:flex;align-items:center;justify-content:space-between;font-size:11.5px;font-weight:700;color:var(--cream)}
.sx .kch .ct{display:flex;align-items:center;gap:7px}.sx .kch .cd{width:8px;height:8px;border-radius:50%}
.sx .kcount{font-size:10px;color:var(--faint);background:#1b1e25;padding:2px 7px;border-radius:6px}
.sx .kcb{padding:9px;display:flex;flex-direction:column;gap:8px;overflow:auto}
.sx .kcard{background:linear-gradient(180deg,#1b1e25,#171a20);border:1px solid var(--hair);border-radius:10px;padding:11px;cursor:pointer;text-align:start}
.sx .kcard:hover{border-color:var(--hair2)}.sx .kcard.on{border-color:rgba(198,164,99,.5);background:#181a16}
.sx .kct{font-size:12.5px;font-weight:700;color:var(--cream)}
.sx .kcm{font-size:10.5px;color:var(--faint);margin-top:3px}
.sx .kcf{display:flex;align-items:center;gap:8px;margin-top:9px}
.sx .av{border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;width:22px;height:22px;font-size:9px}
.sx .kcd{font-size:10px;color:var(--faint);margin-inline-start:auto}
.sx .chain{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:11px}
.sx .pc-h{display:flex;align-items:center;justify-content:space-between}.sx .pc-h .t{font-size:13.5px;font-weight:700;color:var(--cream)}
.sx .crow{display:flex;align-items:center;gap:11px;padding:10px 0;border-top:1px solid var(--hair)}.sx .crow:first-of-type{border-top:none}
.sx .cst{width:24px;height:24px;border-radius:50%;flex:none;display:grid;place-items:center}.sx .cst .ico{width:14px;height:14px}
.sx .cn{flex:1}.sx .cnn{font-size:12.5px;font-weight:600;color:var(--cream)}.sx .cnr{font-size:10.5px;color:var(--faint)}
.sx .gate{background:rgba(198,164,99,.07);border:1px solid rgba(198,164,99,.25);border-radius:11px;padding:12px;margin-top:4px}
.sx .kv{display:flex;align-items:center;justify-content:space-between;padding:5px 0;font-size:12.5px}.sx .kv .k{color:var(--faint)}.sx .kv .v{color:var(--text);font-weight:600}
.sx .badge{font-size:10px;font-weight:800;padding:4px 9px;border-radius:999px}.sx .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}
.sx .lockbtn{width:100%;justify-content:center;opacity:.55;cursor:not-allowed;display:inline-flex;align-items:center;gap:7px;height:36px;border-radius:10px;background:#1b1e25;border:1px solid var(--hair);color:var(--mute);font-size:13px;font-weight:600}
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
const STST: Record<string, { bg: string; c: string; ico: React.ReactNode }> = {
  done: { bg: 'rgba(87,179,104,.18)', c: 'var(--green)', ico: <path d="M20 6L9 17l-5-5" /> },
  current: { bg: 'rgba(91,141,239,.18)', c: 'var(--blue)', ico: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
  pending: { bg: '#1b1e25', c: 'var(--faint)', ico: <circle cx="12" cy="12" r="9" /> },
};

export default function ScriptOnApprovals(props: {
  title: string; meta: string; columns: SxKCol[]; chainRev: string; chainColor: string; steps: SxStep[]; lockLabel: string;
  onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void; toast?: string | null;
}) {
  const { dir, t } = useLocale();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="tl"><div className="logo" onClick={props.onBack} title={t('Back to TFM')}>TFM</div><div className="proj">{props.title}</div><span className="meta">{props.meta}</span></div>
          <div className="tr"><button className="btn ghost" onClick={() => props.onAction('activity')}><svg className="ico" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8" /></svg>{t('Activity')}</button><button className="btn gold" onClick={() => props.onAction('new')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 5v14M5 12h14" /></svg>{t('New routing')}</button></div>
        </div>
        <div className="body">
          <SxRail active="approvals" />
          <div className="main"><div className="content">
            <div className="phead"><h1>{t('Approvals & Sign-off')}</h1><div className="sub">{t('Move a draft from review to lock through an ordered chain — with a compliance gate before anything is final.')}</div></div>
            <div className="apgrid">
              <div className="kanban">
                {props.columns.map((col, i) => (
                  <div className="kcol" key={i}>
                    <div className="kch"><span className="ct"><span className="cd" style={{ background: col.color }} />{t(col.label)}</span><span className="kcount">{col.count}</span></div>
                    <div className="kcb">{col.cards.map((c, j) => (<button className={'kcard' + (c.selected ? ' on' : '')} key={j} onClick={() => props.onAction('card')}><div className="kct">{c.title}</div><div className="kcm">{c.sub}</div><div className="kcf"><span className="av" style={{ background: c.avColor }}>{c.av}</span><span className="kcd">{c.when}</span></div></button>))}</div>
                  </div>
                ))}
              </div>
              <div className="chain">
                <div className="pc-h"><span className="t">{t('Approval chain')}</span><span className="pill" style={{ background: props.chainColor + '28', color: props.chainColor }}><span className="d" style={{ background: props.chainColor }} />{props.chainRev.toUpperCase()}</span></div>
                <div className="sub" style={{ fontSize: 11.5, marginTop: -3 }}>{props.chainRev} — {t('full script')}</div>
                {props.steps.map((s, i) => (
                  <React.Fragment key={i}>
                    {i === 3 && (<div className="gate"><div className="eyebrow" style={{ marginBottom: 8 }}>{t('COMPLIANCE GATE')}</div><div className="kv"><span className="k">{t('Rating estimate')}</span><span className="v" style={{ color: 'var(--gold2)' }}>PG-15 (GCAM)</span></div><div className="kv" style={{ borderTop: '1px solid var(--hair)' }}><span className="k">{t('Culture screen')}</span><span className="badge amber">{t('1 FLAG')}</span></div><div className="kv" style={{ borderTop: '1px solid var(--hair)', cursor: 'pointer' }} onClick={() => props.onAction('compliance')}><span className="k" style={{ color: 'var(--gold2)' }}>{t('Run rating & culture screen')} {dir === 'rtl' ? '←' : '→'}</span></div></div>)}
                    <div className="crow"><span className="cst" style={{ background: STST[s.state].bg, color: STST[s.state].c }}><svg className="ico" viewBox="0 0 24 24">{STST[s.state].ico}</svg></span><div className="cn"><div className="cnn">{s.name}</div><div className="cnr">{s.role}</div></div></div>
                  </React.Fragment>
                ))}
                <div style={{ display: 'flex', gap: 8 }}><button className="lockbtn" style={{ flex: '0 0 auto', width: 'auto', padding: '0 16px', opacity: 1, cursor: 'pointer', color: 'var(--red)', borderColor: 'rgba(229,99,95,.4)' }} onClick={() => props.onAction('reject')}>{t('Reject')}</button><button className="lockbtn" style={{ flex: 1, opacity: 1, cursor: 'pointer' }} onClick={() => props.onAction('lock')}><svg className="ico" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>{props.lockLabel}</button></div>
              </div>
            </div>
          </div></div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
