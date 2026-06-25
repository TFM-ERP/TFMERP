'use client';
import React from 'react';
import { T_CSS, SEG5 } from './deviceCss';
import type { SxCard } from './ScriptOnLibrary';
import { useLocale } from '@/lib/i18n';
const SC = `.dvt .cardgrid{flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-content:start;overflow:auto}.dvt .scard{background:var(--panel);border:1px solid var(--hair);border-radius:13px;overflow:hidden;display:flex;flex-direction:column;height:max-content;cursor:pointer}.dvt .cover{height:90px;position:relative;display:flex;align-items:flex-end;padding:11px}.dvt .cover .badge{position:absolute;top:11px;left:11px}.dvt .cover .rev{position:absolute;top:11px;right:11px}.dvt .b{padding:12px 13px;display:flex;flex-direction:column;gap:7px}.dvt .ti2{font-size:14px;font-weight:700;color:var(--cream)}.dvt .mrow{display:flex;gap:9px;font-size:11px;color:var(--faint);font-weight:500;align-items:center}.dvt .scard.add{border-style:dashed;align-items:center;justify-content:center;color:var(--faint);min-height:170px;gap:8px}`;
type P = { meta: string; filters: string[]; activeFilter: string; onFilter: (f: string) => void; search: string; onSearch: (v: string) => void; cards: SxCard[]; onOpen: (id: string) => void; onNew: () => void; onNav: (k: string) => void; onBack: () => void; toast?: string | null };
export default function ScriptOnLibraryTablet(p: P) {
  const { dir, t } = useLocale();
  return (<div className="dvt" dir={dir}><style dangerouslySetInnerHTML={{ __html: T_CSS + SC }} />
    <div className="top"><div className="tl"><div className="logo" onClick={p.onBack}>TFM</div><div className="proj">{t('Script Library')}</div></div>
      <div className="seg">{SEG5.map(([k, l, d]) => <button key={k} className={'segtab' + (k === 'library' ? ' on' : '')} onClick={() => k !== 'library' && p.onNav(k)}><svg className="ico" viewBox="0 0 24 24"><path d={d} /></svg>{t(l)}</button>)}</div>
      <div style={{ display: 'flex', gap: 8 }}><div className="search"><svg className="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg><input value={p.search} onChange={(e) => p.onSearch(e.target.value)} placeholder={t('Search…')} /></div><button className="btn gold" onClick={p.onNew}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 5v14M5 12h14" /></svg>{t('New')}</button></div></div>
    <div className="content"><div><div className="h1">{t('Scripts')}</div><div className="sub">{p.meta} · FDX · Fountain · PDF + OCR</div></div>
      <div className="chips">{p.filters.map((f) => <button key={f} className={'chip' + (f === p.activeFilter ? ' on' : '')} onClick={() => p.onFilter(f)}>{t(f)}</button>)}</div>
      <div className="cardgrid">{p.cards.map((c) => (
        <button className="scard" key={c.id} onClick={() => p.onOpen(c.id)}><div className="cover" style={{ background: c.cover }}><span className="badge" style={{ background: 'rgba(255,255,255,.10)', color: c.typeColor }}>{c.type}</span><span className="pill rev" style={{ background: 'rgba(0,0,0,.35)', color: c.revColor }}><span className="d" style={{ background: c.revColor }} />{c.rev}</span></div><div className="b"><div className="ti2">{c.title}</div><div className="mrow"><span>{c.pages}</span><span>·</span><span style={{ color: c.gradeColor, fontWeight: 700 }}>{c.grade}</span><span style={{ marginInlineStart: 'auto' }}>{c.updated}</span></div></div></button>))}
        <button className="scard add" onClick={p.onNew}><svg className="ico" viewBox="0 0 24 24" style={{ width: 22, height: 22 }}><path d="M12 5v14M5 12h14" /></svg><div style={{ fontSize: 12.5, fontWeight: 600 }}>{t('New · Import')}</div></button>
      </div></div>
    {p.toast && <div className="toast">{p.toast}</div>}
  </div>);
}
