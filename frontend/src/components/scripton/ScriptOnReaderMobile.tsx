'use client';
/** ScriptON Doctor — Reader · MOBILE (on-set), carbon-copy of design/mobile-reader.html. Wired to the same props. */
import React from 'react';
import type { SxScene, SxSceneRead } from './ScriptOnReader';
import { useLocale } from '@/lib/i18n';

const CSS = `
.sxm{--bg:#0b0c0f;--panel:#14161c;--hair:rgba(255,255,255,.08);--hair2:rgba(255,255,255,.14);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--paper:#F7F4EC;--ink:#23231f;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;background:var(--bg);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sxm *{box-sizing:border-box;margin:0;padding:0}
.sxm .ico{stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round;display:block;width:20px;height:20px}
.sxm .mtop{height:54px;flex:none;display:flex;align-items:center;gap:12px;padding:0 14px;border-bottom:1px solid var(--hair);background:linear-gradient(180deg,#15181e,#121419)}
.sxm .bk{width:34px;height:34px;border-radius:10px;background:#1b1e25;border:1px solid var(--hair);display:grid;place-items:center;color:var(--mute);flex:none}
.sxm .ti{flex:1;min-width:0}.sxm .t1{font-size:14px;font-weight:700;color:var(--cream);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sxm .t2{font-size:11px;color:var(--faint);margin-top:1px}
.sxm .dr{width:36px;height:36px;border-radius:11px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);flex:none;border:none}
.sxm .mbody{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.sxm .mscript{flex:1;overflow:auto;padding:16px 14px;background:radial-gradient(120% 80% at 50% 0,#101218,#0a0b0e)}
.sxm .page{background:var(--paper);color:var(--ink);border-radius:8px;padding:20px;font-family:'Courier Prime',ui-monospace,monospace;font-size:13px;line-height:1.85;box-shadow:0 20px 50px -16px rgba(0,0,0,.7)}
.sxm .sh{font-weight:700;margin-bottom:10px}.sxm .ac{margin-bottom:10px}
.sxm .sheet{flex:none;background:linear-gradient(180deg,#16181f,#121419);border-top:1px solid var(--hair2);border-radius:22px 22px 0 0;padding:10px 16px 14px;box-shadow:0 -16px 40px -20px rgba(0,0,0,.7);display:flex;flex-direction:column;gap:11px}
.sxm .grab{width:38px;height:4px;border-radius:3px;background:#3a3f49;margin:2px auto 4px}
.sxm .sh-h{display:flex;align-items:center;justify-content:space-between}.sxm .sh-h .t{font-size:13px;font-weight:700;color:var(--cream)}
.sxm .badge{font-size:10px;font-weight:800;padding:3px 8px;border-radius:999px;background:rgba(224,162,59,.16);color:var(--amber)}
.sxm .kvr{display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;border-top:1px solid var(--hair)}.sxm .kvr:first-of-type{border-top:none}.sxm .kvr .k{color:var(--faint)}.sxm .kvr .v{color:var(--text);font-weight:600}
.sxm .chips{display:flex;gap:8px;overflow:auto}
.sxm .achip{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;border-radius:12px;background:#1b1e25;border:1px solid var(--hair);font-size:10.5px;font-weight:600;color:var(--mute);cursor:pointer;min-width:64px}.sxm .achip .ico{width:18px;height:18px;stroke:var(--gold2)}
.sxm .row2{display:flex;gap:9px}
.sxm .btn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;height:46px;border-radius:13px;font-size:14px;font-weight:700;border:1px solid transparent;cursor:pointer}.sxm .btn .ico{width:17px;height:17px}
.sxm .flag{background:rgba(224,162,59,.14);border-color:rgba(224,162,59,.5);color:var(--amber)}
.sxm .appr{background:linear-gradient(180deg,#6cc77c,var(--green));color:#08230f}
.sxm .tabbar{height:74px;flex:none;display:flex;align-items:flex-start;padding:9px 8px 0;background:#0e1015;border-top:1px solid var(--hair)}
.sxm .tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--faint);font-size:9.5px;font-weight:600;background:none;border:none;cursor:pointer}.sxm .tab .ico{width:22px;height:22px}.sxm .tab.on{color:var(--gold2)}
.sxm .tab .b{width:46px;height:30px;border-radius:11px;display:grid;place-items:center}.sxm .tab.on .b{background:rgba(198,164,99,.15)}
`;
const TABS = [
  { k: 'home', lbl: 'Home', d: <path d="M3 11l9-8 9 8M5 10v10h14V10" /> },
  { k: 'library', lbl: 'Library', d: <path d="M4 4h6v16H4zM14 4h6v16h-6z" /> },
  { k: 'reader', lbl: 'Reader', d: <path d="M6 2h9l5 5v15H6z" /> },
  { k: 'breakdown', lbl: 'Breakdown', d: <path d="M12 2l9 5-9 5-9-5z" /> },
  { k: 'doctor', lbl: 'Doctor', d: <path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9z" /> },
];

export default function ScriptOnReaderMobile(props: {
  projectTitle: string; revisionLabel?: string; sceneCount: number;
  scenes: SxScene[]; activeId?: string; sceneRead: SxSceneRead;
  onAction: (a: string) => void; onRun: () => void; onNav: (k: string) => void; onBack: () => void;
}) {
  const { dir, t } = useLocale();
  const active = props.scenes.find((s) => s.id === props.activeId) || props.scenes[0];
  const fmt = (s?: SxScene) => s ? (s.slugline || [s.intExt, s.dayNight].filter(Boolean).join('. ').toUpperCase() || 'SCENE') : 'NO SCENE';
  const paras = (active?.description || '').split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const sr = props.sceneRead;
  return (
    <div className="sxm" dir={dir}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mtop">
        <button className="bk" onClick={props.onBack}><svg className="ico" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg></button>
        <div className="ti"><div className="t1">{fmt(active)}</div><div className="t2">{t('Scene')} {active?.sceneNumber || '—'} {t('of')} {props.sceneCount} · {props.revisionLabel || ''}</div></div>
        <button className="dr" onClick={props.onRun} title={t('Run diagnostics')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9z" /></svg></button>
      </div>
      <div className="mbody">
        <div className="mscript"><div className="page"><div className="sh">{fmt(active)}</div>{paras.length ? paras.map((p, i) => <div className="ac" key={i}>{p}</div>) : <div className="ac" style={{ color: '#6f6b60' }}>{t('No action text for this scene.')}</div>}</div></div>
        <div className="sheet">
          <div className="grab" />
          <div className="sh-h"><span className="t">{t('Doctor')} · {t('Scene')} {active?.sceneNumber || '—'}</span>{sr?.verdict && <span className="badge">{sr.verdict}</span>}</div>
          <div className="kvr"><span className="k">{t('Wants')}</span><span className="v">{sr?.wants || '—'}</span></div>
          <div className="kvr"><span className="k">{t('Obstacle')}</span><span className="v">{sr?.obstacle || '—'}</span></div>
          <div className="chips">
            <button className="achip" onClick={() => props.onAction('diagnose')}><svg className="ico" viewBox="0 0 24 24"><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>{t('Diagnose')}</button>
            <button className="achip" onClick={() => props.onAction('rewrite')}><svg className="ico" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>{t('Rewrite')}</button>
            <button className="achip" onClick={() => props.onAction('notes')}><svg className="ico" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>{t('Note')}</button>
            <button className="achip" onClick={() => props.onAction('breakdown')}><svg className="ico" viewBox="0 0 24 24"><path d="M12 2l9 5-9 5-9-5z" /></svg>{t('Sides')}</button>
          </div>
          <div className="row2"><button className="btn flag" onClick={() => props.onAction('flag')}><svg className="ico" viewBox="0 0 24 24"><path d="M4 21V4h12l-2 4 2 4H4" /></svg>{t('Flag')}</button><button className="btn appr" onClick={() => props.onAction('approve')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#08230f' }}><path d="M20 6L9 17l-5-5" /></svg>{t('Approve')}</button></div>
        </div>
      </div>
      <div className="tabbar">{TABS.map((tab) => <button key={tab.k} className={'tab' + (tab.k === 'reader' ? ' on' : '')} onClick={() => tab.k !== 'reader' && props.onNav(tab.k)}><div className="b"><svg className="ico" viewBox="0 0 24 24">{tab.d}</svg></div>{t(tab.lbl)}</button>)}</div>
    </div>
  );
}
