'use client';
/**
 * ScriptON Doctor — Script Reader (carbon-copy of design/ScriptHub-Reader-Desktop-HiFi.html).
 * Presentational shell; all data + actions are passed in by the /scripon page.
 * CSS is the locked design, namespaced under `.sx` so it cannot leak into the app.
 */
import React from 'react';
import { SxRail } from './ScriptOnStudio';
import { useLocale } from '@/lib/i18n';

export type SxScene = { id: string; sceneNumber?: string; slugline?: string; intExt?: string; dayNight?: string; description?: string; pages?: string; status?: 'tagged' | 'attn' | 'todo' };
export type SxSceneRead = { verdict?: string; wants?: string; obstacle?: string; subtext?: string; power?: string; confidence?: string } | null;
export type SxTab = 'Doctor' | 'Breakdown' | 'Notes' | 'Revisions' | 'Production';

const CSS = `
.sx{--bg:#0b0c0f;--chrome:#121419;--chrome2:#171a20;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.12);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--paper:#F7F4EC;--ink:#23231f;--ink2:#3a3a34;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--violet:#8b7cf0;position:relative;display:flex;flex-direction:column;height:100%;background:var(--bg);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx *{box-sizing:border-box;margin:0;padding:0}
.sx:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(700px 280px at 72% -6%,rgba(198,164,99,.10),transparent 70%);z-index:0}
.sx svg{display:block}
.sx .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx .tl{display:flex;align-items:center;gap:12px}
.sx .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;letter-spacing:-.5px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer}
.sx .proj{font-weight:700;font-size:15.5px;color:var(--cream);letter-spacing:-.2px;cursor:pointer}
.sx .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.3px}
.sx .pill .d{width:7px;height:7px;border-radius:50%}
.sx .meta{color:var(--faint);font-size:12px;font-weight:500}
.sx .tr{display:flex;align-items:center;gap:8px}
.sx .btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;color:var(--text);white-space:nowrap;background:transparent}
.sx .btn .ico{width:15px;height:15px}
.sx .btn.ghost{background:#1b1e25;border-color:var(--hair);color:var(--mute)}
.sx .btn.kbd{background:transparent;border:1px solid var(--hair);color:var(--faint);font-family:var(--sx-body);gap:4px}
.sx .btn.kbd kbd{font:inherit;color:var(--mute)}
.sx .btn.outline{background:#1c1d1a;border-color:rgba(198,164,99,.55);color:var(--gold2)}
.sx .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;box-shadow:0 6px 18px -4px rgba(198,164,99,.45),inset 0 1px 0 rgba(255,255,255,.3)}
.sx .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx .rail{width:74px;flex:0 0 74px;background:#0e1015;border-right:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px}
.sx .ritem{width:56px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);cursor:pointer;position:relative;border:none;background:transparent}
.sx .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mute)}
.sx .ritem .lbl{font-size:9px;font-weight:600;letter-spacing:.2px}
.sx .ritem:hover .box{border-color:var(--hair2);color:var(--cream)}
.sx .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink);box-shadow:0 6px 16px -4px rgba(198,164,99,.5)}
.sx .ritem.on .lbl{color:var(--gold2)}
.sx .ritem.on:before{content:"";position:absolute;left:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
.sx .nav{width:284px;flex:0 0 284px;background:var(--panel);border-right:1px solid var(--hair);display:flex;flex-direction:column}
.sx .navhd{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 10px}
.sx .eyebrow{font-size:11px;font-weight:700;letter-spacing:1.4px;color:var(--gold)}
.sx .navhd .n{font-size:11px;color:var(--faint);font-weight:600}
.sx .search{margin:0 14px 8px;display:flex;align-items:center;gap:8px;height:34px;padding:0 10px;background:#1a1d24;border:1px solid var(--hair);border-radius:9px;color:var(--faint);font-size:12.5px}
.sx .search .ico{width:14px;height:14px}
.sx .search input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:inherit;font-size:12.5px}
.sx .search input::placeholder{color:var(--faint)}
.sx .rows{flex:1;overflow:auto;padding:4px 10px;display:flex;flex-direction:column;gap:3px}
.sx .row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;cursor:pointer;border:1px solid transparent;text-align:left}
.sx .row:hover{background:#191c23}
.sx .row .num{width:22px;text-align:right;font-size:11px;font-weight:700;color:var(--faint);font-variant-numeric:tabular-nums}
.sx .row .slug{flex:1;font-size:12.5px;color:var(--mute);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sx .row .pg{font-size:10.5px;color:var(--faint);font-variant-numeric:tabular-nums}
.sx .row .dot{width:8px;height:8px;border-radius:50%;flex:none}
.sx .row.on{background:rgba(198,164,99,.12);border-color:rgba(198,164,99,.4)}
.sx .row.on .slug{color:var(--cream);font-weight:600}.sx .row.on .num{color:var(--gold2)}
.sx .canvas{flex:1;min-width:0;background:radial-gradient(900px 500px at 50% 0,#101218,#0b0c0f);display:flex;justify-content:center;padding:34px 0;overflow:auto}
.sx .page{width:642px;align-self:flex-start;background:var(--paper);border-radius:7px;padding:54px 74px;box-shadow:0 30px 70px -20px rgba(0,0,0,.7),0 2px 0 rgba(255,255,255,.04);color:var(--ink);font-family:"Courier Prime",ui-monospace,monospace;font-size:14.5px;line-height:1.62;position:relative}
.sx .page .pgno{position:absolute;top:30px;right:46px;font-size:12px;color:#9a968a}
.sx .sh{font-weight:700;letter-spacing:.3px;margin-bottom:14px}
.sx .ac{margin-bottom:14px}
.sx .dlg{margin:0 0 14px;padding-left:118px;padding-right:70px}
.sx .ch{font-weight:700;text-align:center;margin-left:-40px}
.sx .par{text-align:center;margin-left:-40px;color:#6f6b60;font-size:13.5px}
.sx .tr2{text-align:right;color:#6f6b60;font-weight:700}
.sx .dock{width:372px;flex:0 0 372px;background:var(--panel);border-left:1px solid var(--hair);display:flex;flex-direction:column}
.sx .tabs{display:flex;gap:4px;padding:14px 16px 0}
.sx .tab{font-size:12.5px;font-weight:600;color:var(--faint);padding:8px 10px;border-radius:8px;cursor:pointer;position:relative;border:none;background:transparent}
.sx .tab:hover{color:var(--mute)}
.sx .tab.on{color:var(--gold2);background:#1b1e25}
.sx .dscroll{flex:1;overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:14px}
.sx .ctx .l{font-size:11px;font-weight:700;letter-spacing:.6px;color:var(--gold)}
.sx .ctx .s{font-size:11.5px;color:var(--faint);margin-top:3px}
.sx .grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.sx .tile{background:linear-gradient(180deg,#1b1e25,#171a20);border:1px solid var(--hair);border-radius:12px;padding:13px;cursor:pointer;transition:border-color .15s;text-align:left}
.sx .tile:hover{border-color:rgba(198,164,99,.4)}
.sx .tile .ti{width:30px;height:30px;border-radius:9px;background:rgba(198,164,99,.14);display:grid;place-items:center;color:var(--gold2);margin-bottom:9px}
.sx .tile .ti .ico{width:16px;height:16px}
.sx .tile .tt{font-size:13.5px;font-weight:600;color:var(--cream)}
.sx .tile .ts{font-size:10.5px;color:var(--faint);margin-top:2px}
.sx .card{background:#171a20;border:1px solid var(--hair);border-radius:14px;padding:14px}
.sx .card .ch2{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.sx .kv{display:flex;gap:10px;margin-bottom:7px}
.sx .kv .k{width:58px;flex:none;font-size:11px;color:var(--faint);font-weight:600;padding-top:1px}
.sx .kv .v{font-size:12px;color:var(--text);line-height:1.45}
.sx .badge{font-size:10px;font-weight:800;letter-spacing:.4px;padding:4px 9px;border-radius:999px}
.sx .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}
.sx .badge.green{background:rgba(87,179,104,.16);color:var(--green)}
.sx .badge.red{background:rgba(229,99,95,.16);color:#e5635f}
.sx .conf{margin-top:6px}
.sx .conf .cl{font-size:10.5px;color:var(--faint);margin-bottom:5px;display:flex;justify-content:space-between}
.sx .meter{height:7px;border-radius:5px;background:#23262e;overflow:hidden}
.sx .meter i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,var(--gold),var(--gold2))}
.sx .run{margin-top:2px;height:46px;border-radius:12px;background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;font-size:13.5px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;box-shadow:0 10px 26px -8px rgba(198,164,99,.5),inset 0 1px 0 rgba(255,255,255,.3);border:none;width:100%}
.sx .run .ico{width:16px;height:16px;stroke-width:2}
.sx .empty{font-size:12px;color:var(--faint);border:1px dashed var(--hair2);border-radius:12px;padding:20px 16px;text-align:center;line-height:1.5}
.sx .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px;box-shadow:0 14px 40px -12px rgba(0,0,0,.7)}
`;

const CONF_W: Record<string, number> = { High: 84, Medium: 58, Low: 38 };

function Tile({ k, title, sub, icon, onClick }: { k: string; title: string; sub: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button className="tile" onClick={onClick} aria-label={title}>
      <div className="ti">{icon}</div>
      <div className="tt">{title}</div>
      <div className="ts">{sub}</div>
    </button>
  );
}

export default function ScriptOnReader(props: {
  projectTitle: string; revisionLabel?: string; revisionColor?: string; pageCount?: number | string; sceneCount: number; updated?: string;
  scenes: SxScene[]; activeId?: string; onSelectScene: (id: string) => void; search: string; onSearch: (v: string) => void;
  sceneRead: SxSceneRead; reading?: boolean;
  activeTab: SxTab; onTab: (t: SxTab) => void; revisions?: { id: string; label: string; color?: string; date?: string }[];
  onAction: (a: string) => void; onRun: () => void; onBack: () => void; onLibrary: () => void; toast?: string | null;
}) {
  const { dir, t } = useLocale();
  const { scenes, activeId } = props;
  const active = scenes.find((s) => s.id === activeId) || scenes[0];
  const revColor = props.revisionColor || '#5b8def';
  const dotColor = (s: SxScene) => (s.status === 'tagged' ? 'var(--green)' : s.status === 'attn' ? 'var(--gold)' : 'var(--faint)');
  const fmtSlug = (s: SxScene) => s.slugline || [s.intExt, s.dayNight].filter(Boolean).join('. ').toUpperCase() || 'SCENE';
  const paras = (active?.description || '').split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
  const sr = props.sceneRead;
  const confW = sr?.confidence ? (CONF_W[sr.confidence] ?? 84) : 84;
  const verdictClass = sr?.verdict === 'CUT' ? 'red' : sr?.verdict === 'KEEP' ? 'green' : 'amber';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        {/* TOP BAR */}
        <div className="top">
          <div className="tl">
            <div className="logo" onClick={props.onBack} title={t('Back to TFM')}>TFM</div>
            <div className="proj" onClick={props.onBack}>{props.projectTitle}</div>
            <span className="pill" style={{ background: revColor + '28', color: revColor }}><span className="d" style={{ background: revColor }} />{(props.revisionLabel || 'DRAFT').toUpperCase()}</span>
            <span className="meta">{props.pageCount ? props.pageCount + ' pp · ' : ''}{props.sceneCount} {t('scenes')}{props.updated ? ' · ' + props.updated : ''}</span>
          </div>
          <div className="tr">
            <button className="btn kbd" onClick={() => props.onAction('cmdk')}><kbd>⌘K</kbd></button>
            <button className="btn ghost" onClick={() => props.onAction('compare')}><svg className="ico" viewBox="0 0 24 24"><path d="M16 3l5 5-5 5M21 8H9M8 21l-5-5 5-5M3 16h12" /></svg>{t('Compare')}</button>
            <button className="btn ghost" onClick={() => props.onAction('distribute')}><svg className="ico" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>{t('Distribute')}</button>
            <button className="btn outline" onClick={() => props.onAction('breakdown')}><svg className="ico" viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" /></svg>{t('Breakdown')}</button>
            <button className="btn gold" onClick={() => props.onTab('Doctor')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9l5.6-.4z" /></svg>{t('Doctor')}</button>
          </div>
        </div>
        {/* BODY */}
        <div className="body">
          {/* RAIL */}
          <SxRail active="reader" />
          {/* NAVIGATOR */}
          <div className="nav">
            <div className="navhd"><span className="eyebrow">{t('SCENES')}</span><span className="n">{props.sceneCount}</span></div>
            <div className="search"><svg className="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg><input value={props.search} onChange={(e) => props.onSearch(e.target.value)} placeholder={t('Search scenes…')} /></div>
            <div className="rows">
              {scenes.map((s, i) => (
                <button key={s.id} className={'row' + (s.id === active?.id ? ' on' : '')} onClick={() => props.onSelectScene(s.id)}>
                  <span className="num">{s.sceneNumber || i + 1}</span>
                  <span className="slug">{fmtSlug(s)}</span>
                  <span className="dot" style={{ background: dotColor(s) }} />
                  <span className="pg">{s.pages || ''}</span>
                </button>
              ))}
              {scenes.length === 0 && <div className="empty" style={{ margin: 8 }}>{t('No scenes in this revision yet.')}</div>}
            </div>
          </div>
          {/* CANVAS */}
          <div className="canvas">
            <div className="page">
              <div className="pgno">{active?.sceneNumber ? active.sceneNumber + '.' : ''}</div>
              <div className="sh">{active ? fmtSlug(active) : t('NO SCENE SELECTED')}</div>
              {paras.length ? paras.map((p, i) => <div className="ac" key={i}>{p}</div>) : <div className="ac" style={{ color: '#6f6b60' }}>{t('No action text captured for this scene.')}</div>}
            </div>
          </div>
          {/* DOCK */}
          <div className="dock">
            <div className="tabs">
              {(['Doctor', 'Breakdown', 'Notes', 'Revisions', 'Production'] as SxTab[]).map((tabName) => (
                <button key={tabName} className={'tab' + (props.activeTab === tabName ? ' on' : '')} onClick={() => (tabName === 'Notes' ? props.onAction('notes') : tabName === 'Revisions' ? props.onAction('compare') : props.onTab(tabName))}>{t(tabName)}</button>
              ))}
            </div>
            <div className="dscroll">
              {props.activeTab === 'Doctor' && (
                <>
                  <div className="ctx"><div className="l">{t('SCENE')} {active?.sceneNumber || '—'} · {active ? fmtSlug(active) : ''}</div><div className="s">{t('Every action below applies to this scene.')}</div></div>
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 9 }}>{t('AI ACTIONS')}</div>
                    <div className="grid">
                      <Tile k="diagnose" title={t('Diagnose')} sub={t('scene read')} onClick={() => props.onAction('diagnose')} icon={<svg className="ico" viewBox="0 0 24 24"><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>} />
                      <Tile k="rewrite" title={t('Rewrite')} sub={t('variants')} onClick={() => props.onAction('rewrite')} icon={<svg className="ico" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>} />
                      <Tile k="coverage" title={t('Coverage')} sub={t('house format')} onClick={() => props.onAction('coverage')} icon={<svg className="ico" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6zM15 2v5h5M9 13h7M9 17h5" /></svg>} />
                      <Tile k="compare" title={t('Compare')} sub={t('vs prev')} onClick={() => props.onAction('compare')} icon={<svg className="ico" viewBox="0 0 24 24"><path d="M16 3l5 5-5 5M21 8H9M8 21l-5-5 5-5M3 16h12" /></svg>} />
                      <Tile k="budgetfit" title={t('Budget-fit')} sub={t('to target')} onClick={() => props.onAction('budgetfit')} icon={<svg className="ico" viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>} />
                      <Tile k="develop" title={t('Develop')} sub={t('expand')} onClick={() => props.onAction('develop')} icon={<svg className="ico" viewBox="0 0 24 24"><path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" /></svg>} />
                    </div>
                  </div>
                  <div className="card">
                    <div className="ch2"><span className="eyebrow">{t('SCENE READ')}</span>{sr?.verdict && <span className={'badge ' + verdictClass}>{sr.verdict}</span>}</div>
                    {props.reading ? (
                      <div className="empty" style={{ border: 'none', padding: '8px 0' }}>{t('Reading this scene…')}</div>
                    ) : sr ? (
                      <>
                        <div className="kv"><div className="k">{t('Wants')}</div><div className="v">{sr.wants || '—'}</div></div>
                        <div className="kv"><div className="k">{t('Obstacle')}</div><div className="v">{sr.obstacle || '—'}</div></div>
                        <div className="kv"><div className="k">{t('Subtext')}</div><div className="v">{sr.subtext || '—'}</div></div>
                        <div className="kv"><div className="k">{t('Power')}</div><div className="v">{sr.power || '—'}</div></div>
                        <div className="conf"><div className="cl"><span>{t('AI confidence')}</span><span style={{ color: 'var(--gold2)', fontWeight: 700 }}>{sr.confidence || 'High'}</span></div><div className="meter"><i style={{ width: confW + '%' }} /></div></div>
                      </>
                    ) : (
                      <div className="empty" style={{ border: 'none', padding: '8px 0' }}>{t('Run diagnostics to read this scene — wants, obstacle, subtext and the power shift.')}</div>
                    )}
                  </div>
                  <button className="run" onClick={props.onRun}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>{t('Run diagnostics on this scene')}</button>
                </>
              )}
              {props.activeTab === 'Revisions' && (
                <div className="card">
                  <div className="ch2"><span className="eyebrow">{t('REVISIONS')}</span></div>
                  {(props.revisions || []).map((r) => (
                    <div className="kv" key={r.id}><div className="k" style={{ width: 'auto' }}><span className="dot" style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 9, background: r.color || 'var(--faint)' }} /></div><div className="v" style={{ flex: 1 }}>{r.label}<span style={{ color: 'var(--faint)', marginLeft: 8 }}>{r.date || ''}</span></div></div>
                  ))}
                  {!(props.revisions || []).length && <div className="empty" style={{ border: 'none' }}>{t('No revisions yet.')}</div>}
                </div>
              )}
              {props.activeTab === 'Breakdown' && <div className="empty">{t('Run a breakdown to tag the elements in this scene (cast, props, locations, wardrobe, vehicles, VFX).')}</div>}
              {props.activeTab === 'Notes' && <div className="empty">{t('No notes on this scene yet. Notes you add are pinned to the scene and threaded.')}</div>}
              {props.activeTab === 'Production' && <div className="empty">{t('This scene isn’t on the stripboard yet. Sync to Schedule to plan its shoot day.')}</div>}
            </div>
          </div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
