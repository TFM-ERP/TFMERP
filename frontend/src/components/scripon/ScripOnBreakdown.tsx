'use client';
/**
 * ScripON Doctor — Breakdown (carbon-copy of design/breakdown.html). One breakdown, six lenses,
 * every action visible. Self-contained, namespaced `.sx`. Lenses bind to productionApi.breakdown.categoryBreakdown.
 */
import React from 'react';
import { SxRail } from './ScripOnStudio';
import { useLocale } from '@/lib/i18n';

export type SxEl = { name: string; sub: string; scenes: number; second: string; badge: string; badgeClass: string };
export type SxLens = { key: string; label: string; color: string; count: number };
export type SxDetail = { name: string; badge: string; kv: { k: string; v: string }[]; scenes: string[]; ids?: string[] } | null;

const CSS = `
.sx{--bg:#0b0c0f;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--violet:#8b7cf0;--pink:#d6649a;--red:#e5635f;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
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
.sx .content{flex:1;overflow:hidden;padding:26px 30px;display:flex;flex-direction:column;gap:18px}
.sx .phead{display:flex;align-items:flex-end;justify-content:space-between}
.sx .phead h1{font-size:24px;font-weight:800;color:var(--cream);letter-spacing:-.5px}
.sx .sub{font-size:13px;color:var(--mute);margin-top:4px}
.sx .eyebrow{font-size:11px;font-weight:700;letter-spacing:1.4px;color:var(--gold)}
.sx .lenses{display:flex;gap:8px;align-items:center}
.sx .lens{display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:11px;font-size:13px;font-weight:600;color:var(--mute);background:#171a20;border:1px solid var(--hair);cursor:pointer}
.sx .lens .ld{width:9px;height:9px;border-radius:3px}
.sx .lens .cn{font-size:11px;color:var(--faint);font-weight:700}
.sx .lens.on{background:#1c1f27;border-color:var(--hair2);color:var(--cream)}
.sx .bdgrid{flex:1;display:grid;grid-template-columns:1.7fr 1fr;gap:16px;min-height:0}
.sx .elist{background:var(--panel);border:1px solid var(--hair);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.sx .elhead{display:flex;align-items:center;gap:11px;padding:11px 16px;border-bottom:1px solid var(--hair);font-size:11px;font-weight:700;letter-spacing:.4px;color:var(--faint)}
.sx .erows{flex:1;overflow:auto;display:flex;flex-direction:column}
.sx .erow{display:flex;align-items:center;gap:11px;padding:13px 16px;border-bottom:1px solid var(--hair);cursor:pointer;text-align:left;background:transparent;border-left:none;border-right:none;border-top:none}
.sx .erow:hover{background:#171a20}
.sx .erow.on{background:rgba(198,164,99,.10)}
.sx .edot{width:8px;height:8px;border-radius:50%;flex:none}
.sx .en{flex:1;min-width:0}
.sx .enm{font-size:13.5px;font-weight:600;color:var(--cream)}
.sx .erl{font-size:11px;color:var(--faint);margin-top:2px}
.sx .ec{width:62px;text-align:right;font-size:12.5px;color:var(--mute);font-variant-numeric:tabular-nums}
.sx .badge{font-size:10px;font-weight:800;letter-spacing:.4px;padding:4px 9px;border-radius:999px}
.sx .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}.sx .badge.green{background:rgba(87,179,104,.16);color:var(--green)}.sx .badge.blue{background:rgba(91,141,239,.16);color:#a9c4f7}
.sx .col{display:flex;flex-direction:column;gap:16px;min-height:0}
.sx .panelcard{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:11px}
.sx .pc-h{display:flex;align-items:center;justify-content:space-between}
.sx .pc-h .t{font-size:13.5px;font-weight:700;color:var(--cream)}
.sx .kv{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--hair);font-size:12.5px}
.sx .kv:first-of-type{border-top:none}
.sx .kv .k{color:var(--faint)}
.sx .kv .v{color:var(--text);font-weight:600}
.sx .scenechips{display:flex;flex-wrap:wrap;gap:6px}
.sx .schip{padding:4px 8px;border-radius:7px;background:#1b1e25;border:1px solid var(--hair);font-size:11px;color:var(--mute);font-weight:600;font-variant-numeric:tabular-nums}
.sx .qa{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.sx .tile{background:linear-gradient(180deg,#1b1e25,#171a20);border:1px solid var(--hair);border-radius:12px;padding:13px;cursor:pointer;text-align:left}
.sx .tile:hover{border-color:rgba(198,164,99,.4)}
.sx .tile .ti{width:30px;height:30px;border-radius:9px;background:rgba(198,164,99,.14);display:grid;place-items:center;color:var(--gold2);margin-bottom:9px}
.sx .tile .ti .ico{width:16px;height:16px}
.sx .tile .tt{font-size:13px;font-weight:600;color:var(--cream)}
.sx .tile .ts{font-size:10.5px;color:var(--faint);margin-top:2px}
.sx .lrow{display:flex;align-items:center;gap:11px;padding-top:8px}
.sx .lrow .dot{width:8px;height:8px;border-radius:50%;flex:none}
.sx .lrow .lt{flex:1;font-size:12px;color:var(--text)}
.sx .empty{font-size:12px;color:var(--faint);padding:24px 16px;text-align:center}
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
const TILES = [
  { k: 'wardrobe', t: 'Link wardrobe', s: 'changes', d: <path d="M20 6H10M20 12H10M20 18H10M4 6h.01M4 12h.01M4 18h.01" /> },
  { k: 'strips', t: 'Add to strips', s: 'scenes', d: <path d="M12 2l9 5-9 5-9-5z" /> },
  { k: 'tag', t: 'Tag in scenes', s: 'on the page', d: <path d="M6 2h9l5 5v15H6z" /> },
  { k: 'merge', t: 'Merge duplicate', s: 'names', d: <path d="M8 6h13M8 12h13M8 18h13M3 6v.01M3 12v.01M3 18v.01" /> },
  { k: 'assign', t: 'Assign dept', s: 'owner', d: <path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7z" /> },
  { k: 'flag', t: 'Flag for Doctor', s: 'review', d: <path d="M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3l-8-14a2 2 0 00-3.4 0z" /> },
];

export default function ScripOnBreakdown(props: {
  title: string; revisionLabel: string; revisionColor: string; meta: string;
  lenses: SxLens[]; activeLens: string; onLens: (k: string) => void;
  elements: SxEl[]; activeName?: string; onSelect: (name: string) => void; lensLabel: string;
  detail: SxDetail; onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void; toast?: string | null;
}) {
  const { dir, t } = useLocale();
  const lensColor = props.lenses.find((l) => l.key === props.activeLens)?.color || 'var(--blue)';
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
            <button className="btn ghost" onClick={() => props.onAction('retag')}><svg className="ico" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" /></svg>{t('Re-tag changed scenes')}</button>
            <button className="btn outline" onClick={() => props.onAction('sync')}><svg className="ico" viewBox="0 0 24 24"><path d="M12 2l9 5-9 5-9-5z" /></svg>{t('Sync to Schedule')}</button>
            <button className="btn gold" onClick={() => props.onAction('tagdoctor')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9z" /></svg>{t('Tag with Doctor')}</button>
          </div>
        </div>
        <div className="body">
          <SxRail active="breakdown" />
          <div className="main"><div className="content">
            <div className="phead"><div><h1>{t('Breakdown')}</h1><div className="sub">{t('Every element, tagged once on the page — read through six lenses. No retyping per department.')}</div></div></div>
            <div className="lenses">
              {props.lenses.map((l) => (
                <button key={l.key} className={'lens' + (l.key === props.activeLens ? ' on' : '')} onClick={() => props.onLens(l.key)}>
                  <span className="ld" style={{ background: l.color }} />{t(l.label)} <span className="cn">{l.count}</span>
                </button>
              ))}
              <button className="lens" style={{ marginInlineStart: 'auto' }} onClick={() => props.onAction('filter')}><svg className="ico" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>{t('Filter elements')}</button>
            </div>
            <div className="bdgrid">
              <div className="elist">
                <div className="elhead"><span style={{ width: 8 }} /><span style={{ flex: 1 }}>{t(props.lensLabel, props.lensLabel)} {t('ELEMENT')}</span><span className="ec">{t('SCENES')}</span><span style={{ width: 74, textAlign: 'end' }}>{t('TAG')}</span></div>
                <div className="erows">
                  {props.elements.map((e) => (
                    <button key={e.name} className={'erow' + (e.name === props.activeName ? ' on' : '')} onClick={() => props.onSelect(e.name)}>
                      <span className="edot" style={{ background: lensColor }} />
                      <div className="en"><div className="enm">{e.name}</div><div className="erl">{e.sub}</div></div>
                      <div className="ec">{e.scenes}</div>
                      <div className="ec">{e.second}</div>
                      <span className={'badge ' + e.badgeClass}>{t(e.badge, e.badge)}</span>
                    </button>
                  ))}
                  {!props.elements.length && <div className="empty">{t('No elements tagged yet for this lens. Run “Tag with Doctor” to break it down.')}</div>}
                </div>
              </div>
              <div className="col">
                <div className="panelcard">
                  <div className="pc-h"><span className="t">{props.detail?.name || '—'}</span>{props.detail?.badge && <span className="badge blue">{t(props.detail.badge, props.detail.badge)}</span>}</div>
                  {props.detail ? (<>
                    {props.detail.kv.map((kv, i) => (<div className="kv" key={i}><span className="k">{t(kv.k, kv.k)}</span><span className="v">{t(kv.v, kv.v)}</span></div>))}
                    {props.detail.scenes.length > 0 && <div className="scenechips" style={{ marginTop: 4 }}>{props.detail.scenes.slice(0, 10).map((s, i) => <span className="schip" key={i}>{s}</span>)}{props.detail.scenes.length > 10 && <span className="schip">+{props.detail.scenes.length - 10}</span>}</div>}
                  </>) : <div className="empty" style={{ padding: '8px 0' }}>{t('Select an element to see where it appears.')}</div>}
                </div>
                <div className="panelcard" style={{ flex: 1 }}>
                  <div className="pc-h"><span className="t">{t('Actions')}</span><span className="eyebrow">{t('ALWAYS VISIBLE')}</span></div>
                  <div className="qa">
                    {TILES.map((tile) => (
                      <button className="tile" key={tile.k} onClick={() => props.onAction(tile.k)}>
                        <div className="ti" style={tile.k === 'flag' ? { background: 'rgba(224,162,59,.16)', color: 'var(--amber)' } : tile.k === 'wardrobe' ? { background: 'rgba(139,124,240,.16)', color: 'var(--violet)' } : undefined}><svg className="ico" viewBox="0 0 24 24">{tile.d}</svg></div>
                        <div className="tt">{t(tile.t)}</div><div className="ts">{t(tile.s)}</div>
                      </button>
                    ))}
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
