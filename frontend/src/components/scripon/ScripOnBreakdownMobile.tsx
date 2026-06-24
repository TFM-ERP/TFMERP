'use client';
/** Breakdown · MOBILE (on-set) — carbon-copy of design/mobile-breakdown.html, wired to the same props. */
import React from 'react';
import type { SxLens, SxEl, SxDetail } from './ScripOnBreakdown';
import { useLocale } from '@/lib/i18n';
const CSS = `
.bxm{--bg:#0b0c0f;--panel:#14161c;--hair:rgba(255,255,255,.08);--hair2:rgba(255,255,255,.14);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--violet:#8b7cf0;position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;background:var(--bg);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.bxm *{box-sizing:border-box;margin:0;padding:0}.bxm .ico{stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round;display:block;width:20px;height:20px}
.bxm .mtop{height:54px;flex:none;display:flex;align-items:center;gap:12px;padding:0 14px;border-bottom:1px solid var(--hair);background:linear-gradient(180deg,#15181e,#121419)}
.bxm .bk{width:34px;height:34px;border-radius:10px;background:#1b1e25;border:1px solid var(--hair);display:grid;place-items:center;color:var(--mute);flex:none}
.bxm .ti{flex:1;min-width:0}.bxm .t1{font-size:14px;font-weight:700;color:var(--cream)}.bxm .t2{font-size:11px;color:var(--faint);margin-top:1px}
.bxm .dr{width:36px;height:36px;border-radius:11px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);flex:none;border:none}
.bxm .lensrow{flex:none;display:flex;gap:7px;padding:11px 14px;overflow:auto;border-bottom:1px solid var(--hair)}
.bxm .lns{display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:10px;background:#171a20;border:1px solid var(--hair);font-size:12px;font-weight:600;color:var(--mute);white-space:nowrap;cursor:pointer}.bxm .lns .ld{width:8px;height:8px;border-radius:3px}.bxm .lns.on{background:#1c1f27;border-color:var(--hair2);color:var(--cream)}
.bxm .elist{flex:1;overflow:auto}
.bxm .erow{display:flex;align-items:center;gap:11px;padding:14px 16px;border-bottom:1px solid var(--hair);width:100%;text-align:left;background:transparent;border-left:none;border-right:none;border-top:none;cursor:pointer}.bxm .erow.on{background:rgba(198,164,99,.10)}
.bxm .edot{width:9px;height:9px;border-radius:50%;flex:none}.bxm .en{flex:1}.bxm .enm{font-size:14px;font-weight:600;color:var(--cream)}.bxm .erl{font-size:11px;color:var(--faint);margin-top:2px}
.bxm .badge{font-size:10px;font-weight:800;padding:3px 8px;border-radius:999px}.bxm .badge.green{background:rgba(87,179,104,.16);color:var(--green)}.bxm .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}.bxm .badge.blue{background:rgba(91,141,239,.16);color:#a9c4f7}
.bxm .sheet{flex:none;background:linear-gradient(180deg,#16181f,#121419);border-top:1px solid var(--hair2);border-radius:22px 22px 0 0;padding:10px 16px 14px;box-shadow:0 -16px 40px -20px rgba(0,0,0,.7);display:flex;flex-direction:column;gap:11px}
.bxm .grab{width:38px;height:4px;border-radius:3px;background:#3a3f49;margin:2px auto 4px}
.bxm .sh-h{display:flex;align-items:center;justify-content:space-between}.bxm .sh-h .t{font-size:13px;font-weight:700;color:var(--cream)}
.bxm .chips{display:flex;gap:8px;overflow:auto}.bxm .achip{flex:1;min-width:64px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;border-radius:12px;background:#1b1e25;border:1px solid var(--hair);font-size:10.5px;font-weight:600;color:var(--mute);cursor:pointer}.bxm .achip .ico{width:18px;height:18px;stroke:var(--gold2)}
.bxm .btn{display:flex;align-items:center;justify-content:center;gap:7px;height:46px;border-radius:13px;font-size:14px;font-weight:700;border:none;cursor:pointer;background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink)}.bxm .btn .ico{width:17px;height:17px;stroke:#1a1509}
.bxm .tabbar{height:74px;flex:none;display:flex;align-items:flex-start;padding:9px 8px 0;background:#0e1015;border-top:1px solid var(--hair)}
.bxm .tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--faint);font-size:9.5px;font-weight:600;background:none;border:none;cursor:pointer}.bxm .tab .ico{width:22px;height:22px}.bxm .tab.on{color:var(--gold2)}.bxm .tab .b{width:46px;height:30px;border-radius:11px;display:grid;place-items:center}.bxm .tab.on .b{background:rgba(198,164,99,.15)}
`;
const TABS = [{ k: 'home', l: 'Home', d: <path d="M3 11l9-8 9 8M5 10v10h14V10" /> }, { k: 'library', l: 'Library', d: <path d="M4 4h6v16H4zM14 4h6v16h-6z" /> }, { k: 'reader', l: 'Reader', d: <path d="M6 2h9l5 5v15H6z" /> }, { k: 'breakdown', l: 'Breakdown', d: <path d="M12 2l9 5-9 5-9-5z" /> }, { k: 'doctor', l: 'Doctor', d: <path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9z" /> }];
const CHIPS = [{ k: 'wardrobe', t: 'Wardrobe' }, { k: 'strips', t: 'Strips' }, { k: 'merge', t: 'Merge' }, { k: 'flag', t: 'Flag' }];
export default function ScripOnBreakdownMobile(props: { title: string; lenses: SxLens[]; activeLens: string; onLens: (k: string) => void; elements: SxEl[]; activeName?: string; onSelect: (n: string) => void; detail: SxDetail; onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void; }) {
  const { dir, t } = useLocale();
  const lc = props.lenses.find((l) => l.key === props.activeLens)?.color || 'var(--blue)';
  const lensLabel = props.lenses.find((l) => l.key === props.activeLens)?.label || '';
  return (<div className="bxm" dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="mtop"><button className="bk" onClick={props.onBack}><svg className="ico" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg></button><div className="ti"><div className="t1">{t('Breakdown')} · {t(lensLabel)}</div><div className="t2">{props.elements.length} {t('elements')}</div></div><button className="dr" onClick={() => props.onAction('confirm')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M20 6L9 17l-5-5" /></svg></button></div>
    <div className="lensrow">{props.lenses.map((l) => <button key={l.key} className={'lns' + (l.key === props.activeLens ? ' on' : '')} onClick={() => props.onLens(l.key)}><span className="ld" style={{ background: l.color }} />{t(l.label)}</button>)}</div>
    <div className="elist">{props.elements.map((e) => <button key={e.name} className={'erow' + (e.name === props.activeName ? ' on' : '')} onClick={() => props.onSelect(e.name)}><span className="edot" style={{ background: lc }} /><div className="en"><div className="enm">{e.name}</div><div className="erl">{e.sub} · {e.scenes} {t('scenes')}</div></div><span className={'badge ' + e.badgeClass}>{t(e.badge, e.badge)}</span></button>)}</div>
    <div className="sheet"><div className="grab" /><div className="sh-h"><span className="t">{props.detail?.name || t('Select an element')}</span>{props.detail?.badge && <span className="badge blue">{t(props.detail.badge, props.detail.badge)}</span>}</div>
      <div className="chips">{CHIPS.map((c) => <button className="achip" key={c.k} onClick={() => props.onAction(c.k)}><svg className="ico" viewBox="0 0 24 24"><path d="M12 2l9 5-9 5-9-5z" /></svg>{t(c.t)}</button>)}</div>
      <button className="btn" onClick={() => props.onAction('confirm')}><svg className="ico" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>{t('Confirm tags for this scene')}</button>
    </div>
    <div className="tabbar">{TABS.map((tab) => <button key={tab.k} className={'tab' + (tab.k === 'breakdown' ? ' on' : '')} onClick={() => tab.k !== 'breakdown' && props.onNav(tab.k)}><div className="b"><svg className="ico" viewBox="0 0 24 24">{tab.d}</svg></div>{t(tab.l)}</button>)}</div>
  </div>);
}
