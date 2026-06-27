'use client';
/** ScriptON Doctor — Revisions & Compare (carbon-copy of design/revisions.html). Colour ladder + side-by-side diff.
 *  Self-contained, namespaced `.sx`. Timeline ⇄ doc.revisions; diff ⇄ two revisions' scenes. */
import React from 'react';
import { SxRail } from './ScriptOnStudio';
import { useLocale } from '@/lib/i18n';

export type SxRev = { id: string; label: string; color: string; date: string; author: string; summary: string; active?: boolean };
export type SxLine = { t: string; cls: '' | 'add' | 'del' };
export type SxCompare = { fromLabel: string; fromColor: string; toLabel: string; toColor: string; fromLines: SxLine[]; toLines: SxLine[] } | null;

const CSS = `
.sx{--bg:#0b0c0f;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--paper:#F7F4EC;--ink:#23231f;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--pink:#d6649a;--red:#e5635f;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx *{box-sizing:border-box;margin:0;padding:0}
.sx:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(700px 280px at 72% -6%,rgba(198,164,99,.09),transparent 70%);z-index:0}
.sx svg{display:block}
.sx .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx .tl{display:flex;align-items:center;gap:12px}
.sx .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer}
.sx .proj{font-weight:700;font-size:15.5px;color:var(--cream)}
.sx .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.3px}
.sx .pill .d{width:7px;height:7px;border-radius:50%}
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
.sx .cmpgrid{display:grid;grid-template-columns:300px 1fr;gap:16px;flex:1;min-height:0}
.sx .revtl{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:8px;overflow:auto;display:flex;flex-direction:column}
.sx .revrow{display:flex;gap:11px;padding:13px 12px;border-radius:10px;cursor:pointer;position:relative;border:none;background:transparent;text-align:left}
.sx .revrow:hover{background:#171a20}
.sx .revrow.on{background:rgba(198,164,99,.08);border:1px solid rgba(198,164,99,.35)}
.sx .revdot{width:12px;height:12px;border-radius:50%;flex:none;margin-top:3px;box-shadow:0 0 0 3px rgba(255,255,255,.06)}
.sx .revb{flex:1;min-width:0}
.sx .revh{display:flex;justify-content:space-between;align-items:baseline}
.sx .revl{font-size:13px;font-weight:700;color:var(--cream)}
.sx .revd{font-size:10.5px;color:var(--faint)}
.sx .reva{font-size:11px;color:var(--mute);margin-top:2px}
.sx .revs{font-size:11px;color:var(--faint);margin-top:4px;line-height:1.4}
.sx .cmp{background:var(--panel);border:1px solid var(--hair);border-radius:14px;display:flex;flex-direction:column;overflow:hidden}
.sx .cmph{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--hair)}
.sx .cmpcols{flex:1;display:grid;grid-template-columns:1fr 1fr;min-height:0}
.sx .cmpcol{padding:18px;overflow:auto}
.sx .cmpcol+.cmpcol{border-left:1px solid var(--hair)}
.sx .cmptag{font-size:10.5px;font-weight:700;letter-spacing:.6px;margin-bottom:12px;display:flex;align-items:center;gap:7px}
.sx .sheet{background:var(--paper);color:var(--ink);border-radius:8px;padding:20px 22px;font-family:'Courier Prime',ui-monospace,monospace;font-size:12px;line-height:1.85;box-shadow:0 12px 30px -10px rgba(0,0,0,.6);min-height:100%}
.sx .sl{display:block}
.sx .add{background:rgba(87,179,104,.30)}
.sx .del{background:rgba(229,99,95,.26);text-decoration:line-through;opacity:.65}
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

export default function ScriptOnRevisions(props: {
  title: string; meta: string; revisions: SxRev[]; activeToId?: string; onSelect: (id: string) => void;
  compare: SxCompare; loading?: boolean; onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void; toast?: string | null;
}) {
  const { dir, t } = useLocale();
  const c = props.compare;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="tl">
            <div className="logo" onClick={props.onBack} title={t('Back to TFM')}>TFM</div>
            <div className="proj">{props.title}</div>
            <span className="meta">{props.meta}</span>
          </div>
          <div className="tr">
            <button className="btn ghost" onClick={() => props.onAction('restore')}><svg className="ico" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" /></svg>{t('Restore a draft')}</button>
            <button className="btn outline" onClick={() => props.onAction('exportpages')}><svg className="ico" viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>{t('Export revised pages')}</button>
            <button className="btn gold" onClick={() => props.onAction('new')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 5v14M5 12h14" /></svg>{t('New revision')}</button>
          </div>
        </div>
        <div className="body">
          <SxRail active="revisions" />
          <div className="main"><div className="content">
            <div className="phead"><h1>{t('Revisions & Compare')}</h1><div className="sub">{t('Every draft on the industry colour ladder — and a side-by-side diff so nobody shoots the wrong page.')}</div></div>
            <div className="cmpgrid">
              <div className="revtl">
                {props.revisions.map((r) => (
                  <button key={r.id} className={'revrow' + (r.id === props.activeToId ? ' on' : '')} onClick={() => props.onSelect(r.id)}>
                    <span className="revdot" style={{ background: r.color }} />
                    <div className="revb"><div className="revh"><span className="revl">{r.label}{r.active ? ' — ' + t('current') : ''}</span><span className="revd">{r.date}</span></div><div className="reva">{r.author}</div><div className="revs">{r.summary}</div></div>
                  </button>
                ))}
                {!props.revisions.length && <div className="empty">{t('No revisions yet.')}</div>}
              </div>
              <div className="cmp">
                {props.loading ? <div className="empty">{t('Comparing revisions…')}</div>
                  : c ? (<>
                    <div className="cmph">
                      <span className="pill" style={{ background: c.fromColor + '28', color: c.fromColor }}><span className="d" style={{ background: c.fromColor }} />{c.fromLabel.toUpperCase()}</span>
                      <svg className="ico" viewBox="0 0 24 24" style={{ color: 'var(--faint)' }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      <span className="pill" style={{ background: c.toColor + '28', color: c.toColor }}><span className="d" style={{ background: c.toColor }} />{c.toLabel.toUpperCase()}</span>
                    </div>
                    <div className="cmpcols">
                      <div className="cmpcol"><div className="cmptag" style={{ color: c.fromColor }}><span className="revdot" style={{ width: 9, height: 9, background: c.fromColor, boxShadow: 'none' }} />{c.fromLabel.toUpperCase()}</div><div className="sheet">{c.fromLines.map((l, i) => <span className={'sl ' + l.cls} key={i}>{l.t || ' '}</span>)}</div></div>
                      <div className="cmpcol"><div className="cmptag" style={{ color: c.toColor }}><span className="revdot" style={{ width: 9, height: 9, background: c.toColor, boxShadow: 'none' }} />{c.toLabel.toUpperCase()}</div><div className="sheet">{c.toLines.map((l, i) => <span className={'sl ' + l.cls} key={i}>{l.t || ' '}</span>)}</div></div>
                    </div>
                  </>) : <div className="empty">{t('Select a revision to compare it against the previous draft.')}</div>}
              </div>
            </div>
          </div></div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
