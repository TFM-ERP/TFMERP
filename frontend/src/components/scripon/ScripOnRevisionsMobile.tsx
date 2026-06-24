'use client';
import React from 'react';
import { M_CSS, TAB5 } from './deviceCss';
import type { SxRev, SxCompare } from './ScripOnRevisions';
import { useLocale } from '@/lib/i18n';
type P={title:string;meta:string;revisions:SxRev[];activeToId?:string;onSelect:(id:string)=>void;compare:SxCompare;loading?:boolean;onAction:(k:string)=>void;onNav:(k:string)=>void;onBack:()=>void;toast?:string|null};
export default function ScripOnRevisionsMobile(p:P){const{dir,t}=useLocale();return(<div className="dvm" dir={dir}><style dangerouslySetInnerHTML={{__html:M_CSS}}/>
<div className="mtop"><div className="dr" onClick={p.onBack}>TFM</div><div className="ti"><div className="t1">{t('Revisions')}</div><div className="t2">{p.revisions.length} {t('revisions')}</div></div></div>
<div className="scroll">{p.revisions.map(r=><button key={r.id} className="card" style={{flexDirection:'row',gap:10,alignItems:'flex-start',textAlign:'left'}} onClick={()=>p.onSelect(r.id)}><span style={{width:11,height:11,borderRadius:'50%',background:r.color,marginTop:3,flex:'none'}}/><div style={{flex:1}}><div style={{fontWeight:700,color:'var(--cream)',fontSize:13}}>{r.label}{r.active?' — '+t('current'):''}</div><div style={{fontSize:10.5,color:'var(--mute)'}}>{r.author} · {r.date}</div>{r.summary&&<div style={{fontSize:10.5,color:'var(--faint)',marginTop:3}}>{r.summary}</div>}</div></button>)}
{p.compare&&<div style={{fontSize:11,color:'var(--faint)',textAlign:'center',padding:'6px'}}>{t('Comparing')} {p.compare.fromLabel} ↔ {p.compare.toLabel} — {t('open on a larger screen for the side-by-side diff.')}</div>}
</div><div className="tabbar">{TAB5.map(([k,l,d])=><button key={k} className="tab" onClick={()=>p.onNav(k)}><div className="b"><svg className="ico" viewBox="0 0 24 24"><path d={d}/></svg></div>{t(l)}</button>)}</div></div>);}
