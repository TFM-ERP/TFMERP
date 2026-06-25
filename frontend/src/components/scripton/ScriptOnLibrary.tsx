'use client';
/** ScriptON Doctor — Script Library (carbon-copy of design/library.html). Slate of scripts as cinematic cards.
 *  Self-contained, namespaced `.sx`. Bound to masterScriptApi.list. */
import React from 'react';
import { SxRail } from './ScriptOnStudio';
import { useLocale } from '@/lib/i18n';

export type SxCard = { id: string; title: string; type: string; typeColor: string; rev: string; revColor: string; pages: string; grade: string; gradeColor: string; updated: string; cover: string };

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
.sx .meta{color:var(--faint);font-size:12px;font-weight:500}
.sx .tr{display:flex;align-items:center;gap:8px}
.sx .btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;color:var(--text);white-space:nowrap;background:transparent}
.sx .btn .ico{width:15px;height:15px}
.sx .btn.outline{background:#1c1d1a;border-color:rgba(198,164,99,.55);color:var(--gold2)}
.sx .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;box-shadow:0 6px 18px -4px rgba(198,164,99,.45),inset 0 1px 0 rgba(255,255,255,.3)}
.sx .search{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;background:#1a1d24;border:1px solid var(--hair);border-radius:10px;color:var(--faint);font-size:12.5px;min-width:280px}
.sx .search .ico{width:15px;height:15px}
.sx .search input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font:inherit}
.sx .search input::placeholder{color:var(--faint)}
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
.sx .phead h1{font-size:24px;font-weight:800;color:var(--cream);letter-spacing:-.5px}
.sx .sub{font-size:13px;color:var(--mute);margin-top:4px}
.sx .filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sx .chip{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:600;color:var(--mute);background:#171a20;border:1px solid var(--hair);cursor:pointer}
.sx .chip.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:var(--gold2)}
.sx .cardgrid{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-content:start;overflow:auto}
.sx .scard{background:var(--panel);border:1px solid var(--hair);border-radius:14px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:border-color .15s,transform .15s;height:max-content}
.sx .scard:hover{border-color:var(--hair2);transform:translateY(-2px)}
.sx .cover{height:128px;position:relative;display:flex;align-items:flex-end;padding:12px}
.sx .cover .badge{position:absolute;top:12px;left:12px}
.sx .cover .rev{position:absolute;top:12px;right:12px}
.sx .badge{font-size:10px;font-weight:800;letter-spacing:.4px;padding:4px 9px;border-radius:999px}
.sx .pill{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:700}
.sx .pill .d{width:6px;height:6px;border-radius:50%}
.sx .b{padding:13px 14px;display:flex;flex-direction:column;gap:8px}
.sx .ti2{font-size:14.5px;font-weight:700;color:var(--cream)}
.sx .mrow{display:flex;align-items:center;gap:10px;font-size:11px;color:var(--faint);font-weight:500}
.sx .scard.add{border-style:dashed;align-items:center;justify-content:center;color:var(--faint);gap:10px;min-height:240px}
.sx .scard.add:hover{color:var(--gold2);border-color:rgba(198,164,99,.5)}
.sx .scard.add .plus{width:46px;height:46px;border-radius:50%;border:1.5px dashed currentColor;display:grid;place-items:center}
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

export default function ScriptOnLibrary(props: {
  meta: string; filters: string[]; activeFilter: string; onFilter: (f: string) => void; search: string; onSearch: (v: string) => void;
  cards: SxCard[]; onOpen: (id: string) => void; onNew: () => void; onNav: (k: string) => void; onBack: () => void; toast?: string | null; onDelete?: (id: string) => void; canDelete?: (id: string) => boolean; onBin?: () => void;
}) {
  const { dir, t } = useLocale();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="tl"><div className="logo" onClick={props.onBack} title={t('Back to TFM')}>TFM</div><div className="proj">{t('Script Library')}</div><span className="meta">{props.meta}</span></div>
          <div className="tr">
            <div className="search"><svg className="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg><input value={props.search} onChange={(e) => props.onSearch(e.target.value)} placeholder={t('Search title, writer, character…')} /></div>
            {props.onBin ? <button className="btn outline" onClick={props.onBin}><svg className="ico" viewBox="0 0 24 24"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>{t('Bin')}</button> : null}
            <button className="btn outline" onClick={props.onNew}><svg className="ico" viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>{t('Import')}</button>
            <button className="btn gold" onClick={props.onNew}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 5v14M5 12h14" /></svg>{t('New script')}</button>
          </div>
        </div>
        <div className="body">
          <SxRail active="library" />
          <div className="main"><div className="content">
            <div className="phead"><h1>{t('Scripts')}</h1><div className="sub">{t('Develop, adapt, import (FDX · Fountain · Celtx · Word · PDF + OCR) — one source of truth per title.')}</div></div>
            <div className="filters">{props.filters.map((f) => (<button key={f} className={'chip' + (f === props.activeFilter ? ' on' : '')} onClick={() => props.onFilter(f)}>{t(f)}</button>))}<span style={{ marginInlineStart: 'auto' }} className="meta">{t('Sorted by recently updated')}</span></div>
            <div className="cardgrid">
              {props.cards.map((c) => (
                <button className="scard" key={c.id} onClick={() => props.onOpen(c.id)}>
                  <div className="cover" style={{ background: c.cover, position: 'relative' }}>
                    <span className="badge" style={{ background: 'rgba(255,255,255,.10)', color: c.typeColor }}>{c.type}</span>
                    <span className="pill rev" style={{ background: 'rgba(0,0,0,.35)', color: c.revColor }}><span className="d" style={{ background: c.revColor }} />{c.rev}</span>
                    {props.onDelete && props.canDelete && props.canDelete(c.id) ? <span onClick={(e) => { e.stopPropagation(); props.onDelete!(c.id); }} title={t('Move to bin')} style={{ position: 'absolute', top: 8, insetInlineEnd: 8, width: 26, height: 26, borderRadius: 8, background: 'rgba(0,0,0,.5)', color: '#f0a3a0', display: 'grid', placeItems: 'center', fontSize: 12, cursor: 'pointer' }}>\u2716</span> : null}
                  </div>
                  <div className="b"><div className="ti2">{c.title}</div><div className="mrow"><span>{c.pages}</span><span>·</span><span style={{ color: c.gradeColor, fontWeight: 700 }}>{c.grade}</span><span style={{ marginInlineStart: 'auto' }}>{c.updated}</span></div></div>
                </button>
              ))}
              <button className="scard add" onClick={props.onNew}><div className="plus"><svg className="ico" viewBox="0 0 24 24" style={{ width: 22, height: 22 }}><path d="M12 5v14M5 12h14" /></svg></div><div style={{ fontSize: 13, fontWeight: 600 }}>{t('New · Import · Develop')}</div></button>
            </div>
          </div></div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
