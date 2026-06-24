'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { productionApi } from '@/lib/api';

const LB_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Courier+Prime:wght@400;700&display=swap');
.lb{--paper:#F7F4EC;--paper2:#efe9dc;--ink:#23231f;--ink2:#54514a;--faint:#8a857a;--gold:#9c7b33;--gold2:#C6A463;--line:rgba(35,35,31,.14);--green:#3f7a4e;--amber:#a9772a;--red:#b0463f}
.lb,.lb *{box-sizing:border-box;margin:0;padding:0}
.lbwrap{background:#0c0d10;padding:34px;display:flex;flex-direction:column;align-items:center;gap:18px}
.lb .page{width:780px;min-height:1010px;background:var(--paper);border-radius:5px;box-shadow:0 40px 90px -25px rgba(0,0,0,.7);position:relative;overflow:hidden;padding:60px 64px 54px;display:flex;flex-direction:column;font-family:Inter,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}
.lb .serif{font-family:Fraunces,serif}.lb .mono{font-family:"Courier Prime",monospace}
.lb .kicker{font-size:11px;font-weight:700;letter-spacing:2.4px;color:var(--gold);text-transform:uppercase}
.lb .small{font-size:10.5px;letter-spacing:1px;color:var(--faint)}
.lb .rule{height:2px;background:linear-gradient(90deg,var(--gold2),rgba(156,123,51,.15));border:none;margin:16px 0}
.lb .rule.thin{height:1px;background:var(--line);margin:14px 0}
.lb .brandrow{display:flex;align-items:center;justify-content:space-between}
.lb .brand{display:flex;align-items:center;gap:10px;font-family:"Courier Prime",monospace;font-size:11px;letter-spacing:1.5px;color:var(--ink2)}
.lb .brand .m{width:26px;height:26px;border-radius:7px;background:linear-gradient(160deg,#23231f,#3a382f);color:var(--gold2);display:grid;place-items:center;font-family:Inter;font-weight:800;font-size:10px;letter-spacing:0}
.lb .cover-mid{flex:1;display:flex;flex-direction:column;justify-content:center}
.lb .title{font-family:Fraunces,serif;font-size:70px;line-height:.96;font-weight:600;letter-spacing:-1.5px;color:var(--ink)}
.lb .fmt{margin-top:18px;font-size:13px;font-weight:600;letter-spacing:.5px;color:var(--ink2)}
.lb .logline{font-family:Fraunces,serif;font-style:italic;font-size:21px;line-height:1.42;color:var(--ink);max-width:560px;margin-top:26px}
.lb .fans{margin-top:24px;font-size:11.5px;letter-spacing:.4px;color:var(--ink2)}.lb .fans b{color:var(--gold);font-weight:700}
.lb .cover-foot{display:flex;justify-content:space-between;align-items:flex-end;font-size:10.5px;letter-spacing:.6px;color:var(--faint)}
.lb .h2{font-family:Fraunces,serif;font-size:28px;font-weight:600;letter-spacing:-.5px;color:var(--ink)}
.lb .lead{font-size:13px;line-height:1.55;color:var(--ink2);margin-top:5px}
.lb .data{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:9px 16px;margin-top:16px;padding:15px 17px;background:var(--paper2);border:1px solid var(--line);border-radius:11px}
.lb .data .dk{font-family:"Courier Prime",monospace;font-size:9.5px;letter-spacing:.6px;color:var(--faint);text-transform:uppercase;align-self:center}
.lb .data .dv{font-size:12.5px;font-weight:600;color:var(--ink)}
.lb .verdrow{display:flex;gap:12px;margin:18px 0 0}
.lb .vcard{flex:1;border:1px solid var(--line);border-radius:11px;padding:12px 14px;background:#fff}
.lb .vcard .vl{font-size:9.5px;font-weight:700;letter-spacing:1px;color:var(--faint)}
.lb .vcard .vv{font-family:Fraunces,serif;font-size:20px;font-weight:600;margin-top:3px}.lb .vcard.ov .vv{font-size:27px}
.lb .scoreline{display:grid;grid-template-columns:repeat(6,1fr);gap:9px;margin-top:14px}
.lb .sc{border:1px solid var(--line);border-radius:9px;padding:9px 10px;background:#fff}
.lb .sc .scl{font-size:8.5px;font-weight:700;letter-spacing:.4px;color:var(--faint)}
.lb .sc .scv{font-family:Fraunces,serif;font-size:19px;font-weight:600;margin-top:2px}.lb .sc .scv small{font-size:10px;color:var(--faint)}
.lb .sc .scb{height:4px;border-radius:3px;background:#e3ddce;margin-top:6px;overflow:hidden}.lb .sc .scb i{display:block;height:100%;border-radius:3px}
.lb .block{margin-top:20px}.lb .block .kicker{margin-bottom:8px}
.lb .synop{font-size:12.5px;line-height:1.68;color:var(--ink);font-family:Fraunces,serif}
.lb .cmts{columns:2;column-gap:30px;margin-top:6px}
.lb .cmt{break-inside:avoid;margin-bottom:15px}
.lb .cmt h4{font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gold);margin-bottom:4px}
.lb .cmt p{font-size:11.5px;line-height:1.5;color:var(--ink2)}
.lb .comps{display:flex;flex-direction:column;gap:7px;margin-top:8px}
.lb .comp{display:flex;gap:12px;font-size:11.5px;color:var(--ink2);align-items:baseline}
.lb .comp .cnm{font-weight:700;color:var(--ink);width:120px;flex:none}.lb .comp .cy{font-family:"Courier Prime",monospace;font-size:10px;color:var(--faint);width:42px;flex:none}
.lb .cbreak{display:flex;flex-direction:column;gap:13px;margin-top:14px}
.lb .cb2{border:1px solid var(--line);border-radius:12px;padding:15px 17px;background:#fff;display:flex;gap:16px}
.lb .cb2 .cinit{width:46px;height:46px;border-radius:11px;flex:none;display:grid;place-items:center;font-family:Fraunces,serif;font-weight:600;font-size:19px;color:#fff;background:linear-gradient(150deg,#b9974f,#8c6c2f)}
.lb .cb2 .cmain{flex:1}
.lb .cb2 .cn{font-size:15px;font-weight:800;color:var(--ink);letter-spacing:-.2px}
.lb .cb2 .cfields{display:grid;grid-template-columns:repeat(5,auto);gap:3px 18px;margin:7px 0 9px}
.lb .cb2 .cf .k{font-family:"Courier Prime",monospace;font-size:8px;letter-spacing:.4px;color:var(--faint);text-transform:uppercase}
.lb .cb2 .cf .v{font-size:11px;font-weight:600;color:var(--ink);margin-top:1px}
.lb .cb2 .cdesc{font-size:11.5px;line-height:1.55;color:var(--ink2)}
.lb .cb2 .cpct{flex:none;width:64px;text-align:right}.lb .cb2 .cpct .n{font-family:Fraunces,serif;font-size:21px;font-weight:600;color:var(--gold)}.lb .cb2 .cpct .l{font-size:8px;color:var(--faint);letter-spacing:.4px}
.lb .boards{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin-top:14px}
.lb .board{border-radius:11px;height:118px;position:relative;overflow:hidden;border:1px solid var(--line)}
.lb .board .bc{position:absolute;left:0;right:0;bottom:0;padding:9px 11px;background:linear-gradient(0deg,rgba(20,18,14,.78),transparent);color:#fff}
.lb .board .bk{font-size:8.5px;font-weight:800;letter-spacing:.8px;opacity:.85}.lb .board .bt{font-size:11px;font-weight:600;margin-top:1px;line-height:1.25}
.lb .board .rf{position:absolute;top:8px;right:9px;font-size:8px;letter-spacing:.5px;color:rgba(255,255,255,.7);font-family:"Courier Prime",monospace}
.lb .mtable{width:100%;border-collapse:collapse;margin-top:12px;font-size:11.5px}
.lb .mtable th{text-align:left;font-size:9px;letter-spacing:.6px;color:var(--faint);text-transform:uppercase;padding:6px 8px;border-bottom:1.5px solid var(--line)}
.lb .mtable td{padding:7px 8px;border-bottom:1px solid var(--line);color:var(--ink2)}.lb .mtable td b{color:var(--ink)}
.lb .quad{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}
.lb .qc{border:1px solid var(--line);border-radius:7px;padding:7px 9px;background:#fff;font-size:10px}.lb .qc .ql{color:var(--faint);font-weight:600}.lb .qc .qv{font-weight:800;margin-top:2px}
.lb .ranges{display:flex;gap:10px;margin-top:12px}
.lb .rg{flex:1;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--paper2);text-align:center}
.lb .rg .rgl{font-size:9px;font-weight:700;letter-spacing:.6px;color:var(--faint)}.lb .rg .rgv{font-family:Fraunces,serif;font-size:18px;font-weight:600;margin-top:3px;color:var(--ink)}
.lb .disc{font-size:10px;font-style:italic;color:var(--faint);margin-top:14px;line-height:1.5}
.lb .pgnum{position:absolute;bottom:28px;right:64px;font-family:"Courier Prime",monospace;font-size:10px;color:var(--faint)}
@media print{@page{size:A4;margin:0}.lbwrap{padding:0;gap:0;background:#fff}.lb .page{box-shadow:none;border-radius:0;margin:0;page-break-after:always;min-height:auto}.noprint{display:none!important}}
`;

function esc(v: any) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtDate(s: any) { if (!s) return '—'; const t = new Date(s); return isNaN(t.getTime()) ? '—' : t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function scClr(n: any) { const v = Number(n) || 0; return v >= 8 ? 'var(--green)' : v >= 6 ? 'var(--gold2)' : v >= 4 ? 'var(--amber)' : 'var(--red)'; }
const BOARD_BG = ['linear-gradient(150deg,#2a3550,#0f1622)', 'linear-gradient(150deg,#3a2330,#161019)', 'linear-gradient(150deg,#332c1c,#15120a)', 'linear-gradient(150deg,#1f3329,#0f1713)', 'linear-gradient(150deg,#26283a,#111018)', 'linear-gradient(150deg,#3a2a22,#16100c)'];
const CINIT_BG = ['linear-gradient(150deg,#b9974f,#8c6c2f)', 'linear-gradient(150deg,#5b8def,#3f5e9e)', 'linear-gradient(150deg,#8b7cf0,#5d4fb0)', 'linear-gradient(150deg,#3f7a4e,#2c5638)', 'linear-gradient(150deg,#a9772a,#7a531c)', 'linear-gradient(150deg,#b0463f,#7e2f2a)'];

function buildLookbookHtml(d: any) {
  const c = d.coverage || {}; const facts = c.facts || {};
  const title = c.title || d.title || 'Untitled';
  const genre = c.genre || '—';
  const time = facts.time || c.time || 'Unspecified';
  const locale = facts.locale || c.locale || 'Unspecified';
  const pages = facts.pages || facts.pageCount || facts.sceneCount || '—';
  const writer = c.writer || '—';
  const date = fmtDate(c.createdAt);
  const scores = c.scores || {};
  const overall = scores.overall != null ? scores.overall : '—';
  const dims: [string, any][] = [['PREMISE', scores.premise], ['PLOT', scores.plot], ['CHARACTER', scores.characters], ['DIALOGUE', scores.dialogue], ['STRUCTURE', scores.structure], ['MARKET', scores.marketability]];
  const rec = c.recommendation || '—'; const wrec = c.writerRecommendation || '—';
  const recClr = (x: string) => x === 'RECOMMEND' ? 'var(--green)' : x === 'CONSIDER' ? 'var(--amber)' : x === 'PASS' ? 'var(--red)' : 'var(--ink2)';
  const comments = c.comments || {};
  const cmtDefs: [string, string][] = [['plot', 'PLOT'], ['characters', 'CHARACTERS'], ['dialogue', 'DIALOGUE'], ['theme', 'THEME'], ['originality', 'ORIGINALITY'], ['marketability', 'MARKETABILITY'], ['production', 'PRODUCTION']];
  const comps = (Array.isArray(d.comps) && d.comps.length ? d.comps : (c.comps || [])).slice(0, 7);
  const chars = (Array.isArray(c.characters) && c.characters.length ? c.characters : (d.roles || [])).slice(0, 6);
  const boards = (d.boards || []).slice(0, 6);
  const market = d.market || {}; const quad = market.quadrant || {}; const ranges = market.ranges || {};

  const scoreCells = dims.map(([l, v]) => `<div class="sc"><div class="scl">${esc(l)}</div><div class="scv">${v != null ? esc(v) : '—'}<small>/10</small></div><div class="scb"><i style="width:${(Number(v) || 0) * 10}%;background:${scClr(v)}"></i></div></div>`).join('');
  const cmtBlocks = cmtDefs.filter(([k]) => comments[k]).map(([k, lbl]) => `<div class="cmt"><h4>${esc(lbl)}</h4><p>${esc(comments[k])}</p></div>`).join('') || '<div class="cmt"><p style="color:var(--faint)">Run coverage to populate comments.</p></div>';
  const compList = comps.map((x: any) => { const t = x.title || x.name || x; const y = x.year || ''; const det = x.rationale || x.reason || (x.metrics && x.metrics.metric) || ''; return `<div class="comp"><span class="cnm">${esc(t)}</span><span class="cy">${esc(y)}</span><span>${esc(det)}</span></div>`; }).join('') || '<div class="comp"><span style="color:var(--faint)">No comparables yet — run the market read.</span></div>';
  const charCards = chars.map((x: any, i: number) => {
    const name = x.name || x.role || 'ROLE'; const role = x.role || x.importance || '—';
    const age = x.age || x.ageRange || '—'; const gender = x.gender || '—';
    const eth = x.ethnicity || 'Unspecified'; const nat = x.nationality || '—';
    const desc = x.description || x.arc || x.physicality || '';
    const pct = x.scenesPct != null ? x.scenesPct + '%' : '—';
    return `<div class="cb2"><div class="cinit" style="background:${CINIT_BG[i % CINIT_BG.length]}">${esc(String(name).charAt(0).toUpperCase())}</div><div class="cmain"><div class="cn">${esc(name)}</div><div class="cfields"><div class="cf"><div class="k">Role</div><div class="v">${esc(role)}</div></div><div class="cf"><div class="k">Age</div><div class="v">${esc(age)}</div></div><div class="cf"><div class="k">Gender</div><div class="v">${esc(gender)}</div></div><div class="cf"><div class="k">Ethnicity</div><div class="v">${esc(eth)}</div></div><div class="cf"><div class="k">Nationality</div><div class="v">${esc(nat)}</div></div></div><div class="cdesc">${esc(desc)}</div></div><div class="cpct"><div class="n">${esc(pct)}</div><div class="l">SCENES</div></div></div>`;
  }).join('') || '<div class="cb2"><div class="cmain"><div class="cdesc" style="color:var(--faint)">Run coverage to populate the character breakdown.</div></div></div>';
  const boardTiles = boards.map((b: any, i: number) => `<div class="board" style="background:${BOARD_BG[i % BOARD_BG.length]}"><span class="rf">REF</span><div class="bc"><div class="bk">${esc(String(b.kind || 'MOOD'))}</div><div class="bt">${esc(b.caption || '')}</div></div></div>`).join('') || '<div class="board" style="background:linear-gradient(150deg,#2a3550,#0f1622)"><div class="bc"><div class="bt">Run the look-board plan</div></div></div>';
  const qcell = (l: string, v: any) => { const s = String(v || '—').toUpperCase(); const clr = s === 'HIGH' ? 'var(--green)' : s.indexOf('MED') === 0 ? 'var(--amber)' : 'var(--ink2)'; return `<div class="qc"><div class="ql">${esc(l)}</div><div class="qv" style="color:${clr}">${esc(s)}</div></div>`; };

  return `
<div class="lb">
<div class="page">
  <div class="brandrow"><div class="brand"><span class="m">TFM</span>SCRIPON · DEVELOPMENT LOOKBOOK</div><div class="small">CONFIDENTIAL</div></div>
  <div class="cover-mid"><div class="kicker">${esc(genre)}</div><div class="title">${esc(title)}</div><div class="fmt">${esc(pages)} pages · ${esc(time)} · ${esc(locale)}</div>${c.logline ? `<div class="logline">“${esc(c.logline)}”</div>` : ''}${comps.length ? `<div class="fans">FOR FANS OF&nbsp;&nbsp;${comps.slice(0, 3).map((x: any) => '<b>' + esc(x.title || x.name || x) + '</b>').join(' · ')}</div>` : ''}</div>
  <hr class="rule"><div class="cover-foot"><div>Generated by ScripON · grounded in real scenes, breakdown &amp; budget</div><div class="small">${esc(date)}</div></div>
</div>
<div class="page">
  <div class="brandrow"><div class="brand"><span class="m">TFM</span>${esc(title)} · LOOKBOOK</div><div class="small">02 — DATA &amp; SYNOPSIS</div></div><hr class="rule">
  <div class="h2">The read</div>
  <div class="data"><div class="dk">Writer</div><div class="dv">${esc(writer)}</div><div class="dk">Date submitted</div><div class="dv">${esc(date)}</div><div class="dk">Pages</div><div class="dv">${esc(pages)}</div><div class="dk">Time</div><div class="dv">${esc(time)}</div><div class="dk">Locale</div><div class="dv">${esc(locale)}</div><div class="dk">Genre</div><div class="dv">${esc(genre)}</div></div>
  <div class="verdrow"><div class="vcard ov"><div class="vl">OVERALL</div><div class="vv">${esc(overall)} <span style="font-size:12px;color:var(--faint)">/10</span></div></div><div class="vcard"><div class="vl">SCRIPT</div><div class="vv" style="color:${recClr(rec)}">${esc(rec)}</div></div><div class="vcard"><div class="vl">WRITER</div><div class="vv" style="color:${recClr(wrec)}">${esc(wrec)}</div></div></div>
  <div class="scoreline">${scoreCells}</div>
  ${c.logline ? `<div class="block"><div class="kicker">Logline</div><div class="synop" style="font-style:italic">${esc(c.logline)}</div></div>` : ''}
  ${c.synopsis ? `<div class="block"><div class="kicker">Synopsis</div><div class="synop" style="margin-top:6px">${esc(c.synopsis)}</div></div>` : ''}
  <div class="pgnum">02</div>
</div>
<div class="page">
  <div class="brandrow"><div class="brand"><span class="m">TFM</span>${esc(title)} · LOOKBOOK</div><div class="small">03 — COMMENTS</div></div><hr class="rule">
  <div class="h2">Comments</div><div class="lead">Specific, honest analysis — every concern cites a scene; weaknesses are named, not smoothed over.</div>
  <div class="cmts">${cmtBlocks}</div>
  <hr class="rule thin"><div class="kicker" style="margin-bottom:6px">Comparisons</div><div class="comps">${compList}</div>
  <div class="pgnum">03</div>
</div>
<div class="page">
  <div class="brandrow"><div class="brand"><span class="m">TFM</span>${esc(title)} · LOOKBOOK</div><div class="small">04 — CHARACTER BREAKDOWN</div></div><hr class="rule">
  <div class="h2">Character breakdown</div><div class="lead">Roles by type and function — no performers attached. Scenes-% is computed from the real scene model.</div>
  <div class="cbreak">${charCards}</div>
  <div class="pgnum">04</div>
</div>
<div class="page">
  <div class="brandrow"><div class="brand"><span class="m">TFM</span>${esc(title)} · LOOKBOOK</div><div class="small">05 — WORLD &amp; MARKET</div></div><hr class="rule">
  <div class="h2">World &amp; market</div><div class="lead">A tonal world board (no faces) and an honest market read — comparables and ranges, never a guarantee.</div>
  <div class="boards">${boardTiles}</div>
  <div class="small" style="margin-top:8px">Look-board plan · no faces · images bound to licensed sources (Unsplash · Pexels · Wikimedia) on export.</div>
  <hr class="rule thin">
  <table class="mtable"><tr><th>Comparable</th><th>Year</th><th>Budget tier</th><th>Outcome / note</th></tr>${comps.map((x: any) => `<tr><td><b>${esc(x.title || x.name || x)}</b></td><td>${esc(x.year || '')}</td><td>${esc(x.budgetTier || '')}</td><td>${esc(x.rationale || x.reason || (x.metrics && x.metrics.metric) || '')}</td></tr>`).join('')}</table>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:18px">
    <div><div class="kicker" style="margin-bottom:6px">Four-quadrant reach</div><div class="quad">${qcell('Male < 25', quad.maleUnder25)}${qcell('Male 25+', quad.maleOver25)}${qcell('Female < 25', quad.femaleUnder25)}${qcell('Female 25+', quad.femaleOver25)}</div></div>
    <div><div class="kicker" style="margin-bottom:6px">Outcome range · illustrative</div><div class="ranges"><div class="rg"><div class="rgl">P10 · LOW</div><div class="rgv">${esc(ranges.low || '—')}</div></div><div class="rg"><div class="rgl">P50 · MID</div><div class="rgv">${esc(ranges.mid || '—')}</div></div><div class="rg"><div class="rgl">P90 · HIGH</div><div class="rgv">${esc(ranges.high || '—')}</div></div></div><div class="small" style="margin-top:7px">Confidence: ${esc(market.confidence || '—')} · basis: budget-tier comp basket</div></div>
  </div>
  <div class="disc">Estimates with wide uncertainty — no one can guarantee commercial performance. Comps and ranges are decision context, not a forecast of return. Streaming / MENA viewership data is estimate-grade only.</div>
  <div class="pgnum">05</div>
</div>
</div>`;
}

function LookbookInner() {
  const sp = useSearchParams();
  const projectId = sp.get('projectId') || '';
  const [html, setHtml] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r: any = await productionApi.scripton.lookbookData(projectId);
        const d: any = r.data || {};
        if (!alive) return;
        if (!d.coverage && !(Array.isArray(d.roles) && d.roles.length)) { setErr('No lookbook data yet — run coverage (and optionally role types, look boards and the market read) first.'); return; }
        setHtml(buildLookbookHtml(d));
        setTimeout(() => { try { window.print(); } catch (e) { /* */ } }, 700);
      } catch (e: any) { if (alive) setErr(e?.response?.data?.message || 'Could not load the lookbook.'); }
    })();
    return () => { alive = false; };
  }, [projectId]);
  return (
    <div className="lbwrap">
      <style dangerouslySetInnerHTML={{ __html: LB_CSS }} />
      <div className="noprint" style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }}>
        <button onClick={() => window.print()} style={{ background: '#C6A463', color: '#1a1509', border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13 }}>Print / Save as PDF</button>
      </div>
      {err && <div style={{ color: '#e88', padding: 24, fontFamily: 'Inter, sans-serif' }}>{err}</div>}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export default function LookbookPrintPage() {
  return (<Suspense fallback={<div style={{ color: '#888', padding: 24, fontFamily: 'Inter, sans-serif' }}>Loading…</div>}><LookbookInner /></Suspense>);
}
