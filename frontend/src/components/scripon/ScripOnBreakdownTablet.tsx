'use client';
/** Breakdown · TABLET (review-first) — carbon-copy of design/tablet-breakdown.html, wired to the same props. */
import React from 'react';
import type { SxLens, SxEl, SxDetail } from './ScripOnBreakdown';
import { useLocale } from '@/lib/i18n';
const CSS = `
.bxt{--bg:#0b0c0f;--panel:#14161c;--hair:rgba(255,255,255,.08);--hair2:rgba(255,255,255,.14);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--violet:#8b7cf0;position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;background:radial-gradient(1000px 500px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.bxt *{box-sizing:border-box;margin:0;padding:0}.bxt .ico{stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round;display:block;width:15px;height:15px}
.bxt .top{height:62px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair)}
.bxt .tl{display:flex;align-items:center;gap:11px}.bxt .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;cursor:pointer}.bxt .proj{font-weight:700;font-size:15px;color:var(--cream)}
.bxt .pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700}.bxt .pill .d{width:7px;height:7px;border-radius:50%}
.bxt .seg{display:flex;gap:4px;background:#10131a;border:1px solid var(--hair);border-radius:11px;padding:4px}.bxt .segtab{display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:8px;font-size:12.5px;font-weight:600;color:var(--mute);cursor:pointer;border:none;background:transparent}.bxt .segtab.on{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink)}
.bxt .btn{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 16px;border-radius:11px;font-size:13.5px;font-weight:700;cursor:pointer;border:none;background:linear-gradient(180deg,#6cc77c,var(--green));color:#08230f}.bxt .btn .ico{width:16px;height:16px;stroke:#08230f}
.bxt .lenses{flex:none;display:flex;gap:7px;align-items:center;padding:10px 18px;background:#0e1015;border-bottom:1px solid var(--hair);overflow:auto}
.bxt .lens{display:flex;align-items:center;gap:7px;padding:8px 12px;border-radius:10px;font-size:12.5px;font-weight:600;color:var(--mute);background:#171a20;border:1px solid var(--hair);white-space:nowrap;cursor:pointer}.bxt .lens .ld{width:8px;height:8px;border-radius:3px}.bxt .lens .cn{font-size:10.5px;color:var(--faint);font-weight:700}.bxt .lens.on{background:#1c1f27;border-color:var(--hair2);color:var(--cream)}
.bxt .body{flex:1;display:grid;grid-template-columns:1.5fr 1fr;min-height:0}
.bxt .elist{border-right:1px solid var(--hair);display:flex;flex-direction:column;overflow:hidden}
.bxt .elhead{padding:10px 18px;border-bottom:1px solid var(--hair);font-size:10.5px;font-weight:700;color:var(--faint);display:flex}
.bxt .erows{flex:1;overflow:auto}
.bxt .erow{display:flex;align-items:center;gap:11px;padding:14px 18px;border-bottom:1px solid var(--hair);cursor:pointer;text-align:left;background:transparent;border-left:none;border-right:none;border-top:none;width:100%}
.bxt .erow.on{background:rgba(198,164,99,.10)}.bxt .erow:hover{background:#171a20}
.bxt .edot{width:9px;height:9px;border-radius:50%;flex:none}.bxt .en{flex:1}.bxt .enm{font-size:13.5px;font-weight:600;color:var(--cream)}.bxt .erl{font-size:11px;color:var(--faint);margin-top:2px}.bxt .ec{width:64px;text-align:right;font-size:12px;color:var(--mute)}
.bxt .badge{font-size:10px;font-weight:800;padding:4px 9px;border-radius:999px}.bxt .badge.green{background:rgba(87,179,104,.16);color:var(--green)}.bxt .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}.bxt .badge.blue{background:rgba(91,141,239,.16);color:#a9c4f7}
.bxt .dock{padding:16px;display:flex;flex-direction:column;gap:13px;overflow:auto}
.bxt .card{background:var(--panel);border:1px solid var(--hair);border-radius:13px;padding:14px;display:flex;flex-direction:column;gap:9px}
.bxt .pc-h{display:flex;align-items:center;justify-content:space-between}.bxt .pc-h .t{font-size:13px;font-weight:700;color:var(--cream)}
.bxt .eyebrow{font-size:10.5px;font-weight:700;letter-spacing:1.3px;color:var(--gold)}
.bxt .kv{display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--hair);font-size:12.5px}.bxt .kv:first-of-type{border-top:none}.bxt .kv .k{color:var(--faint)}.bxt .kv .v{color:var(--text);font-weight:600}
.bxt .schip{padding:4px 8px;border-radius:7px;background:#1b1e25;border:1px solid var(--hair);font-size:11px;color:var(--mute);font-weight:600}
.bxt .qa{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.bxt .tile{background:linear-gradient(180deg,#1b1e25,#171a20);border:1px solid var(--hair);border-radius:11px;padding:12px;cursor:pointer;text-align:left}.bxt .tile .ti{width:30px;height:30px;border-radius:9px;background:rgba(198,164,99,.14);display:grid;place-items:center;color:var(--gold2);margin-bottom:8px}.bxt .tile .ti .ico{width:16px;height:16px}.bxt .tile .tt{font-size:12.5px;font-weight:600;color:var(--cream)}
.bxt .empty{padding:24px 16px;text-align:center;color:var(--faint);font-size:12px}
`;
const SEG = [{ k: 'library', l: 'Library', d: <path d="M4 4h6v16H4z" /> }, { k: 'reader', l: 'Reader', d: <path d="M6 2h9l5 5v15H6z" /> }, { k: 'breakdown', l: 'Breakdown', d: <path d="M12 2l9 5-9 5-9-5z" /> }, { k: 'doctor', l: 'Doctor', d: <path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9z" /> }];
const TILES = [{ k: 'wardrobe', t: 'Link wardrobe' }, { k: 'strips', t: 'Add to strips' }, { k: 'merge', t: 'Merge dup' }, { k: 'flag', t: 'Flag Doctor' }];
export default function ScripOnBreakdownTablet(props: { title: string; revisionLabel?: string; revisionColor?: string; lenses: SxLens[]; activeLens: string; onLens: (k: string) => void; elements: SxEl[]; activeName?: string; onSelect: (n: string) => void; lensLabel: string; detail: SxDetail; onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void; }) {
  const { dir, t } = useLocale();
  const rc = props.revisionColor || '#5b8def'; const lc = props.lenses.find((l) => l.key === props.activeLens)?.color || 'var(--blue)';
  return (<div className="bxt" dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="top">
      <div className="tl"><div className="logo" onClick={props.onBack}>TFM</div><div className="proj">{props.title}</div><span className="pill" style={{ background: rc + '28', color: rc }}><span className="d" style={{ background: rc }} />{(props.revisionLabel || 'DRAFT').toUpperCase()}</span></div>
      <div className="seg">{SEG.map((s) => <button key={s.k} className={'segtab' + (s.k === 'breakdown' ? ' on' : '')} onClick={() => s.k !== 'breakdown' && props.onNav(s.k)}><svg className="ico" viewBox="0 0 24 24">{s.d}</svg>{t(s.l)}</button>)}</div>
      <button className="btn" onClick={() => props.onAction('confirm')}><svg className="ico" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>{t('Confirm tags')}</button>
    </div>
    <div className="lenses">{props.lenses.map((l) => <button key={l.key} className={'lens' + (l.key === props.activeLens ? ' on' : '')} onClick={() => props.onLens(l.key)}><span className="ld" style={{ background: l.color }} />{t(l.label)} <span className="cn">{l.count}</span></button>)}</div>
    <div className="body">
      <div className="elist">
        <div className="elhead"><span style={{ width: 9 }} /><span style={{ flex: 1, marginInlineStart: 11 }}>{t(props.lensLabel, props.lensLabel)} {t('ELEMENT')}</span><span className="ec">{t('SCENES')}</span><span style={{ width: 74, textAlign: 'end' }}>{t('TAG')}</span></div>
        <div className="erows">{props.elements.map((e) => <button key={e.name} className={'erow' + (e.name === props.activeName ? ' on' : '')} onClick={() => props.onSelect(e.name)}><span className="edot" style={{ background: lc }} /><div className="en"><div className="enm">{e.name}</div><div className="erl">{e.sub}</div></div><div className="ec">{e.scenes}</div><span className={'badge ' + e.badgeClass}>{t(e.badge, e.badge)}</span></button>)}
          {!props.elements.length && <div className="empty">{t('No elements tagged yet for this lens.')}</div>}</div>
      </div>
      <div className="dock">
        <div className="card"><div className="pc-h"><span className="t">{props.detail?.name || '—'}</span>{props.detail?.badge && <span className="badge blue">{t(props.detail.badge, props.detail.badge)}</span>}</div>
          {props.detail ? (<>{props.detail.kv.map((kv, i) => <div className="kv" key={i}><span className="k">{t(kv.k, kv.k)}</span><span className="v">{t(kv.v, kv.v)}</span></div>)}{props.detail.scenes.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>{props.detail.scenes.slice(0, 8).map((s, i) => <span className="schip" key={i}>{s}</span>)}{props.detail.scenes.length > 8 && <span className="schip">+{props.detail.scenes.length - 8}</span>}</div>}</>) : <div className="empty" style={{ padding: '6px 0' }}>{t('Select an element.')}</div>}
        </div>
        <div className="card" style={{ flex: 1 }}><div className="pc-h"><span className="t">{t('Actions')}</span><span className="eyebrow">{t('ALWAYS VISIBLE')}</span></div>
          <div className="qa">{TILES.map((tile) => <button className="tile" key={tile.k} onClick={() => props.onAction(tile.k)}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><path d="M12 2l9 5-9 5-9-5z" /></svg></div><div className="tt">{t(tile.t)}</div></button>)}</div>
        </div>
      </div>
    </div>
  </div>);
}
