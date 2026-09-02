'use client';
/**
 * ScriptON shared primitives — the rail (SxRail), the cinematic shell CSS (SX_CSS), the stage-text
 * cleaner (cleanStageText) and the core Sx* types. Extracted from the legacy ScriptOnStudio so the new
 * OS no longer imports from the old screen (this lets the old file be retired). Behaviour is identical
 * — the definitions are moved verbatim. New code should import these from here, never from ScriptOnStudio.
 */
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n';
import { useScriptonShellFlag } from '../osShellFlag';
import { OS_WORKSPACES, activeWorkspaceKey, filterWorkspaces, type OsWorkspace } from '../os-workspaces';
import { useScriptonMode } from '../useScriptonMode';
import { useScriptonGenerating } from '../useScriptonGenerating';

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
export function cleanStageText(raw: string): string {
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
/* ── Rail generation badge ──────────────────────────────────────────────────────────────────
   A feature rewrite runs 30-50 minutes. "Continue in background" used to mean the run vanished
   from the product entirely. The badge rides the Build icon: gold and turning while the writer
   works, green and beating once the draft has landed, until it is clicked. */
.sx .ritem{position:relative}
.sx .rgen{position:absolute;top:4px;right:6px;width:12px;height:12px;border-radius:50%;pointer-events:none;z-index:2}
.sx .rgen.on{border:2px solid rgba(198,164,99,.28);border-top-color:var(--gold2);animation:rgenspin .9s linear infinite}
.sx .rgen.done{background:var(--green);box-shadow:0 0 0 0 rgba(87,179,104,.55);animation:rgenbeat 1.6s ease-out infinite}
.sx .rgen.bad{background:var(--red);box-shadow:0 0 6px rgba(229,99,95,.6)}
@keyframes rgenspin{to{transform:rotate(360deg)}}
/* Two beats then rest — a pulse, not a strobe. Sized so it reads at 12px on a dark rail. */
@keyframes rgenbeat{
  0%{box-shadow:0 0 0 0 rgba(87,179,104,.55);transform:scale(1)}
  14%{box-shadow:0 0 0 5px rgba(87,179,104,0);transform:scale(1.18)}
  28%{box-shadow:0 0 0 0 rgba(87,179,104,.5);transform:scale(1)}
  42%{box-shadow:0 0 0 5px rgba(87,179,104,0);transform:scale(1.14)}
  56%,100%{box-shadow:0 0 0 0 rgba(87,179,104,0);transform:scale(1)}
}
@media (prefers-reduced-motion:reduce){
  .sx .rgen.on,.sx .rgen.done{animation:none}
  .sx .rgen.done{box-shadow:0 0 6px rgba(87,179,104,.7)}
}
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
  // collaboration mode — called unconditionally (hooks rule); used in the new-rail branch below.
  const mode = useScriptonMode();
  // The one live generation, if any. Called unconditionally (hooks rule) and cheap when idle:
  // with nothing running the hook makes no requests at all.
  const gen = useScriptonGenerating();
  const genBadge = (key: string) => {
    // Generation belongs to Build — that is the workspace the run is launched from and returned to.
    if (key !== 'develop' || !gen.docId) return null;
    const cls = gen.failed ? 'bad' : gen.finished ? 'done' : gen.status === 'GENERATING' ? 'on' : '';
    if (!cls) return null;
    const title = gen.failed
      ? 'Generation stopped — open the script'
      : gen.finished
        ? 'Draft ready' + (gen.pageCount ? ' — ' + gen.pageCount + ' pages' : '')
        : gen.pct == null
          ? 'Planning the scenes…'
          : 'Writing scene ' + Math.min(gen.done + 1, gen.total) + ' of ' + gen.total;
    return <span className={'rgen ' + cls} title={title} aria-label={title} role="status" />;
  };
  /**
   * While a badge is showing, the Build item goes to the SCRIPT rather than to Build — because the
   * badge is the answer to "where did my generation go", and the answer is the screen that shows it.
   * Clicking also acknowledges a finished run, which is what stops the green pulse.
   */
  const genHref = (key: string): string | null => {
    if (key !== 'develop' || !gen.docId) return null;
    if (!(gen.finished || gen.failed || gen.status === 'GENERATING')) return null;
    if (gen.finished || gen.failed) gen.dismiss();
    return '/scripton/script?doc=' + encodeURIComponent(gen.docId);
  };

  if (flag === 'new') {
    const canSee = (w: OsWorkspace) => !w.perm || !perms || (perms[w.perm] ?? 0) >= 1;
    const activeKey = activeWorkspaceKey(pathname, osSearch);
    return (
      <div className="rail">
        {filterWorkspaces(OS_WORKSPACES, mode).filter(canSee).map((w) => (
          <button key={w.key} className={'ritem' + (w.key === activeKey ? ' on' : '')} onClick={() => router.push(genHref(w.key) || w.href)} title={t(w.label)} aria-label={t(w.label)}>
            <div className="box"><w.icon size={18} /></div><div className="lbl">{t(w.label)}</div>
            {genBadge(w.key)}
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
        <button key={r.k} className={'ritem' + (r.k === props.active ? ' on' : '')} onClick={() => { const g = genHref(r.k === 'studio' ? 'develop' : r.k); if (g) router.push(g); else go(r.k); }}>
          <div className="box"><svg className="ico" viewBox="0 0 24 24">{r.d}</svg></div><div className="lbl">{t(r.lbl)}</div>
          {genBadge(r.k === 'studio' ? 'develop' : r.k)}
        </button>
      ))}
      <button className="ritem" onClick={() => go('settings')} style={{ marginTop: 'auto' }}><div className="box"><svg className="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7 7 0 000-2l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L15 3h-4l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4L6.6 11a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1L11 21h4l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4z" /></svg></div><div className="lbl">{t('Settings')}</div></button>
      <button className="ritem" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} title={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'} aria-label="Toggle language"><div className="box" style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.5px' }}>{locale === 'ar' ? 'EN' : 'ع'}</div><div className="lbl">{locale === 'ar' ? 'English' : 'العربية'}</div></button>
    </div>
  );
}
