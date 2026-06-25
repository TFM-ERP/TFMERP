'use client';
import React from 'react';
import { M_CSS, TAB5 } from './deviceCss';
import type { SxCard } from './ScriptOnLibrary';
import { useLocale } from '@/lib/i18n';
const SC = `.dvm .scard{background:var(--panel);border:1px solid var(--hair);border-radius:13px;overflow:hidden;display:flex;cursor:pointer}.dvm .cv{width:70px;flex:none}.dvm .bb{flex:1;padding:11px 12px;display:flex;flex-direction:column;gap:5px}.dvm .ti2{font-size:14px;font-weight:700;color:var(--cream)}.dvm .mrow{display:flex;gap:8px;font-size:10.5px;color:var(--faint);font-weight:600;flex-wrap:wrap;align-items:center}`;
type P = { meta: string; filters: string[]; activeFilter: string; onFilter: (f: string) => void; search?: string; onSearch?: (v: string) => void; cards: SxCard[]; onOpen: (id: string) => void; onNew: () => void; onNav: (k: string) => void; onBack: () => void; toast?: string | null };
export default function ScriptOnLibraryMobile(p: P) {
  const { dir, t } = useLocale();
  return (<div className="dvm" dir={dir}><style dangerouslySetInnerHTML={{ __html: M_CSS + SC }} />
    <div className="mtop"><div className="dr" onClick={p.onBack}>TFM</div><div className="ti"><div className="t1">{t('Script Library')}</div><div className="t2">{p.meta}</div></div><button className="bk" style={{ background: 'none' }} onClick={p.onNew}><svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button></div>
    <div className="scroll"><div className="chips">{p.filters.map((f) => <button key={f} className={'chip' + (f === p.activeFilter ? ' on' : '')} onClick={() => p.onFilter(f)}>{t(f)}</button>)}</div>
      {p.cards.map((c) => <button className="scard" key={c.id} onClick={() => p.onOpen(c.id)}><div className="cv" style={{ background: c.cover }} /><div className="bb"><div className="ti2">{c.title}</div><div className="mrow"><span className="badge" style={{ background: c.typeColor + '22', color: c.typeColor }}>{c.type}</span><span>{c.pages}</span><span style={{ color: c.gradeColor, fontWeight: 700 }}>{c.grade}</span></div></div></button>)}
    </div>
    <div className="tabbar">{TAB5.map(([k, l, d]) => <button key={k} className={'tab' + (k === 'library' ? ' on' : '')} onClick={() => k !== 'library' && p.onNav(k)}><div className="b"><svg className="ico" viewBox="0 0 24 24"><path d={d} /></svg></div>{t(l)}</button>)}</div>
  </div>);
}
