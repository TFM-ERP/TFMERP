'use client';
/**
 * ScriptON Doctor — Studio (P4 Format + P6 Develop/Adapt). Tabs switch content:
 * Develop (the ladder), Adapt (source → directions), Format (target → episode map). Exports SxRail/RAIL10 (shared).
 * `.sx`-scoped, self-contained. Engines run via the page; panels render their results, sample until run.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ScriptPaper } from './scriptPaper';
import { useLocale } from '@/lib/i18n';
import { useScriptonShellFlag } from './osShellFlag';
import { OS_WORKSPACES, activeWorkspaceKey, type OsWorkspace } from './os-workspaces';
const lsGet = (k: string, fb: any) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };

export type SxLadder = { name: string; sub?: string; state: 'done' | 'on' | 'wait'; body?: string; kind?: string; stageId?: string; versionId?: string; versionN?: number; versionCount?: number; versionColor?: string; status?: string; framework?: string; scenes?: any[]; steps?: any[] };
export type SxSpine = { k: string; v: string };
export type SxDirection = { label: string; logline: string; keep?: string; change?: string; tone?: string; risk?: string };
export type SxEpisode = { ep?: any; title?: string; engine?: string; cliffhanger?: string; hook?: string; escalation?: string; sting?: string };

// Clean a stored stage body for display: strip code fences, and if it is raw JSON
// (old builds saved metadata-wrapped JSON), parse it and flatten to readable prose.
function unescStr(s: string): string { return String(s).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '  ').replace(/\\r/g, '').replace(/\\\\/g, '\\'); }
function structuredStage(j: any): string {
  if (!j || typeof j !== 'object') return '';
  const out: string[] = [];
  if (Array.isArray(j.beats) && j.beats.length) {
    if (typeof j.output === 'string' && j.output.trim()) out.push(j.output.trim());
    for (const b of j.beats) { const name = b.name || b.beatName || b.anchor || ''; const body = (typeof b.beat === 'string' && b.beat) || b.prose || b.text || ''; const purpose = b.purpose || ''; const head = ('■ ' + name + (body ? ' — ' + body : '')).trim(); if (name || body) out.push(head + (purpose ? '\n   ' + purpose : '')); }
    return out.join('\n\n');
  }
  if (Array.isArray(j.scenes) && j.scenes.length) {
    for (const s of j.scenes) { const n = s.sceneNumber ? s.sceneNumber + '. ' : ''; const head = String(s.slugline || s.location || 'Scene'); const syn = s.synopsis || s.description || ''; out.push((n + head + (syn ? '\n' + syn : '') + (s.purpose ? '\n   Purpose: ' + s.purpose : '')).trim()); }
    return out.join('\n\n');
  }
  if (Array.isArray(j.steps) && j.steps.length) { j.steps.forEach((s: any, i: number) => out.push(((s.n != null ? s.n : i + 1) + '. ' + (s.text || s.scene || '')).trim())); return out.join('\n\n'); }
  const tr = j.treatment && typeof j.treatment === 'object' ? j.treatment : null;
  if (tr) { for (const k of Object.keys(tr)) { const act: any = tr[k]; if (!act || typeof act !== 'object') continue; if (act.title) out.push('— ' + String(act.title).toUpperCase() + ' —'); const bs = Array.isArray(act.beats) ? act.beats : []; for (const b of bs) { const p = b.prose || (typeof b.beat === 'string' && b.beat) || b.text || ''; if (p) out.push(p); } } return out.join('\n\n'); }
  if (typeof j.output === 'string') return j.output;
  const META = new Set(['title', 'format', 'rating', 'totalScenes', 'type', 'genre', 'beat', 'sceneNumber', 'anchor', 'n', 'name', 'purpose', 'thread', 'chargeOpen', 'chargeClose', 'turnType', 'intExt', 'dayNight', 'location', 'slugline', 'conflict', 'stakes', 'characters']);
  const flat = (v: any): string => { if (v == null) return ''; if (typeof v === 'string') return v; if (typeof v === 'number' || typeof v === 'boolean') return ''; if (Array.isArray(v)) return v.map(flat).filter(Boolean).join('\n\n'); if (typeof v === 'object') return Object.keys(v).filter((k) => !META.has(k)).map((k) => flat(v[k])).filter(Boolean).join('\n\n'); return ''; };
  return flat(j);
}
function salvageStage(t: string): string {
  const keys = ['prose', 'synopsis', 'description', 'beat', 'purpose', 'output', 'text', 'name', 'anchor', 'slugline'];
  const re = new RegExp('"(' + keys.join('|') + ')"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"', 'g');
  const segs: string[] = []; let m: any;
  while ((m = re.exec(t))) { const key = m[1]; const val = unescStr(m[2]); if (!val.trim()) continue; segs.push((key === 'name' || key === 'anchor' || key === 'slugline') ? ('■ ' + val) : val); }
  return segs.join('\n\n');
}
function cleanStageText(raw: string): string {
  let t = String(raw || '').trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
  if (/^[\[{]/.test(t)) {
    let parsed: any = null;
    try { parsed = JSON.parse(t); } catch { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) { try { parsed = JSON.parse(t.slice(a, b + 1)); } catch { /* */ } } }
    if (parsed) { const o = structuredStage(parsed).trim(); if (o) return o; }
    const sv = salvageStage(t).trim(); if (sv) return sv;
  }
  return t;
}

// Split into ~page-sized chunks on blank lines so paragraphs / scenes are never cut mid-way.
function paginateText(text: string, perChars: number): string[] {
  const paras = String(text || '').split(/\n{2,}/);
  const pages: string[] = []; let cur = '';
  for (const p of paras) {
    if (cur && (cur.length + p.length + 2) > perChars) { pages.push(cur); cur = p; }
    else cur = cur ? cur + '\n\n' + p : p;
  }
  if (cur.trim()) pages.push(cur);
  return pages.length ? pages : [String(text || '')];
}

// Paper viewer: serif (or Courier for screenplay) sheets that slide like turning pages.
function PaperPages({ text, script }: { text: string; script?: boolean }) {
  const clean = useMemo(() => cleanStageText(text), [text]);
  // Unified A4 script paper for screenplay content (the "unify script view" standard).
  if (script) return <div style={{ maxHeight: '66vh', overflow: 'auto', marginTop: 10 }}><ScriptPaper text={clean} /></div>;
  const pages = paginateText(clean, 1700);
  const n = pages.length;
  // Vertical stack — RTL-safe. The old horizontal translateX track hid pages 2+ in the Arabic (RTL) layout,
  // so a 5-page treatment/beats only ever showed the first sheet. Stacked sheets scroll in the canvas.
  return (
    <div className="paperwrap">
      <div className="paperstack">
        {pages.map((pg, i) => (<div className="papersheet stacked" key={i}><div className="papersheet-in">{pg}</div><div className="paperfoot">{(i + 1) + (n > 1 ? ' / ' + n : '')}</div></div>))}
      </div>
    </div>
  );
}

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
.sx .btn.ghost{background:#1b1e25;border-color:var(--hair);color:var(--mute)}
.sx .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;box-shadow:0 6px 18px -4px rgba(198,164,99,.45),inset 0 1px 0 rgba(255,255,255,.3)}
.sx .kbd{background:#1b1e25;border-color:var(--hair);color:var(--mute);font-family:inherit}
.sx .kbd kbd{font-family:inherit;font-size:11px}
.sx .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx .rail{width:74px;flex:0 0 74px;background:#0e1015;border-right:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px}
.sx .ritem{width:58px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);cursor:pointer;position:relative;border:none;background:transparent}
.sx .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mute)}
.sx .ritem .lbl{font-size:9px;font-weight:600}
.sx .ritem:hover .box{border-color:var(--hair2);color:var(--cream)}
.sx .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink);box-shadow:0 6px 16px -4px rgba(198,164,99,.5)}
.sx .ritem.on .lbl{color:var(--gold2)}
.sx .ritem.on:before{content:"";position:absolute;left:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
.sx .main{flex:1;min-width:0;display:flex;flex-direction:column}
.sx .content{flex:1;overflow:auto;padding:26px 30px;display:flex;flex-direction:column;gap:18px}
.sx .phead{display:flex;align-items:flex-end;justify-content:space-between}
.sx .phead h1{font-size:24px;font-weight:800;color:var(--cream);letter-spacing:-.5px}
.sx .sub{font-size:13px;color:var(--mute);margin-top:4px;max-width:680px}
.sx .eyebrow{font-size:11px;font-weight:700;letter-spacing:1.4px;color:var(--gold)}
.sx.osnew .phead h1{font-family:var(--sx-title);font-weight:500;letter-spacing:-.3px}
.sx .tabs{display:flex;gap:8px}
.sx .tab{padding:9px 16px;border-radius:11px;font-size:13px;font-weight:600;color:var(--mute);background:#171a20;border:1px solid var(--hair);cursor:pointer;display:flex;align-items:center;gap:7px}
.sx .tab .ico{width:15px;height:15px}
.sx .tab.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:var(--gold2)}
.sx .sgrid{flex:1;display:grid;grid-template-columns:1fr;gap:16px;min-height:0}
.sx .ladder{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:18px 20px;overflow:auto;display:flex;flex-direction:column}
.sx .lstep{display:flex;gap:13px;padding:13px 0;position:relative}
.sx .lstep:before{content:"";position:absolute;left:13px;top:34px;bottom:-2px;width:2px;background:var(--hair)}
.sx .lstep:last-child:before{display:none}
.sx .lnum{width:28px;height:28px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:12px;font-weight:800;z-index:1}
.sx .lstep.done .lnum{background:rgba(87,179,104,.18);color:var(--green)}
.sx .lstep.on .lnum{background:linear-gradient(160deg,var(--gold2),var(--gold));color:var(--goldink)}
.sx .lstep.wait .lnum{background:#1b1e25;color:var(--faint);border:1px solid var(--hair)}
.sx .lb{flex:1}
.sx .ltt{font-size:13.5px;font-weight:700;color:var(--cream)}
.sx .lss{font-size:11.5px;color:var(--faint);margin-top:2px}
.sx .lstep.on .lbody{margin-top:9px;background:var(--paper);color:var(--ink);border-radius:8px;padding:14px 16px;font-size:12.5px;line-height:1.6;box-shadow:0 12px 28px -12px rgba(0,0,0,.6)}
.sx .lpaper{margin-top:10px;background:var(--paper);color:var(--ink);border-radius:10px;overflow:auto;max-height:58vh;border:1px solid rgba(0,0,0,.08);box-shadow:0 18px 44px -18px rgba(0,0,0,.65)}
.sx .lpaper .lpaper-in{white-space:pre-wrap;padding:26px 32px;font-family:var(--sx-title);font-size:14px;line-height:1.78;letter-spacing:.1px;max-width:62ch;margin:0 auto}
.sx .lpaper.script .lpaper-in{font-family:'Courier Prime',ui-monospace,monospace;font-size:13px;line-height:1.5;letter-spacing:0;max-width:66ch}
.sx .lpaper::-webkit-scrollbar{width:10px}.sx .lpaper::-webkit-scrollbar-thumb{background:rgba(0,0,0,.18);border-radius:8px;border:3px solid var(--paper)}
.sx .paperwrap{margin-top:10px}
.sx .paperwrap .paperview{overflow:hidden;border-radius:8px}
.sx .paperwrap .papertrack{display:flex;transition:transform .5s cubic-bezier(.33,0,.2,1);will-change:transform}
.sx .paperwrap .papersheet{flex:0 0 100%;min-width:0;padding:2px}
.sx .paperwrap .papersheet-in{white-space:pre-wrap;word-break:break-word;background:var(--paper);color:var(--ink);border-radius:6px 10px 10px 6px;padding:30px 38px;font-family:var(--sx-title);font-size:14px;line-height:1.8;letter-spacing:.1px;min-height:320px;max-height:62vh;overflow:auto;box-shadow:0 18px 44px -18px rgba(0,0,0,.65),inset 5px 0 0 -3px rgba(0,0,0,.07);border-left:1px solid rgba(0,0,0,.08)}
.sx .paperwrap.script .papersheet-in{font-family:'Courier Prime',ui-monospace,monospace;font-size:13px;line-height:1.5;letter-spacing:0}
.sx .paperwrap .paperfoot{text-align:right;color:#9a958a;font-size:10.5px;margin-top:8px;font-family:var(--sx-title)}
.sx .paperwrap .papernav{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:10px}
.sx .paperwrap .papernav button{background:#1b1e25;border:1px solid var(--hair);color:var(--gold2);border-radius:8px;padding:5px 13px;font-size:12px;font-weight:600;cursor:pointer}
.sx .paperwrap .papernav button:disabled{opacity:.38;cursor:default}
.sx .paperwrap .papernav span{font-size:11.5px;color:var(--mute);font-family:'Courier Prime',ui-monospace,monospace}
.sx .paperwrap .paperstack{display:flex;flex-direction:column;gap:16px}
.sx .paperwrap .papersheet.stacked{flex:none;width:100%}
.sx .paperwrap .papersheet.stacked .papersheet-in{max-height:none}
.sx .intake{display:flex;flex-direction:column;gap:14px;min-height:0}
.sx .panelcard{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:11px}
.sx .pc-h{display:flex;align-items:center;justify-content:space-between}
.sx .pc-h .t{font-size:13.5px;font-weight:700;color:var(--cream)}
.sx .kv{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--hair);font-size:12.5px}
.sx .kv:first-of-type{border-top:none}
.sx .kv .k{color:var(--faint)}
.sx .kv .v{color:var(--text);font-weight:600}
.sx .chips{display:flex;flex-wrap:wrap;gap:8px}
.sx .chip{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:600;color:var(--mute);background:#171a20;border:1px solid var(--hair);cursor:pointer}
.sx .chip.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:var(--gold2)}
.sx .note{font-size:12px;color:var(--faint);border-top:1px solid var(--hair);padding-top:9px}
.sx .ta{width:100%;min-height:128px;background:#101218;border:1px solid var(--hair);border-radius:12px;padding:13px 15px;color:var(--text);font:inherit;font-size:13px;line-height:1.6;resize:vertical;outline:none}
.sx .ta:focus{border-color:rgba(198,164,99,.5)}
.sx .dirs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.sx .dir{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:9px}
.sx .dir .dl{font-size:12px;font-weight:800;letter-spacing:.4px;color:var(--gold2)}
.sx .dir .dlog{font-size:13px;color:var(--cream);font-weight:600;line-height:1.45}
.sx .dir .drow{font-size:11.5px;color:var(--mute);line-height:1.5}.sx .dir .drow b{color:var(--text);font-weight:600}
.sx .eps{display:flex;flex-direction:column;gap:10px}
.sx .ep{background:var(--panel);border:1px solid var(--hair);border-radius:12px;padding:13px 15px;display:flex;gap:13px}
.sx .ep .epn{width:30px;height:30px;border-radius:9px;background:rgba(198,164,99,.14);color:var(--gold2);display:grid;place-items:center;font-weight:800;font-size:12px;flex:none}
.sx .ep .epb{flex:1;display:flex;flex-direction:column;gap:4px}
.sx .ep .ept{font-size:13px;font-weight:700;color:var(--cream)}
.sx .ep .eprow{font-size:11.5px;color:var(--mute);line-height:1.5}.sx .ep .eprow b{color:var(--gold2);font-weight:600}
.sx .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px;box-shadow:0 14px 40px -12px rgba(0,0,0,.7)}
.sx .dvl{flex:1;display:grid;grid-template-columns:264px 1fr;min-height:0;min-width:0;border-radius:14px;overflow:hidden}
.sx .dvrail{background:#0e1015;border-right:1px solid var(--hair);padding:14px 12px;display:flex;flex-direction:column;gap:2px;overflow:auto}
.sx .dvrhead{display:flex;align-items:center;gap:10px;padding:2px 6px 12px}
.sx .dvrhead .t{font-size:12.5px;font-weight:800;color:var(--cream)}.sx .dvrhead .s{font-size:10px;color:var(--faint);margin-top:1px}
.sx .dvlogo{width:32px;height:32px;border-radius:9px;background:linear-gradient(180deg,#E6D2A2,#C6A463);display:grid;place-items:center;flex:none}.sx .dvlogo span{color:#15120B;font-weight:900;font-size:14px;line-height:1}
.sx .dvrstep{display:flex;align-items:center;gap:10px;padding:9px;border-radius:10px;cursor:pointer;position:relative;border:none;background:none;text-align:left;width:100%;font:inherit}
.sx .dvrstep:hover{background:rgba(255,255,255,.03)}
.sx .dvrstep .nm{font-size:13px;font-weight:600;color:var(--mute);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx .dvrstep .sub{font-size:10px;color:var(--faint);display:block;margin-top:1px}
.sx .dvrstep.dones .nm{color:#b9c0b3}
.sx .dvrstep.cur{background:rgba(198,164,99,.1)}.sx .dvrstep.cur .nm{color:var(--gold2)}
.sx .dvrstep.cur:before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:3px;background:var(--gold)}
.sx .dvdot{width:18px;height:18px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:9px;background:#1b1e25;border:1px solid var(--hair);color:var(--faint)}
.sx .dvdot.done{background:rgba(87,179,104,.2);color:var(--green);border-color:transparent}
.sx .dvdot.on{background:linear-gradient(160deg,var(--gold2),var(--gold));color:var(--goldink);border-color:transparent}
.sx .dvrstep.busy .dvdot{animation:dvpulse 1.2s ease-in-out infinite}
.sx .dvrfoot{margin-top:auto;padding:12px 6px 2px;border-top:1px solid var(--hair)}
.sx .dvrfoot .lbl{font-size:10.5px;color:var(--faint);display:flex;justify-content:space-between;margin-bottom:6px}
.sx .dvrbar{height:6px;border-radius:99px;background:#1b1e25;overflow:hidden}.sx .dvrbar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:99px}
.sx .dvcanvas{display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--panel)}
.sx .dvchead{display:flex;align-items:center;gap:14px;padding:18px 22px 12px}
.sx .dvchead h2{margin:0;font-size:20px;font-weight:800;color:var(--cream);font-family:var(--sx-title)}
.sx .dvchead .stg{font-size:11px;color:var(--faint);margin-top:3px}
.sx .dvvc{display:inline-flex;align-items:center;gap:12px;flex:none}
.sx .dvver{font-size:11px;color:var(--mute);font-weight:600}
.sx .vnav{background:none;border:none;color:#C6A463;font-size:15px;cursor:pointer;padding:0 1px;line-height:1}.sx .vnav:disabled{opacity:.3;cursor:default}
.sx .dvicon{font-size:16px;line-height:1;color:#9a8456;cursor:pointer;background:none;border:none;padding:0;transition:.15s}.sx .dvicon:hover{color:#E6D2A2;transform:scale(1.12)}
.sx .dvicon.spin{display:inline-block;animation:dvspin .7s linear infinite;color:#E6D2A2}
.sx .dvappr{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--green);cursor:pointer;border:none;background:none}.sx .dvappr svg{width:13px;height:13px}
.sx .dvscroll{padding:0 22px 10px;flex:1;overflow:auto;min-height:0}
.sx .dvfoot{display:flex;align-items:center;gap:12px;padding:14px 22px;border-top:1px solid var(--hair);flex-wrap:wrap}
.sx .dvhint{font-size:11.5px;color:var(--faint);margin-left:auto}
.sx .gbtn{height:42px;padding:0 18px;border:1px solid rgba(198,164,99,.5);border-radius:11px;background:transparent;color:#E6D2A2;font:inherit;font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:.18s}
.sx .gbtn:hover{background:rgba(198,164,99,.12);border-color:rgba(198,164,99,.85)}
.sx .gbtn .ar{transition:transform .18s}.sx .gbtn:hover .ar{transform:translateX(3px)}
.sx .gbtn.ghost{height:38px;padding:0 14px;font-size:12px;border-color:var(--hair);color:var(--mute)}.sx .gbtn.ghost:hover{border-color:var(--hair2);color:var(--cream);background:transparent}
.sx .dvgen{display:flex;align-items:center;gap:10px;width:100%;font-size:12.5px;color:var(--gold2);font-weight:600}
.sx .dvgen .dvprog{flex:1;height:5px;border-radius:99px;background:#1b1e25;overflow:hidden;position:relative;max-width:360px}
.sx .dvgen .dvprog i{position:absolute;inset:0 60% 0 0;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:99px;animation:dvfill 2.2s ease-in-out infinite}
.sx .dvspin{display:inline-block;width:14px;height:14px;border:2px solid rgba(198,164,99,.3);border-top-color:var(--gold2);border-radius:50%;animation:dvspin .7s linear infinite;flex:none}
@keyframes dvspin{to{transform:rotate(360deg)}}
@keyframes dvfill{0%{right:80%}50%{right:22%}100%{right:80%}}
@keyframes dvpulse{0%,100%{box-shadow:0 0 0 0 rgba(198,164,99,0)}50%{box-shadow:0 0 0 5px rgba(198,164,99,.18)}}
`;

/** The cinematic ScriptON shell CSS — exported so every screen (incl. Dialect) shares one look. */
export const SX_CSS = CSS;

export const RAIL10: { k: string; lbl: string; d: React.ReactNode }[] = [
  { k: 'home', lbl: 'Home', d: <path d="M3 11l9-8 9 8M5 10v10h14V10" /> },
  { k: 'library', lbl: 'Library', d: <path d="M4 4h6v16H4zM14 4h6v16h-6z" /> },
  { k: 'reader', lbl: 'Reader', d: <path d="M6 2h9l5 5v15H6zM15 2v5h5M9 13h7M9 17h7" /> },
  { k: 'breakdown', lbl: 'Breakdown', d: <path d="M12 2l9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5" /> },
  { k: 'schedule', lbl: 'Schedule', d: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></> },
  { k: 'coverage', lbl: 'Coverage', d: <path d="M6 2h9l5 5v15H6zM15 2v5h5M9 12l2 2 4-4" /> },
  { k: 'dialect', lbl: 'Dialect', d: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2zM8 9h8M8 13h5" /> },
  { k: 'studio', lbl: 'Studio', d: <path d="M5 3v4M3 5h4M13 3l3 7 7 3-7 3-3 7-3-7-7-3z" /> },
  { k: 'greenlight', lbl: 'Greenlight', d: <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM9 12l2 2 4-4" /> },
  { k: 'reports', lbl: 'Reports', d: <path d="M3 3v18h18M7 14l3-3 3 3 5-6" /> },
];

const RAIL_ROUTES: Record<string, string> = { home: '/home', library: '/scripton/library', reader: '/scripton/reader', breakdown: '/scripton/breakdown', schedule: '/scripton/schedule', coverage: '/scripton/coverage', dialect: '/scripton/dialect', studio: '/scripton/studio', greenlight: '/scripton/greenlight', reports: '/scripton/reports', settings: '/scripton/settings' };
export function SxRail(props: { active: string; onNav?: (k: string) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale, setLocale } = useLocale();
  const flag = useScriptonShellFlag();

  // RBAC perms — read post-mount only (no localStorage during render → no hydration mismatch). Fail-open while unknown.
  const [perms, setPerms] = useState<Record<string, number> | null>(null);
  useEffect(() => { setPerms(lsGet('tfm_perms', null)); }, []);
  // active workspace — resolve the studio?tab=builds case from a post-mount search read.
  const [osSearch, setOsSearch] = useState('');
  useEffect(() => { setOsSearch(typeof window !== 'undefined' ? window.location.search : ''); }, [pathname]);

  if (flag === 'new') {
    const canSee = (w: OsWorkspace) => !w.perm || !perms || (perms[w.perm] ?? 0) >= 1;
    const activeKey = activeWorkspaceKey(pathname, osSearch);
    return (
      <div className="rail">
        {OS_WORKSPACES.filter(canSee).map((w) => (
          <button key={w.key} className={'ritem' + (w.key === activeKey ? ' on' : '')} onClick={() => router.push(w.href)} title={t(w.label)} aria-label={t(w.label)}>
            <div className="box"><w.icon size={18} /></div><div className="lbl">{t(w.label)}</div>
          </button>
        ))}
        <button className="ritem" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} style={{ marginTop: 'auto' }} title={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'} aria-label="Toggle language">
          <div className="box" style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.5px' }}>{locale === 'ar' ? 'EN' : 'ع'}</div><div className="lbl">{locale === 'ar' ? 'English' : 'العربية'}</div>
        </button>
      </div>
    );
  }

  // ── old (fallback) — current behavior, unchanged ──
  const go = (k: string) => { const r = RAIL_ROUTES[k]; if (r) router.push(r); else if (props.onNav) props.onNav(k); };
  return (
    <div className="rail">
      {RAIL10.map((r) => (
        <button key={r.k} className={'ritem' + (r.k === props.active ? ' on' : '')} onClick={() => go(r.k)}>
          <div className="box"><svg className="ico" viewBox="0 0 24 24">{r.d}</svg></div><div className="lbl">{t(r.lbl)}</div>
        </button>
      ))}
      <button className="ritem" onClick={() => go('settings')} style={{ marginTop: 'auto' }}><div className="box"><svg className="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7 7 0 000-2l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L15 3h-4l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4L6.6 11a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1L11 21h4l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4z" /></svg></div><div className="lbl">{t('Settings')}</div></button>
      <button className="ritem" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} title={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'} aria-label="Toggle language"><div className="box" style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.5px' }}>{locale === 'ar' ? 'EN' : 'ع'}</div><div className="lbl">{locale === 'ar' ? 'English' : 'العربية'}</div></button>
    </div>
  );
}

const TABS = [
  { k: 'builds', lbl: 'Builds', d: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /> },
  { k: 'develop', lbl: 'Develop', d: <path d="M12 2v6m0 8v6M2 12h6m8 0h6" /> },
];
const FORMATS = [['series', 'Series'], ['vertical', 'Vertical micro-drama'], ['short', 'Short'], ['feature', 'Feature']];

export default function ScriptOnStudio(props: {
  title: string; meta: string; mode: string; onTab: (k: string) => void; showDevelop?: boolean;
  ladder: SxLadder[]; spine: SxSpine[]; comps: string[]; note?: string;
  adaptResult: SxDirection[]; formatResult: SxEpisode[]; formatTarget: string; busy?: string;
  onNav: (k: string) => void; onBack: () => void; onAction: (k: string) => void; onAdapt: (source: string) => void; onFormat: (target: string) => void; onPick?: (d: SxDirection, i: number) => void; onRegenerate?: (kind: string) => void; onSwitchVersion?: (stageId: string, dir: number) => void; onPromote?: (versionId: string) => void; onFramework?: (kind: string, fw: string) => void; onRead?: (versionId: string) => void; onBranch?: (stageId: string, versionId: string) => void; onPromoteScript?: (versionId: string) => void; reads?: Record<string, any>; approvals?: boolean; genBusy?: string | null; toast?: string | null; osNew?: boolean;
}) {
  const { dir, t } = useLocale();
  const [src, setSrc] = useState('');
  const [focus, setFocus] = useState('');
  const dvActiveKind = (props.ladder || []).find((s) => s.state === 'on')?.kind || '';
  useEffect(() => { setFocus(dvActiveKind); }, [dvActiveKind]);
  const m = props.mode;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className={'sx' + (props.osNew ? ' osnew' : '')} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        {/* Builds renders the BuildsPanel overlay (which has its own top bar); hide this one
            under the OS shell so it doesn't peek in the rail-width strip behind the overlay. */}
        {!(props.osNew && m === 'builds') && (
        <div className="top">
          <div className="tl">
            <div className="logo" onClick={props.onBack} title={t('Back to FilmOS')}>TFM</div>
            <div className="proj">{props.title}</div>
            <span className="pill"><span className="d" />{m === 'adapt' ? t('ADAPT') : m === 'format' ? t('FORMAT') : t('DEVELOP')}</span>
            <span className="meta">{props.meta}</span>
          </div>
          <div className="tr">
            <button className="btn kbd" onClick={() => props.onAction('cmdk')}><kbd>⌘K</kbd></button>
            {m === 'adapt' && <button className="btn gold" onClick={() => props.onAdapt(src)}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M4 19V5l8-2v16M12 3l8 2v14" /></svg>{props.busy === 'adapt' ? t('Reading…') : t('Get directions')}</button>}
            {m === 'format' && <button className="btn gold" onClick={() => props.onFormat(props.formatTarget)}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M16 3l5 5-5 5M21 8H9M8 21l-5-5 5-5M3 16h12" /></svg>{props.busy === 'format' ? t('Converting…') : t('Convert')}</button>}
          </div>
        </div>
        )}
        <div className="body">
          <SxRail active="studio" onNav={props.onNav} />
          <div className="main"><div className="content">
            <div className="phead"><div><h1>{t('Studio')}</h1><div className="sub">{t('Develop a seed into a script, adapt a book, or convert the format — nothing is written until the spine is agreed.')}</div></div></div>
            <div className="tabs">
              {TABS.filter((tb) => tb.k !== 'develop' || props.showDevelop).map((tb) => (
                <button key={tb.k} className={'tab' + (tb.k === m ? ' on' : '')} onClick={() => props.onTab(tb.k)}><svg className="ico" viewBox="0 0 24 24">{tb.d}</svg>{t(tb.lbl)}</button>
              ))}
            </div>

            {m === 'develop' && (() => {
              const L = props.ladder || [];
              const flat = (sc: any) => sc && sc.chargeOpen && sc.chargeClose && String(sc.chargeOpen) === String(sc.chargeClose);
              // A stage counts as DONE only if it actually has a version. The next-empty stage is also marked
              // 'on' by the page, so without the versionId guard lastDone overshoots and nextS skips a stage.
              let lastDone = -1; L.forEach((s, i) => { if (s.state === 'done' || (s.state === 'on' && s.versionId)) lastDone = i; });
              const activeS: any = L.find((s) => s.state === 'on');
              const fk = (focus && L.find((s) => s.kind === focus)) ? focus : (activeS ? activeS.kind : (L[lastDone] ? L[lastDone].kind : (L[0] ? L[0].kind : '')));
              const cur: any = L.find((s) => s.kind === fk) || activeS || L[0];
              const nextS: any = L[lastDone + 1];
              const done = lastDone + 1;
              const pct = L.length ? Math.round((done / L.length) * 100) : 0;
              const lbl = (k: string) => { const x = L.find((s) => s.kind === k); return x ? x.name : k; };
              const renderBody = (s: any) => (
                <>
                  {s.kind === 'SCENES' && Array.isArray(s.scenes) && s.scenes.length > 0 ? (
                    <div style={{ display: 'grid', gap: 6 }}>{s.scenes.slice(0, 40).map((sc: any, j: number) => (
                      <div key={j} style={{ background: '#15171d', border: '1px solid var(--hair)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cream)' }}>{sc.sceneNumber ? sc.sceneNumber + '. ' : ''}{sc.slugline || sc.location || t('Scene')}</div>
                        {(sc.purpose || sc.synopsis) ? <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>{sc.purpose || sc.synopsis}</div> : null}
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10.5, flexWrap: 'wrap' }}>
                          <span style={{ color: flat(sc) ? 'var(--red)' : 'var(--gold2)' }}>{sc.chargeOpen || '?'} {'→'} {sc.chargeClose || '?'}</span>
                          {sc.turnType ? <span style={{ color: 'var(--faint)' }}>{sc.turnType}</span> : null}
                          {sc.thread ? <span style={{ color: 'var(--blue)' }}>{sc.thread}</span> : null}
                          {flat(sc) ? <span style={{ color: 'var(--red)' }}>{t('flat — no turn')}</span> : null}
                        </div>
                      </div>))}</div>
                  ) : s.kind === 'STEP_OUTLINE' && Array.isArray(s.steps) && s.steps.length > 0 ? (
                    <div style={{ display: 'grid', gap: 5 }}>{s.steps.slice(0, 60).map((st: any, j: number) => (
                      <div key={j} style={{ fontSize: 11.5, color: 'var(--text)' }}><b style={{ color: 'var(--gold2)' }}>{st.n ?? j + 1}.</b> {st.text || st.scene || ''}</div>))}</div>
                  ) : s.body ? (<PaperPages text={s.body} script={s.kind === 'DRAFT'} />) : (
                    <div style={{ color: 'var(--faint)', fontSize: 13, padding: '34px 4px' }}>{t('Not written yet — generate this stage from the one before it.')}</div>
                  )}
                  {s.versionId && s.kind === 'DRAFT' && props.onPromoteScript ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => props.onPromoteScript!(s.versionId!)} style={{ background: 'rgba(91,141,239,.16)', color: 'var(--blue)', border: '1px solid rgba(91,141,239,.4)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>{'↗'} {t('Generate script')} {'→'} {t('Library')}</button>
                    </div>
                  ) : null}
                  {props.reads && s.versionId && props.reads[s.versionId] ? (() => { const rd: any = props.reads![s.versionId!]; const vc = rd.verdict === 'GO' ? 'var(--green)' : rd.verdict === 'HOLD' ? 'var(--red)' : 'var(--amber)'; return (
                    <div style={{ marginTop: 10, background: '#15171d', border: '1px solid var(--hair)', borderRadius: 8, padding: '8px 10px', fontSize: 11.5 }}>
                      <span style={{ fontWeight: 800, color: vc }}>{rd.verdict}</span> <span style={{ color: 'var(--mute)' }}>{rd.note}</span>
                      {Array.isArray(rd.concerns) && rd.concerns.length ? <ul style={{ margin: '4px 0 0 16px', color: 'var(--amber)' }}>{rd.concerns.slice(0, 3).map((cc: string, k: number) => <li key={k}>{cc}</li>)}</ul> : null}
                    </div>); })() : null}
                </>
              );
              return (
                <div className="dvl">
                  <div className="dvrail">
                    <div className="dvrhead"><div className="dvlogo"><span>{'✦'}</span></div><div><div className="t">{t('The ladder')}</div><div className="s">{done} / {L.length} {t('stages')}</div></div></div>
                    {L.map((s, i) => { const isBusy = props.genBusy === s.kind; return (
                      <button key={i} className={'dvrstep' + (s.kind === fk ? ' cur' : '') + (s.state === 'done' ? ' dones' : '') + (isBusy ? ' busy' : '')} onClick={() => setFocus(s.kind || '')}>
                        <span className={'dvdot ' + s.state}>{s.state === 'done' ? '✓' : s.state === 'on' ? '●' : ''}</span>
                        <span style={{ minWidth: 0 }}><span className="nm">{s.name}</span><span className="sub">{isBusy ? t('writing…') : s.state === 'done' ? (s.status || ('V' + (s.versionN || 1))) : s.state === 'on' ? (s.sub || ('V' + (s.versionN || 1))) : t('pending')}</span></span>
                      </button>); })}
                    <div className="dvrfoot"><div className="lbl"><span>{t('Pipeline')}</span><span>{done} / {L.length}</span></div><div className="dvrbar"><i style={{ width: pct + '%' }} /></div></div>
                  </div>
                  <div className="dvcanvas">
                    <div className="dvchead">
                      <div style={{ flex: 1, minWidth: 0 }}><h2>{cur ? cur.name : t('Develop')}</h2><div className="stg">{cur ? (t('Stage') + ' ' + (L.indexOf(cur) + 1) + ' ' + t('of') + ' ' + L.length + (cur.kind === 'BEATS' && cur.framework ? '  ·  ' + cur.framework : '')) : t('Generate the ladder, one stage at a time')}</div></div>
                      {cur && cur.versionId ? (
                        <div className="dvvc">
                          {props.onSwitchVersion ? <button className="vnav" disabled={(cur.versionN || 1) <= 1} title={t('Previous version')} onClick={() => props.onSwitchVersion!(cur.stageId!, -1)}>{'‹'}</button> : null}
                          <span className="dvver">V{cur.versionN || 1}{(cur.versionCount || 1) > 1 ? '/' + cur.versionCount : ''}</span>
                          {props.onSwitchVersion ? <button className="vnav" disabled={(cur.versionN || 1) >= (cur.versionCount || 1)} title={t('Next version')} onClick={() => props.onSwitchVersion!(cur.stageId!, 1)}>{'›'}</button> : null}
                          {props.onRegenerate ? <button className={'dvicon' + (props.genBusy === cur.kind ? ' spin' : '')} title={t('Generate another take')} onClick={() => props.onRegenerate!(cur.kind!)}>{'⟳'}</button> : null}
                          {/* Approve removed — the approval workflow is disabled; develop stages advance without a gate. */}
                        </div>
                      ) : null}
                    </div>
                    <div className="dvscroll">{cur ? renderBody(cur) : null}</div>
                    <div className="dvfoot">
                      {props.genBusy ? (
                        <div className="dvgen"><span className="dvspin" /><span>{t('Generating')} {lbl(props.genBusy)} {'—'} {t('this can take a minute or two')}</span><div className="dvprog"><i /></div></div>
                      ) : nextS ? (<>
                        <button className="gbtn" onClick={() => props.onAction('advance')}>{t('Generate')} {nextS.name} <span className="ar">{dir === 'rtl' ? '←' : '→'}</span></button>
                        {props.onRegenerate && cur ? <button className="gbtn ghost" onClick={() => props.onRegenerate!(cur.kind!)}>{'⟳'} {t('Regenerate')} {cur.name}</button> : null}
                        <span className="dvhint">{t('Builds on')} {cur ? cur.name : t('the last stage')}</span>
                      </>) : (<span className="dvhint">{t('The ladder is complete — every stage written.')}</span>)}
                    </div>
                  </div>
                </div>
              );
            })()}

            {m === 'adapt' && (
              <>
                <div className="panelcard"><div className="pc-h"><span className="t">{t('Source work')}</span><span className="eyebrow">{t('BOOK · STORY · ARTICLE')}</span></div>
                  <textarea className="ta" placeholder={t('Paste a synopsis or an excerpt of the source work to adapt…')} value={src} onChange={(e) => setSrc(e.target.value)} />
                  <div className="note">{t('Three adaptation directions, faithful to bold — grounded in what you paste. Nothing is written until you pick one.')}</div>
                </div>
                {props.adaptResult.length > 0 && (
                  <div className="dirs">
                    {props.adaptResult.map((d, i) => (
                      <div className="dir" key={i} style={{ cursor: props.onPick ? 'pointer' : 'default' }} onClick={() => props.onPick && props.onPick(d, i)}><div className="dl">{d.label}</div><div className="dlog">{d.logline}</div>
                        {d.keep && <div className="drow"><b>{t('Keep:')}</b> {d.keep}</div>}
                        {d.change && <div className="drow"><b>{t('Change:')}</b> {d.change}</div>}
                        {d.tone && <div className="drow"><b>{t('Tone:')}</b> {d.tone}</div>}
                        {d.risk && <div className="drow"><b>{t('Risk:')}</b> {d.risk}</div>}
                        {props.onPick && <button onClick={(e) => { e.stopPropagation(); props.onPick!(d, i); }} disabled={props.busy === 'pick'} style={{ marginTop: 12, width: '100%', background: 'linear-gradient(180deg,#E6D2A2,#C6A463)', color: '#1a1509', border: 'none', borderRadius: 9, padding: '9px 0', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: props.busy === 'pick' ? 0.6 : 1 }}>{props.busy === 'pick' ? t('Writing…') : t('Develop this direction →')}</button>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {m === 'format' && (
              <>
                <div className="panelcard"><div className="pc-h"><span className="t">{t('Convert to')}</span><span className="eyebrow">{t('KEEP THE ENGINE')}</span></div>
                  <div className="chips">{FORMATS.map(([k, l]) => (<span key={k} className={'chip' + (props.formatTarget === k ? ' on' : '')} onClick={() => props.onAction('fmt-' + k)}>{t(l)}</span>))}</div>
                  <div className="note">{t('Maps your real scenes into the new format. Vertical builds the hook → escalation → sting → cliffhanger loop per episode.')}</div>
                </div>
                {props.formatResult.length > 0 && (
                  <div className="eps">
                    {props.formatResult.map((e, i) => (
                      <div className="ep" key={i}><div className="epn">{e.ep ?? i + 1}</div>
                        <div className="epb">
                          {e.hook !== undefined ? (<>
                            <div className="ept">{t('Episode')} {e.ep ?? i + 1}</div>
                            <div className="eprow"><b>{t('Hook:')}</b> {e.hook}</div>
                            {e.escalation && <div className="eprow"><b>{t('Escalation:')}</b> {e.escalation}</div>}
                            {e.sting && <div className="eprow"><b>{t('Sting:')}</b> {e.sting}</div>}
                            {e.cliffhanger && <div className="eprow"><b>{t('Cliffhanger:')}</b> {e.cliffhanger}</div>}
                          </>) : (<>
                            <div className="ept">{e.title || (t('Episode') + ' ' + (e.ep ?? i + 1))}</div>
                            {e.engine && <div className="eprow"><b>{t('Engine:')}</b> {e.engine}</div>}
                            {e.cliffhanger && <div className="eprow"><b>{t('Out:')}</b> {e.cliffhanger}</div>}
                          </>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div></div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
