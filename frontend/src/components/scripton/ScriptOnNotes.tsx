'use client';
/** ScriptON Doctor — Notes & Collaboration (carbon-copy of design/notes.html). Scene-anchored threads.
 *  Self-contained, namespaced `.sx`. Best-effort bind to scriptAnnotations.list. */
import React from 'react';
import { SxRail } from './ScriptOnStudio';
import { useLocale } from '@/lib/i18n';

export type SxNote = { id: string; av: string; author: string; scene: string; text: string; meta: string; color: string; status: 'open' | 'resolved' };
export type SxBubble = { av: string; author: string; time: string; text: string; color: string; doc?: boolean };
export type SxThread = { scene: string; badge: string; badgeClass: string; snip: string; bubbles: SxBubble[] } | null;

const CSS = `
.sx{--bg:#0b0c0f;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--paper:#F7F4EC;--ink:#23231f;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--violet:#8b7cf0;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx *{box-sizing:border-box;margin:0;padding:0}
.sx:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(700px 280px at 72% -6%,rgba(198,164,99,.09),transparent 70%);z-index:0}
.sx svg{display:block}
.sx .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx .tl{display:flex;align-items:center;gap:12px}
.sx .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer}
.sx .proj{font-weight:700;font-size:15.5px;color:var(--cream)}
.sx .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700}.sx .pill .d{width:7px;height:7px;border-radius:50%}
.sx .meta{color:var(--faint);font-size:12px;font-weight:500}
.sx .tr{display:flex;align-items:center;gap:8px}
.sx .btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;color:var(--text);white-space:nowrap;background:transparent}
.sx .btn .ico{width:15px;height:15px}
.sx .btn.ghost{background:#1b1e25;border-color:var(--hair);color:var(--mute)}
.sx .btn.outline{background:#1c1d1a;border-color:rgba(198,164,99,.55);color:var(--gold2)}
.sx .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;box-shadow:0 6px 18px -4px rgba(198,164,99,.45),inset 0 1px 0 rgba(255,255,255,.3)}
.sx .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx .main{flex:1;min-width:0;display:flex;flex-direction:column}
.sx .content{flex:1;overflow:hidden;padding:24px 30px;display:flex;flex-direction:column;gap:16px}
.sx .phead h1{font-size:24px;font-weight:800;color:var(--cream);letter-spacing:-.5px}
.sx .sub{font-size:13px;color:var(--mute);margin-top:4px}
.sx .filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sx .chip{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:600;color:var(--mute);background:#171a20;border:1px solid var(--hair);cursor:pointer}
.sx .chip.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:var(--gold2)}
.sx .ngrid{flex:1;display:grid;grid-template-columns:1.25fr 1fr;gap:16px;min-height:0}
.sx .nlist{background:var(--panel);border:1px solid var(--hair);border-radius:14px;overflow:auto;display:flex;flex-direction:column}
.sx .nrow{display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid var(--hair);cursor:pointer;text-align:left;background:transparent;border-left:none;border-right:none;border-top:none}
.sx .nrow:hover{background:#171a20}
.sx .nrow.on{background:rgba(198,164,99,.08)}
.sx .av{width:34px;height:34px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:11.5px;font-weight:800;color:#fff}
.sx .nb{flex:1;min-width:0}
.sx .nh{display:flex;align-items:center;gap:8px}
.sx .nau{font-size:13px;font-weight:700;color:var(--cream)}
.sx .nsc{font-size:10px;font-weight:700;color:var(--gold2);background:rgba(198,164,99,.13);padding:2px 7px;border-radius:6px}
.sx .ntx{font-size:12px;color:var(--mute);margin-top:4px;line-height:1.4}
.sx .nm{font-size:10.5px;color:var(--faint);margin-top:5px}
.sx .thread{background:var(--panel);border:1px solid var(--hair);border-radius:14px;display:flex;flex-direction:column;overflow:hidden}
.sx .th-h{padding:13px 16px;border-bottom:1px solid var(--hair);display:flex;align-items:center;gap:9px}
.sx .badge{font-size:10px;font-weight:800;padding:4px 9px;border-radius:999px}.sx .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}.sx .badge.green{background:rgba(87,179,104,.16);color:var(--green)}
.sx .th-b{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:13px}
.sx .snip{background:var(--paper);color:var(--ink);border-radius:8px;padding:13px 15px;font-family:'Courier Prime',ui-monospace,monospace;font-size:11.5px;line-height:1.7}
.sx .bub{display:flex;gap:10px}
.sx .bub .bx{flex:1;background:#1b1e25;border:1px solid var(--hair);border-radius:11px;padding:10px 12px}
.sx .bub .bxh{display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px}
.sx .bub .bxh .a{font-weight:700;color:var(--cream)}.sx .bub .bxh .t{color:var(--faint)}
.sx .bub .bxt{font-size:12px;color:var(--text);line-height:1.45}
.sx .bub.doc .bx{background:rgba(198,164,99,.08);border-color:rgba(198,164,99,.3)}
.sx .composer{padding:12px 14px;border-top:1px solid var(--hair);display:flex;align-items:center;gap:9px}
.sx .cin{flex:1;height:40px;border-radius:11px;background:#1a1d24;border:1px solid var(--hair);display:flex;align-items:center;padding:0 13px;color:var(--faint);font-size:12.5px}
.sx .eyebrow{font-size:11px;font-weight:700;letter-spacing:1.4px;color:var(--gold)}
.sx .empty{flex:1;display:grid;place-items:center;font-size:12.5px;color:var(--faint);text-align:center;padding:30px}
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

export default function ScriptOnNotes(props: {
  title: string; meta: string; filters: string[]; activeFilter: string; onFilter: (f: string) => void;
  notes: SxNote[]; activeId?: string; onSelect: (id: string) => void; thread: SxThread;
  onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void; toast?: string | null;
}) {
  const { dir, t } = useLocale();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="tl"><div className="logo" onClick={props.onBack} title={t('Back to TFM')}>TFM</div><div className="proj">{props.title}</div><span className="meta">{props.meta}</span></div>
          <div className="tr">
            <button className="btn ghost" onClick={() => props.onAction('filter')}><svg className="ico" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4" /></svg>{t('Filter')}</button>
            <button className="btn outline" onClick={() => props.onAction('resolveall')}><svg className="ico" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>{t('Resolve all mine')}</button>
            <button className="btn gold" onClick={() => props.onAction('new')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 5v14M5 12h14" /></svg>{t('New note')}</button>
          </div>
        </div>
        <div className="body">
          <SxRail active="notes" />
          <div className="main"><div className="content">
            <div className="phead"><h1>{t('Notes & Collaboration')}</h1><div className="sub">{t('Threaded notes anchored to scenes and people — resolvable, assignable, never lost in a PDF margin.')}</div></div>
            <div className="filters">{props.filters.map((f) => (<button key={f} className={'chip' + (f === props.activeFilter ? ' on' : '')} onClick={() => props.onFilter(f)}>{f}</button>))}</div>
            <div className="ngrid">
              <div className="nlist">
                {props.notes.map((n) => (
                  <button key={n.id} className={'nrow' + (n.id === props.activeId ? ' on' : '')} onClick={() => props.onSelect(n.id)}>
                    <div className="av" style={{ background: n.color }}>{n.av}</div>
                    <div className="nb"><div className="nh"><span className="nau">{n.author}</span><span className="nsc">{n.scene}</span></div><div className="ntx">{n.text}</div><div className="nm">{n.meta}</div></div>
                  </button>
                ))}
                {!props.notes.length && <div className="empty">{t('No notes yet. Notes you add are pinned to a scene and threaded.')}</div>}
              </div>
              <div className="thread">
                {props.thread ? (<>
                  <div className="th-h"><span className="nsc" style={{ fontSize: 11 }}>{props.thread.scene}</span><span className={'badge ' + props.thread.badgeClass}>{props.thread.badge}</span><span style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}><button className="btn ghost" style={{ height: 30 }} onClick={() => props.onAction('assign')}>{t('Assign')}</button><button className="btn outline" style={{ height: 30 }} onClick={() => props.onAction('resolve')}>{t('Resolve')}</button></span></div>
                  <div className="th-b">
                    {props.thread.snip && <div className="snip">{props.thread.snip}</div>}
                    {props.thread.bubbles.map((b, i) => (
                      <div className={'bub' + (b.doc ? ' doc' : '')} key={i}><div className="av" style={{ background: b.doc ? 'linear-gradient(160deg,#E6D2A2,#C6A463)' : b.color, color: b.doc ? '#1a1509' : '#fff' }}>{b.av}</div><div className="bx"><div className="bxh"><span className="a" style={b.doc ? { color: 'var(--gold2)' } : {}}>{b.author}</span><span className="t">{b.time}</span></div><div className="bxt">{b.text}</div></div></div>
                    ))}
                  </div>
                  <div className="composer"><div className="cin">{t('Reply, or @mention a collaborator…')}</div><button className="btn gold" style={{ height: 40 }} onClick={() => props.onAction('send')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>{t('Send')}</button></div>
                </>) : <div className="empty">{t('Select a note to open its thread.')}</div>}
              </div>
            </div>
          </div></div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
