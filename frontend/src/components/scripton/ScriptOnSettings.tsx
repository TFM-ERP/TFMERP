'use client';
/** ScriptON Doctor — Settings & Governance (carbon-copy of design/settings.html). The AI spine, made legible.
 *  Self-contained, namespaced `.sx`. Audit log + model + gates (governance wiring partial — honest). */
import React from 'react';
import { SxRail } from './ScriptOnStudio';
import { useLocale } from '@/lib/i18n';
import ReviewProtectionPanel from './ReviewProtectionPanel';
import { aiEnginesApi, scriptAudioApi, videoEnginesApi } from '@/lib/api';

export type SxRun = { surface: string; model: string; tokens: string; conf: number; status: string; statusClass: string; when: string };

const CSS = `
.sx{--bg:#0b0c0f;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--red:#e5635f;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx *{box-sizing:border-box;margin:0;padding:0}
.sx:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(700px 280px at 72% -6%,rgba(198,164,99,.09),transparent 70%);z-index:0}
.sx svg{display:block}
.sx .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx .tl{display:flex;align-items:center;gap:12px}
.sx .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer}
.sx .proj{font-weight:700;font-size:15.5px;color:var(--cream)}
.sx .meta{color:var(--faint);font-size:12px;font-weight:500}
.sx .tr{display:flex;align-items:center;gap:8px}
.sx .btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;color:var(--text);white-space:nowrap;background:transparent}
.sx .btn .ico{width:15px;height:15px}
.sx .btn.ghost{background:#1b1e25;border-color:var(--hair);color:var(--mute)}
.sx .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;box-shadow:0 6px 18px -4px rgba(198,164,99,.45),inset 0 1px 0 rgba(255,255,255,.3)}
.sx .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx .main{flex:1;min-width:0;display:flex;flex-direction:column}
.sx .content{flex:1;overflow:hidden;padding:24px 30px;display:flex;flex-direction:column;gap:16px}
.sx .phead h1{font-size:24px;font-weight:800;color:var(--cream);letter-spacing:-.5px}
.sx .sub{font-size:13px;color:var(--mute);margin-top:4px}
.sx .eyebrow{font-size:11px;font-weight:700;letter-spacing:1.4px;color:var(--gold)}
.sx .setgrid{flex:1;display:grid;grid-template-columns:226px 1fr;gap:16px;min-height:0}
.sx .subnav{display:flex;flex-direction:column;gap:3px}
.sx .sni{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:10px;font-size:13px;font-weight:600;color:var(--mute);cursor:pointer;border:none;background:transparent;text-align:start}
.sx .sni .ico{width:16px;height:16px}
.sx .sni:hover{background:#171a20;color:var(--cream)}
.sx .sni.on{background:rgba(198,164,99,.13);color:var(--gold2)}
.sx .setmain{overflow:auto;display:flex;flex-direction:column;gap:14px}
.sx .kpis{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:12px}
.sx .panelcard{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:8px}
.sx .toggle{width:42px;height:24px;border-radius:999px;background:linear-gradient(90deg,var(--gold),var(--gold2));position:relative;flex:none;cursor:pointer;border:none}
.sx .toggle.off{background:#2a2f39}
.sx .toggle:after{content:"";position:absolute;width:18px;height:18px;border-radius:50%;background:#fff;top:3px;right:3px}
.sx .toggle.off:after{right:auto;left:3px}
.sx .slider{height:6px;border-radius:4px;background:#23262e;position:relative;margin:14px 0 6px}
.sx .slider i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:linear-gradient(90deg,var(--gold),var(--gold2))}
.sx .slider .knob{position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;top:-5px;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.sx .gtable{flex:1;background:var(--panel);border:1px solid var(--hair);border-radius:13px;overflow:hidden;display:flex;flex-direction:column}
.sx .gthead,.sx .gtr{display:grid;grid-template-columns:1.4fr 1.5fr .8fr 1.1fr .9fr .7fr;align-items:center;gap:10px;padding:11px 16px}
.sx .gthead{border-bottom:1px solid var(--hair);font-size:10.5px;font-weight:700;letter-spacing:.4px;color:var(--faint);background:#101319}
.sx .gtr{border-bottom:1px solid var(--hair);font-size:12px}
.sx .gsf{font-weight:600;color:var(--cream)}.sx .gmodel{color:var(--mute);font-family:'Courier Prime',ui-monospace,monospace;font-size:11px}.sx .gtok{color:var(--mute)}.sx .gwhen{color:var(--faint);font-size:11px}
.sx .gconf{display:flex;align-items:center;gap:8px;color:var(--mute)}.sx .cbar{width:46px;height:5px;border-radius:3px;background:#23262e;overflow:hidden}.sx .cbar i{display:block;height:100%;background:var(--green)}
.sx .badge{font-size:10px;font-weight:800;padding:4px 9px;border-radius:999px}.sx .badge.green{background:rgba(87,179,104,.16);color:var(--green)}.sx .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}
.sx .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px;box-shadow:0 14px 40px -12px rgba(0,0,0,.7)}
.sx .liverow{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.sx .livecard{flex-direction:row !important;align-items:center;gap:12px}
.sx .ldot{width:10px;height:10px;border-radius:50%;flex:none}
.sx .rfilters{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.sx .fchip{font-size:11.5px;font-weight:600;color:var(--mute);background:var(--panel2);border:1px solid var(--hair);border-radius:999px;padding:5px 11px;cursor:pointer}
.sx .fchip.on{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);border-color:transparent}
.sx .fsel{font-size:11.5px;color:var(--text);background:var(--panel2);border:1px solid var(--hair);border-radius:999px;padding:5px 10px;cursor:pointer}
.sx .gthead,.sx .gtr{grid-template-columns:1.1fr 1.6fr 1.3fr 1.1fr .9fr .55fr .7fr}
.sx .gstage{color:var(--text)}.sx .gsize{color:var(--mute);font-size:11.5px}.sx .gdur{color:var(--faint);font-size:11px}
.sx .badge.red{background:rgba(229,99,95,.16);color:var(--red)}
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
const SUBNAV = [
  { k: 'workspace', label: 'Workspace', d: <path d="M3 9l9-7 9 7v11H3z" /> },
  { k: 'ai', label: 'AI Governance', d: <path d="M12 3l1.9 5.6L19.5 9l-4.5 3.3L16.8 18 12 14.7 7.2 18l1.8-5.7L4.5 9z" /> },
  { k: 'protection', label: 'Review Protection', d: <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM9 12l2 2 4-4" /> },
  { k: 'members', label: 'Members & roles', d: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" /> },
  { k: 'tenancy', label: 'Companies & tenancy', d: <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" /> },
  { k: 'integrations', label: 'Integrations', d: <path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" /> },
  { k: 'billing', label: 'Billing', d: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></> },
];

export default function ScriptOnSettings(props: {
  companyName: string; model: string; promptSet: string; confidence: number; humanApproval: boolean;
  runs: SxRun[]; runsMeta: string; onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void; toast?: string | null;
}) {
  const { dir, t } = useLocale();
  const [section, setSection] = React.useState<'ai' | 'protection'>('ai');
  const [live, setLive] = React.useState<any>({});
  const [feed, setFeed] = React.useState<any>(null);
  const [rf, setRf] = React.useState<{ hours: number; surface?: string; status?: string; size?: string }>({ hours: 24 });
  React.useEffect(() => { let ok = true; Promise.all([aiEnginesApi.health().catch(() => ({ data: null })), videoEnginesApi.health().catch(() => ({ data: null })), scriptAudioApi.engines().catch(() => ({ data: [] }))]).then(([l, v, a]: any) => { if (ok) setLive({ llm: l.data, video: v.data, audio: a.data }); }); return () => { ok = false; }; }, []);
  React.useEffect(() => { let ok = true; aiEnginesApi.runs({ hours: rf.hours, surface: rf.surface, status: rf.status, size: rf.size, limit: 60 }).then((r: any) => { if (ok) setFeed(r.data); }).catch(() => { if (ok) setFeed({ runs: [], surfaces: [], sizes: [] }); }); return () => { ok = false; }; }, [rf.hours, rf.surface, rf.status, rf.size]);
  const llmLive = (live.llm?.providers || []).filter((p: any) => p.usable).length, llmTot = (live.llm?.providers || []).length;
  const vidLive = (live.video?.providers || []).filter((p: any) => p.usable).length, vidTot = (live.video?.providers || []).length;
  const audTot = Array.isArray(live.audio) ? live.audio.length : 0, audLive = Array.isArray(live.audio) ? live.audio.filter((e: any) => e.enabled).length : 0;
  const fmtTok = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n));
  const rel = (d: string) => { const m = Math.round((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return 'now'; if (m < 60) return m + 'm'; const h = Math.round(m / 60); return h < 24 ? h + 'h' : Math.round(h / 24) + 'd'; };
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="tl"><div className="logo" onClick={props.onBack} title={t('Back to TFM')}>TFM</div><div className="proj">{props.companyName}</div><span className="meta">{t('Workspace settings · governance')}</span></div>
          <div className="tr"><button className="btn ghost" onClick={() => props.onAction('discard')}>{t('Discard')}</button><button className="btn gold" onClick={() => props.onAction('save')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M20 6L9 17l-5-5" /></svg>{t('Save changes')}</button></div>
        </div>
        <div className="body">
          <SxRail active="settings" />
          <div className="main"><div className="content">
            <div className="phead"><h1>{section === 'protection' ? t('Review Protection') : t('AI Governance')}</h1><div className="sub">{section === 'protection' ? t('Recipient-watermarked, permission-locked, audit-logged review copies. Set the workspace default here.') : t('One model gateway, one audit trail. Every ScriptON Doctor run is versioned, scored for confidence, and logged.')}</div></div>
            <div className="setgrid">
              <div className="subnav">{SUBNAV.map((s) => (<button key={s.k} className={'sni' + (s.k === section ? ' on' : '')} onClick={() => s.k === 'ai' ? setSection('ai') : s.k === 'protection' ? setSection('protection') : props.onAction('subnav')}><svg className="ico" viewBox="0 0 24 24">{s.d}</svg>{t(s.label)}</button>))}</div>
              <div className="setmain">
                {section === 'protection' ? <ReviewProtectionPanel /> : <>
                <div className="panelcard" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div><div className="eyebrow">{t('ENGINES & ROUTING')}</div><div className="sub" style={{ fontSize: 12 }}>{t('Configure providers, failover order and telemetry for text, audio + video AI.')}</div></div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><a className="btn gold" href="/setup/llm-engines">{t('AI Engines & Routing')}</a><a className="btn ghost" href="/setup/audio-engines">{t('Audio Engines')}</a><a className="btn ghost" href="/setup/video-engines">{t('Video Engines')}</a></div>
                </div>
                <div className="liverow">{[['System LLM', llmLive, llmTot], ['Audio', audLive, audTot], ['Video', vidLive, vidTot]].map((s: any, i: number) => (<div className="panelcard livecard" key={i}><span className="ldot" style={{ background: s[1] > 0 ? 'var(--green)' : s[2] > 0 ? 'var(--amber)' : 'var(--faint)' }} /><div><div style={{ fontWeight: 700, color: 'var(--cream)', fontSize: 13.5 }}>{t(s[0])}</div><div className="meta" style={{ fontSize: 11.5 }}>{s[1]} {t('of')} {s[2]} {t('live')}</div></div></div>))}</div>
                <div className="kpis">
                  <div className="panelcard"><div className="eyebrow">{t('ACTIVE MODEL')}</div><div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cream)', fontFamily: "'Courier Prime',ui-monospace,monospace" }}>{props.model}</div><div className="sub" style={{ fontSize: 11 }}>{props.promptSet} · {t('single gateway (AiService)')}</div></div>
                  <div className="panelcard"><div className="eyebrow">{t('CONFIDENCE GATE')}</div><div className="slider"><i style={{ width: Math.round(props.confidence * 100) + '%' }} /><span className="knob" style={{ left: 'calc(' + Math.round(props.confidence * 100) + '% - 8px)' }} /></div><div className="sub" style={{ fontSize: 11 }}>{t('Hold runs below')} <b style={{ color: 'var(--gold2)' }}>{props.confidence.toFixed(2)}</b> {t('as PENDING')}</div></div>
                  <div className="panelcard"><div className="eyebrow">{t('HUMAN APPROVAL')}</div><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><button className={'toggle' + (props.humanApproval ? '' : ' off')} onClick={() => props.onAction('toggle')} /><span style={{ fontSize: 12.5, color: 'var(--cream)', fontWeight: 600 }}>{props.humanApproval ? t('Required') : t('Off')}</span></div><div className="sub" style={{ fontSize: 11 }}>{t('Applied rewrites need sign-off before they branch a revision')}</div></div>
                </div>
                <div className="pc-h" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, flexWrap: 'wrap', gap: 8 }}>
                  <span className="eyebrow">{t('RECENT RUNS')} <span className="meta" style={{ fontSize: 10.5, letterSpacing: 0, fontWeight: 500 }}>· {t('live · AiRun ∪ VideoRun')}{feed ? ' · ' + feed.total : ''}</span></span>
                  <div className="rfilters">
                    {[['24h', 24], ['7 days', 168], ['All', 720]].map((o: any) => (<button key={o[1]} className={'fchip' + (rf.hours === o[1] ? ' on' : '')} onClick={() => setRf((s) => ({ ...s, hours: o[1] }))}>{t(o[0])}</button>))}
                    {[['All', undefined], ['Success', 'success'], ['Error', 'error']].map((o: any, i: number) => (<button key={i} className={'fchip' + ((rf.status || 'All') === (o[1] || 'All') ? ' on' : '')} onClick={() => setRf((s) => ({ ...s, status: o[1] }))}>{t(o[0])}</button>))}
                    <select className="fsel" value={rf.surface || ''} onChange={(e) => setRf((s) => ({ ...s, surface: e.target.value || undefined }))}><option value="">{t('All surfaces')}</option>{(feed?.surfaces || []).map((sf: string) => (<option key={sf} value={sf}>{sf}</option>))}</select>
                    <select className="fsel" value={rf.size || ''} onChange={(e) => setRf((s) => ({ ...s, size: e.target.value || undefined }))}><option value="">{t('Any size')}</option>{(feed?.sizes || []).map((sz: string) => (<option key={sz} value={sz}>{sz}</option>))}</select>
                  </div>
                </div>
                <div className="gtable">
                  <div className="gthead"><span>{t('SURFACE')}</span><span>{t('STAGE / PURPOSE')}</span><span>{t('MODEL')}</span><span>{t('SIZE')}</span><span>{t('STATUS')}</span><span>{t('DUR')}</span><span>{t('WHEN')}</span></div>
                  {(feed?.runs || []).map((r: any, i: number) => (<div className="gtr" key={r.id || i}><span className="gsf" style={{ color: r.kind === 'VIDEO' ? 'var(--blue)' : undefined }}>{r.surface}</span><span className="gstage">{[r.purpose, r.stage].filter(Boolean).join(' · ') || '—'}</span><span className="gmodel">{r.model}</span><span className="gsize">{r.tokens ? (r.size + ' · ' + fmtTok(r.tokens)) : (r.durationSec ? (r.durationSec + 's clip') : '—')}</span><span className={'badge ' + (r.result === 'error' ? 'red' : r.result === 'running' ? 'amber' : 'green')}>{r.status}</span><span className="gdur">{r.durationMs ? Math.round(r.durationMs / 1000) + 's' : (r.durationSec ? r.durationSec + 's' : '—')}</span><span className="gwhen">{rel(r.when)}</span></div>))}
                  {feed && !feed.runs.length && <div className="gtr"><span className="gsf" style={{ gridColumn: '1/8', color: 'var(--faint)' }}>{t('No runs in this window.')}</span></div>}
                  {!feed && <div className="gtr"><span className="gsf" style={{ gridColumn: '1/8', color: 'var(--faint)' }}>{t('Loading run history…')}</span></div>}
                </div>
                </>}
              </div>
            </div>
          </div></div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
