'use client';
import React from 'react';
import { M_CSS, TAB5 } from './deviceCss';
import type { SxDay, SxBudRow, SxKpi } from './ScriptOnSchedule';
import { useLocale } from '@/lib/i18n';
const SC = `.dvm .k2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.dvm .kpi{background:linear-gradient(180deg,#16191f,#131519);border:1px solid var(--hair);border-radius:12px;padding:12px}.dvm .kl{font-size:10px;color:var(--faint);font-weight:600}.dvm .kv{font-size:19px;font-weight:800;color:var(--cream);margin-top:4px}.dvm .kc{font-size:10px;margin-top:3px;font-weight:600}.dvm .day{background:var(--panel);border:1px solid var(--hair);border-radius:13px;overflow:hidden}.dvm .dayh{padding:10px 12px;border-bottom:1px solid var(--hair);display:flex;justify-content:space-between;align-items:center}.dvm .dn{font-size:12.5px;font-weight:700;color:var(--cream)}.dvm .dm{font-size:10px;color:var(--faint)}.dvm .daybody{padding:8px;display:flex;flex-direction:column;gap:6px}.dvm .strip{border-radius:7px;padding:8px 10px;display:flex;gap:9px;align-items:center}.dvm .sn{font-weight:800;font-size:12px}.dvm .ss{font-size:11.5px;font-weight:700}`;
type P = { title: string; meta: string; kpis: SxKpi[]; days: SxDay[]; budget: SxBudRow[]; suggestion?: any; onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void; toast?: string | null };
export default function ScriptOnScheduleMobile(p: P) {
  const { dir, t } = useLocale();
  return (<div className="dvm" dir={dir}><style dangerouslySetInnerHTML={{ __html: M_CSS + SC }} />
    <div className="mtop"><div className="dr" onClick={p.onBack}>TFM</div><div className="ti"><div className="t1">{t('Schedule & Budget')}</div><div className="t2">{p.meta}</div></div></div>
    <div className="scroll"><div className="k2">{p.kpis.slice(0, 4).map((k, i) => <div className="kpi" key={i}><div className="kl">{t(k.label, k.label)}</div><div className="kv" style={{ color: k.tone || 'var(--cream)' }}>{k.value}</div><div className="kc" style={{ color: k.tone || 'var(--mute)' }}>{t(k.caption || '', k.caption || '')}</div></div>)}</div>
      {p.days.map((d, i) => <div className="day" key={i}><div className="dayh"><div><div className="dn">{d.label} · {d.sub}</div></div><span className={'badge ' + d.ppTone}>{d.pp}</span></div><div className="daybody">{d.strips.map((s, j) => <div className="strip" key={j} style={{ background: s.bg, color: s.fg }}><span className="sn">{s.num}</span><span className="ss">{s.slug}</span></div>)}</div></div>)}
    </div>
    <div className="tabbar">{TAB5.map(([k, l, d]) => <button key={k} className="tab" onClick={() => p.onNav(k)}><div className="b"><svg className="ico" viewBox="0 0 24 24"><path d={d} /></svg></div>{t(l)}</button>)}</div>
  </div>);
}
