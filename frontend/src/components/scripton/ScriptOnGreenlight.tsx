'use client';
/**
 * ScriptON Doctor — Greenlight (P5 Market + P7 Decision). Tabs switch the content area:
 * Market (comps/forecast/gauge/ROI), Audience (quadrants), Cost (opportunities), Decision (GLP scorecard + verdict + memo).
 * Probabilistic — never a guarantee. `.sx`-scoped, self-contained.
 */
import React from 'react';
import { SxRail } from './ScriptOnStudio';
import { useLocale } from '@/lib/i18n';

export type SxComp = { name: string; sim: number; gross: string };
export type SxFcast = { label: string; pct: number; color: string; bandLeft?: number; bandWidth?: number; value: string; gold?: boolean };
export type SxRoi = { case: string; rev: string; margin: string; roi: string; tone?: string };
export type SxScore = { criterion: string; weight: number; score: number; note?: string };
export type SxQuad = { quadrant: string; appeal: string };
export type SxCostOp = { item: string; saving: string; note?: string };
export type SxDecision = { scorecard: SxScore[]; audience: SxQuad[]; costOps: SxCostOp[]; roi: SxRoi[]; probability: number; verdict: string; memo: string };

const CSS = `
.sx{--bg:#0b0c0f;--chrome:#121419;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--red:#e5635f;--violet:#8b7cf0;--paper:#F7F4EC;--ink:#23231f;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx *{box-sizing:border-box;margin:0;padding:0}
.sx:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(700px 280px at 72% -6%,rgba(198,164,99,.09),transparent 70%);z-index:0}
.sx svg{display:block}
.sx .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx .tl{display:flex;align-items:center;gap:12px}
.sx .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer}
.sx .proj{font-weight:700;font-size:15.5px;color:var(--cream)}
.sx .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.3px;background:rgba(91,141,239,.16);color:#a9c4f7}
.sx .pill .d{width:7px;height:7px;border-radius:50%;background:var(--blue)}
.sx .meta{color:var(--faint);font-size:12px;font-weight:500}
.sx .tr{display:flex;align-items:center;gap:8px}
.sx .btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;color:var(--text);white-space:nowrap;background:transparent}
.sx .btn .ico{width:15px;height:15px}
.sx .btn.outline{background:#1c1d1a;border-color:rgba(198,164,99,.55);color:var(--gold2)}
.sx .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;box-shadow:0 6px 18px -4px rgba(198,164,99,.45),inset 0 1px 0 rgba(255,255,255,.3)}
.sx .kbd{background:#1b1e25;border-color:var(--hair);color:var(--mute)}
.sx .kbd kbd{font-family:inherit;font-size:11px}
.sx .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx .main{flex:1;min-width:0;display:flex;flex-direction:column}
.sx .content{flex:1;overflow:auto;padding:26px 30px;display:flex;flex-direction:column;gap:18px}
.sx .phead{display:flex;align-items:flex-end;justify-content:space-between}
.sx .phead h1{font-size:24px;font-weight:800;color:var(--cream);letter-spacing:-.5px}
.sx .sub{font-size:13px;color:var(--mute);margin-top:4px;max-width:720px}
.sx .eyebrow{font-size:11px;font-weight:700;letter-spacing:1.4px;color:var(--gold)}
.sx .tabs{display:flex;gap:8px}
.sx .tab{padding:9px 16px;border-radius:11px;font-size:13px;font-weight:600;color:var(--mute);background:#171a20;border:1px solid var(--hair);cursor:pointer;display:flex;align-items:center;gap:7px}
.sx .tab .ico{width:15px;height:15px}
.sx .tab.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:var(--gold2)}
.sx .mgrid{flex:1;display:grid;grid-template-columns:1.55fr 1fr;gap:16px;min-height:0}
.sx .col{display:flex;flex-direction:column;gap:16px;min-height:0}
.sx .panelcard{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:11px}
.sx .pc-h{display:flex;align-items:center;justify-content:space-between}
.sx .pc-h .t{font-size:13.5px;font-weight:700;color:var(--cream)}
.sx .badge{font-size:10px;font-weight:800;letter-spacing:.4px;padding:4px 9px;border-radius:999px}
.sx .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}
.sx .badge.green{background:rgba(87,179,104,.16);color:var(--green)}
.sx .badge.red{background:rgba(229,99,95,.16);color:var(--red)}
.sx .comp{display:flex;align-items:center;gap:11px;padding:11px 0;border-top:1px solid var(--hair)}
.sx .comp:first-of-type{border-top:none}
.sx .cbar{width:90px;height:6px;border-radius:4px;background:#23262e;overflow:hidden}
.sx .cbar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2))}
.sx .cname{flex:1;font-size:12.5px;font-weight:600;color:var(--cream)}
.sx .cgr{font-size:12px;color:var(--mute);font-variant-numeric:tabular-nums}
.sx .fwin{display:flex;align-items:center;gap:11px;padding:10px 0;border-top:1px solid var(--hair);font-size:12.5px}
.sx .fwin:first-of-type{border-top:none}
.sx .fl{width:90px;color:var(--faint);font-weight:600}
.sx .fb{flex:1;height:8px;border-radius:5px;background:#23262e;overflow:hidden;position:relative}
.sx .fb i{display:block;height:100%;border-radius:5px}
.sx .fb .band{position:absolute;top:-3px;bottom:-3px;background:rgba(198,164,99,.18);border-left:1px solid var(--gold);border-right:1px solid var(--gold)}
.sx .fv{width:74px;text-align:end;font-weight:700;color:var(--cream)}
.sx .gauge{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0}
.sx .ring{width:130px;height:130px;border-radius:50%;display:grid;place-items:center;position:relative}
.sx .ring:before{content:"";position:absolute;inset:12px;border-radius:50%;background:var(--panel)}
.sx .rv{position:relative;font-size:30px;font-weight:800;color:var(--cream)}
.sx .rs{position:relative;font-size:10px;color:var(--faint);margin-top:-4px}
.sx .roi{width:100%;border-collapse:collapse}
.sx .roi th,.sx .roi td{text-align:end;padding:8px 6px;font-size:12px;border-bottom:1px solid var(--hair)}
.sx .roi th{color:var(--faint);font-weight:700;font-size:10px;letter-spacing:.4px}
.sx .roi td:first-child,.sx .roi th:first-child{text-align:start;color:var(--cream);font-weight:600}
.sx .note{font-size:11.5px;color:var(--faint);border-top:1px solid var(--hair);padding-top:9px;margin-top:auto}
.sx .quad{flex:1;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:14px;min-height:0}
.sx .qc{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:9px}
.sx .qc .ql{font-size:11px;font-weight:700;letter-spacing:.6px;color:var(--gold)}
.sx .qc .qa2{font-size:13px;color:var(--text);line-height:1.5;flex:1}
.sx .qmeter{height:6px;border-radius:4px;background:#23262e;overflow:hidden}.sx .qmeter i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2))}
.sx .sc{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--hair)}
.sx .sc:first-of-type{border-top:none}
.sx .sc .scn{width:128px;font-size:12.5px;font-weight:600;color:var(--cream)}
.sx .sc .scbar{flex:1;height:7px;border-radius:5px;background:#23262e;overflow:hidden}.sx .sc .scbar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,var(--gold),var(--gold2))}
.sx .sc .scv{width:42px;text-align:end;font-size:12.5px;font-weight:700;color:var(--cream)}
.sx .sc .scw{width:48px;text-align:end;font-size:11px;color:var(--faint)}
.sx .costrow{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--hair)}
.sx .costrow:first-of-type{border-top:none}
.sx .costrow .ci{flex:1}.sx .costrow .cii{font-size:12.5px;color:var(--cream);font-weight:600}.sx .costrow .cin{font-size:11px;color:var(--faint);margin-top:2px}
.sx .costrow .cs{font-size:14px;font-weight:800;color:var(--green)}
.sx .verdict{display:inline-flex;align-items:center;gap:8px;padding:7px 15px;border-radius:999px;font-size:13px;font-weight:800;letter-spacing:.5px}
.sx .memo{font-size:13.5px;line-height:1.7;color:var(--text)}
.sx .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px;box-shadow:0 14px 40px -12px rgba(0,0,0,.7)}
`;

const TABS = [
  { k: 'market', lbl: 'Market', d: <path d="M3 3v18h18M7 14l3-3 3 3 5-6" /> },
  { k: 'audience', lbl: 'Audience', d: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" /> },
  { k: 'cost', lbl: 'Cost', d: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /> },
  { k: 'decision', lbl: 'Decision (GLP)', d: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /> },
];
const appealPct = (t: string) => { const u = String(t || '').toLowerCase(); if (u.includes('very high') || u.startsWith('high')) return 88; if (u.includes('med-high') || u.includes('medium-high')) return 72; if (u.includes('med')) return 56; if (u.includes('low-med')) return 40; if (u.includes('low')) return 26; return 50; };
const verdictColor = (v: string) => { const u = String(v || '').toUpperCase(); if (u.includes('GREEN') || u === 'GO') return 'var(--green)'; if (u.includes('PASS') || u.includes('HOLD')) return 'var(--red)'; return 'var(--amber)'; };
const verdictBg = (v: string) => { const c = verdictColor(v); return c === 'var(--green)' ? 'rgba(87,179,104,.16)' : c === 'var(--red)' ? 'rgba(229,99,95,.16)' : 'rgba(224,162,59,.16)'; };

export default function ScriptOnGreenlight(props: {
  title: string; meta: string; mode: string; onTab: (k: string) => void;
  comps: SxComp[]; forecast: SxFcast[]; prob: { pct: number; verdict: string; note: string }; roi: SxRoi[]; prescription: string;
  decision: SxDecision;
  onNav: (k: string) => void; onBack: () => void; onAction: (k: string) => void; toast?: string | null;
}) {
  const { dir, t } = useLocale();
  const ring = `conic-gradient(var(--gold) 0 ${props.prob.pct}%,#23262e ${props.prob.pct}% 100%)`;
  const dec = props.decision;
  const m = props.mode;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="tl">
            <div className="logo" onClick={props.onBack} title={t('Back to TFM')}>TFM</div>
            <div className="proj">{props.title}</div>
            <span className="pill"><span className="d" />{t('FEATURE')}</span>
            <span className="meta">{props.meta}</span>
          </div>
          <div className="tr">
            <button className="btn kbd" onClick={() => props.onAction('cmdk')}><kbd>⌘K</kbd></button>
            <button className="btn outline" onClick={() => props.onAction('memo')}><svg className="ico" viewBox="0 0 24 24"><path d="M3 3v18h18M7 14l3-3 3 3 5-6" /></svg>{t('Decision memo')}</button>
            <button className="btn gold" onClick={() => props.onAction('forecast')}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M3 3v18h18M7 14l3-3 3 3 5-6" /></svg>{t('Run forecast')}</button>
          </div>
        </div>
        <div className="body">
          <SxRail active="greenlight" onNav={props.onNav} />
          <div className="main"><div className="content">
            <div className="phead"><div><h1>{t('Greenlight')}</h1><div className="sub">{t('Predict, prescribe and re-cost on your real budget — per format and market. Probabilistic, with confidence bands; never a guarantee.')}</div></div></div>
            <div className="tabs">
              {TABS.map((tab) => (
                <button key={tab.k} className={'tab' + (tab.k === m ? ' on' : '')} onClick={() => props.onTab(tab.k)}><svg className="ico" viewBox="0 0 24 24">{tab.d}</svg>{t(tab.lbl)}</button>
              ))}
            </div>

            {m === 'market' && (
              <div className="mgrid">
                <div className="col">
                  <div className="panelcard"><div className="pc-h"><span className="t">{t('Comparables')}</span><span className="eyebrow">{t('SIMILARITY · GROSS')}</span></div>
                    {props.comps.map((c, i) => (<div className="comp" key={i}><span className="cname">{c.name}</span><span className="cbar"><i style={{ width: c.sim + '%' }} /></span><span className="cgr">{c.sim}% · {c.gross}</span></div>))}
                  </div>
                  <div className="panelcard" style={{ flex: 1 }}><div className="pc-h"><span className="t">{t('Forecast')}</span><span className="eyebrow">{t('P50 · 80% BAND')}</span></div>
                    {props.forecast.map((f, i) => (
                      <div className="fwin" key={i}><span className="fl">{t(f.label)}</span><span className="fb"><i style={{ width: f.pct + '%', background: f.color }} />{f.bandWidth ? <span className="band" style={{ insetInlineStart: f.bandLeft + '%', width: f.bandWidth + '%' }} /> : null}</span><span className="fv" style={f.gold ? { color: 'var(--gold2)' } : {}}>{f.value}</span></div>
                    ))}
                  </div>
                </div>
                <div className="col">
                  <div className="panelcard"><div className="pc-h"><span className="t">{t('Greenlight probability')}</span><span className="badge amber">{props.prob.verdict}</span></div>
                    <div className="gauge"><div className="ring" style={{ background: ring }}><span className="rv">{props.prob.pct}%</span><span className="rs">{t('P(greenlight)')}</span></div><div className="sub" style={{ textAlign: 'center', fontSize: 11.5 }}>{t(props.prob.note)}</div></div>
                  </div>
                  <div className="panelcard" style={{ flex: 1 }}><div className="pc-h"><span className="t">{t('Predict → prescribe → re-cost')}</span><span className="eyebrow">{t('ON REAL NEGATIVE')}</span></div>
                    <table className="roi"><thead><tr><th>{t('Case')}</th><th>{t('Revenue')}</th><th>{t('Margin')}</th><th>{t('ROI')}</th></tr></thead>
                      <tbody>{props.roi.map((r, i) => (<tr key={i}><td style={r.tone ? { color: r.tone } : {}}>{t(r.case)}</td><td>{r.rev}</td><td style={r.tone ? { color: r.tone } : {}}>{r.margin}</td><td>{r.roi}</td></tr>))}</tbody>
                    </table>
                    <div className="note">{t(props.prescription)}</div>
                  </div>
                </div>
              </div>
            )}

            {m === 'audience' && (
              <div className="quad">
                {dec.audience.map((q, i) => (
                  <div className="qc" key={i}><div className="ql">{t(q.quadrant)}</div><div className="qa2">{t(q.appeal)}</div><div className="qmeter"><i style={{ width: appealPct(q.appeal) + '%' }} /></div></div>
                ))}
              </div>
            )}

            {m === 'cost' && (
              <div className="panelcard" style={{ flex: 1 }}><div className="pc-h"><span className="t">{t('Cost opportunities')}</span><span className="eyebrow">{t('ON THE NEGATIVE')}</span></div>
                {dec.costOps.map((c, i) => (<div className="costrow" key={i}><div className="ci"><div className="cii">{t(c.item)}</div>{c.note && <div className="cin">{t(c.note)}</div>}</div><div className="cs">{c.saving}</div></div>))}
                <div className="note">{t('Savings are estimates against the current negative — apply via a budget-fit pass in the Doctor.')}</div>
              </div>
            )}

            {m === 'decision' && (
              <div className="mgrid">
                <div className="col">
                  <div className="panelcard" style={{ flex: 1 }}><div className="pc-h"><span className="t">{t('Greenlight scorecard')}</span><span className="eyebrow">{t('WEIGHTED')}</span></div>
                    {dec.scorecard.map((s, i) => (<div className="sc" key={i}><span className="scn">{t(s.criterion)}</span><span className="scbar"><i style={{ width: (Number(s.score) || 0) * 10 + '%' }} /></span><span className="scv">{s.score}/10</span><span className="scw">{t('w')} {s.weight}</span></div>))}
                  </div>
                </div>
                <div className="col">
                  <div className="panelcard"><div className="pc-h"><span className="t">{t('Verdict')}</span><span className="badge amber">{dec.probability}% P</span></div>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}><span className="verdict" style={{ color: verdictColor(dec.verdict), background: verdictBg(dec.verdict) }}>{dec.verdict}</span></div>
                    <div className="memo">{t(dec.memo)}</div>
                  </div>
                  <div className="panelcard" style={{ flex: 1 }}><div className="pc-h"><span className="t">{t('ROI cases')}</span><span className="eyebrow">{t('BASE · HIGH · DOWN')}</span></div>
                    <table className="roi"><thead><tr><th>{t('Case')}</th><th>{t('Revenue')}</th><th>{t('Margin')}</th><th>{t('ROI')}</th></tr></thead>
                      <tbody>{dec.roi.map((r, i) => (<tr key={i}><td style={r.tone ? { color: r.tone } : {}}>{t(r.case)}</td><td>{r.rev}</td><td style={r.tone ? { color: r.tone } : {}}>{r.margin}</td><td>{r.roi}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div></div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
