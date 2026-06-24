'use client';
import React from 'react';
import { M_CSS, TAB5 } from './deviceCss';
import type { SxStep, SxKCol } from './ScripOnApprovals';
import { useLocale } from '@/lib/i18n';
const ST:any={done:'var(--green)',current:'var(--blue)',pending:'var(--faint)'};
type P={title:string;meta:string;columns:SxKCol[];chainRev:string;chainColor:string;steps:SxStep[];lockLabel:string;onAction:(k:string)=>void;onNav:(k:string)=>void;onBack:()=>void;toast?:string|null};
export default function ScripOnApprovalsMobile(p:P){const{dir,t}=useLocale();return(<div className="dvm" dir={dir}><style dangerouslySetInnerHTML={{__html:M_CSS}}/>
<div className="mtop"><div className="dr" onClick={p.onBack}>TFM</div><div className="ti"><div className="t1">{t('Approvals')}</div><div className="t2">{p.meta}</div></div></div>
<div className="scroll"><div className="card"><div className="pc-h"><span className="t">{p.chainRev} — {t('full script')}</span><span className="badge blue">{t('REVIEW')}</span></div>{p.steps.map((s,i)=><div className="lrow" key={i}><span className="dot" style={{background:ST[s.state]}}/><span className="lt">{s.name} · {s.role.split(' · ')[0]}</span><span className={'badge '+(s.state==='done'?'green':s.state==='current'?'blue':'')}>{s.state==='done'?'✓':s.state==='current'?t('now'):'·'}</span></div>)}</div>
<div className="card"><div className="pc-h"><span className="t">{t('Compliance gate')}</span><button style={{background:'none',border:'none',color:'var(--gold2)',fontSize:11,fontWeight:700,cursor:'pointer'}} onClick={()=>p.onAction('compliance')}>{t('Run')} {dir==='rtl'?'←':'→'}</button></div><div className="lrow"><span className="lt dim">{t('Rating')}</span><span className="v" style={{marginInlineStart:'auto',color:'var(--gold2)',fontWeight:600}}>PG-15</span></div><div className="lrow"><span className="lt dim">{t('Culture screen')}</span><span className="badge amber" style={{marginInlineStart:'auto'}}>{t('1 FLAG')}</span></div></div>
</div><div className="tabbar">{TAB5.map(([k,l,d])=><button key={k} className="tab" onClick={()=>p.onNav(k)}><div className="b"><svg className="ico" viewBox="0 0 24 24"><path d={d}/></svg></div>{t(l)}</button>)}</div></div>);}
