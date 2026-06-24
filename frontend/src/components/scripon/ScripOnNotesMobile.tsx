'use client';
import React from 'react';
import { M_CSS, TAB5 } from './deviceCss';
import type { SxNote } from './ScripOnNotes';
import { useLocale } from '@/lib/i18n';
type P={title:string;meta:string;filters:string[];activeFilter:string;onFilter:(f:string)=>void;notes:SxNote[];activeId?:string;onSelect:(id:string)=>void;thread?:any;onAction:(k:string)=>void;onNav:(k:string)=>void;onBack:()=>void;toast?:string|null};
export default function ScripOnNotesMobile(p:P){const{dir,t}=useLocale();return(<div className="dvm" dir={dir}><style dangerouslySetInnerHTML={{__html:M_CSS}}/>
<div className="mtop"><div className="dr" onClick={p.onBack}>TFM</div><div className="ti"><div className="t1">{t('Notes')}</div><div className="t2">{p.meta}</div></div></div>
<div className="scroll"><div className="chips">{p.filters.map(f=><button key={f} className={'chip'+(f===p.activeFilter?' on':'')} onClick={()=>p.onFilter(f)}>{f}</button>)}</div>
{p.notes.map(n=><button key={n.id} className="card" style={{flexDirection:'row',gap:10,alignItems:'flex-start',textAlign:'left'}} onClick={()=>p.onSelect(n.id)}><div style={{width:32,height:32,borderRadius:'50%',background:n.color,display:'grid',placeItems:'center',fontSize:11,fontWeight:800,color:'#fff',flex:'none'}}>{n.av}</div><div style={{flex:1}}><div style={{fontSize:12.5,fontWeight:700,color:'var(--cream)'}}>{n.author.split(' · ')[0]} <span style={{fontSize:10,color:'var(--gold2)',background:'rgba(198,164,99,.13)',padding:'2px 6px',borderRadius:6}}>{n.scene}</span></div><div style={{fontSize:11.5,color:'var(--mute)',marginTop:4,lineHeight:1.4}}>{n.text}</div></div></button>)}
</div><div className="tabbar">{TAB5.map(([k,l,d])=><button key={k} className="tab" onClick={()=>p.onNav(k)}><div className="b"><svg className="ico" viewBox="0 0 24 24"><path d={d}/></svg></div>{t(l)}</button>)}</div></div>);}
