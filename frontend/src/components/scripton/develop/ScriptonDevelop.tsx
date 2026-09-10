'use client';
/**
 * ScriptON · Develop — the structural rebuild (Figma node 69:2), behind scripton.osShell.
 * A two-pane cinematic workspace: ladder rail · stage canvas · spine/comps context.
 * Built slice-by-slice (A top bar → B two-pane shell → C per-stage canvas → D ladder+controls
 * → E render-screen glow → F responsive). `old` restores the current Builder.
 *
 * Uses the shared `.sx` design tokens (globals.css, Gate 0 #40) — NO inline palette block.
 *
 * Slice B: the two-pane body (right of the OS rail), wired to the page's REAL develop data —
 * no mocks. Ladder rail (real stages + done/active/pending), stage canvas (the focused stage's
 * cleaned body — full per-kind rendering is slice C), spine + comparables. The top bar's ring +
 * V ▾ are wired from the OPEN BUILD's linked kernel script (continuity + active version), so they
 * populate for builds whose script has renders (honestly hidden when it has none — no fake number).
 */
import { useEffect, useMemo, useState } from 'react';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { SxRail, SxTruncationBanner, cleanStageText, type SxLadder, type SxSpine } from '@/components/scripton/shared/sx';
import { ScriptPaper } from '@/components/scripton/scriptPaper';
import VideoRenderPanel from '@/components/scripton/VideoRenderPanel';
import CohesiveEpisodePanel from '@/components/scripton/CohesiveEpisodePanel';
import ScriptonTopBar from '@/components/scripton/topbar/ScriptonTopBar';
import ScriptonShell from '@/components/scripton/ScriptonShell';

export type ScriptonDevelopProps = {
  vp: 'mobile' | 'tablet' | 'desktop';
  onBack?: () => void;
  projectId: string | null;
  buildId?: string;
  ladder: SxLadder[];            // real develop stages (name/kind/state/body/version…)
  spine: SxSpine[];              // the agreed brief — Format / Logline / Framework / Stage
  comps: string[];               // real comparables (empty → honest empty state, no mock chips)
  genBusy: string | null;        // the stage kind currently generating (global), or null
  onAdvance: () => void;         // generate the next stage
  onRegenerate: (kind: string) => void;   // regenerate the focused stage
  onSwitchVersion: (stageId: string, dir: number) => void; // ‹ Vn › prev/next on the focused stage
  onPromoteScript?: (versionId: string) => void; // Draft → render the screenplay into the Library (opens the standalone render screen)
};

// TOTAL is computed per build from the ladder length (in the component body) — see below.
const LABEL: Record<string, string> = { LOGLINE: 'Logline', SYNOPSIS: 'Synopsis', TREATMENT: 'Treatment', BEATS: 'Beats', SCENES: 'Scenes', STEP_OUTLINE: 'Step Outline', DRAFT: 'Draft', COVERAGE: 'Coverage', SEASON_ARC: 'Season arc', EPISODE_MAP: 'Episode map', PREMISE: 'Premise', STORY_ENGINE: 'Story engine', BEAT_ENGINE: 'Beat engine', THESIS: 'Thesis', RESEARCH_PLAN: 'Research plan', RIGHTS_PLAN: 'Rights plan', INTERVIEW_OUTLINE: 'Interview outline', PAPER_EDIT: 'Paper edit', NARRATION: 'Narration', SHOT_LIST: 'Shot List', VIDEO_PROMPT: 'Video Prompt' };

// ── Markdown-clean (#47) + per-kind rendering ────────────────────────────────
// Strip ** / * / ` / leading # / --- rules / runs of blank lines. No content is translated —
// dir="auto" on every body block makes Arabic render RTL right-aligned and English LTR.
const stripMd = (s: string) => String(s || '').replace(/\*+/g, '').replace(/`+/g, '').replace(/^\s*#{1,6}\s*/gm, '').replace(/^\s*[-_*]{3,}\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
// Robust output unwrap: strict JSON first, then a hand extraction for malformed JSON (the AI sometimes
// writes literal newlines inside the "output" string value, which breaks JSON.parse + the salvage regex).
const unwrapOutput = (raw?: string): string => {
  const s = String(raw || '').trim();
  if (s.startsWith('{') || s.startsWith('[')) {
    try { const o: any = JSON.parse(s); if (o && typeof o === 'object') return String(o.output || o.text || o.body || ''); } catch { /* malformed/truncated */ }
    // Grab the output value to end-of-string (tolerates a truncated/unterminated JSON string — the
    // AI sometimes runs out mid-value), then strip a trailing close quote/brace if the JSON was whole.
    const m = s.match(/"(?:output|text|body)"\s*:\s*"([\s\S]*)$/);
    if (m) return m[1].replace(/"\s*[}\]]?\s*$/, '').replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '  ').replace(/\\r/g, '').replace(/\\\\/g, '\\');
  }
  return s;
};
const cleanProse = (raw?: string) => stripMd(unwrapOutput(cleanStageText(String(raw || ''))));

// Verdict colouring — GO/RECOMMEND green · CONSIDER amber · HOLD/PASS red (no hardcoded labels;
// detected from the real verdict text, English or Arabic section).
const VERDICT_COLOR: Record<string, string> = { GO: 'var(--green)', RECOMMEND: 'var(--green)', CONSIDER: 'var(--amber)', HOLD: 'var(--red)', PASS: 'var(--red)' };
function verdictColor(label: string, body: string): string | null {
  const lead = body.match(/^\s*(GO|RECOMMEND|CONSIDER|HOLD|PASS)\b/i);
  if (lead) return VERDICT_COLOR[lead[1].toUpperCase()] || null;
  if (/verdict|recommendation|توصية|الحكم|الخلاصة/i.test(label)) { const m = body.match(/\b(GO|RECOMMEND|CONSIDER|HOLD|PASS)\b/i); return m ? (VERDICT_COLOR[m[1].toUpperCase()] || null) : null; }
  return null;
}
// Coverage → its REAL section headers (English or Arabic) as gold mini-labels + clean prose.
// Sections are delimited by --- rules (Arabic عنترة) and/or a header line (a short line — markdown
// bold/heading, ALL-CAPS, or a few words with no sentence punctuation — that precedes its prose).
function coverageSections(raw?: string): { label: string; body: string }[] {
  const s = unwrapOutput(raw);
  const headerish = (first: string) => {
    const bare = first.replace(/^#{1,6}\s*/, '').replace(/\*+/g, '').replace(/[:：]\s*$/, '').trim();
    if (!bare || first.length > 70) return false;
    return /^\*\*.+\*\*$/.test(first) || /^#{1,6}\s+/.test(first) || /^[A-Z0-9 /&'’-]{3,}$/.test(bare) || (bare.split(/\s+/).length <= 6 && !/[.!?؟،…]$/.test(bare));
  };
  const out: { label: string; body: string }[] = [];
  for (const blk of s.split(/\n\s*[-_*]{3,}\s*\n/)) {
    const lines = blk.split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length) continue;
    const first = lines[0].trim();
    let label = '', body = '';
    if (headerish(first) && lines.length > 1) { label = stripMd(first).replace(/[:：]\s*$/, '').trim(); body = stripMd(lines.slice(1).join('\n')); }
    else { body = stripMd(lines.join('\n')); }
    if (label || body) out.push({ label, body });
  }
  // drop a leading title-only / label-less single short line (the coverage's own title — the head already names the stage)
  if (out.length && !out[0].label && out[0].body.length < 80 && !out[0].body.includes('\n')) out.shift();
  return out.filter((x) => x.body);
}

function CoverageBody({ raw, t }: { raw?: string; t: (k: string) => string }) {
  const sections = useMemo(() => coverageSections(raw), [raw]);
  if (!sections.length) { const p = cleanProse(raw); return <>{p.split(/\n{2,}/).filter(Boolean).map((x, i) => <p key={i} dir="auto">{x}</p>)}</>; }
  return (
    <>
      {sections.map((s, i) => {
        const vc = verdictColor(s.label, s.body);
        return (
          <div className="cvsec" key={i}>
            {s.label ? <div className="cvlabel">{s.label}</div> : null}
            <div className={'cvprose' + (vc ? ' verdict' : '')} dir="auto" style={vc ? { color: vc } : undefined}>{s.body}</div>
          </div>
        );
      })}
    </>
  );
}
function SceneCards({ scenes, t }: { scenes: any[]; t: (k: string) => string }) {
  return (
    <div className="scards">
      {scenes.map((s, i) => {
        const open = s.chargeOpen, close = s.chargeClose;
        const flat = !open || !close || open === close;
        const purpose = s.purpose || s.synopsis || s.description || '';
        return (
          <div className={'scard' + (flat ? ' flat' : '')} key={i} dir="auto">
            <div className="scslug">{s.sceneNumber != null ? s.sceneNumber + '. ' : ''}{s.slugline || s.location || t('Scene')}</div>
            {purpose ? <div className="scbody">{purpose}</div> : null}
            <div className="sctags">
              {open || close ? <span className={'charge' + (flat ? ' flatc' : '')} dir="ltr">{open || '·'} → {close || '·'}</span> : null}
              {s.turnType ? <span className="tag">{s.turnType}</span> : null}
              {s.thread ? <span className="tag">{t('thread')} {s.thread}</span> : null}
              {flat ? <span className="tag red">{t('flat')}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function StepList({ steps }: { steps: any[] }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={i} dir="auto"><span className="snum">{s.n != null ? s.n : i + 1}.</span><span className="stext">{s.text || s.scene || ''}</span></li>
      ))}
    </ol>
  );
}
// Recover complete shot objects from a VIDEO_PROMPT body even when the JSON is truncated (the model hit
// the token ceiling mid-array). Brace-matches each top-level {…} inside the "shots" array, string-aware,
// and keeps every shot that parses — the incomplete trailing one is simply dropped.
function salvageVideoPayload(raw: string): { format: string; aspectRatio: string; shots: any[] } | null {
  if (!raw) return null;
  const i = raw.indexOf('"shots"');
  const lb = i >= 0 ? raw.indexOf('[', i) : -1;
  if (lb < 0) return null;
  const shots: any[] = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let p = lb + 1; p < raw.length; p++) {
    const ch = raw[p];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') { if (depth === 0) start = p; depth++; }
    else if (ch === '}') { depth--; if (depth === 0 && start >= 0) { try { shots.push(JSON.parse(raw.slice(start, p + 1))); } catch { /* skip malformed */ } start = -1; } }
    else if (ch === ']' && depth === 0) break;
  }
  if (!shots.length) return null;
  const fmt = (raw.match(/"format"\s*:\s*"([^"]+)"/) || [])[1] || 'VERTICAL_AI_VIDEO';
  const ar = (raw.match(/"aspectRatio"\s*:\s*"([^"]+)"/) || [])[1] || '9:16';
  return { format: fmt, aspectRatio: ar, shots };
}
// The focused stage's content, by kind (prose · coverage sections · scene cards · numbered steps · Reader script paper · empty).
function StageCanvasBody({ active, t, projectId }: { active?: SxLadder; t: (k: string) => string; projectId?: string | null }) {
  const kind = active?.kind || '';
  const hasContent = !!(active && (active.body || active.scenes?.length || active.steps?.length));
  if (!hasContent) return <div className="cvempty" dir="auto">{t('Not written yet — generate this stage from the one before it.')}</div>;
  if (kind === 'DRAFT') return <div className="draftwrap"><ScriptPaper text={unwrapOutput(active!.body)} /></div>;
  if (kind === 'SCENES' && active!.scenes?.length) return <SceneCards scenes={active!.scenes!} t={t} />;
  if (kind === 'STEP_OUTLINE' && active!.steps?.length) return <StepList steps={active!.steps!} />;
  if (kind === 'COVERAGE') return <CoverageBody raw={active!.body} t={t} />;
  if (kind === 'VIDEO_PROMPT') {
    let payload: any = {};
    try { payload = JSON.parse(String(active!.body || '{}')); } catch { /* truncated — salvage below */ }
    // If the body didn't parse (token-cap truncation) or carried no shots, recover the complete shots so the
    // render panel still works without forcing a costly regenerate.
    if (!Array.isArray(payload?.shots) || !payload.shots.length) {
      const salv = salvageVideoPayload(String(active!.body || ''));
      if (salv) payload = salv;
    }
    return (<div dir="auto">
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'Courier Prime',ui-monospace,monospace", fontSize: 12, color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>{active!.body}</pre>
      <CohesiveEpisodePanel projectId={projectId || ''} stageVersionId={active!.versionId} payload={payload} />
      <VideoRenderPanel projectId={projectId || ''} stageVersionId={active!.versionId} payload={payload} />
    </div>);
  }
  const paras = cleanProse(active!.body).split(/\n{2,}/).filter((p) => p.trim());
  if (!paras.length) return <div className="cvempty" dir="auto">{t('Not written yet — generate this stage from the one before it.')}</div>;
  return <>{paras.map((p, i) => <p key={i} dir="auto">{p}</p>)}</>;
}

// Node 69:2 — body #0a0b0e; 76px rail #0c0d11; panels #14161c hairlined; track/chip/pending #1b1e25 (--track).
const CSS = `
.sx.develop{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;height:100%;background:#0a0b0e;color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.develop *{box-sizing:border-box;margin:0;padding:0}
.sx.develop svg{display:block}
.sx.develop .body{flex:1;display:flex;min-height:0}
/* Workspace rail (SxRail renders the markup; the host screen styles it) — node 69:34: 76px / #0c0d11 */

/* ── Two-pane body (node 69:81): 40 pad · 280 ladder · 20 · canvas · 16 · 268 context ── */
.sx.develop .dvbody{flex:1;min-height:0;display:flex;padding:28px 40px 44px}
.sx.develop .panel{background:var(--panel);border:1px solid var(--hair);border-radius:14px;display:flex;flex-direction:column;overflow:hidden}

/* Ladder rail (92:2) */
.sx.develop .ladderrail{width:280px;flex:none;margin-inline-end:20px}
.sx.develop .lhead{display:flex;align-items:flex-start;gap:9px;padding:15px 15px 13px}
.sx.develop .ltile{width:28px;height:28px;flex:none;border-radius:8px;background:var(--gold);display:grid;place-items:center;color:var(--goldink);font-size:13px;font-weight:600}
.sx.develop .lhh{display:flex;flex-direction:column;gap:4px;padding-top:1px}
.sx.develop .lht{font-family:var(--sx-body);font-weight:600;font-size:12.5px;color:var(--cream)}
.sx.develop .lhs{font-size:10px;color:var(--faint)}
.sx.develop .lrows{flex:1;min-height:0;overflow-y:auto;padding:0 7px}
.sx.develop .lrow{height:42px;display:flex;align-items:center;padding:0 9px;border-radius:10px;position:relative;cursor:pointer;margin-bottom:2px}
.sx.develop .lrow:hover{background:rgba(255,255,255,.03)}
.sx.develop .lrow.on{background:rgba(198,164,99,.10)}
.sx.develop .lrow.on:hover{background:rgba(198,164,99,.13)}
.sx.develop .lrow.on:before{content:"";position:absolute;inset-inline-start:0;top:9px;height:24px;width:3px;border-radius:3px;background:var(--gold)}
.sx.develop .ldot{width:18px;height:18px;flex:none;border-radius:9px;display:grid;place-items:center;margin-inline-end:9px;font-size:9px;font-weight:600}
.sx.develop .lrow.done .ldot{background:rgba(87,179,104,.2);color:var(--green)}
.sx.develop .lrow.on .ldot{background:var(--gold);color:var(--goldink);font-size:8px}
.sx.develop .lrow.wait .ldot{background:transparent;border:1.6px solid rgba(255,255,255,.18)}
.sx.develop .ltext{display:flex;flex-direction:column;gap:3px;min-width:0}
.sx.develop .lname{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.develop .lrow.done .lname{color:#b9c0b3}
.sx.develop .lrow.on .lname{color:var(--gold2)}
.sx.develop .lrow.wait .lname{color:var(--mute)}
.sx.develop .lsub{font-size:10px;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.develop .lfoot{padding:14px 15px 15px;border-top:1px solid var(--hair)}
.sx.develop .lfr{display:flex;align-items:center;justify-content:space-between;font-size:10.5px;color:var(--faint);margin-bottom:8px}
.sx.develop .lfr .lfn{font-weight:500}
.sx.develop .ltrack{height:6px;border-radius:99px;background:var(--track);overflow:hidden}
.sx.develop .ltrack i{display:block;height:6px;border-radius:99px;background:var(--gold)}

/* Stage canvas (93:2) */
.sx.develop .stagecanvas{flex:1;min-width:0;margin-inline-end:16px}
.sx.develop .cvhead{position:relative;padding:17px 23px 0;flex:none}
.sx.develop .cvname{font-family:var(--sx-title);font-weight:600;font-size:20px;color:var(--cream)}
.sx.develop .cvmeta{font-size:11px;color:var(--faint);margin-top:9px}
.sx.develop .cvctrl{position:absolute;top:17px;inset-inline-end:23px;display:flex;align-items:center;gap:12px}
.sx.develop .cvsw{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--mute)}
.sx.develop .cvsw b{color:var(--cream);font-weight:600}
.sx.develop .cvsw span{cursor:pointer;font-size:13px;color:var(--faint);user-select:none}
.sx.develop .cvsw span:hover{color:var(--gold2)}
.sx.develop .cvsw span.dis{opacity:.3;cursor:default;pointer-events:none}
.sx.develop .regen{background:none;border:none;color:var(--gold);font-size:17px;cursor:pointer;line-height:1}
.sx.develop .cvdiv{height:1px;background:var(--hair);margin:17px 19px 0}
.sx.develop .cvbody{flex:1;min-height:0;overflow-y:auto;padding:20px 23px}
.sx.develop .cvbody p{font-size:13px;line-height:20px;color:var(--text);margin-bottom:14px}
.sx.develop .cvempty{font-size:13px;color:var(--faint);line-height:20px}
/* Per-kind canvas (slice C) */
.sx.develop .cvsec{margin-bottom:4px}
.sx.develop .cvlabel{font-weight:600;font-size:10.5px;letter-spacing:.6px;color:var(--gold2);text-transform:uppercase;margin:18px 0 6px}
.sx.develop .cvsec:first-child .cvlabel{margin-top:0}
.sx.develop .cvprose{font-size:13px;line-height:20px;color:var(--text);white-space:pre-wrap}
.sx.develop .cvprose.verdict{font-weight:500}
.sx.develop .draftwrap{display:flex;justify-content:center;padding:2px 0 8px}
.sx.develop .scards{display:flex;flex-direction:column;gap:12px}
.sx.develop .scard{border:1px solid var(--hair);border-radius:12px;background:rgba(255,255,255,.02);padding:13px 15px}
.sx.develop .scard.flat{border-color:rgba(229,99,95,.45)}
.sx.develop .scslug{font-weight:600;font-size:12.5px;color:var(--cream);margin-bottom:6px}
.sx.develop .scbody{font-size:12.5px;line-height:19px;color:var(--mute);margin-bottom:9px}
.sx.develop .sctags{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.sx.develop .charge{font-size:11px;font-weight:600;color:var(--gold2);background:rgba(198,164,99,.13);padding:3px 9px;border-radius:999px}
.sx.develop .charge.flatc{color:var(--red);background:rgba(229,99,95,.13)}
.sx.develop .tag{font-size:11px;color:var(--faint);background:rgba(255,255,255,.05);padding:3px 9px;border-radius:999px}
.sx.develop .tag.red{color:var(--red);background:rgba(229,99,95,.13)}
.sx.develop .steps{list-style:none;display:flex;flex-direction:column;gap:12px}
.sx.develop .steps li{display:flex;gap:10px}
.sx.develop .steps .snum{color:var(--gold2);font-weight:600;font-size:13px;flex:none;min-width:22px}
.sx.develop .steps .stext{font-size:13px;line-height:20px;color:var(--text)}
.sx.develop .cvfoot{flex:none;border-top:1px solid var(--hair);padding:14px 23px}
.sx.develop .stbar{display:flex;align-items:center;gap:11px}
.sx.develop .spin{width:14px;height:14px;flex:none;border:2px solid var(--gold2);border-radius:7px;border-top-color:transparent;animation:dvspin 1s linear infinite}
@media (prefers-reduced-motion: reduce){.sx.develop .spin{animation:none}.sx.develop .ltrack .ind{animation:none;width:100%}}
@keyframes dvspin{to{transform:rotate(360deg)}}
.sx.develop .sttext{font-size:12.5px;font-weight:500;color:var(--gold2);flex:1;min-width:0}
.sx.develop .sttrack{height:5px;border-radius:99px;background:var(--track);overflow:hidden;margin-top:11px}
.sx.develop .sttrack .ind{display:block;height:5px;width:40%;border-radius:99px;background:var(--gold);animation:dcvsweep 1.5s ease-in-out infinite}
@keyframes dcvsweep{0%{margin-inline-start:-40%}100%{margin-inline-start:100%}}
.sx.develop .acts{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sx.develop .btn{height:34px;padding:0 15px;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid var(--hair2);background:transparent;color:var(--cream);display:inline-flex;align-items:center;gap:7px}
.sx.develop .btn:hover{border-color:var(--gold2)}
.sx.develop .btn:disabled{opacity:.45;cursor:not-allowed}
.sx.develop .btn:disabled:hover{border-color:var(--hair2)}
.sx.develop .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink)}
.sx.develop .btn.gold:hover{filter:brightness(1.05)}

/* Right context (94:2 spine, 94:14 comps) */
.sx.develop .ctxcol{width:268px;flex:none;display:flex;flex-direction:column;gap:16px;min-height:0}
.sx.develop .spine{flex:none}
.sx.develop .comps{flex:1;min-height:0}
.sx.develop .ctxin{padding:17px}
.sx.develop .ctxhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.sx.develop .ctxtitle{font-weight:600;font-size:13px;color:var(--cream)}
.sx.develop .badge{padding:4px 9px;border-radius:999px;background:rgba(198,164,99,.14);font-weight:600;font-size:9.5px;letter-spacing:.5px;color:var(--gold2)}
.sx.develop .srow{margin-top:14px}
.sx.develop .slabel{font-weight:600;font-size:10px;letter-spacing:.5px;color:var(--faint);margin-bottom:6px}
.sx.develop .sval{font-size:12.5px;line-height:18px;color:var(--text)}
.sx.develop .csub{font-size:11px;line-height:16px;color:var(--faint);margin:4px 0 14px}
.sx.develop .chips{display:flex;flex-wrap:wrap;gap:8px}
.sx.develop .chip{padding:5px 11px;border-radius:999px;background:rgba(198,164,99,.13);font-weight:500;font-size:12px;color:var(--gold2)}
.sx.develop .cnote{font-size:11px;line-height:16px;color:var(--mute);margin-top:16px}
.sx.develop .cempty{font-size:11.5px;line-height:16px;color:var(--faint);margin-top:6px}

/* ── Responsive · portrait (tablet 78:2 / mobile 80:2) — no OS rail; stacked column ── */
.sx.develop .pbody{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:16px;padding:22px 26px 26px}
.sx.develop .pheader{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;flex:none}
.sx.develop .pheader h1{font-family:var(--sx-title);font-weight:600;font-size:26px;color:var(--cream)}
.sx.develop .pheader .psub{font-size:13px;color:#6b7380}
/* ladder chip strip (107:20) */
.sx.develop .ladcard{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:14px 19px;flex:none}
.sx.develop .ladtop{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.sx.develop .ladlabel{font-weight:600;font-size:12.5px;color:var(--cream);margin-inline-end:4px}
.sx.develop .lchip{display:inline-flex;align-items:center;gap:7px;background:var(--track);padding:7px 13px 7px 11px;border-radius:999px;font-size:12.5px;font-weight:500;cursor:pointer;border:1px solid transparent;color:var(--mute)}
.sx.develop .lchip .cdot{width:9px;height:9px;border-radius:9px;flex:none;background:#3a3f49}
.sx.develop .lchip.done{color:#b9c0b3}
.sx.develop .lchip.done .cdot{background:var(--green)}
.sx.develop .lchip.on{background:rgba(198,164,99,.12);border-color:rgba(198,164,99,.5);color:var(--gold2)}
.sx.develop .lchip.on .cdot{background:var(--gold)}
.sx.develop .ladbar{display:flex;align-items:center;gap:14px;margin-top:13px;padding-top:13px;border-top:1px solid var(--hair)}
.sx.develop .ladbar .ltrack{flex:1;height:5px}
.sx.develop .ladbar .ltrack i{height:5px}
.sx.develop .ladcount{font-size:11px;color:var(--faint);white-space:nowrap;font-weight:500}
/* portrait canvas + context */
.sx.develop .pbody .stagecanvas{flex:none;margin:0}
.sx.develop .pbody .cvbody{flex:none;max-height:62vh}
.sx.develop .pctx{display:grid;grid-template-columns:1fr 1fr;gap:16px;flex:none}
.sx.develop .pctx .spine,.sx.develop .pctx .comps{flex:none}
.sx.develop[data-vp="mobile"] .pctx{grid-template-columns:1fr}
.sx.develop[data-vp="mobile"] .pheader{flex-direction:column;gap:4px;align-items:flex-start}
/* mobile script paper — horizontally scrollable (don't reflow screenplay geometry) */
.sx.develop[data-vp="mobile"] .draftwrap{justify-content:flex-start;overflow-x:auto}
`;

function StatusBar({ t, label }: { t: (k: string) => string; label: string }) {
  return (
    <div>
      <div className="stbar">
        <span className="spin" />
        <span className="sttext">{t('Generating')} {label} — {t('this can take a minute or two')}</span>
      </div>
      <div className="sttrack"><span className="ind" /></div>
    </div>
  );
}

export default function ScriptonDevelop(props: ScriptonDevelopProps) {
  const { t, dir } = useLocale();
  const ladder = props.ladder || [];
  const TOTAL = ladder.length || 8;   // stage count tracks the build's real ladder (feature = 8, vertical AI micro-drama = 10, …)

  // Counters (node §2): done = stages with a version (the node's 7/8 = Coverage mid-generation has
  // no version yet; a fully-developed build is 8/8). pct = round(done/total*100).
  // A stage cut off at its token ceiling has a version but is NOT done (stage-truncation.util).
  const done = useMemo(() => ladder.filter((l) => !!l.versionId && !l.truncation).length, [ladder]);
  const pct = Math.round((done / TOTAL) * 100);

  // The focused stage — defaults to the furthest-developed stage (the current 'on'); ladder rows switch it.
  const defaultKind = useMemo(() => {
    const last = [...ladder].reverse().find((l) => l.versionId || l.state === 'on');
    return last?.kind || ladder[0]?.kind || '';
  }, [ladder]);
  const [focusKind, setFocusKind] = useState<string>(defaultKind);
  useEffect(() => { setFocusKind(defaultKind); }, [defaultKind]);

  const active = ladder.find((l) => l.kind === focusKind) || ladder.find((l) => l.state === 'on') || ladder[ladder.length - 1];
  const activeIdx = Math.max(0, ladder.findIndex((l) => l.kind === active?.kind));
  const nextStage = ladder.find((l) => !l.versionId); // next stage with no version yet
  // A CUT-OFF STAGE IS NOT BUILT ON (the server refuses; this says so before the click). The next stage
  // waits on any cut-off stage before it; the script waits on any cut-off stage it is written from.
  const cutBeforeNext = nextStage ? ladder.slice(0, ladder.indexOf(nextStage)).filter((l) => l.truncation) : [];
  const cutForScript = ladder.filter((l) => l.truncation && l.kind !== 'COVERAGE');
  const names = (ls: SxLadder[]) => ls.map((l) => l.name).join(', ');
  const metaHint = (() => {
    switch (active?.kind) {
      case 'LOGLINE': return t('the promise in one line');
      case 'SYNOPSIS': return t('the story in brief');
      case 'TREATMENT': return t('the film in prose');
      case 'BEATS': return active?.framework || t('the beat map');
      case 'SCENES': return (active?.scenes?.length || 0) + ' ' + t('scenes');
      case 'STEP_OUTLINE': return (active?.steps?.length || 0) + ' ' + t('steps');
      case 'DRAFT': return t('feature draft');
      case 'COVERAGE': return t('grounded in your pages');
      default: return '';
    }
  })();

  // Top-bar ring + V ▾ — resolve the OPEN BUILD's linked kernel script, then its active version's
  // continuity + label. Builds whose script has renders light up; otherwise honestly hidden (no fake).
  const [hdr, setHdr] = useState<{ continuity: number | null; versionLabel: string | null; title: string | null }>({ continuity: null, versionLabel: null, title: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!props.projectId || !props.buildId) return;
      try {
        // ADDRESS THE BUILD BY ITS ID. This used to list EVERY build in props.projectId — twice, active
        // and bin — and search the result for one id. Besides being O(all builds) to read one, the list
        // is scoped to a single project, so a build living in another project was simply never found
        // and the header silently lost its title and continuity ring. Three of the recovered builds
        // are in other projects.
        const br: any = await productionApi.scripton.development.getBuild(props.buildId).catch(() => ({ data: null }));
        const build = br?.data || null;
        const sid = build?.linkedScriptId;
        if (!sid) { if (alive) setHdr((h) => ({ ...h, title: build?.name || null })); return; }
        const vr: any = await productionApi.scripton.versions(sid);
        const vs: any[] = vr.data?.versions || [];
        const av = vs.find((v) => v.active) || vs[vs.length - 1];
        if (alive) setHdr({ continuity: av && typeof av.continuity === 'number' ? av.continuity : null, versionLabel: av?.label || (av ? 'V' + av.n : null), title: build?.name || null });
      } catch { /* degrade — ring/V stay hidden */ }
    })();
    return () => { alive = false; };
  }, [props.projectId, props.buildId]);

  const stageLabel = (kind?: string) => t(LABEL[kind || ''] || kind || '');
  const vp = props.vp;
  const portrait = vp !== 'desktop';

  // Ladder rail (desktop, vertical — 92:2): dot + name + sub per row, highlight follows focus.
  const ladderRail = (
    <div className="panel ladderrail">
      <div className="lhead">
        <div className="ltile">✦</div>
        <div className="lhh">
          <div className="lht">{t('The ladder')}</div>
          <div className="lhs">{done} / {TOTAL} {t('stages')}</div>
        </div>
      </div>
      <div className="lrows">
        {ladder.map((l, i) => {
          // Row highlight follows the FOCUSED stage (gold ●); others show ✓ (has a version) or hollow pending.
          const st = l.kind === focusKind ? 'on' : (l.versionId ? 'done' : 'wait');
          const cut = !!l.truncation && l.kind !== props.genBusy;
          const sub = l.kind === props.genBusy ? t('writing…') : cut ? ('V' + (l.versionN || 1) + ' · ' + t('incomplete — cut off')) : (l.versionN ? 'V' + l.versionN + (l.framework ? ' · ' + l.framework : '') : (!l.versionId ? t('pending') : (l.sub || '')));
          const dot = cut ? '!' : st === 'done' ? '✓' : st === 'on' ? '●' : '';
          return (
            <button key={l.kind || i} className={'lrow ' + st} onClick={() => l.kind && setFocusKind(l.kind)} title={cut ? l.truncation!.note : l.name}>
              <span className="ldot" style={cut ? { color: '#e5635f' } : undefined}>{dot}</span>
              <span className="ltext"><span className="lname">{l.name}</span><span className="lsub" style={cut ? { color: '#e5635f' } : undefined}>{sub}</span></span>
            </button>
          );
        })}
      </div>
      <div className="lfoot">
        <div className="lfr"><span>{t('Pipeline')}</span><span className="lfn">{done} / {TOTAL}</span></div>
        <div className="ltrack"><i style={{ width: pct + '%' }} /></div>
      </div>
    </div>
  );

  // Ladder chip strip (portrait, horizontal wrap — 107:20): dot + stage name; same focus/state model.
  const ladderStrip = (
    <div className="ladcard">
      <div className="ladtop">
        <span className="ladlabel">{t('The ladder')}</span>
        {ladder.map((l, i) => {
          const st = l.kind === focusKind ? 'on' : (l.versionId ? 'done' : 'wait');
          return (
            <button key={l.kind || i} className={'lchip ' + st} onClick={() => l.kind && setFocusKind(l.kind)} title={l.truncation ? l.truncation.note : undefined} style={l.truncation ? { color: '#e5635f' } : undefined}>
              <span className="cdot" />{l.name}{l.truncation ? ' !' : ''}
            </button>
          );
        })}
      </div>
      <div className="ladbar">
        <div className="ltrack"><i style={{ width: pct + '%' }} /></div>
        <span className="ladcount">{done} / {TOTAL} {t('stages')}</span>
      </div>
    </div>
  );

  // Stage canvas (93:2 / 108:2) — per-kind body (slice C), version/regenerate/advance/promote (slice D).
  const stageCanvas = (
    <div className="panel stagecanvas">
      <div className="cvhead">
        <div className="cvname">{stageLabel(active?.kind)}</div>
        <div className="cvmeta">{t('Stage')} {activeIdx + 1} {t('of')} {TOTAL}{metaHint ? ' · ' + metaHint : ''}</div>
        <div className="cvctrl">
          {active?.versionN ? (() => {
            const count = active.versionCount || 1;
            const atFirst = (active.versionN || 1) <= 1, atLast = (active.versionN || 1) >= count;
            return (
              <span className="cvsw">
                <span className={atFirst ? 'dis' : ''} onClick={() => !atFirst && active.stageId && props.onSwitchVersion(active.stageId, -1)}>‹</span>
                <b>V{active.versionN}{count > 1 ? '/' + count : ''}</b>
                <span className={atLast ? 'dis' : ''} onClick={() => !atLast && active.stageId && props.onSwitchVersion(active.stageId, 1)}>›</span>
              </span>
            );
          })() : null}
          <button className="regen" title={t('Regenerate')} onClick={() => active?.kind && props.onRegenerate(active.kind)}>⟳</button>
        </div>
      </div>
      <div className="cvdiv" />
      <div className="cvbody">
        <SxTruncationBanner tr={active?.truncation} t={t} />
        <StageCanvasBody active={active} t={t} projectId={props.projectId} />
      </div>
      <div className="cvfoot">
        {props.genBusy ? (
          <StatusBar t={t} label={stageLabel(props.genBusy)} />
        ) : (
          <div className="acts">
            {(cutBeforeNext.length || (active?.kind === 'DRAFT' && cutForScript.length)) ? (
              <div style={{ flexBasis: '100%', color: '#e5635f', fontSize: 12 }}>
                {t('Regenerate first')}: {names(cutBeforeNext.length ? cutBeforeNext : cutForScript)} — {t('incomplete — cut off')}. {t('Nothing is written from a cut-off stage; you can still read, copy and export it.')}
              </div>
            ) : null}
            {active?.kind === 'DRAFT' && active.versionId && props.onPromoteScript
              ? <button className="btn gold" disabled={!!cutForScript.length} title={cutForScript.length ? t('Blocked') + ': ' + names(cutForScript) + ' ' + t('incomplete — cut off') : undefined}
                  onClick={() => { if (!cutForScript.length) props.onPromoteScript!(active.versionId!); }}>↗ {t('Generate script → Library')}</button>
              : null}
            {nextStage
              ? <button className={'btn' + (active?.kind === 'DRAFT' ? '' : ' gold')} disabled={!!cutBeforeNext.length} title={cutBeforeNext.length ? t('Blocked') + ': ' + names(cutBeforeNext) + ' ' + t('incomplete — cut off') : undefined}
                  onClick={() => { if (!cutBeforeNext.length) props.onAdvance(); }}>{t('Generate')} {stageLabel(nextStage.kind)} →</button>
              : null}
            {active?.kind ? <button className="btn" onClick={() => props.onRegenerate(active.kind!)}>⟳ {t('Regenerate')} {stageLabel(active.kind)}</button> : null}
          </div>
        )}
      </div>
    </div>
  );

  const spinePanel = (
    <div className="panel spine">
      <div className="ctxin">
        <div className="ctxhead">
          <div className="ctxtitle">{t('The spine')}</div>
          <div className="badge">{t('AGREED FIRST')}</div>
        </div>
        {props.spine.map((s, i) => (
          <div className="srow" key={i}>
            <div className="slabel">{s.k.toUpperCase()}</div>
            <div className="sval">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const compsPanel = (
    <div className="panel comps">
      <div className="ctxin">
        <div className="ctxhead"><div className="ctxtitle">{t('Comparables')}</div></div>
        <div className="csub">{t('Auto — closest titles by tone, scale & market.')}</div>
        {props.comps.length ? (
          <div className="chips">{props.comps.map((c, i) => <span className="chip" key={i}>{c}</span>)}</div>
        ) : (
          <div className="cempty">{t('No comparables yet — they surface with coverage.')}</div>
        )}
        <div className="cnote">{t('Comparables steer tone, scale & market — not plot.')}</div>
      </div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <ScriptonShell
        screen="develop" active="develop" vp={vp} onBack={props.onBack}
        rail={!portrait}
        bodyClassName={portrait ? 'pbody' : 'body'}
        topbar={{
          // Desktop: the title sits centred in the bar. Portrait (78:2/80:2): the title is a body header
          // instead and the bar carries no search — brand + crumb + ring (+ V2/avatars at tablet).
          centerTitle: portrait ? undefined : { title: 'Develop', sub: 'Nothing is written until the spine is agreed.' },
          noSearch: true,
          continuity: hdr.continuity,
          versionLabel: hdr.versionLabel ?? undefined,
          scriptTitle: hdr.title ?? undefined,
        }}
      >
        {portrait ? (
          <>
            <div className="pheader"><h1>{t('Develop')}</h1><span className="psub">{t('Nothing is written until the spine is agreed.')}</span></div>
            {ladderStrip}
            {stageCanvas}
            <div className="pctx">{spinePanel}{compsPanel}</div>
          </>
        ) : (
          <div className="dvbody">
            {ladderRail}
            {stageCanvas}
            <div className="ctxcol">{spinePanel}{compsPanel}</div>
          </div>
        )}
      </ScriptonShell>
    </>
  );
}
