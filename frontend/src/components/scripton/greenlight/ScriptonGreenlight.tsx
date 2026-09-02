'use client';
/**
 * ScriptonGreenlight — new-OS Greenlight workspace. Market forecast + the go/no-go decision pack,
 * inside the shared ScriptonShell (rail + top bar). Replaces the legacy ScriptOnGreenlight trio.
 * Pure presentation: the route page loads the data (marketForecast / greenlightDecision) and the
 * verdict, and passes them in. Tabs: Market · Audience · Cost · Decision.
 */
import React from 'react';
import ScriptonShell from '@/components/scripton/ScriptonShell';
import { SX_CSS } from '@/components/scripton/shared/sx';

// Greenlight view-model types (owned here now — the legacy ScriptOnGreenlight is retired).
export type SxComp = { name: string; sim: number; gross: string };
export type SxFcast = { label: string; pct: number; color: string; bandLeft?: number; bandWidth?: number; value: string; gold?: boolean };
export type SxRoi = { case: string; rev: string; margin: string; roi: string; tone?: string };
export type SxDecision = {
  scorecard: { criterion: string; weight: number; score: number; note: string }[];
  audience: { quadrant: string; appeal: string }[];
  costOps: { item: string; saving: string; note: string }[];
  roi: SxRoi[]; probability: number; verdict: string; memo: string;
};

const EXTRA = `
.sx.greenlight .gl-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:1100px){.sx.greenlight .gl-grid{grid-template-columns:1fr}}
.sx.greenlight .bar{height:9px;border-radius:99px;background:#1b1e25;overflow:hidden;margin-top:6px}
.sx.greenlight .bar i{display:block;height:100%;border-radius:99px}
.sx.greenlight .scrow{display:grid;grid-template-columns:1.3fr auto 2fr;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--hair);font-size:12.5px}
.sx.greenlight .scrow:first-child{border-top:none}
.sx.greenlight .pillv{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.4px}
.sx.greenlight .memo{font-size:13px;line-height:1.65;color:var(--text);background:var(--paper);color:var(--ink);border-radius:10px;padding:16px 18px;margin-top:6px}
`;

type Props = {
  title: string; vp: 'mobile' | 'tablet' | 'desktop'; mode: string; onTab: (k: string) => void;
  comps: SxComp[]; forecast: SxFcast[]; prob: { pct: number; verdict: string; note: string };
  roi: SxRoi[]; prescription: string; decision: SxDecision;
  onNav?: (k: string) => void; onBack?: () => void; onAction: (k: string) => void; toast?: string | null;
};

const TABS: [string, string][] = [['market', 'Market'], ['audience', 'Audience'], ['cost', 'Cost'], ['decision', 'Decision']];
const verdictTone = (v: string) => /GREENLIT|RECOMMEND|GO\b/i.test(v) ? 'var(--green)' : /PASS|NO/i.test(v) ? 'var(--red)' : 'var(--amber)';

export default function ScriptonGreenlight(props: Props) {
  const { title, vp, mode, onTab, comps, forecast, prob, roi, prescription, decision, onNav, onBack, onAction, toast } = props;
  const tone = verdictTone(prob.verdict);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SX_CSS + EXTRA }} />
      <ScriptonShell screen="greenlight" active="greenlight" vp={vp} onBack={onBack} onNav={onNav}
        topbar={{ scriptScoped: false }} overlay={toast ? <div className="toast">{toast}</div> : null}>
        <div className="main"><div className="content">
          <div className="phead">
            <div>
              <div className="eyebrow">GREENLIGHT</div>
              <h1>{title}</h1>
              <div className="sub">Market forecast &amp; the go/no-go decision pack — grounded in your pages, not vibes.</div>
            </div>
            <div style={{ textAlign: 'end', flex: 'none' }}>
              <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, color: tone }}>{prob.pct}%</div>
              <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.6px', color: tone, marginTop: 3 }}>P(greenlight) · {prob.verdict}</div>
            </div>
          </div>

          <div className="tabs">
            {TABS.map(([k, l]) => <button key={k} className={'tab' + (mode === k ? ' on' : '')} onClick={() => onTab(k)}>{l}</button>)}
            <button className="btn gold" style={{ marginInlineStart: 'auto' }} onClick={() => onAction(mode === 'decision' ? 'memo' : 'forecast')}>
              {mode === 'decision' ? 'Assemble decision pack' : 'Run market forecast'} →
            </button>
          </div>

          {mode === 'market' && (
            <div className="gl-grid">
              <div className="panelcard">
                <div className="pc-h"><div className="t">Comparable titles</div><span className="meta">{comps.length} matched</span></div>
                {comps.map((c, i) => (
                  <div className="kv" key={i}><span className="k">{c.name}</span><span className="v">{c.sim}% · {c.gross}</span></div>
                ))}
              </div>
              <div className="panelcard">
                <div className="pc-h"><div className="t">Revenue forecast (P50)</div><span className="meta">probabilistic</span></div>
                {forecast.map((f, i) => (
                  <div key={i} style={{ marginTop: i ? 10 : 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: f.gold ? 'var(--gold2)' : 'var(--mute)', fontWeight: f.gold ? 700 : 500 }}>{f.label}</span><span style={{ color: 'var(--text)', fontWeight: 700 }}>{f.value}</span></div>
                    <div className="bar"><i style={{ width: f.pct + '%', background: f.color }} /></div>
                  </div>
                ))}
                <div className="note">{prob.note}</div>
              </div>
              <div className="panelcard" style={{ gridColumn: '1 / -1' }}>
                <div className="pc-h"><div className="t">Prescription</div></div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{prescription}</div>
              </div>
            </div>
          )}

          {mode === 'audience' && (
            <div className="gl-grid">
              {decision.audience.map((a, i) => (
                <div className="panelcard" key={i}>
                  <div className="pc-h"><div className="t">{a.quadrant}</div></div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>{a.appeal}</div>
                </div>
              ))}
            </div>
          )}

          {mode === 'cost' && (
            <div className="gl-grid">
              <div className="panelcard">
                <div className="pc-h"><div className="t">Cost optimisations</div></div>
                {decision.costOps.map((c, i) => (
                  <div className="kv" key={i}><span className="k">{c.item}<div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{c.note}</div></span><span className="v" style={{ color: 'var(--green)' }}>{c.saving}</span></div>
                ))}
              </div>
              <div className="panelcard">
                <div className="pc-h"><div className="t">ROI scenarios</div></div>
                {roi.map((r, i) => (
                  <div className="kv" key={i}><span className="k" style={{ color: r.tone || 'var(--text)' }}>{r.case}</span><span className="v">{r.rev} · {r.margin} · <b style={{ color: 'var(--gold2)' }}>{r.roi}</b></span></div>
                ))}
              </div>
            </div>
          )}

          {mode === 'decision' && (
            <div>
              <div className="panelcard">
                <div className="pc-h"><div className="t">Greenlight scorecard</div><span className="pillv" style={{ background: 'color-mix(in srgb,' + tone + ' 16%,transparent)', color: tone }}>{decision.verdict} · {decision.probability}%</span></div>
                {decision.scorecard.map((s, i) => (
                  <div className="scrow" key={i}>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{s.criterion} <span style={{ color: 'var(--faint)', fontWeight: 400 }}>·{Math.round(s.weight * 100)}%</span></span>
                    <span style={{ color: 'var(--gold2)', fontWeight: 800 }}>{s.score}/10</span>
                    <span style={{ color: 'var(--mute)' }}>{s.note}</span>
                  </div>
                ))}
              </div>
              <div className="panelcard" style={{ marginTop: 16 }}>
                <div className="pc-h"><div className="t">Decision memo</div></div>
                <div className="memo">{decision.memo}</div>
              </div>
            </div>
          )}
        </div></div>
      </ScriptonShell>
    </>
  );
}
