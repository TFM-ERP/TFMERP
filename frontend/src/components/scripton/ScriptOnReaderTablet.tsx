'use client';
/** ScriptON Doctor — Reader · TABLET (review-first), carbon-copy of design/tablet-reader.html. Wired to the same props. */
import React from 'react';
import type { SxScene, SxSceneRead } from './ScriptOnReader';
import { useLocale } from '@/lib/i18n';

const CSS = `
.sxt{--bg:#0b0c0f;--panel:#14161c;--hair:rgba(255,255,255,.08);--hair2:rgba(255,255,255,.14);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--paper:#F7F4EC;--ink:#23231f;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;background:radial-gradient(1000px 500px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sxt *{box-sizing:border-box;margin:0;padding:0}
.sxt .ico{stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round;display:block;width:18px;height:18px}
.sxt .top{height:62px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair)}
.sxt .tl{display:flex;align-items:center;gap:11px}.sxt .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;cursor:pointer}
.sxt .proj{font-weight:700;font-size:15px;color:var(--cream)}
.sxt .pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700}.sxt .pill .d{width:7px;height:7px;border-radius:50%}
.sxt .seg{display:flex;gap:4px;background:#10131a;border:1px solid var(--hair);border-radius:11px;padding:4px}
.sxt .segtab{display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:8px;font-size:12.5px;font-weight:600;color:var(--mute);cursor:pointer;border:none;background:transparent}.sxt .segtab .ico{width:15px;height:15px}
.sxt .segtab.on{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink)}
.sxt .btn{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 16px;border-radius:11px;font-size:13.5px;font-weight:700;cursor:pointer;border:1px solid transparent}.sxt .btn .ico{width:16px;height:16px}
.sxt .flag{background:rgba(224,162,59,.14);border-color:rgba(224,162,59,.5);color:var(--amber)}
.sxt .appr{background:linear-gradient(180deg,#6cc77c,var(--green));color:#08230f}
.sxt .strip{height:50px;flex:none;display:flex;align-items:center;gap:10px;padding:0 18px;background:#0e1015;border-bottom:1px solid var(--hair)}
.sxt .scount{font-size:11px;font-weight:700;color:var(--faint);letter-spacing:.4px;flex:none}
.sxt .film{display:flex;gap:6px;overflow:auto;flex:1}
.sxt .fchip{display:flex;align-items:center;gap:6px;padding:6px 11px;border-radius:8px;background:#171a20;border:1px solid var(--hair);font-size:11.5px;color:var(--mute);font-weight:600;white-space:nowrap;cursor:pointer}
.sxt .fchip .fd{width:6px;height:6px;border-radius:50%}.sxt .fchip.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:var(--gold2)}
.sxt .body{flex:1;display:grid;grid-template-columns:1.5fr 1fr;min-height:0}
.sxt .canvas{background:radial-gradient(120% 90% at 50% 0,#101218,#0a0b0e);display:flex;justify-content:center;padding:26px;overflow:auto}
.sxt .page{width:560px;align-self:flex-start;background:var(--paper);color:var(--ink);border-radius:6px;padding:40px 56px;font-family:'Courier Prime',ui-monospace,monospace;font-size:13.5px;line-height:1.95;box-shadow:0 30px 70px -20px rgba(0,0,0,.7)}
.sxt .sh{font-weight:700;margin-bottom:12px}.sxt .ac{margin-bottom:12px}
.sxt .dock{background:#101217;border-left:1px solid var(--hair);display:flex;flex-direction:column;overflow:hidden}
.sxt .dh{padding:13px 16px;border-bottom:1px solid var(--hair);display:flex;align-items:center;justify-content:space-between}.sxt .dh .t{font-size:13px;font-weight:700;color:var(--cream)}
.sxt .eyebrow{font-size:10.5px;font-weight:700;letter-spacing:1.3px;color:var(--gold)}
.sxt .dbody{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:14px}
.sxt .kv{display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--hair);font-size:12.5px}.sxt .kv:first-of-type{border-top:none}.sxt .kv .k{color:var(--faint)}.sxt .kv .v{color:var(--text);font-weight:600}
.sxt .card{background:var(--panel);border:1px solid var(--hair);border-radius:13px;padding:14px;display:flex;flex-direction:column;gap:9px}
.sxt .qa{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.sxt .tile{background:linear-gradient(180deg,#1b1e25,#171a20);border:1px solid var(--hair);border-radius:11px;padding:12px;cursor:pointer;text-align:left}
.sxt .tile .ti{width:30px;height:30px;border-radius:9px;background:rgba(198,164,99,.14);display:grid;place-items:center;color:var(--gold2);margin-bottom:8px}.sxt .tile .ti .ico{width:16px;height:16px}
.sxt .tile .tt{font-size:12.5px;font-weight:600;color:var(--cream)}
.sxt .badge{font-size:10px;font-weight:800;padding:4px 9px;border-radius:999px;background:rgba(224,162,59,.16);color:var(--amber)}
.sxt .mtr{height:6px;border-radius:4px;background:#23262e;overflow:hidden}.sxt .mtr i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2))}
.sxt .run{height:46px;border-radius:13px;background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;border:none}.sxt .run .ico{width:17px;height:17px;stroke:#1a1509}
`;
const SEG = [
  { k: 'library', lbl: 'Library', d: <path d="M4 4h6v16H4z" /> },
  { k: 'reader', lbl: 'Reader', d: <path d="M6 2h9l5 5v15H6z" /> },
  { k: 'breakdown', lbl: 'Breakdown', d: <path d="M12 2l9 5-9 5-9-5z" /> },
  { k: 'doctor', lbl: 'Doctor', d: <path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9z" /> },
];
const CONF_W: Record<string, number> = { High: 84, Medium: 58, Low: 38 };

export default function ScriptOnReaderTablet(props: {
  projectTitle: string; revisionLabel?: string; revisionColor?: string; sceneCount: number;
  scenes: SxScene[]; activeId?: string; onSelectScene: (id: string) => void; sceneRead: SxSceneRead; reading?: boolean;
  onAction: (a: string) => void; onRun: () => void; onNav: (k: string) => void; onBack: () => void;
}) {
  const { dir, t } = useLocale();
  const active = props.scenes.find((s) => s.id === props.activeId) || props.scenes[0];
  const fmt = (s?: SxScene) => s ? (s.slugline || [s.intExt, s.dayNight].filter(Boolean).join('. ').toUpperCase() || 'SCENE') : 'NO SCENE';
  const paras = (active?.description || '').split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const sr = props.sceneRead; const confW = sr?.confidence ? (CONF_W[sr.confidence] ?? 84) : 84;
  const rc = props.revisionColor || '#5b8def';
  return (
    <div className="sxt" dir={dir}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="top">
        <div className="tl"><div className="logo" onClick={props.onBack}>TFM</div><div className="proj">{props.projectTitle}</div><span className="pill" style={{ background: rc + '28', color: rc }}><span className="d" style={{ background: rc }} />{(props.revisionLabel || 'DRAFT').toUpperCase()}</span></div>
        <div className="seg">{SEG.map((seg) => <button key={seg.k} className={'segtab' + (seg.k === 'reader' ? ' on' : '')} onClick={() => seg.k !== 'reader' && props.onNav(seg.k)}><svg className="ico" viewBox="0 0 24 24">{seg.d}</svg>{t(seg.lbl)}</button>)}</div>
        <div style={{ display: 'flex', gap: 9 }}><button className="btn flag" onClick={() => props.onAction('flag')}><svg className="ico" viewBox="0 0 24 24"><path d="M4 21V4h12l-2 4 2 4H4" /></svg>{t('Flag')}</button><button className="btn appr" onClick={() => props.onAction('approve')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#08230f' }}><path d="M20 6L9 17l-5-5" /></svg>{t('Approve scene')}</button></div>
      </div>
      <div className="strip">
        <span className="scount">{t('SCENE')} {active?.sceneNumber || '—'} / {props.sceneCount}</span>
        <div className="film">{props.scenes.map((s) => <button key={s.id} className={'fchip' + (s.id === active?.id ? ' on' : '')} onClick={() => props.onSelectScene(s.id)}><span className="fd" style={{ background: s.status === 'tagged' ? 'var(--green)' : s.status === 'attn' ? 'var(--gold)' : 'var(--faint)' }} />{s.sceneNumber} · {(s.slugline || '').split(' — ')[0].replace(/^(INT|EXT)\.?\s*/i, '').slice(0, 14)}</button>)}</div>
      </div>
      <div className="body">
        <div className="canvas"><div className="page"><div className="sh">{fmt(active)}</div>{paras.length ? paras.map((p, i) => <div className="ac" key={i}>{p}</div>) : <div className="ac" style={{ color: '#6f6b60' }}>{t('No action text for this scene.')}</div>}</div></div>
        <div className="dock">
          <div className="dh"><span className="t">{t('Doctor')} · {t('Scene')} {active?.sceneNumber || '—'}</span><span className="eyebrow">{t('READ')}</span></div>
          <div className="dbody">
            <div className="card">
              <div className="kv"><span className="k">{t('Wants')}</span><span className="v">{sr?.wants || '—'}</span></div>
              <div className="kv"><span className="k">{t('Obstacle')}</span><span className="v">{sr?.obstacle || '—'}</span></div>
              <div className="kv"><span className="k">{t('Subtext')}</span><span className="v">{sr?.subtext || '—'}</span></div>
              {sr?.verdict && <div className="kv"><span className="k">{t('Turn')}</span><span className="badge">{sr.verdict}</span></div>}
              <div style={{ marginTop: 4 }}><div className="eyebrow" style={{ marginBottom: 6 }}>{t('CONFIDENCE')} {sr ? (sr.confidence || 'High') : '—'}</div><div className="mtr"><i style={{ width: (sr ? confW : 0) + '%' }} /></div></div>
            </div>
            <div className="card" style={{ flex: 1 }}>
              <div className="dh" style={{ padding: 0, border: 'none' }}><span className="t" style={{ fontSize: 12.5 }}>{t('Scene actions')}</span><span className="eyebrow">{t('VISIBLE')}</span></div>
              <div className="qa">
                <button className="tile" onClick={() => props.onAction('diagnose')}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><path d="M3 12h4l2 6 4-14 2 8h6" /></svg></div><div className="tt">{t('Diagnose')}</div></button>
                <button className="tile" onClick={() => props.onAction('rewrite')}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg></div><div className="tt">{t('Rewrite')}</div></button>
                <button className="tile" onClick={() => props.onAction('notes')}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg></div><div className="tt">{t('Note')}</div></button>
                <button className="tile" onClick={() => props.onAction('breakdown')}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><path d="M12 2l9 5-9 5-9-5z" /></svg></div><div className="tt">{t('Breakdown')}</div></button>
              </div>
            </div>
            <button className="run" onClick={props.onRun}><svg className="ico" viewBox="0 0 24 24"><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>{props.reading ? t('Reading…') : t('Run diagnostics')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
