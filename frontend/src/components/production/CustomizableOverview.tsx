'use client';

/**
 * SYS-UX — Customizable project Overview (additive).
 * A per-user widget board for /production/projects/[id] · Overview.
 * Edit mode: drag-reorder, move ◀▶, resize width, remove; Add from a widget library;
 * Reset to default; Save & switch named "views" (role layouts). Persisted in localStorage
 * per project per user. Token-driven so it themes across all app themes. The old
 * OverviewPanel / WorkflowChecklist stay in the tree for a one-line revert.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { productionApi, arrivalApi, castingApi, transportApi, savedViewsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Pencil, Save, RotateCcw, LayoutGrid, Check, PanelLeft, PanelRight, PanelTop, EyeOff } from 'lucide-react';

type Item = { id: string; w: number; h?: number };

const DEFAULT_LAYOUT: Item[] = [
  { id: 'workflow', w: 1 }, { id: 'kpi-money', w: 2 }, { id: 'kpi-today', w: 3 },
  { id: 'today-scenes', w: 2 }, { id: 'attention', w: 1 }, { id: 'script', w: 1 },
  { id: 'schedule', w: 1 }, { id: 'crew', w: 1 },
];
const DEF_H: Record<string, number> = { 'kpi-today': 5, 'kpi-money': 5, 'workflow': 10, 'today-scenes': 9, 'attention': 8, 'script': 7, 'schedule': 6, 'crew': 6, 'approvals': 7, 'budget': 6, 'project-info': 7, 'travel': 6, 'casting': 6, 'locations': 6, 'transport': 6, 'perdiem': 6, 'weather': 7, 'tasks': 6, 'quote': 6, 'onthisday': 6, 'prompt': 6, 'palette': 7, 'composition': 10, 'notes': 8, 'todo': 9, 'pomodoro': 8, 'links': 9, 'clocks': 8, 'countdown': 8, 'sun': 9, 'ratio': 8, 'pagetime': 7, 'timecode': 8, 'units': 7, 'moon': 7, 'safety': 6, 'currency': 8, 'birthdays': 6, 'ambient': 8 };
const PRESET_VIEWS: Record<string, Item[]> = {
  'Default': DEFAULT_LAYOUT,
  'Line Producer': [{ id: 'kpi-money', w: 2 }, { id: 'approvals', w: 1 }, { id: 'budget', w: 2 }, { id: 'attention', w: 1 }, { id: 'perdiem', w: 1 }, { id: 'crew', w: 1 }, { id: 'workflow', w: 1 }],
  '1st AD': [{ id: 'kpi-today', w: 3 }, { id: 'today-scenes', w: 2 }, { id: 'weather', w: 1 }, { id: 'schedule', w: 1 }, { id: 'transport', w: 1 }, { id: 'attention', w: 1 }],
  'Accountant': [{ id: 'kpi-money', w: 2 }, { id: 'budget', w: 2 }, { id: 'approvals', w: 1 }, { id: 'perdiem', w: 1 }, { id: 'workflow', w: 1 }],
  'Coordinator': [{ id: 'travel', w: 1 }, { id: 'casting', w: 1 }, { id: 'locations', w: 1 }, { id: 'crew', w: 1 }, { id: 'tasks', w: 1 }, { id: 'attention', w: 1 }],
};

const STYLE = `
.pd-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 12px;border:1px solid var(--border-1);background:var(--surface-1);border-radius:12px;margin-bottom:14px}
.pd-bar .pd-lab{font-size:12px;color:var(--text-3);font-weight:600}.pd-bar .pd-lab b{color:var(--accent)}
.pd-bar .grow{flex:1}
.pd-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:5px;margin-bottom:12px;flex-wrap:wrap}
.pd-hint{font-size:11px;color:var(--text-3);margin-inline-end:auto}
.pd-ico{width:30px;height:30px;display:grid;place-items:center;border-radius:8px;border:1px solid var(--border-1);background:var(--surface-1);color:var(--text-2);cursor:pointer;transition:all .15s}
.pd-ico:hover{color:var(--text-1);border-color:var(--accent)}
.pd-ico.on{background:var(--accent);color:var(--accent-on);border-color:var(--accent)}
.pd-div{width:1px;height:20px;background:var(--border-1);margin:0 3px}
.pd-pop{position:absolute;top:34px;inset-inline-end:0;z-index:20;background:var(--surface-1);border:1px solid var(--border-1);border-radius:10px;box-shadow:var(--shadow);padding:5px;min-width:170px}
.pd-popitem{display:flex;align-items:center;gap:7px;width:100%;text-align:start;font-size:12px;padding:6px 9px;border-radius:7px;border:none;background:none;color:var(--text-2);cursor:pointer}
.pd-popitem:hover{background:var(--surface-2);color:var(--text-1)}
.pd-tb{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:7px 11px;border-radius:9px;background:var(--surface-2);border:1px solid var(--border-1);color:var(--text-2);cursor:pointer}
.pd-tb:hover{color:var(--text-1);border-color:var(--accent)}.pd-tb.on{background:var(--accent);color:var(--accent-on);border-color:var(--accent)}
.pd-sel{font-size:12px;font-weight:700;padding:7px 9px;border-radius:9px;background:var(--surface-2);border:1px solid var(--border-1);color:var(--text-2);cursor:pointer}
.pd-board{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:24px;grid-auto-flow:row dense;gap:13px}
.pd-w{background:var(--surface-1);border:1px solid var(--border-1);border-radius:12px;overflow:hidden;min-height:48px;position:relative;height:100%;display:flex;flex-direction:column;transition:box-shadow .15s,opacity .12s,outline-color .15s}
.pd-w.cw1{grid-column:span 1}.pd-w.cw2{grid-column:span 2}.pd-w.cw3{grid-column:span 3}
.pd-wh{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--border-1)}
.pd-wh h3{font-size:12.5px;font-weight:700;flex:1;display:flex;align-items:center;gap:7px;margin:0}
.pd-wh .smpl{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3);background:var(--surface-2);border:1px solid var(--border-1);border-radius:999px;padding:1px 6px}
.pd-wh .more{color:var(--accent);font-size:10.5px;font-weight:600;cursor:pointer;border:none;background:none}
.pd-grip{cursor:grab;color:var(--text-3);font-size:13px;display:none}
.pd-ctl{display:none;align-items:center;gap:3px}
.pd-ctl button{width:24px;height:24px;border-radius:6px;border:1px solid var(--border-1);background:var(--surface-2);color:var(--text-2);cursor:pointer;font-size:11px;display:grid;place-items:center}
.pd-ctl button:hover{color:var(--text-1);border-color:var(--accent)}.pd-ctl button.rm:hover{color:var(--danger);border-color:var(--danger)}
.pd-board.editing .pd-w{outline:1px dashed var(--border-2);outline-offset:-1px}
.pd-board.editing .pd-grip{display:inline}.pd-board.editing .pd-ctl{display:flex}.pd-board.editing .pd-wh .more{display:none}
.pd-w.over{outline:2px dashed var(--accent) !important}.pd-w.drag{opacity:.4}
.pd-wb{padding:11px 13px;flex:1;overflow:auto;min-height:0}
.pd-row{display:grid;gap:9px}.pd-c2{grid-template-columns:1fr 1fr}.pd-c3{grid-template-columns:repeat(3,1fr)}.pd-c4{grid-template-columns:repeat(4,1fr)}.pd-c6{grid-template-columns:repeat(6,1fr)}
.pd-stat{background:var(--surface-2);border:1px solid var(--border-1);border-radius:10px;padding:9px 10px}
.pd-stat .k{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3);font-weight:700}
.pd-stat .v{font-size:17px;font-weight:800;margin-top:3px;letter-spacing:-.02em}
.pd-stat .d{font-size:9.5px;margin-top:1px;color:var(--text-3)}.pd-stat .d.up{color:var(--ok)}.pd-stat .d.dn{color:var(--danger)}.pd-stat .d.wn{color:var(--warn)}
.pd-tbl{width:100%;border-collapse:collapse;font-size:11.5px}.pd-tbl th{text-align:start;padding:6px 10px;color:var(--text-3);font-weight:700;font-size:9px;text-transform:uppercase;border-bottom:1px solid var(--border-1)}
.pd-tbl td{padding:7px 10px;border-bottom:1px solid var(--border-1);color:var(--text-2)}.pd-tbl tr:last-child td{border-bottom:none}
.pd-sn{font-weight:800;color:var(--accent)}
.pd-bdg{display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:999px}
.b-int{background:var(--accent-soft);color:var(--accent)}.b-ok{background:var(--ok-soft);color:var(--ok)}.b-warn{background:var(--warn-soft);color:var(--warn)}.b-dn{background:var(--danger-soft);color:var(--danger)}
.pd-kv{display:flex;justify-content:space-between;gap:8px;padding:5px 0;font-size:12px;border-bottom:1px solid var(--border-1)}.pd-kv:last-child{border-bottom:none}.pd-kv .l{color:var(--text-3)}.pd-kv .r{font-weight:700;color:var(--text-1);text-align:end}
.pd-attn{display:flex;gap:7px;align-items:center;padding:6px 8px;border-radius:8px;background:var(--surface-2);font-size:11.5px;margin-bottom:6px;color:var(--text-2)}.pd-attn .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.pd-li{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;border-bottom:1px solid var(--border-1)}.pd-li:last-child{border-bottom:none}.pd-li .a{width:22px;height:22px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-size:9px;font-weight:800;flex-shrink:0}.pd-li .t{flex:1}.pd-li small{color:var(--text-3)}
.pd-scr{font-family:var(--font-mono,monospace);font-size:11.5px;line-height:1.5}.pd-scr .sh{font-weight:700;text-transform:uppercase;margin-bottom:7px}.pd-scr .ch{text-align:center;font-weight:700;padding-inline-start:8%}.pd-scr .di{width:70%;margin:0 auto 8px}
.pd-prog{height:6px;border-radius:999px;background:var(--surface-2);overflow:hidden;margin:7px 0}.pd-prog>i{display:block;height:100%;background:var(--accent)}
.pd-chk{display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0}.pd-chk .s{width:15px;text-align:center}.pd-chk .s.done{color:var(--ok)}.pd-chk .s.now{color:var(--accent)}.pd-chk .s.lock{color:var(--text-3)}.pd-chk.is-done{color:var(--text-3);text-decoration:line-through}
.pd-big{font-size:28px;font-weight:800;letter-spacing:-.02em}
.pd-ov{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:90;padding:18px}
.pd-modal{width:min(680px,100%);max-height:84vh;overflow:auto;background:var(--surface-1);border:1px solid var(--border-1);border-radius:14px;box-shadow:var(--shadow)}
.pd-mh{display:flex;align-items:center;gap:8px;padding:13px 16px;border-bottom:1px solid var(--border-1);font-weight:800;position:sticky;top:0;background:var(--surface-1)}.pd-mh .x{margin-inline-start:auto;cursor:pointer;color:var(--text-3);font-size:18px;border:none;background:none}
.pd-lib{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 16px}
.pd-libitem{display:flex;gap:10px;align-items:flex-start;padding:11px;border:1px solid var(--border-1);border-radius:10px;background:var(--surface-2)}
.pd-libitem .ico{width:30px;height:30px;border-radius:8px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;flex-shrink:0;font-size:15px}
.pd-libitem .nm{font-weight:700;font-size:12.5px}.pd-libitem .ds{font-size:10.5px;color:var(--text-3);margin-top:1px}
.pd-libitem .add{margin-inline-start:auto;align-self:center;font-size:11px;font-weight:800;color:var(--accent-on);background:var(--accent);border:none;border-radius:7px;padding:5px 10px;cursor:pointer}
.pd-libitem.inuse{opacity:.5}.pd-libitem.inuse .add{background:var(--surface-3);color:var(--text-3)}
.pd-inp{width:100%;background:var(--surface-2);border:1px solid var(--border-1);border-radius:8px;color:var(--text-1);font-size:12px;padding:6px 8px;font-family:inherit}
.pd-w.dragging{opacity:.45}
.pd-w.ins-before{box-shadow:inset 3px 0 0 var(--accent)}
.pd-w.ins-after{box-shadow:inset -3px 0 0 var(--accent)}
.pd-rz,.pd-rz-e,.pd-rz-s{position:absolute;display:none;z-index:3;user-select:none}
.pd-board.editing .pd-rz,.pd-board.editing .pd-rz-e,.pd-board.editing .pd-rz-s{display:block}
.pd-rz{right:1px;bottom:0;width:16px;height:16px;cursor:nwse-resize;color:var(--text-3);font-size:11px;line-height:16px;text-align:right}
.pd-rz-e{top:50%;right:-3px;transform:translateY(-50%);width:7px;height:38px;cursor:ew-resize;border-radius:5px}
.pd-rz-s{left:50%;bottom:-3px;transform:translateX(-50%);height:7px;width:38px;cursor:ns-resize;border-radius:5px}
.pd-board.editing .pd-rz-e:hover,.pd-board.editing .pd-rz-s:hover{background:var(--accent)}
.pd-libcat{grid-column:1 / -1;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);font-weight:800;margin:8px 2px 0}
@media(max-width:980px){.pd-board{grid-template-columns:1fr;grid-auto-rows:auto}.pd-w{grid-column:span 1 !important;grid-row:auto !important;height:auto}.pd-lib{grid-template-columns:1fr}}
`;

const pad2 = (n: number) => String(n).padStart(2, '0');
const dayIdx = () => Math.floor(Date.now() / 86400000);
function useLS<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(init);
  useEffect(() => { try { const r = localStorage.getItem(key); if (r != null) setV(JSON.parse(r)); } catch { /* */ } }, [key]);
  const set = (nv: T) => { setV(nv); try { localStorage.setItem(key, JSON.stringify(nv)); } catch { /* */ } };
  return [v, set];
}
const QUOTES = [
  '“A film is never really good unless the camera is an eye in the head of a poet.” — Orson Welles',
  '“Cinema is a matter of what\'s in the frame and what\'s out.” — Martin Scorsese',
  '“The most honest form of filmmaking is to make a film for yourself.” — Peter Jackson',
  '“If it can be written, or thought, it can be filmed.” — Stanley Kubrick',
  '“Drama is life with the dull bits cut out.” — Alfred Hitchcock',
  '“Light makes photography. Embrace light. Worship it.” — George Eastman',
  '“Filmmaking is a chance to live many lifetimes.” — Robert Altman',
  '“The director is the only one who can see whether the eyes are right.” — Akira Kurosawa',
  '“You can\'t paint with light if you don\'t respect the dark.” — Roger Deakins (attrib.)',
  '“Every cut is a heartbeat.” — Walter Murch (attrib.)',
  '“Make it dark, make it grim, make it tough — but then, for the love of God, tell a joke.” — Joss Whedon',
  '“A great film is made three times: written, shot, and edited.” — folk wisdom',
];
const PROMPTS = [
  'Block a scene using only one continuous take.',
  'Tell today\'s story with a single light source.',
  'Frame every shot at 2.39:1 — commit to the anamorphic feel.',
  'Use color to show a character\'s arc across three beats.',
  'Shoot a conversation without a single cut to the listener.',
  'Find the emotional close-up nobody scripted.',
  'Let silence carry a full page of action.',
  'Motivate every camera move with a character\'s intention.',
  'Hide exposition inside a physical task.',
  'Build tension by withholding the wide shot.',
  'Open on the detail, end on the face.',
  'Make the location a character in the scene.',
];
const SAFETY = [
  'Confirm the nearest hospital & medic on every call sheet.',
  'No live weapons without an armorer and a safety briefing.',
  'Hydration & shade rotation during heat-advisory hours.',
  'Walk the rigging and check every stinger before crew arrives.',
  'Brief stunts and high-falls with the full unit present.',
  'Mark and tape all trip hazards and cable runs.',
  'Heads-up call before any pyro, water, or vehicle action.',
  'Fatigue is a hazard — respect turnaround and meal breaks.',
  'Eye protection and ear protection near grinders and pyro.',
  'Spotter required for any reversing vehicle near crew.',
];
const FILM_HISTORY: Record<string, string> = {
  '05-25': 'Star Wars opened in 1977 — changed blockbusters forever.',
  '06-11': 'Jurassic Park premiered in 1993 — a VFX watershed.',
  '12-18': 'Avatar opened in 2009 — pushed 3D & virtual production.',
  '07-16': 'The Dark Knight released in 2008 — IMAX features go mainstream.',
  '03-31': 'The Matrix released in 1999 — bullet-time enters the lexicon.',
  '11-19': 'Toy Story opened in 1995 — first fully CG feature.',
  '04-03': 'Kurosawa\'s influence: many homages trace to his blocking.',
  '10-01': 'The lumiere brothers\' early screenings shaped exhibition.',
};
function onThisDay(): string {
  const d = new Date(); const md = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return FILM_HISTORY[md] || 'On any given day, somewhere a camera rolls for the first time. Make today\'s frame count.';
}
function moonPhase(d: Date): string {
  const lp = 2551443, newMoon = new Date(1970, 0, 7, 20, 35, 0).getTime() / 1000;
  const phase = (((d.getTime() / 1000 - newMoon) % lp) + lp) % lp / lp;
  const idx = Math.round(phase * 8) % 8;
  return ['🌑 New', '🌒 Waxing crescent', '🌓 First quarter', '🌔 Waxing gibbous', '🌕 Full', '🌖 Waning gibbous', '🌗 Last quarter', '🌘 Waning crescent'][idx];
}
function sunTimes(date: Date, lat: number, lng: number) {
  const rad = Math.PI / 180;
  const doy = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const decl = -23.44 * Math.cos(rad * (360 / 365) * (doy + 10));
  const cosH = -Math.tan(lat * rad) * Math.tan(decl * rad);
  if (cosH > 1 || cosH < -1) return null;
  const H = Math.acos(cosH) / rad;
  const noon = 12 - lng / 15;
  const tzo = date.getTimezoneOffset() / 60;
  const fmt = (h: number) => { let x = ((h - tzo) % 24 + 24) % 24; const hh = Math.floor(x); const mm = Math.round((x - hh) * 60); return `${pad2(hh)}:${pad2(mm === 60 ? 0 : mm)}`; };
  return { sunrise: fmt(noon - H / 15), sunset: fmt(noon + H / 15), ghAm: fmt(noon - H / 15 + 0.0) , ghPm: fmt(noon + H / 15 - 0.7) };
}
function PomodoroWidget() {
  const [secs, setSecs] = useState(25 * 60); const [run, setRun] = useState(false); const [mode, setMode] = useState<'work' | 'break'>('work');
  useEffect(() => { if (!run) return; const t = setInterval(() => setSecs(s => { if (s <= 1) { const nm = mode === 'work' ? 'break' : 'work'; setMode(nm); return (nm === 'work' ? 25 : 5) * 60; } return s - 1; }), 1000); return () => clearInterval(t); }, [run, mode]);
  return (<div style={{ textAlign: 'center' }}><div className="pd-big" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.floor(secs / 60)}:{pad2(secs % 60)}</div><div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>{mode === 'work' ? 'Focus' : 'Break'}</div><div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}><button className="pd-tb" onClick={() => setRun(r => !r)}>{run ? 'Pause' : 'Start'}</button><button className="pd-tb" onClick={() => { setRun(false); setMode('work'); setSecs(25 * 60); }}>Reset</button></div></div>);
}
function NotesWidget({ projectId }: any) { const [t, setT] = useLS(`pdw_notes_${projectId}`, ''); return <textarea className="pd-inp" value={t} onChange={e => setT(e.target.value)} placeholder="Quick notes…" style={{ minHeight: 96, resize: 'vertical' }} />; }
function TodoWidget({ projectId }: any) {
  const [items, setItems] = useLS<{ t: string; done: boolean }[]>(`pdw_todo_${projectId}`, []); const [v, setV] = useState('');
  const add = () => { if (!v.trim()) return; setItems([...items, { t: v.trim(), done: false }]); setV(''); };
  return (<div><div style={{ display: 'flex', gap: 6, marginBottom: 8 }}><input className="pd-inp" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="Add task…" /><button className="pd-tb" onClick={add}>＋</button></div>{items.map((x, i) => (<div key={i} className={`pd-chk ${x.done ? 'is-done' : ''}`}><span className="s" style={{ cursor: 'pointer' }} onClick={() => setItems(items.map((y, j) => j === i ? { ...y, done: !y.done } : y))}>{x.done ? '✓' : '○'}</span><span style={{ flex: 1 }}>{x.t}</span><span style={{ cursor: 'pointer', color: 'var(--text-3)' }} onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</span></div>))}{items.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>No tasks yet.</div>}</div>);
}
function LinksWidget({ projectId }: any) {
  const [links, setLinks] = useLS<{ label: string; url: string }[]>(`pdw_links_${projectId}`, [{ label: 'Drive folder', url: '#' }, { label: 'Call sheet template', url: '#' }]); const [l, setL] = useState(''); const [u, setU] = useState('');
  const add = () => { if (!l.trim()) return; setLinks([...links, { label: l.trim(), url: u.trim() || '#' }]); setL(''); setU(''); };
  return (<div>{links.map((x, i) => (<div key={i} className="pd-kv"><a href={x.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>🔗 {x.label}</a><span style={{ cursor: 'pointer', color: 'var(--text-3)' }} onClick={() => setLinks(links.filter((_, j) => j !== i))}>✕</span></div>))}<div style={{ display: 'flex', gap: 5, marginTop: 7 }}><input className="pd-inp" placeholder="Label" value={l} onChange={e => setL(e.target.value)} /><input className="pd-inp" placeholder="https://" value={u} onChange={e => setU(e.target.value)} /><button className="pd-tb" onClick={add}>＋</button></div></div>);
}
const CLOCK_ZONES: [string, string][] = [['LA', 'America/Los_Angeles'], ['New York', 'America/New_York'], ['London', 'Europe/London'], ['Dubai', 'Asia/Dubai'], ['Mumbai', 'Asia/Kolkata']];
function ClocksWidget() { const [now, setNow] = useState(new Date()); useEffect(() => { const t = setInterval(() => setNow(new Date()), 20000); return () => clearInterval(t); }, []); return (<div>{CLOCK_ZONES.map(([c, tz]) => { let s = '—'; try { s = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz }); } catch { /* */ } return <div key={c} className="pd-kv"><span className="l">{c}</span><span className="r" style={{ fontVariantNumeric: 'tabular-nums' }}>{s}</span></div>; })}</div>); }
function CountdownWidget({ projectId }: any) {
  const [target, setTarget] = useLS(`pdw_cd_${projectId}`, ''); const [now, setNow] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const ms = target ? new Date(target).getTime() - now : 0; const days = Math.floor(Math.abs(ms) / 86400000); const hrs = Math.floor((Math.abs(ms) % 86400000) / 3600000);
  return (<div>{target ? <div style={{ textAlign: 'center', marginBottom: 8 }}><div className="pd-big">{days}<span style={{ fontSize: 13, color: 'var(--text-3)' }}>d</span> {hrs}<span style={{ fontSize: 13, color: 'var(--text-3)' }}>h</span></div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>{ms >= 0 ? 'until' : 'since'} {new Date(target).toLocaleDateString()}</div></div> : <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Set a target date.</div>}<input className="pd-inp" type="date" value={target} onChange={e => setTarget(e.target.value)} /></div>);
}
function SunWidget({ projectId }: any) {
  const [loc, setLoc] = useLS(`pdw_sun_${projectId}`, { lat: 25.2, lng: 55.27 }); const st = sunTimes(new Date(), loc.lat, loc.lng);
  return (<div>{st ? <div className="pd-row pd-c2" style={{ marginBottom: 8 }}><div className="pd-stat"><div className="k">Sunrise</div><div className="v" style={{ fontSize: 16 }}>{st.sunrise}</div></div><div className="pd-stat"><div className="k">Sunset</div><div className="v" style={{ fontSize: 16 }}>{st.sunset}</div></div></div> : <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Polar day/night.</div>}{st && <div className="pd-kv"><span className="l">Golden hour (pm)</span><span className="r">{st.ghPm}–{st.sunset}</span></div>}<div style={{ display: 'flex', gap: 5, marginTop: 7 }}><input className="pd-inp" type="number" step="0.01" value={loc.lat} onChange={e => setLoc({ ...loc, lat: parseFloat(e.target.value) || 0 })} placeholder="lat" /><input className="pd-inp" type="number" step="0.01" value={loc.lng} onChange={e => setLoc({ ...loc, lng: parseFloat(e.target.value) || 0 })} placeholder="lng" /></div></div>);
}
function RatioWidget() { const [shot, setShot] = useState('10'); const [used, setUsed] = useState('1'); const r = (parseFloat(shot) || 0) / (parseFloat(used) || 1); return (<div><div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}><input className="pd-inp" type="number" value={shot} onChange={e => setShot(e.target.value)} /><span>:</span><input className="pd-inp" type="number" value={used} onChange={e => setUsed(e.target.value)} /></div><div style={{ textAlign: 'center' }}><div className="pd-big">{r.toFixed(1)}:1</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>shooting ratio</div></div></div>); }
function PageTimeWidget() { const [pg, setPg] = useState('92'); const m = Math.round(parseFloat(pg) || 0); return (<div><input className="pd-inp" type="number" value={pg} onChange={e => setPg(e.target.value)} placeholder="Pages" /><div style={{ textAlign: 'center', marginTop: 8 }}><div className="pd-big">≈ {m}<span style={{ fontSize: 13, color: 'var(--text-3)' }}> min</span></div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>~1 page = 1 min screen time</div></div></div>); }
function TimecodeWidget() { const [sec, setSec] = useState('60'); const [fps, setFps] = useState('24'); const s = parseFloat(sec) || 0; const f = parseFloat(fps) || 24; const frames = Math.round(s * f); const tc = `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(Math.floor(s % 60))}:${pad2(Math.round((s - Math.floor(s)) * f))}`; return (<div><div style={{ display: 'flex', gap: 6, marginBottom: 8 }}><input className="pd-inp" type="number" value={sec} onChange={e => setSec(e.target.value)} placeholder="Seconds" /><input className="pd-inp" type="number" value={fps} onChange={e => setFps(e.target.value)} placeholder="fps" /></div><div style={{ textAlign: 'center' }}><div className="pd-big" style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>{tc}</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>{frames.toLocaleString()} frames @ {f}fps</div></div></div>); }
function UnitsWidget() { const [ft, setFt] = useState('10'); const m = (parseFloat(ft) || 0) * 0.3048; return (<div><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input className="pd-inp" type="number" value={ft} onChange={e => setFt(e.target.value)} /><span>ft</span></div><div style={{ textAlign: 'center', marginTop: 8 }}><div className="pd-big">{m.toFixed(2)}<span style={{ fontSize: 13, color: 'var(--text-3)' }}> m</span></div></div></div>); }
function CurrencyWidget() { const [amt, setAmt] = useState('1000'); const [rate, setRate] = useState('3.67'); const out = (parseFloat(amt) || 0) * (parseFloat(rate) || 0); return (<div><div style={{ display: 'flex', gap: 6, marginBottom: 8 }}><input className="pd-inp" type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="Amount" /><input className="pd-inp" type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="Rate" /></div><div style={{ textAlign: 'center' }}><div className="pd-big">{out.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>amount × your rate</div></div></div>); }
function PaletteWidget() { const gen = () => Array.from({ length: 5 }, () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')); const [c, setC] = useState<string[]>(gen); return (<div><div style={{ display: 'flex', gap: 4, height: 46, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>{c.map((x, i) => (<div key={i} style={{ flex: 1, background: x }} title={x} />))}</div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace' }}>{c[0]} {c[1]} …</span><button className="pd-tb" onClick={() => setC(gen())}>↺ New</button></div></div>); }
function CompositionWidget() { const ratios: [string, number][] = [['2.39:1', 2.39], ['1.85:1', 1.85], ['16:9', 16 / 9], ['4:3', 4 / 3], ['1:1', 1]]; const [r, setR] = useState(2.39); const W = 200, Hh = Math.round(W / r); return (<div><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>{ratios.map(([l, v]) => (<button key={l} className="pd-tb" style={r === v ? { background: 'var(--accent)', color: 'var(--accent-on)', borderColor: 'var(--accent)' } : undefined} onClick={() => setR(v)}>{l}</button>))}</div><svg width="100%" viewBox={`0 0 ${W} ${Hh}`} style={{ background: 'var(--surface-2)', borderRadius: 6, display: 'block' }}><rect x="0.5" y="0.5" width={W - 1} height={Hh - 1} fill="none" stroke="var(--border-2)" /><line x1={W / 3} y1="0" x2={W / 3} y2={Hh} stroke="var(--accent)" strokeOpacity="0.5" /><line x1={2 * W / 3} y1="0" x2={2 * W / 3} y2={Hh} stroke="var(--accent)" strokeOpacity="0.5" /><line x1="0" y1={Hh / 3} x2={W} y2={Hh / 3} stroke="var(--accent)" strokeOpacity="0.5" /><line x1="0" y1={2 * Hh / 3} x2={W} y2={2 * Hh / 3} stroke="var(--accent)" strokeOpacity="0.5" /></svg></div>); }

export default function CustomizableOverview({ projectId, project, currency = 'AED', onNavigate, navDock, setDock }:
  { projectId: string; project: any; currency?: string; onNavigate: (tab: string) => void; navDock?: 'top' | 'left' | 'right' | 'hide'; setDock?: (v: 'top' | 'left' | 'right' | 'hide') => void }) {
  const money = (n: any) => formatCurrency(n || 0, currency);
  const [d, setD] = useState<any>({});

  useEffect(() => {
    let alive = true;
    const set = (k: string, v: any) => { if (alive) setD((p: any) => ({ ...p, [k]: v })); };
    productionApi.ledger.summary(projectId).then(r => set('sum', r.data)).catch(() => {});
    productionApi.costing.report(projectId).then(r => set('report', r.data)).catch(() => {});
    productionApi.scheduling.board(projectId).then(r => set('board', r.data)).catch(() => {});
    productionApi.crew.list(projectId).then(r => set('crew', r.data || [])).catch(() => {});
    productionApi.callsheets.list(projectId).then(r => set('sheets', r.data || [])).catch(() => {});
    productionApi.costing.pos(projectId).then(r => set('pos', r.data || [])).catch(() => {});
    productionApi.projects.workflow(projectId).then(r => set('wf', r.data)).catch(() => {});
    productionApi.perdiem.list(projectId).then(r => set('perdiem', r.data)).catch(() => {});
    productionApi.locationNeeds.list(projectId).then(r => set('locneeds', Array.isArray(r.data) ? r.data : [])).catch(() => {});
    arrivalApi.dashboard(projectId).then(r => set('arrivals', r.data)).catch(() => {});
    castingApi.calls(projectId).then(r => set('casting', Array.isArray(r.data) ? r.data : [])).catch(() => {});
    transportApi.orders({ projectId }).then(r => set('torders', Array.isArray(r.data) ? r.data : [])).catch(() => {});
    transportApi.vehicles({ projectId }).then(r => set('tveh', Array.isArray(r.data) ? r.data : [])).catch(() => {});
    return () => { alive = false; };
  }, [projectId]);

  // ----- board state + persistence -----
  const LS = `tfm_pdash_${projectId}`, LSV = `tfm_pdash_views_${projectId}`;
  const [board, setBoard] = useState<Item[]>(() => JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));
  const [views, setViews] = useState<Record<string, Item[]>>(() => JSON.parse(JSON.stringify(PRESET_VIEWS)));
  const [curView, setCurView] = useState('Default');
  const [editing, setEditing] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const rz = useRef<{ idx: number; axis: 'x' | 'y' | 'both'; startX: number; startY: number; startW: number; startH: number; colUnit: number; rowUnit: number } | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LSV); if (v) setViews({ ...PRESET_VIEWS, ...JSON.parse(v) });
      const r = localStorage.getItem(LS);
      if (r) { const o = JSON.parse(r); if (Array.isArray(o.board)) setBoard(o.board); if (o.view) setCurView(o.view); }
    } catch { /* ignore */ }
    setHydrated(true);
  }, [LS, LSV]);
  useEffect(() => { if (hydrated) { try { localStorage.setItem(LS, JSON.stringify({ board, view: curView })); } catch { /* ignore */ } } }, [board, curView, hydrated, LS]);
  const persistViews = (nv: Record<string, Item[]>) => { try { const custom: any = {}; for (const k of Object.keys(nv)) if (!(k in PRESET_VIEWS)) custom[k] = nv[k]; localStorage.setItem(LSV, JSON.stringify(custom)); } catch { /* ignore */ } };
  const be = useRef<{ currentId: string | null; viewIds: Record<string, string>; timer: any }>({ currentId: null, viewIds: {}, timer: null });
  const [beReady, setBeReady] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows: any[] = await savedViewsApi.list(`pdash:${projectId}`);
        if (alive && Array.isArray(rows)) {
          const vmap: Record<string, Item[]> = {};
          for (const r of rows) {
            if (r.name === '__current__') { be.current.currentId = r.id; if (r.query?.board) setBoard(r.query.board); if (r.query?.view) setCurView(r.query.view); }
            else if (r.query?.board) { vmap[r.name] = r.query.board; be.current.viewIds[r.name] = r.id; }
          }
          if (Object.keys(vmap).length) setViews(v => ({ ...v, ...vmap }));
        }
      } catch { /* backend offline — localStorage already applied */ }
      if (alive) setBeReady(true);
    })();
    return () => { alive = false; };
  }, [projectId]);
  useEffect(() => {
    if (!hydrated || !beReady) return;
    clearTimeout(be.current.timer);
    be.current.timer = setTimeout(async () => {
      try {
        if (be.current.currentId) await savedViewsApi.update(be.current.currentId, { query: { board, view: curView } });
        else { const row: any = await savedViewsApi.create({ module: `pdash:${projectId}`, name: '__current__', query: { board, view: curView } }); if (row?.id) be.current.currentId = row.id; }
      } catch { /* offline ok */ }
    }, 800);
  }, [board, curView, hydrated, beReady, projectId]);

  // ----- widget registry (closes over live data) -----
  const sum = d.sum, report = d.report, board0 = d.board, crew = d.crew || [], sheets = d.sheets || [], pos = d.pos || [], wf = d.wf;
  const efc = report?.totals?.efc ?? 0, variance = report?.totals?.variance ?? 0, committed = report?.totals?.committed ?? 0;
  const draftPos = pos.filter((p: any) => p.status === 'DRAFT').length;
  const openPos = pos.filter((p: any) => ['APPROVED', 'PARTIALLY_INVOICED'].includes(p.status)).length;
  const published = sheets.filter((s: any) => s.status === 'PUBLISHED').length;
  const memosSigned = crew.filter((c: any) => c.dealMemoStatus === 'SIGNED').length;
  const days = board0?.board || [];
  const nextDay = days.find((x: any) => x.date && new Date(x.date) >= new Date()) || days[0];
  const todayStrips = (nextDay?.strips || []).slice(0, 5);
  const spentPct = report?.totals?.actual && sum?.budget ? Math.round((report.totals.actual / sum.budget) * 100) : 0;
  const pdItems: any[] = d.perdiem?.items || []; const pdTot: any = d.perdiem?.totals || {};
  const pdUnrec = pdItems.filter((i: any) => i.status && i.status !== 'PAID').length;
  const locneeds: any[] = d.locneeds || []; const locLocked = locneeds.filter((n: any) => n.lockedOptionId || n.status === 'LOCKED').length;
  const arrCounts: any = d.arrivals?.counts || d.arrivals?.byStatus || {};
  const calls: any[] = d.casting || []; const openCalls = calls.filter((c: any) => ['OPEN', 'IN_REVIEW', 'CALLBACKS'].includes(c.status)).length;
  const castSubs = calls.reduce((a: number, c: any) => a + (c._count?.submissions || 0), 0);
  const torders: any[] = d.torders || []; const tveh: any[] = d.tveh || [];
  const activeRuns = torders.filter((o: any) => ['ACTIVE', 'EN_ROUTE', 'ASSIGNED', 'DISPATCHED'].includes(o.status)).length;

  const WIDGETS: Record<string, { icon: string; title: string; desc: string; w: number; sample?: boolean; tab?: string; cat?: string; render?: () => any; Comp?: any }> = useMemo(() => ({
    'kpi-money': { icon: '💷', title: 'Money · live', desc: 'EFC, variance, cash, committed POs', w: 2, tab: 'costreport', render: () => (
      <div className="pd-row pd-c4">
        <div className="pd-stat"><div className="k">Est. final cost</div><div className="v">{money(efc)}</div><div className={`d ${spentPct > 100 ? 'wn' : ''}`}>{spentPct}% spent</div></div>
        <div className="pd-stat"><div className="k">Variance</div><div className="v" style={{ color: variance < 0 ? 'var(--danger)' : 'var(--ok)' }}>{money(Math.abs(variance))}</div><div className={`d ${variance < 0 ? 'dn' : 'up'}`}>{variance < 0 ? 'over' : 'under'}</div></div>
        <div className="pd-stat"><div className="k">Cash</div><div className="v">{money(sum?.cashPosition)}</div><div className="d">position</div></div>
        <div className="pd-stat"><div className="k">Committed</div><div className="v">{money(committed)}</div><div className="d wn">{openPos} open POs</div></div>
      </div>) },
    'kpi-today': { icon: '🎬', title: 'Today · on set', desc: 'Shoot day, scenes, pages, cast', w: 3, sample: true, tab: 'callsheets', render: () => (
      <div className="pd-row pd-c6">
        <div className="pd-stat"><div className="k">Shoot day</div><div className="v">{nextDay?.dayNumber ?? '—'}{board0?.shootDays ? ` / ${board0.shootDays}` : ''}</div><div className="d">{nextDay?.date ? formatDate(nextDay.date) : 'TBC'}</div></div>
        <div className="pd-stat"><div className="k">Crew call</div><div className="v">{nextDay?.callTime || '06:30'}</div><div className="d">basecamp</div></div>
        <div className="pd-stat"><div className="k">Scenes</div><div className="v">{todayStrips.length || board0?.totalScenes || '—'}</div><div className="d">today</div></div>
        <div className="pd-stat"><div className="k">Pages</div><div className="v">{nextDay?.pages || '—'}</div><div className="d">today</div></div>
        <div className="pd-stat"><div className="k">Total pages</div><div className="v">{board0?.totalPages?.toFixed?.(1) ?? board0?.totalPages ?? '—'}</div><div className="d">script</div></div>
        <div className="pd-stat"><div className="k">Crew</div><div className="v">{crew.length}</div><div className="d">assigned</div></div>
      </div>) },
    'workflow': { icon: '☑', title: 'Production Workflow', desc: 'Gated steps & phase progress', w: 1, render: () => {
      const pct = wf?.total ? Math.round((wf.completed / wf.total) * 100) : 0;
      const steps = (wf?.steps || []).slice(0, 5);
      return (<div>
        <div className="pd-prog"><i style={{ width: `${pct}%` }} /></div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 7 }}>{wf ? `${wf.completed} / ${wf.total} steps` : 'Loading…'}</div>
        {steps.map((s: any) => (
          <div key={s.key} className={`pd-chk ${s.done ? 'is-done' : ''}`} onClick={() => onNavigate(s.tab)} style={{ cursor: 'pointer' }}>
            <span className={`s ${s.done ? 'done' : !s.available ? 'lock' : wf?.next === s.key ? 'now' : 'lock'}`}>{s.done ? '✓' : !s.available ? '🔒' : '◉'}</span>
            <span style={{ flex: 1 }}>{s.label}</span>{wf?.next === s.key && <small style={{ color: 'var(--accent)', fontWeight: 700 }}>Next</small>}
          </div>))}
        {!wf && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>No workflow data.</div>}
      </div>); } },
    'today-scenes': { icon: '🎞', title: "Today's scenes", desc: 'Next shoot day scene strip', w: 2, tab: 'callsheets', render: () => (
      todayStrips.length ? <table className="pd-tbl"><thead><tr><th>Sc</th><th>I/E</th><th>Set</th><th>D/N</th><th>Pages</th></tr></thead><tbody>
        {todayStrips.map((s: any, i: number) => (<tr key={i}><td className="pd-sn">{s.sceneNumber || '—'}</td><td><span className="pd-bdg b-int">{(s.intExt || '').toUpperCase() || '—'}</span></td><td>{s.setName || '—'}</td><td>{s.dayNight || ''}</td><td>{s.pages || ''}</td></tr>))}
      </tbody></table> : <div style={{ padding: 4, fontSize: 12, color: 'var(--text-3)' }}>No scheduled day yet — build the stripboard to populate.</div>) },
    'attention': { icon: '⚠️', title: 'Needs attention', desc: 'Blockers waiting on you', w: 1, render: () => (
      <div>
        {draftPos > 0 && <div className="pd-attn"><span className="dot" style={{ background: 'var(--warn)' }} />{draftPos} PO(s) awaiting approval</div>}
        {(crew.length - memosSigned) > 0 && <div className="pd-attn"><span className="dot" style={{ background: 'var(--danger)' }} />{crew.length - memosSigned} deal memo(s) unsigned</div>}
        {wf?.next && <div className="pd-attn"><span className="dot" style={{ background: 'var(--accent)' }} />Next step: {(wf.steps || []).find((s: any) => s.key === wf.next)?.label || wf.next}</div>}
        {wf?.accounting?.periodClosed === false && <div className="pd-attn"><span className="dot" style={{ background: 'var(--ok)' }} />Period {wf.accounting.currentPeriod} open</div>}
        {draftPos === 0 && (crew.length - memosSigned) === 0 && !wf?.next && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>All clear.</div>}
      </div>) },
    'schedule': { icon: '🗓', title: 'Schedule', desc: 'Scenes/pages, shoot days, next day', w: 1, tab: 'schedule', render: () => (
      <div>
        <div className="pd-kv"><span className="l">Scenes / pages</span><span className="r">{board0?.totalScenes ?? '—'} · {board0?.totalPages?.toFixed?.(1) ?? board0?.totalPages ?? '—'} pg</span></div>
        <div className="pd-kv"><span className="l">Shoot days</span><span className="r">{board0?.shootDays ?? '—'}</span></div>
        <div className="pd-kv"><span className="l">Next day</span><span className="r">{nextDay ? `Day ${nextDay.dayNumber}${nextDay.date ? ` · ${formatDate(nextDay.date)}` : ''}` : '—'}</span></div>
      </div>) },
    'crew': { icon: '👥', title: 'Crew & call sheets', desc: 'Headcount, memos, publishing', w: 1, tab: 'crew', render: () => (
      <div>
        <div className="pd-kv"><span className="l">Crew assigned</span><span className="r">{crew.length}</span></div>
        <div className="pd-kv"><span className="l">Deal memos signed</span><span className="r">{memosSigned} / {crew.length}</span></div>
        <div className="pd-kv"><span className="l">Call sheets published</span><span className="r" style={{ color: 'var(--ok)' }}>{published} / {sheets.length}</span></div>
      </div>) },
    'approvals': { icon: '🛒', title: 'Approvals queue', desc: 'POs & expenses awaiting you', w: 1, tab: 'purchasing', render: () => (
      <div>
        <div className="pd-kv"><span className="l">Draft POs</span><span className="r" style={{ color: draftPos ? 'var(--warn)' : undefined }}>{draftPos}</span></div>
        <div className="pd-kv"><span className="l">Open POs</span><span className="r">{openPos}</span></div>
        <div className="pd-kv"><span className="l">Committed</span><span className="r">{money(committed)}</span></div>
        <button className="pd-tb" style={{ marginTop: 8 }} onClick={() => onNavigate('purchasing')}>Open purchasing →</button>
      </div>) },
    'budget': { icon: '🧮', title: 'Budget summary', desc: 'Budget vs actual vs committed', w: 2, tab: 'actual', render: () => (
      <div className="pd-row pd-c4">
        <div className="pd-stat"><div className="k">Budget</div><div className="v">{money(sum?.budget)}</div><div className="d">approved</div></div>
        <div className="pd-stat"><div className="k">Actual</div><div className="v">{money(report?.totals?.actual)}</div><div className="d">{spentPct}%</div></div>
        <div className="pd-stat"><div className="k">Committed</div><div className="v">{money(committed)}</div><div className="d">open POs</div></div>
        <div className="pd-stat"><div className="k">EFC</div><div className="v">{money(efc)}</div><div className={`d ${variance < 0 ? 'dn' : 'up'}`}>{variance < 0 ? 'over' : 'under'}</div></div>
      </div>) },
    'project-info': { icon: '🎬', title: 'Project info', desc: 'Identity, dates, budget', w: 2, tab: 'settings', render: () => (
      <div className="pd-row pd-c2">
        <div>
          <div className="pd-kv"><span className="l">Type / status</span><span className="r">{project?.projectType || '—'} · {(project?.status || '').replace(/_/g, ' ')}</span></div>
          <div className="pd-kv"><span className="l">Shoot</span><span className="r">{project?.shootStartDate ? formatDate(project.shootStartDate) : '—'} → {project?.shootEndDate ? formatDate(project.shootEndDate) : '—'}</span></div>
          <div className="pd-kv"><span className="l">Budget</span><span className="r">{money(project?.totalBudget ?? sum?.budget)}</span></div>
        </div>
        <div>
          <div className="pd-kv"><span className="l">Project #</span><span className="r">{project?.projectNumber || '—'}</span></div>
          <div className="pd-kv"><span className="l">Client</span><span className="r">{project?.client?.companyName || (project?.isHouse ? 'House' : '—')}</span></div>
          <div className="pd-kv"><span className="l">Crew / sheets</span><span className="r">{crew.length} · {sheets.length}</span></div>
        </div>
      </div>) },
    'script': { icon: '📄', title: 'Script peek', desc: 'Current scene from the reader', w: 1, sample: true, cat: 'Creative', tab: 'script', render: () => (
      <div className="pd-scr"><p className="sh">INT. FIELD HOSPITAL TENT — NIGHT</p><p style={{ color: 'var(--text-2)', marginBottom: 8 }}>Open the reader to pull live scene text.</p><p className="ch">NADIA</p><p className="di">Stay with me. Look at my eyes — not the wound.</p></div>) },
    'weather': { icon: '🌤', title: 'Weather & daylight', desc: 'On-set forecast & golden hour', w: 1, sample: true, cat: 'Team & ambient', render: () => (
      <div><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div className="pd-big">34°</div><div style={{ fontSize: 12, color: 'var(--text-2)' }}>Clear · wind 12kph<br /><span style={{ color: 'var(--text-3)' }}>Sunset 18:52</span></div></div><div className="pd-kv" style={{ marginTop: 7 }}><span className="l">Golden hour</span><span className="r">18:10–18:52</span></div></div>) },
    'tasks': { icon: '✅', title: 'My tasks', desc: 'Quick sample task list', w: 1, sample: true, cat: 'Productivity', render: () => (
      <div><div className="pd-chk"><span className="s now">◉</span> Approve camera package PO</div><div className="pd-chk"><span className="s now">◉</span> Sign Gaffer deal memo</div><div className="pd-chk is-done"><span className="s done">✓</span> Confirm Sc 24 cast</div></div>) },
    'travel': { icon: '✈️', title: 'Travel & arrivals', desc: 'Inbound cast/crew arrivals', w: 1, tab: 'arrivals', render: () => {
      const entries = Object.entries(arrCounts);
      return entries.length ? <div>{entries.slice(0, 5).map(([k, v]: any) => (<div key={k} className="pd-kv"><span className="l" style={{ textTransform: 'capitalize' }}>{String(k).toLowerCase().replace(/_/g, ' ')}</span><span className="r">{v as any}</span></div>))}</div>
        : <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No arrivals logged yet.</div>; } },
    'casting': { icon: '🎭', title: 'Casting activity', desc: 'Calls & submissions', w: 1, tab: 'casting', render: () => (
      <div><div className="pd-kv"><span className="l">Total calls</span><span className="r">{calls.length}</span></div><div className="pd-kv"><span className="l">Open / in review</span><span className="r">{openCalls}</span></div><div className="pd-kv"><span className="l">Submissions</span><span className="r" style={{ color: 'var(--accent)' }}>{castSubs}</span></div></div>) },
    'locations': { icon: '📍', title: 'Location status', desc: 'Needs, locked sets, options', w: 1, tab: 'locations', render: () => (
      locneeds.length ? <div><div className="pd-kv"><span className="l">Location needs</span><span className="r">{locneeds.length}</span></div><div className="pd-kv"><span className="l">Locked</span><span className="r" style={{ color: 'var(--ok)' }}>{locLocked}</span></div><div className="pd-kv"><span className="l">Pending</span><span className="r" style={{ color: (locneeds.length - locLocked) ? 'var(--warn)' : undefined }}>{locneeds.length - locLocked}</span></div></div>
        : <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No location needs yet.</div>) },
    'transport': { icon: '🚐', title: 'Transport / dispatch', desc: 'Orders & vehicles', w: 1, tab: 'transport', render: () => (
      <div><div className="pd-kv"><span className="l">Active orders</span><span className="r" style={{ color: 'var(--ok)' }}>{activeRuns}</span></div><div className="pd-kv"><span className="l">Total orders</span><span className="r">{torders.length}</span></div><div className="pd-kv"><span className="l">Vehicles</span><span className="r">{tveh.length}</span></div></div>) },
    'perdiem': { icon: '💵', title: 'Per diem', desc: 'Runs & outstanding', w: 1, tab: 'perdiem', render: () => (
      <div><div className="pd-kv"><span className="l">Records</span><span className="r">{pdItems.length}</span></div><div className="pd-kv"><span className="l">Total</span><span className="r">{money(pdTot.totalAmount ?? pdTot.total ?? 0)}</span></div><div className="pd-kv"><span className="l">Unreconciled</span><span className="r" style={{ color: pdUnrec ? 'var(--warn)' : undefined }}>{pdUnrec}</span></div></div>) },
    // ── Creative & inspiration ──
    'quote': { icon: '💬', title: 'Daily film quote', desc: 'A rotating quote from the greats', w: 1, cat: 'Creative', render: () => (<div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5 }}>{QUOTES[dayIdx() % QUOTES.length]}</div>) },
    'onthisday': { icon: '🎞', title: 'On this day in film', desc: 'A notable moment for today', w: 1, cat: 'Creative', render: () => (<div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>{onThisDay()}</div>) },
    'prompt': { icon: '💡', title: 'Creative prompt', desc: 'A daily shot / story spark', w: 1, cat: 'Creative', render: () => (<div style={{ fontSize: 13, color: 'var(--text-1)' }}>{PROMPTS[dayIdx() % PROMPTS.length]}</div>) },
    'palette': { icon: '🎨', title: 'Color palette', desc: 'Generate a look palette', w: 1, cat: 'Creative', Comp: PaletteWidget },
    'composition': { icon: '🖼', title: 'Composition guide', desc: 'Aspect ratio + rule of thirds', w: 1, cat: 'Creative', Comp: CompositionWidget },
    // ── Productivity & focus ──
    'notes': { icon: '📝', title: 'Sticky notes', desc: 'Free scratchpad, saved per project', w: 1, cat: 'Productivity', Comp: NotesWidget },
    'todo': { icon: '🗒', title: 'Personal to-do', desc: 'Your own checklist', w: 1, cat: 'Productivity', Comp: TodoWidget },
    'pomodoro': { icon: '⏲', title: 'Focus timer', desc: 'Pomodoro work / break timer', w: 1, cat: 'Productivity', Comp: PomodoroWidget },
    'links': { icon: '🔗', title: 'Quick links', desc: 'Your own bookmarks', w: 1, cat: 'Productivity', Comp: LinksWidget },
    'clocks': { icon: '🌍', title: 'World clocks', desc: 'Timezones for the crew', w: 1, cat: 'Productivity', Comp: ClocksWidget },
    // ── Film & production utilities ──
    'countdown': { icon: '⏳', title: 'Countdown', desc: 'To wrap / shoot day / delivery', w: 1, cat: 'Film utilities', Comp: CountdownWidget },
    'sun': { icon: '🌅', title: 'Sun & golden hour', desc: 'Sunrise/sunset for a location', w: 1, cat: 'Film utilities', Comp: SunWidget },
    'ratio': { icon: '🎬', title: 'Shooting ratio', desc: 'Footage shot vs used', w: 1, cat: 'Film utilities', Comp: RatioWidget },
    'pagetime': { icon: '📄', title: 'Pages → screen time', desc: 'Estimate minutes from pages', w: 1, cat: 'Film utilities', Comp: PageTimeWidget },
    'timecode': { icon: '⏱', title: 'Timecode / frames', desc: 'Seconds ↔ frames @ fps', w: 1, cat: 'Film utilities', Comp: TimecodeWidget },
    'units': { icon: '📐', title: 'Unit converter', desc: 'Feet ↔ metres', w: 1, cat: 'Film utilities', Comp: UnitsWidget },
    'moon': { icon: '🌙', title: 'Moon phase', desc: 'Tonight\'s phase for exteriors', w: 1, cat: 'Film utilities', render: () => (<div style={{ textAlign: 'center' }}><div className="pd-big">{moonPhase(new Date()).split(' ')[0]}</div><div style={{ fontSize: 12, color: 'var(--text-2)' }}>{moonPhase(new Date()).split(' ').slice(1).join(' ')}</div></div>) },
    // ── Team & ambient ──
    'safety': { icon: '🦺', title: 'Safety tip', desc: 'Rotating on-set reminder', w: 1, cat: 'Team & ambient', render: () => (<div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>{SAFETY[dayIdx() % SAFETY.length]}</div>) },
    'currency': { icon: '💱', title: 'Currency converter', desc: 'Amount × your rate', w: 1, cat: 'Team & ambient', Comp: CurrencyWidget },
    'ambient': { icon: '🎧', title: 'Ambient sound', desc: 'Focus / on-set soundscapes', w: 1, cat: 'Team & ambient', render: () => (<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{([['🌧 Rain & thunder', 'https://www.youtube.com/results?search_query=rain+thunder+ambience'], ['🎬 Studio room tone', 'https://www.youtube.com/results?search_query=studio+room+tone'], ['🌊 Ocean waves', 'https://www.youtube.com/results?search_query=ocean+waves+ambience']] as [string, string][]).map(([l, u]) => (<a key={l} href={u} target="_blank" rel="noreferrer" className="pd-tb" style={{ textDecoration: 'none', justifyContent: 'flex-start' }}>{l}</a>))}</div>) },
    'birthdays': { icon: '🎂', title: 'Crew birthdays', desc: 'Today\'s birthdays & milestones', w: 1, cat: 'Team & ambient', sample: true, render: () => (<div><div className="pd-li"><span className="a">🎂</span><span className="t">No birthdays today</span></div><div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Connect crew DOBs to populate.</div></div>) },
  }), [d, currency]); // eslint-disable-line

  // ----- actions -----
  const move = (i: number, dir: number) => { const j = i + dir; if (j < 0 || j >= board.length) return; const b = board.slice(); [b[i], b[j]] = [b[j], b[i]]; setBoard(b); };
  const reorder = (from: number, to: number) => { if (from === to) return; const b = board.slice(); const it = b.splice(from, 1)[0]; b.splice(to, 0, it); setBoard(b); };
  const resize = (i: number) => { const b = board.slice(); const cur = b[i].w || WIDGETS[b[i].id]?.w || 1; b[i] = { ...b[i], w: cur >= 3 ? 1 : cur + 1 }; setBoard(b); };
  const removeW = (i: number) => setBoard(board.filter((_, idx) => idx !== i));
  const setW = (i: number, dir: number) => { const b = board.slice(); const cur = b[i].w || WIDGETS[b[i].id]?.w || 1; b[i] = { ...b[i], w: Math.min(3, Math.max(1, cur + dir)) }; setBoard(b); };
  const reorderTo = (from: number, insertAt: number) => { const b = board.slice(); const it = b.splice(from, 1)[0]; let to = insertAt > from ? insertAt - 1 : insertAt; if (to < 0) to = 0; if (to > b.length) to = b.length; b.splice(to, 0, it); setBoard(b); };
  const startResize = (i: number, axis: 'x' | 'y' | 'both', e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); const bw = boardRef.current?.clientWidth || 900; rz.current = { idx: i, axis, startX: e.clientX, startY: e.clientY, startW: board[i].w || WIDGETS[board[i].id]?.w || 1, startH: board[i].h ?? DEF_H[board[i].id] ?? 6, colUnit: (bw + 13) / 3, rowUnit: 37 }; setResizing(true); };
  useEffect(() => {
    const mm = (e: MouseEvent) => { const r = rz.current; if (!r) return; let nw = r.startW, nh = r.startH; if (r.axis !== 'y') nw = Math.min(3, Math.max(1, r.startW + Math.round((e.clientX - r.startX) / r.colUnit))); if (r.axis !== 'x') nh = Math.min(18, Math.max(2, r.startH + Math.round((e.clientY - r.startY) / r.rowUnit))); setBoard(b => { const it = b[r.idx]; if (!it) return b; const ch = it.h ?? DEF_H[it.id] ?? 6; if ((it.w || 1) === nw && ch === nh) return b; const nb = b.slice(); nb[r.idx] = { ...it, w: nw, h: nh }; return nb; }); };
    const mu = () => { if (rz.current) { rz.current = null; setResizing(false); } };
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
  }, []); // eslint-disable-line
  const addW = (id: string) => { if (!board.some(b => b.id === id)) setBoard([...board, { id, w: WIDGETS[id]?.w || 1 }]); setEditing(true); };
  const resetBoard = () => { setBoard(JSON.parse(JSON.stringify(DEFAULT_LAYOUT))); setCurView('Default'); };
  const applyView = (name: string) => { if (views[name]) { setBoard(JSON.parse(JSON.stringify(views[name]))); setCurView(name); } };
  const saveView = () => { const n = prompt('Save current layout as a view named:', 'My view'); if (!n) return; const snap = JSON.parse(JSON.stringify(board)); const nv = { ...views, [n]: snap }; setViews(nv); persistViews(nv); setCurView(n);
    (async () => { try { if (be.current.viewIds[n]) await savedViewsApi.update(be.current.viewIds[n], { query: { board: snap } }); else { const row: any = await savedViewsApi.create({ module: `pdash:${projectId}`, name: n, query: { board: snap } }); if (row?.id) be.current.viewIds[n] = row.id; } } catch { /* offline ok */ } })(); };

  return (
    <div>
      <style>{STYLE}</style>
      <div className="pd-toolbar">
        {editing && <span className="pd-hint">drag ⠿ reorder · edges/corner resize · ‹ › width · ✕ remove</span>}
        <div style={{ position: 'relative' }}>
          <button className="pd-ico" title={`View: ${curView}`} onClick={() => setViewsOpen(o => !o)}><LayoutGrid size={15} /></button>
          {viewsOpen && <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setViewsOpen(false)} />
            <div className="pd-pop">
              {Object.keys(views).map(v => (
                <button key={v} className="pd-popitem" onClick={() => { applyView(v); setViewsOpen(false); }}>{v === curView ? <Check size={13} /> : <span style={{ width: 13, display: 'inline-block' }} />} {v}</button>
              ))}
            </div>
          </>}
        </div>
        <button className="pd-ico" title="Add widget" onClick={() => setLibOpen(true)}><Plus size={16} /></button>
        <button className={`pd-ico ${editing ? 'on' : ''}`} title={editing ? 'Done editing' : 'Edit layout'} onClick={() => setEditing(e => !e)}><Pencil size={14} /></button>
        <button className="pd-ico" title="Save current as a view" onClick={saveView}><Save size={15} /></button>
        <button className="pd-ico" title="Reset to default" onClick={resetBoard}><RotateCcw size={14} /></button>
        {setDock && <>
          <span className="pd-div" />
          <button className={`pd-ico ${navDock === 'left' ? 'on' : ''}`} title="Dock menu left" onClick={() => setDock('left')}><PanelLeft size={15} /></button>
          <button className={`pd-ico ${navDock === 'top' ? 'on' : ''}`} title="Dock menu top" onClick={() => setDock('top')}><PanelTop size={15} /></button>
          <button className={`pd-ico ${navDock === 'right' ? 'on' : ''}`} title="Dock menu right" onClick={() => setDock('right')}><PanelRight size={15} /></button>
          <button className={`pd-ico ${navDock === 'hide' ? 'on' : ''}`} title="Hide menu" onClick={() => setDock('hide')}><EyeOff size={15} /></button>
        </>}
      </div>

      <div ref={boardRef} className={`pd-board ${editing ? 'editing' : ''}`}>
        {board.map((it, idx) => {
          const c = WIDGETS[it.id]; if (!c) return null;
          const Comp = c.Comp;
          const w = it.w || c.w; const h = it.h ?? DEF_H[it.id] ?? 6;
          return (
            <div key={it.id + idx} style={{ gridColumn: `span ${w}`, gridRow: `span ${h}` }} className={`pd-w ${dragFrom === idx ? 'dragging' : ''} ${dropIdx === idx ? 'ins-before' : ''} ${dropIdx === board.length && idx === board.length - 1 ? 'ins-after' : ''}`}
              draggable={editing && !resizing}
              onDragStart={() => setDragFrom(idx)}
              onDragOver={editing ? (e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setDropIdx(e.clientX < r.left + r.width / 2 ? idx : idx + 1); } : undefined}
              onDrop={editing ? (e) => { e.preventDefault(); if (dragFrom != null && dropIdx != null) reorderTo(dragFrom, dropIdx); setDragFrom(null); setDropIdx(null); } : undefined}
              onDragEnd={() => { setDragFrom(null); setDropIdx(null); }}>
              <div className="pd-wh">
                <span className="pd-grip" title="Drag to reorder">⠿</span>
                <h3>{c.icon} {c.title}{c.sample && <span className="smpl">sample</span>}</h3>
                {c.tab && <button className="more" onClick={() => onNavigate(c.tab!)}>Open →</button>}
                <div className="pd-ctl">
                  <button title="Move back" onClick={() => move(idx, -1)}>◀</button>
                  <button title="Move forward" onClick={() => move(idx, 1)}>▶</button>
                  <button title="Narrower" onClick={() => setW(idx, -1)}>‹</button>
                  <button title="Wider" onClick={() => setW(idx, 1)}>›</button>
                  <button className="rm" title="Remove" onClick={() => removeW(idx)}>✕</button>
                </div>
              </div>
              <div className="pd-wb">{Comp ? <Comp projectId={projectId} /> : c.render ? c.render() : null}</div>
              {editing && <><div className="pd-rz-e" title="Drag width" onMouseDown={(e) => startResize(idx, 'x', e)} /><div className="pd-rz-s" title="Drag height" onMouseDown={(e) => startResize(idx, 'y', e)} /><div className="pd-rz" title="Drag to resize" onMouseDown={(e) => startResize(idx, 'both', e)}>⤡</div></>}
            </div>
          );
        })}
        {board.length === 0 && <div className="pd-w" style={{ gridColumn: 'span 3', gridRow: 'span 3' }}><div className="pd-wb" style={{ color: 'var(--text-3)', fontSize: 13 }}>Empty dashboard — click <b>Add widget</b> to start, or <b>Reset</b> for the default.</div></div>}
      </div>

      {libOpen && (
        <div className="pd-ov" onClick={e => { if (e.target === e.currentTarget) setLibOpen(false); }}>
          <div className="pd-modal">
            <div className="pd-mh">＋ Add a widget<button className="x" onClick={() => setLibOpen(false)}>✕</button></div>
            <div className="pd-lib">
              {(() => {
                const ORDER = ['Production', 'Film utilities', 'Creative', 'Productivity', 'Team & ambient'];
                const groups: Record<string, [string, any][]> = {};
                Object.entries(WIDGETS).forEach(([id, c]) => { const cat = (c as any).cat || 'Production'; (groups[cat] = groups[cat] || []).push([id, c]); });
                return ORDER.filter(cat => groups[cat]?.length).map(cat => (
                  <Fragment key={cat}>
                    <div className="pd-libcat">{cat}</div>
                    {groups[cat].map(([id, c]) => { const used = board.some(b => b.id === id); return (
                      <div key={id} className={`pd-libitem ${used ? 'inuse' : ''}`}>
                        <div className="ico">{c.icon}</div>
                        <div><div className="nm">{c.title}{c.sample ? ' · sample' : ''}</div><div className="ds">{c.desc}</div></div>
                        <button className="add" onClick={() => addW(id)}>{used ? 'Added' : '＋ Add'}</button>
                      </div>); })}
                  </Fragment>));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
