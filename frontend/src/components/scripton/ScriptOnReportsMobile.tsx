'use client';
import React from 'react';
import { M_CSS, TAB5 } from './deviceCss';
import type { SxReport } from './ScriptOnReports';
import { useLocale } from '@/lib/i18n';
type P={title:string;meta:string;filters:string[];activeFilter:string;onFilter:(f:string)=>void;reports:SxReport[];activeKey?:string;onSelect:(k:string)=>void;preview?:any;onExport:(f:string)=>void;onAction:(k:string)=>void;onNav:(k:string)=>void;onBack:()=>void;toast?:string|null};
export default function ScriptOnReportsMobile(p:P){const{dir,t}=useLocale();return(<div className="dvm" dir={dir}><style dangerouslySetInnerHTML={{__html:M_CSS}}/>
<div className="mtop"><div className="dr" onClick={p.onBack}>TFM</div><div className="ti"><div className="t1">{t('Reports & Exports')}</div><div className="t2">{p.meta}</div></div></div>
<div className="scroll"><div className="chips">{p.filters.map(f=><button key={f} className={'chip'+(f===p.activeFilter?' on':'')} onClick={()=>p.onFilter(f)}>{f}</button>)}</div>
{p.reports.map(r=><button key={r.key} className="card" style={{flexDirection:'row',alignItems:'center',gap:11}} onClick={()=>p.onExport('pdf')}><div style={{width:38,height:38,borderRadius:9,background:'rgba(198,164,99,.13)',display:'grid',placeItems:'center',color:'var(--gold2)'}}><svg className="ico" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/></svg></div><div style={{flex:1}}><div style={{fontWeight:700,color:'var(--cream)',fontSize:13.5}}>{r.title}</div><div style={{fontSize:10.5,color:'var(--faint)'}}>{r.meta}</div></div><span className={'badge '+r.badgeClass}>{r.badge}</span></button>)}
</div><div className="tabbar">{TAB5.map(([k,l,d])=><button key={k} className="tab" onClick={()=>p.onNav(k)}><div className="b"><svg className="ico" viewBox="0 0 24 24"><path d={d}/></svg></div>{t(l)}</button>)}</div></div>);}
