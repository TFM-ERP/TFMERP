'use client';
import React from 'react';
import { M_CSS, TAB5 } from './deviceCss';
import type { SxRun } from './ScripOnSettings';
import { useLocale } from '@/lib/i18n';
type P={companyName:string;model:string;promptSet:string;confidence:number;humanApproval:boolean;runs:SxRun[];runsMeta:string;onAction:(k:string)=>void;onNav:(k:string)=>void;onBack:()=>void;toast?:string|null};
export default function ScripOnSettingsMobile(p:P){const{dir,t}=useLocale();return(<div className="dvm" dir={dir}><style dangerouslySetInnerHTML={{__html:M_CSS}}/>
<div className="mtop"><div className="dr" onClick={p.onBack}>TFM</div><div className="ti"><div className="t1">{t('AI Governance')}</div><div className="t2">{p.companyName}</div></div></div>
<div className="scroll"><div className="card"><div className="eyebrow">{t('ACTIVE MODEL')}</div><div style={{fontSize:14,fontWeight:700,color:'var(--cream)',fontFamily:"'Courier Prime',monospace"}}>{p.model}</div><div style={{fontSize:11,color:'var(--mute)'}}>{p.promptSet} · {t('single gateway')}</div></div>
<div className="card"><div className="eyebrow">{t('CONFIDENCE GATE')} · {p.confidence.toFixed(2)}</div><div style={{height:6,borderRadius:4,background:'#23262e',position:'relative',marginTop:8}}><span style={{position:'absolute',insetInlineStart:0,top:0,bottom:0,width:Math.round(p.confidence*100)+'%',borderRadius:4,background:'linear-gradient(90deg,#C6A463,#E6D2A2)'}}/></div></div>
<div className="card"><div className="pc-h"><span className="t">{t('Human approval')}</span><span style={{width:42,height:24,borderRadius:999,background:p.humanApproval?'linear-gradient(90deg,#C6A463,#E6D2A2)':'#2a2f39',position:'relative'}}><span style={{position:'absolute',width:18,height:18,borderRadius:'50%',background:'#fff',top:3,right:p.humanApproval?3:'auto',left:p.humanApproval?'auto':3}}/></span></div></div>
<div className="card"><div className="pc-h"><span className="t">{t('AiRun audit')}</span><span style={{fontSize:10,color:'var(--faint)'}}>{p.runsMeta}</span></div>{p.runs.slice(0,5).map((r,i)=><div className="lrow" key={i}><span className="lt">{t(r.surface)}</span><span className={'badge '+r.statusClass} style={{marginInlineStart:'auto'}}>{r.status}</span></div>)}</div>
</div><div className="tabbar">{TAB5.map(([k,l,d])=><button key={k} className="tab" onClick={()=>p.onNav(k)}><div className="b"><svg className="ico" viewBox="0 0 24 24"><path d={d}/></svg></div>{t(l)}</button>)}</div></div>);}
