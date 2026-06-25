'use client';
import React from 'react';
import { M_CSS, TAB5 } from './deviceCss';
import type { SxGauge, SxCoverage, SxDiag, SxTab } from './ScriptOnDoctor';
import { useLocale } from '@/lib/i18n';
const SC = `.dvm .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.dvm .g{background:linear-gradient(180deg,#16191f,#131519);border:1px solid var(--hair);border-radius:12px;padding:12px}.dvm .gl{font-size:10px;color:var(--faint);font-weight:600}.dvm .gv{font-size:19px;font-weight:800;margin-top:4px}.dvm .mtr{height:5px;border-radius:4px;background:#23262e;overflow:hidden;margin-top:7px}.dvm .mtr i{display:block;height:100%}.dvm .pt{display:flex;gap:8px;font-size:12px;line-height:1.4;margin-bottom:5px}.dvm .synop{font-size:12px;color:var(--mute);line-height:1.55}.dvm .run{height:46px;border-radius:13px;background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;gap:7px;border:none}.dvm .run .ico{stroke:#1a1509;width:17px;height:17px}`;
type P = { title: string; revisionLabel?: string; gauges: SxGauge[]; coverage: SxCoverage; onGenerate: () => void; onRunDiag: () => void; onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void; activeTab?: SxTab; onTab?: (t: SxTab) => void; diagnostics?: SxDiag[] | null; covLoading?: boolean; diagLoading?: boolean; revisionColor?: string; meta?: string; actHealth?: any; toast?: string | null };
const PI: any = { good: { c: 'var(--green)', s: '✓' }, warn: { c: 'var(--amber)', s: '!' }, bad: { c: 'var(--red)', s: '×' } };
export default function ScriptOnDoctorMobile(p: P) {
  const { dir, t } = useLocale();
  const cov = p.coverage;
  return (<div className="dvm" dir={dir}><style dangerouslySetInnerHTML={{ __html: M_CSS + SC }} />
    <div className="mtop"><div className="dr" onClick={p.onBack}>TFM</div><div className="ti"><div className="t1">{t('Script Doctor')}</div><div className="t2">{p.title} · {p.revisionLabel}</div></div><span className="pill" style={{ background: 'rgba(224,162,59,.16)', color: 'var(--amber)' }}>{p.gauges[0]?.value}</span></div>
    <div className="scroll">
      <div className="g2">{p.gauges.slice(0, 4).map((g, i) => <div className="g" key={i}><div className="gl">{g.label}</div><div className="gv" style={{ color: g.color, fontSize: g.value.length > 3 ? 13 : 19, paddingTop: g.value.length > 3 ? 3 : 0 }}>{g.value}</div><div className="mtr"><i style={{ width: g.pct + '%', background: g.color }} /></div></div>)}</div>
      {cov ? <div className="card"><div className="pc-h"><span className="t">{t('Coverage')}</span></div>{cov.logline && <div className="synop">{cov.logline}</div>}{cov.strengths.slice(0, 1).map((x, i) => <div className="pt" key={i}><span style={{ color: PI[x.tone].c }}>{PI[x.tone].s}</span>{x.text}</div>)}{cov.concerns.slice(0, 1).map((x, i) => <div className="pt" key={i}><span style={{ color: PI[x.tone].c }}>{PI[x.tone].s}</span>{x.text}</div>)}</div> : <button className="run" onClick={p.onGenerate}><svg className="ico" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" /></svg>{t('Generate coverage')}</button>}
      <div className="chips"><button className="chip" onClick={() => p.onAction('diagnose')}>{t('Diagnose')}</button><button className="chip" onClick={() => p.onAction('budgetfit')}>{t('Budget-fit')}</button><button className="chip" onClick={() => p.onAction('compare')}>{t('Compare')}</button><button className="chip" onClick={() => p.onAction('rewrite')}>{t('Rewrite')}</button></div>
      <button className="run" onClick={p.onRunDiag}><svg className="ico" viewBox="0 0 24 24"><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>{t('Run full diagnostic')}</button>
    </div>
    <div className="tabbar">{TAB5.map(([k, l, d]) => <button key={k} className={'tab' + (k === 'doctor' ? ' on' : '')} onClick={() => k !== 'doctor' && p.onNav(k)}><div className="b"><svg className="ico" viewBox="0 0 24 24"><path d={d} /></svg></div>{t(l)}</button>)}</div>
  </div>);
}
