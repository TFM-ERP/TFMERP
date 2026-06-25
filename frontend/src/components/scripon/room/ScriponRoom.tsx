'use client';
/**
 * ScripON · Room (3-column) — route /scripon/notes under the `new` shell flag.
 * Consolidates Notes + Approvals + Distribution (Figma 6:156; mobile 49:3).
 * Presentational; the page owns data + the real Resolve→approvalsApi routing.
 * Replies + distribution-viewed are honest stubs; the ↳ Revision Pass chip
 * degrades when the kernel is inert.
 */
import { useState } from 'react';
import { SxRail } from '@/components/scripon/ScripOnStudio';
import { useLocale } from '@/lib/i18n';
import type { RoomNote, ChainStage, DistRow, Thread } from './scripon-room.logic';

const STATE_COLOR: Record<string, string> = { done: 'var(--green)', current: 'var(--amber)', pending: 'var(--faint)', rejected: 'var(--red)' };
const STATE_LABEL: Record<string, string> = { done: 'Approved', current: 'Reviewing now', pending: 'Pending', rejected: 'Sent back' };

const CSS = `
.sx.room{--bg:#0b0c0f;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--violet:#8b7cf0;--red:#e5635f;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.room *{box-sizing:border-box;margin:0;padding:0}
.sx.room:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(700px 280px at 72% -6%,rgba(198,164,99,.09),transparent 70%);z-index:0}
.sx.room svg{display:block}
.sx.room .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx.room .tl{display:flex;align-items:center;gap:12px;min-width:0}
.sx.room .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer;flex:none}
.sx.room .proj{font-weight:700;font-size:15.5px;color:var(--cream);font-family:var(--sx-title);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.room .pill{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.sx.room .pill .d{width:7px;height:7px;border-radius:50%;flex:none}
.sx.room .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx.room .rail{width:74px;flex:0 0 74px;background:#0e1015;border-inline-end:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px;overflow-y:auto}
.sx.room .ritem{width:58px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);cursor:pointer;position:relative;border:none;background:transparent}
.sx.room .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mute)}
.sx.room .ritem .lbl{font-size:9px;font-weight:600}
.sx.room .ritem:hover .box{border-color:var(--hair2);color:var(--cream)}
.sx.room .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink);box-shadow:0 6px 16px -4px rgba(198,164,99,.5)}
.sx.room .ritem.on .lbl{color:var(--gold2)}
.sx.room .ritem.on:before{content:"";position:absolute;inset-inline-start:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
.sx.room .main{flex:1;min-width:0;display:flex;flex-direction:column}
.sx.room .content{flex:1;min-height:0;overflow:hidden;padding:20px 24px;display:flex;flex-direction:column;gap:14px}
.sx.room .phead{flex:0 0 auto}
.sx.room .phead h1{font-family:var(--sx-title);font-size:25px;font-weight:500;color:var(--cream);letter-spacing:-.3px}
.sx.room .phead .sub{font-size:12.5px;color:var(--mute);margin-top:3px}
.sx.room .rcols{flex:1;min-height:0;display:grid;grid-template-columns:300px 1fr 300px;gap:16px}
.sx.room .rcol{min-height:0;display:flex;flex-direction:column;gap:10px}
.sx.room .seclabel{font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--faint);flex:0 0 auto}
.sx.room .card{background:var(--panel);border:1px solid var(--hair);border-radius:13px}

/* Notes column */
.sx.room .filters{display:flex;gap:6px;flex-wrap:wrap;flex:0 0 auto}
.sx.room .chip{padding:5px 10px;border-radius:999px;font-size:11px;font-weight:600;color:var(--mute);background:#171a20;border:1px solid var(--hair);cursor:pointer}
.sx.room .chip.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:var(--gold2)}
.sx.room .nlist{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;padding-right:2px}
.sx.room .nrow{background:var(--panel);border:1px solid var(--hair);border-radius:12px;padding:11px;cursor:pointer;text-align:start;display:flex;gap:10px;transition:border-color .12s}
.sx.room .nrow:hover{border-color:var(--hair2)}
.sx.room .nrow.on{border-color:rgba(198,164,99,.5);background:#181a14}
.sx.room .av{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:10.5px;font-weight:800;color:#0b0c0f;flex:none}
.sx.room .nb{min-width:0;flex:1}
.sx.room .nh{display:flex;align-items:center;gap:7px}
.sx.room .nsc{font-size:12px;font-weight:700;color:var(--cream)}
.sx.room .tag{font-size:8.5px;font-weight:800;letter-spacing:.4px;padding:2px 6px;border-radius:999px;margin-inline-start:auto}
.sx.room .nau{font-size:10px;color:var(--faint);margin-top:1px}
.sx.room .ntx{font-size:11.5px;color:var(--text);margin-top:5px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* Thread column */
.sx.room .thread{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--hair);border-radius:13px;overflow:hidden}
.sx.room .th-h{flex:0 0 auto;padding:13px 15px;border-bottom:1px solid var(--hair)}
.sx.room .th-sc{display:flex;align-items:center;gap:9px}
.sx.room .th-t{font-size:13.5px;font-weight:700;color:var(--cream)}
.sx.room .badge{font-size:9px;font-weight:800;letter-spacing:.4px;padding:3px 8px;border-radius:999px}
.sx.room .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}
.sx.room .badge.green{background:rgba(87,179,104,.16);color:var(--green)}
.sx.room .th-s{font-size:11px;color:var(--faint);margin-top:3px}
.sx.room .th-b{flex:1;min-height:0;overflow:auto;padding:14px 15px;display:flex;flex-direction:column;gap:12px}
.sx.room .bub{display:flex;gap:9px}
.sx.room .bub .bx{min-width:0;flex:1;background:var(--panel2);border:1px solid var(--hair);border-radius:10px;padding:9px 11px}
.sx.room .bub.doc .bx{background:linear-gradient(135deg,rgba(198,164,99,.14),rgba(198,164,99,.04));border-color:rgba(198,164,99,.4)}
.sx.room .ba{font-size:11px;font-weight:700;color:var(--cream)}
.sx.room .ba small{color:var(--faint);font-weight:500;margin-inline-start:6px}
.sx.room .bt{font-size:12px;color:var(--text);margin-top:4px;line-height:1.45}
.sx.room .passchip{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;color:var(--gold2);background:rgba(198,164,99,.12);border:1px solid rgba(198,164,99,.3);border-radius:999px;padding:3px 9px;margin-top:8px;width:max-content}
.sx.room .composer{flex:0 0 auto;border-top:1px solid var(--hair);padding:11px;display:flex;gap:9px;align-items:center}
.sx.room .cin{flex:1;background:#171a20;border:1px solid var(--hair);border-radius:9px;padding:9px 11px;color:var(--text);font:inherit;font-size:12.5px;outline:none}
.sx.room .cin::placeholder{color:var(--faint)}
.sx.room .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 13px;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid transparent;white-space:nowrap}
.sx.room .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700}
.sx.room .btn.ghost{background:#1b1e25;border-color:var(--hair);color:var(--text)}
.sx.room .empty{flex:1;display:grid;place-items:center;color:var(--faint);font-size:13px;text-align:center;padding:20px}

/* Right column: chain + distribution */
.sx.room .panel{background:var(--panel);border:1px solid var(--hair);border-radius:13px;padding:14px}
.sx.room .stage{display:flex;gap:10px;align-items:flex-start;padding:8px 0}
.sx.room .sdot{width:10px;height:10px;border-radius:50%;flex:none;margin-top:3px}
.sx.room .sn{font-size:12.5px;font-weight:700;color:var(--cream)}
.sx.room .sm{font-size:10.5px;color:var(--faint);margin-top:1px}
.sx.room .drow{display:flex;gap:9px;align-items:center;padding:8px 0;border-top:1px solid var(--hair)}
.sx.room .drow:first-of-type{border-top:none}
.sx.room .dn{font-size:12px;font-weight:600;color:var(--cream)}
.sx.room .dm{font-size:10px;color:var(--faint);margin-top:1px}
.sx.room .dstat{font-size:10px;color:var(--mute);margin-inline-start:auto;display:flex;align-items:center;gap:4px}
.sx.room .pfoot{font-size:10px;color:var(--faint);margin-top:10px;line-height:1.4}
.sx.room .muted{font-size:12px;color:var(--faint);padding:8px 0}
.sx.room .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px;box-shadow:0 14px 40px -12px rgba(0,0,0,.7)}
.sx.room .mtabs{display:none}

/* Tablet: notes + thread; chain/distribution stack below the thread */
.sx.room[data-vp="tablet"] .rcols{grid-template-columns:280px 1fr}
.sx.room[data-vp="tablet"] .rcol.side{grid-column:1 / -1;flex-direction:row;gap:16px}
.sx.room[data-vp="tablet"] .rcol.side .panel{flex:1}
.sx.room[data-vp="tablet"] .content{padding:18px 18px}

/* Mobile (49:3, review-first): one panel at a time via the segmented control */
.sx.room[data-vp="mobile"] .content{padding:14px 12px;gap:10px}
.sx.room[data-vp="mobile"] .mtabs{display:flex;gap:6px;flex:0 0 auto}
.sx.room[data-vp="mobile"] .mtab{flex:1;padding:8px;border-radius:9px;font-size:12px;font-weight:700;background:#171a20;border:1px solid var(--hair);color:var(--mute);cursor:pointer}
.sx.room[data-vp="mobile"] .mtab.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:var(--gold2)}
.sx.room[data-vp="mobile"] .rcols{display:block;flex:1;min-height:0;overflow:hidden}
.sx.room[data-vp="mobile"] .rcol{height:100%}
.sx.room[data-vp="mobile"] .rcol.side{flex-direction:column}
.sx.room[data-vp="mobile"] .phead h1{font-size:21px}
`;

export type RoomProps = {
  title: string; revisionLabel: string; revisionColor: string;
  filters: string[]; activeFilter: string; onFilter: (f: string) => void;
  notes: RoomNote[]; openLabel: string; selectedId?: string; onSelect: (id: string) => void;
  thread: Thread | null; chainStages: ChainStage[]; chainTitle: string;
  distribution: DistRow[]; kernelInert: boolean;
  onResolve: () => void; onReply: () => void;
  onNav: (k: string) => void; onBack: () => void; toast?: string | null;
  vp: 'mobile' | 'tablet' | 'desktop';
};

export default function ScriponRoom(props: RoomProps) {
  const { dir, t } = useLocale();
  const [mtab, setMtab] = useState<'notes' | 'thread' | 'side'>('notes');
  const isMobile = props.vp === 'mobile';
  const show = (col: 'notes' | 'thread' | 'side') => !isMobile || mtab === col;

  const NotesCol = (
    <div className="rcol" style={show('notes') ? undefined : { display: 'none' }}>
      <div className="seclabel">{t('Notes')} · {props.openLabel}</div>
      <div className="filters">
        {props.filters.map((f) => <button key={f} className={'chip' + (f === props.activeFilter ? ' on' : '')} onClick={() => props.onFilter(f)}>{t(f)}</button>)}
      </div>
      <div className="nlist">
        {props.notes.length ? props.notes.map((n) => (
          <button key={n.id} className={'nrow' + (n.id === props.selectedId ? ' on' : '')} onClick={() => { props.onSelect(n.id); if (isMobile) setMtab('thread'); }}>
            <span className="av" style={{ background: n.color }}>{n.av}</span>
            <div className="nb">
              <div className="nh"><span className="nsc">{n.scene}</span><span className="tag" style={n.status === 'open' ? { background: 'rgba(224,162,59,.16)', color: 'var(--amber)' } : { background: 'rgba(87,179,104,.16)', color: 'var(--green)' }}>{n.status === 'open' ? t('OPEN') : t('RESOLVED')}</span></div>
              <div className="nau">{n.author}</div>
              <div className="ntx">{n.text}</div>
            </div>
          </button>
        )) : <div className="muted">{t('No notes yet.')}</div>}
      </div>
    </div>
  );

  const ThreadCol = (
    <div className="rcol" style={show('thread') ? undefined : { display: 'none' }}>
      {props.thread ? (
        <div className="thread">
          <div className="th-h">
            <div className="th-sc">
              {isMobile ? <button className="btn ghost" style={{ height: 28, padding: '0 9px' }} onClick={() => setMtab('notes')}>←</button> : null}
              <span className="th-t">{props.thread.scene}</span>
              <span className={'badge ' + props.thread.badgeClass}>{props.thread.badge}</span>
            </div>
            <div className="th-s">{t('Anchored to the scene — moves with it.')}</div>
          </div>
          <div className="th-b">
            {props.thread.bubbles.map((b, i) => (
              <div className={'bub' + (b.doc ? ' doc' : '')} key={i}>
                <span className="av" style={{ background: b.color, color: b.doc ? '#0b0c0f' : '#0b0c0f' }}>{b.av}</span>
                <div className="bx"><div className="ba">{b.author}<small>{b.time}</small></div><div className="bt">{b.text}</div></div>
              </div>
            ))}
            {!props.kernelInert ? <span className="passchip">↳ {t('Revision Pass')} · {props.thread.scene}</span> : null}
          </div>
          <div className="composer">
            <input className="cin" placeholder={t('Reply, or @mention…')} onKeyDown={(e) => { if (e.key === 'Enter') props.onReply(); }} />
            <button className="btn gold" onClick={props.onResolve}>{t('Resolve')} ✓</button>
          </div>
        </div>
      ) : <div className="thread"><div className="empty">{t('Select a note to open its thread.')}</div></div>}
    </div>
  );

  const SideCol = (
    <div className="rcol side" style={show('side') ? undefined : { display: 'none' }}>
      <div className="panel">
        <div className="seclabel" style={{ marginBottom: 10 }}>{t('Approval chain')}{props.chainTitle ? ' · ' + props.chainTitle : ''}</div>
        {props.chainStages.length ? props.chainStages.map((s, i) => (
          <div className="stage" key={i}>
            <span className="sdot" style={{ background: STATE_COLOR[s.state] }} />
            <div><div className="sn">{t(s.name)}</div><div className="sm">{t(STATE_LABEL[s.state])}{s.by ? ' · ' + s.by : s.state === 'pending' ? ' · ' + t('not started') : ''}</div></div>
          </div>
        )) : <div className="muted">{t('No approvals routed yet — resolve a note to start the chain.')}</div>}
      </div>
      <div className="panel">
        <div className="seclabel" style={{ marginBottom: 10 }}>{t('Distribution')}</div>
        {props.distribution.length ? props.distribution.map((d, i) => (
          <div className="drow" key={i}>
            <div><div className="dn">{d.name}{d.role ? ' · ' + t(d.role) : ''}</div><div className="dm">{t('watermarked')}</div></div>
            <span className="dstat">{d.status === 'viewed' ? '👁' : '✓'} {d.status === 'viewed' ? t('viewed') + ' ' + d.when : t('sent')}</span>
          </div>
        )) : <div className="muted">{t('No protected copies distributed yet.')}</div>}
        <div className="pfoot">{t('Every copy is per-recipient forensic-watermarked and access-logged.')}</div>
      </div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx room" data-vp={props.vp} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="tl">
            <div className="logo" onClick={props.onBack} title={t('Back to TFM')}>TFM</div>
            <div className="proj">{props.title}</div>
            <span className="pill" style={{ background: props.revisionColor + '28', color: props.revisionColor }}>
              <span className="d" style={{ background: props.revisionColor }} />{props.revisionLabel.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="body">
          <SxRail active="room" />
          <div className="main"><div className="content">
            <div className="phead"><h1>{t('Room')}</h1><div className="sub">{t('Notes, approvals & distribution — live and structured, never emailed PDFs.')}</div></div>
            <div className="mtabs">
              {([['notes', 'Notes'], ['thread', 'Thread'], ['side', 'Approvals']] as const).map(([k, l]) => (
                <button key={k} className={'mtab' + (mtab === k ? ' on' : '')} onClick={() => setMtab(k)}>{t(l)}</button>
              ))}
            </div>
            <div className="rcols">{NotesCol}{ThreadCol}{SideCol}</div>
          </div></div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
