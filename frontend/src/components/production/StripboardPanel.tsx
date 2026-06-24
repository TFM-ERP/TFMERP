'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Film, Calendar, RefreshCw, Users, Printer, GripVertical, FileUp, Wand2, Lock, Filter, Flag, AlertTriangle, Sparkles } from 'lucide-react';
import { productionApi, uploadFile } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import BreakdownMappingModal from './BreakdownMappingModal';
import UniversalDoodPanel from './UniversalDoodPanel';
import ScheduleScenariosPanel from './ScheduleScenariosPanel';

const IE = ['INT', 'EXT', 'INT_EXT'];
const DN = ['DAY', 'NIGHT', 'DUSK', 'DAWN'];
const DN_CLR: Record<string, string> = { DAY: 'bg-amber-50 text-amber-700', NIGHT: 'bg-indigo-50 text-indigo-700', DUSK: 'bg-orange-50 text-orange-700', DAWN: 'bg-sky-50 text-sky-700' };
const CODE_CLR: Record<string, string> = { SW: 'bg-green-100 text-green-700', W: 'bg-blue-50 text-blue-700', H: 'bg-gray-100 text-gray-400', WF: 'bg-amber-100 text-amber-700', SWF: 'bg-purple-100 text-purple-700' };
const DN_EDGE: Record<string, string> = { DAY: 'border-l-amber-400', NIGHT: 'border-l-indigo-400', DUSK: 'border-l-orange-400', DAWN: 'border-l-sky-400' };
const pagesLabel = (p: number) => { const whole = Math.floor(p); const e = Math.round((p - whole) * 8); return `${whole || (e ? '' : '0')}${e ? ` ${e}/8` : ''}`.trim() || '0'; };

export default function StripboardPanel({ projectId, cast = [], currency = 'AED', accounts = [] }: { projectId: string; cast?: string[]; currency?: string; accounts?: { code: string; title: string }[] }) {
  const [view, setView] = useState<'board' | 'dood' | 'scenarios'>('board');
  const [board, setBoard] = useState<any>(null);
  const [dood, setDood] = useState<any>(null);
  const [conf, setConf] = useState<any>(null);
  const [scriptStat, setScriptStat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ sceneNumber: '', intExt: 'INT', dayNight: 'DAY', setName: '', locationId: '', description: '', pages: '', shootDay: '1', cast: '' });
  const [locations, setLocations] = useState<any[]>([]);
  const [filt, setFilt] = useState<any>({ cast: '', loc: '', dn: '', set: '' });
  const [calOpen, setCalOpen] = useState(false);
  const [outOpen, setOutOpen] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [calCfg, setCalCfg] = useState<any>({ weekendDays: [], holidays: [] });
  const [holText, setHolText] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    productionApi.scheduling.conflicts(projectId).then((r: any) => setConf(r.data)).catch(() => {});
    Promise.all([productionApi.scheduling.board(projectId), productionApi.scheduling.dood(projectId)])
      .then(([b, d]) => { setBoard(b.data); setDood(d.data); }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { productionApi.locations.list(projectId).then(r => setLocations(r.data || [])).catch(() => {}); }, [projectId]);
  useEffect(() => { productionApi.scheduling.calendarConfig(projectId).then(r => { const c = r.data || { weekendDays: [], holidays: [] }; setCalCfg(c); setHolText((c.holidays || []).join('\n')); }).catch(() => {}); }, [projectId]);
  useEffect(() => { productionApi.script.projectionStatus(projectId).then((r: any) => setScriptStat(r.data)).catch(() => {}); }, [projectId]);
  const breakdownScript = async () => {
    const rid = scriptStat?.revision?.id; if (!rid) return;
    if (!confirm('Run the Script-hub AI breakdown on the active revision? This is the single source of truth — strips, budget & cast derive from it.')) return;
    try { const r = await productionApi.breakdown.breakdownRevision(rid); alert(`Broke down ${r.data?.processed ?? 0} scene(s) → ${r.data?.elements ?? 0} elements.`); productionApi.script.projectionStatus(projectId).then((x: any) => setScriptStat(x.data)).catch(() => {}); }
    catch { alert('Needs db:push + ANTHROPIC_API_KEY + a backend restart.'); }
  };

  const add = async () => {
    if (!form.sceneNumber && !form.description) return;
    const loc = locations.find((l: any) => l.id === form.locationId);
    await productionApi.scheduling.createStrip({
      projectId, sceneNumber: form.sceneNumber || undefined, intExt: form.intExt, dayNight: form.dayNight,
      setName: form.setName || undefined, description: form.description || undefined,
      locationId: form.locationId || undefined, location: loc?.name || form.location || undefined,
      pages: Number(form.pages) || 0, shootDay: Number(form.shootDay) || 0,
      cast: form.cast ? form.cast.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
    });
    setAdding(false); setForm({ sceneNumber: '', intExt: 'INT', dayNight: 'DAY', setName: '', locationId: '', description: '', pages: '', shootDay: form.shootDay, cast: '' });
    load();
  };
  const moveDay = async (id: string, day: number) => { await productionApi.scheduling.updateStrip(id, { shootDay: day }); load(); };
  const del = async (id: string) => { if (confirm('Delete this strip?')) { await productionApi.scheduling.removeStrip(id); load(); } };
  const setLock = async (id: string, v: boolean) => { await productionApi.scheduling.updateStrip(id, { isLocked: v }); load(); };
  const addBanner = async (day: number) => { const text = prompt('Banner / day-break text (e.g. COMPANY MOVE · DAY OFF · 2ND UNIT):'); if (!text) return; await productionApi.scheduling.createStrip({ projectId, isBanner: true, bannerText: text, shootDay: day, pages: 0 }); load(); };
  const toggleWeekend = (d: number) => setCalCfg((c: any) => ({ ...c, weekendDays: (c.weekendDays || []).includes(d) ? c.weekendDays.filter((x: number) => x !== d) : [...(c.weekendDays || []), d] }));
  const saveCal = async () => { const holidays = holText.split(/\n|,/).map(x => x.trim()).filter(Boolean); await productionApi.scheduling.setCalendarConfig(projectId, { weekendDays: calCfg.weekendDays || [], holidays }); setCalOpen(false); load(); };
  const stripMatches = (s: any) => s.isBanner || ((!filt.cast || (Array.isArray(s.cast) && s.cast.includes(filt.cast))) && (!filt.loc || s.locationId === filt.loc || s.location === filt.loc) && (!filt.dn || s.dayNight === filt.dn) && (!filt.set || s.setName === filt.set));

  // ── One-click: Script → full setup (import + schedule + budget) ──
  const fullRef = useRef<HTMLInputElement>(null);
  const [fullBusy, setFullBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const onFullSetup = async (e: any) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const ppd = prompt(`Script → full setup for "${file.name}":\n\nThis will (1) import & AI-break-down the script and (2) auto-schedule scenes into shoot days. Previously imported scenes are replaced.\n\nTarget pages per shoot day:`, '5');
    if (ppd === null) return;
    const useVisual = confirm('Budget step:\n\nOK = open the VISUAL drag-and-drop mapping (you place each category onto a budget account)\nCancel = auto-generate budget lines at default rates');
    setFullBusy(true);
    try {
      const up = await uploadFile(file);
      const r = await productionApi.breakdown.importScriptFull(projectId, { fileUrl: up.url, originalName: up.originalName, pagesPerDay: Number(ppd) || 5, skipBudget: useVisual });
      const d = r.data;
      if (useVisual) {
        load();
        setMapOpen(true); // hand off to the drag-and-drop mapping step
      } else {
        alert(`Full setup complete:\n• ${d.import.scenes} scenes, ${d.import.elements} elements\n• Scheduled across ${d.schedule.days} shoot day(s)\n• ${d.budget.created} budget lines generated${d.budget.unmapped?.length ? ` (unmapped: ${d.budget.unmapped.map((u: any) => u.category).join(', ')})` : ''}\n\nReview the DOOD, then refine rates on the Breakdown tab.`);
        load(); setView('dood');
      }
    } catch (err: any) { alert(err.response?.data?.message || 'Full setup failed.'); }
    finally { setFullBusy(false); }
  };

  const [scheduling, setScheduling] = useState(false);
  const autoSchedule = async () => {
    const ppd = prompt('Auto-assign unscheduled scenes to shoot days. Target pages per day:', '5');
    if (ppd === null) return;
    setScheduling(true);
    try {
      const r = await productionApi.scheduling.autoSchedule(projectId, { pagesPerDay: Number(ppd) || 5, onlyUnscheduled: true });
      alert(`Scheduled ${r.data.scheduled} scenes across ${r.data.days} day(s). The Day Out of Days is now populated from scene cast.`);
      load(); setView('dood');
    } catch (e: any) { alert(e.response?.data?.message || 'Auto-schedule failed.'); }
    finally { setScheduling(false); }
  };
  // ── Shooting-order optimizer (preview → apply) ──
  const [optBusy, setOptBusy] = useState(false);
  const [optOpen, setOptOpen] = useState(false);
  const [optRes, setOptRes] = useState<any>(null);
  const runOptimize = async () => {
    const ppd = prompt('Optimise shooting order — fewer company moves & cast hold days. Target pages per day:', '5');
    if (ppd === null) return;
    setOptBusy(true);
    try {
      const r = await productionApi.scheduling.optimize(projectId, { pagesPerDay: Number(ppd) || 5, apply: false });
      if (r.data?.ok === false) { alert(r.data.message || 'Nothing to optimise yet — add scenes first.'); return; }
      setOptRes(r.data); setOptOpen(true);
    } catch (e: any) { alert(e.response?.data?.message || 'Optimise failed. Restart the backend if scheduling was just updated.'); }
    finally { setOptBusy(false); }
  };
  const applyOptimize = async () => {
    if (!optRes) return;
    setOptBusy(true);
    try {
      await productionApi.scheduling.optimize(projectId, { pagesPerDay: optRes.pagesPerDay, apply: true });
      setOptOpen(false); setOptRes(null); load();
    } catch (e: any) { alert(e.response?.data?.message || 'Apply failed.'); }
    finally { setOptBusy(false); }
  };


  // ── Script import (auto-breakdown) ──
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const onScriptFile = async (e: any) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm(`Import & auto-break-down "${file.name}"? This parses scenes and uses AI to tag elements, then adds them to the stripboard (previously imported scenes are replaced).`)) return;
    setImporting(true);
    try {
      const up = await uploadFile(file);
      const r = await productionApi.breakdown.importScript(projectId, { fileUrl: up.url, originalName: up.originalName, replace: true });
      alert(`Imported ${r.data.scenes} scenes and ${r.data.elements} elements from the ${r.data.format}.`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Script import failed.');
    } finally { setImporting(false); }
  };

  // ── Drag & drop reordering ──
  const [dragId, setDragId] = useState<string | null>(null);
  const flatStrips = () => {
    const list: any[] = [];
    for (const d of board?.board || []) for (const s of d.strips) list.push({ ...s, shootDay: d.dayNumber });
    for (const s of board?.unscheduled || []) list.push({ ...s, shootDay: 0 });
    return list;
  };
  const moveStrip = async (draggedId: string, targetDay: number, beforeId?: string) => {
    let list = flatStrips();
    const dragged = list.find(s => s.id === draggedId);
    if (!dragged) return;
    list = list.filter(s => s.id !== draggedId);
    dragged.shootDay = targetDay;
    if (beforeId) { const idx = list.findIndex(s => s.id === beforeId); list.splice(idx < 0 ? list.length : idx, 0, dragged); }
    else { let last = -1; list.forEach((s, i) => { if (s.shootDay === targetDay) last = i; }); list.splice(last + 1, 0, dragged); }
    const counter: Record<number, number> = {};
    const items = list.map(s => { counter[s.shootDay] = counter[s.shootDay] || 0; return { id: s.id, shootDay: s.shootDay, sortOrder: counter[s.shootDay]++ }; });
    await productionApi.scheduling.reorder(items);
    load();
  };
  const onStripDrop = (e: any, s: any) => { e.preventDefault(); e.stopPropagation(); if (dragId && dragId !== s.id) moveStrip(dragId, s.shootDay, s.id); setDragId(null); };
  const onDayDrop = (e: any, day: number) => { e.preventDefault(); if (dragId) moveStrip(dragId, day); setDragId(null); };

  const dayOptions = board ? [0, ...board.board.map((d: any) => d.dayNumber), (board.board.length ? Math.max(...board.board.map((d: any) => d.dayNumber)) + 1 : 1)] : [0, 1];
  const uniqueDays = Array.from(new Set(dayOptions)).sort((a, b) => a - b);
  const sets = Array.from(new Set(flatStrips().map((s: any) => s.setName).filter(Boolean)));

  const Strip = ({ s }: { s: any }) => s.isBanner ? (
    <div draggable onDragStart={() => setDragId(s.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onStripDrop(e, s)}
      className="flex items-center justify-between gap-2 px-2.5 py-1 bg-gray-800 text-white text-[10px] font-bold tracking-wide cursor-move">
      <span className="flex items-center gap-1.5 truncate"><Flag size={10} /> {s.bannerText || '—'}</span>
      <button onClick={() => del(s.id)} className="text-gray-400 hover:text-white shrink-0"><Trash2 size={11} /></button>
    </div>
  ) : (
    <div draggable={!s.isLocked} onDragStart={() => !s.isLocked && setDragId(s.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onStripDrop(e, s)}
      className={cn('px-2.5 py-2 border-b border-gray-50 hover:bg-gray-50/60 text-xs border-l-4', DN_EDGE[s.dayNight] || 'border-l-gray-200', s.isLocked ? 'bg-gray-50/70' : 'cursor-move', dragId === s.id && 'opacity-40')}>
      <div className="flex items-center gap-1.5">
        {!s.isLocked && <GripVertical size={12} className="text-gray-300 shrink-0" />}
        <span className="font-mono text-[11px] text-gray-500">{s.sceneNumber || '—'}</span>
        <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded', s.intExt === 'EXT' ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-600')}>{s.intExt.replace('_', '/')}</span>
        <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded', DN_CLR[s.dayNight])}>{s.dayNight[0]}</span>
        <span className="flex-1" />
        <button onClick={() => setLock(s.id, !s.isLocked)} title={s.isLocked ? 'Locked — click to unlock' : 'Lock to hold position'} className={cn('shrink-0', s.isLocked ? 'text-brand-500' : 'text-gray-300 hover:text-gray-500')}><Lock size={11} /></button>
        <button onClick={() => del(s.id)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={12} /></button>
      </div>
      <div className="text-gray-800 truncate mt-1">{s.setName ? <b>{s.setName}</b> : ''}{s.setName && s.description ? ' — ' : ''}{s.description}</div>
      <div className="flex items-center justify-between mt-1 gap-1">
        {Array.isArray(s.cast) && s.cast.length > 0 ? <span className="text-[10px] text-gray-400 truncate">{s.cast.join(', ')}</span> : <span className="flex-1" />}
        <div className="flex items-center gap-1 shrink-0">
          <select value={s.shootDay} onChange={e => moveDay(s.id, Number(e.target.value))} className="input text-[10px] h-6 w-14" title="Move to day">{uniqueDays.map(d => <option key={d} value={d}>{d === 0 ? 'U' : `D${d}`}</option>)}</select>
          <span className="text-[10px] text-gray-500">{pagesLabel(Number(s.pages))}pg</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          <button onClick={() => setView('board')} className={cn('text-xs px-3 py-1.5 rounded-lg', view === 'board' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50')}>Stripboard</button>
          <button onClick={() => setView('dood')} className={cn('text-xs px-3 py-1.5 rounded-lg', view === 'dood' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50')}>Day Out of Days</button>
          <button onClick={() => setView('scenarios')} className={cn('text-xs px-3 py-1.5 rounded-lg', view === 'scenarios' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50')}>Scenarios</button>
        </div>
        <div className="flex gap-2 items-center">
          {board && <span className="text-xs text-gray-400">{board.totalScenes} scenes · {pagesLabel(board.totalPages)} pages · {board.shootDays} days</span>}
          {scriptStat?.hasScript && (() => { const r = scriptStat.revision; const drift = (scriptStat.counts?.unlinked || 0) > 0; return (
            <span className={cn('inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border', drift ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')} title="Script is the source of truth — manage revisions & breakdown in the Script tab">
              <span style={{ width: 9, height: 9, borderRadius: 9, background: r?.colorCode || '#cbd5e1', border: '1px solid rgba(0,0,0,.2)' }} />
              Script {r?.label || ''}{r?.isLocked ? ' · locked' : ''}{drift ? ` · ${scriptStat.counts.unlinked} unlinked` : ' · in sync'}
            </span>); })()}

          {scriptStat?.hasScript && scriptStat?.revision?.id && (scriptStat.counts?.brokenDown ?? 0) < (scriptStat.counts?.scenes ?? 0) && (
            <button onClick={breakdownScript} className="text-[11px] px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700" title="Run the Script-hub AI breakdown — the single source of truth">Break down script</button>
          )}
          <button onClick={() => setCalOpen(o => !o)} className="btn btn-secondary text-xs py-1.5 px-2" title="Work-week & holidays"><Calendar size={13} className="me-1" /> Work-week</button>
          <div className="relative">
            <button onClick={() => setOutOpen(o => !o)} className="btn btn-secondary text-xs py-1.5 px-2" title="Print & export schedule documents"><Printer size={13} className="me-1" /> Outputs ▾</button>
            {outOpen && (
              <div className="absolute end-0 mt-1 z-30 w-52 bg-white border border-gray-100 rounded-lg shadow-lg py-1 text-xs" onMouseLeave={() => setOutOpen(false)}>
                <button onClick={() => { window.open(`/print/schedule/${projectId}`, '_blank'); setOutOpen(false); }} className="w-full text-start px-3 py-1.5 hover:bg-gray-50">Strip board (print)</button>
                <button onClick={() => { window.open(`/print/oneliner/${projectId}`, '_blank'); setOutOpen(false); }} className="w-full text-start px-3 py-1.5 hover:bg-gray-50">One-line schedule</button>
                <button onClick={() => { window.open(`/print/shooting-schedule/${projectId}`, '_blank'); setOutOpen(false); }} className="w-full text-start px-3 py-1.5 hover:bg-gray-50">Shooting schedule</button>
                <button onClick={() => { window.open(`/print/dood/${projectId}?category=CAST`, '_blank'); setOutOpen(false); }} className="w-full text-start px-3 py-1.5 hover:bg-gray-50">Day Out of Days (Cast)</button>
              </div>
            )}
          </div>
          <input ref={fullRef} type="file" accept=".fdx,.pdf,.docx,.txt,.fountain" className="hidden" onChange={onFullSetup} />
          <input ref={fileRef} type="file" accept=".fdx,.pdf,.docx,.txt,.fountain" className="hidden" onChange={onScriptFile} />
          <div className="relative">
            <button onClick={() => setLegacyOpen(o => !o)} className="btn btn-secondary text-xs py-1.5 px-2" title="Direct-to-board import. The Script hub is now the source of truth — prefer Break down + Sync from script.">
              <FileUp size={13} className={cn('me-1', (fullBusy || importing) && 'animate-pulse')} /> Legacy import ▾
            </button>
            {legacyOpen && (
              <div className="absolute end-0 mt-1 z-30 w-72 bg-white border border-gray-100 rounded-lg shadow-lg py-1 text-xs" onMouseLeave={() => setLegacyOpen(false)}>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400">Source of truth is the Script hub — break down &amp; sync there</div>
                <button onClick={() => { setLegacyOpen(false); fullRef.current?.click(); }} disabled={fullBusy} className="w-full text-start px-3 py-1.5 hover:bg-gray-50">{fullBusy ? 'Setting up…' : 'Script → full setup (legacy)'}</button>
                <button onClick={() => { setLegacyOpen(false); fileRef.current?.click(); }} disabled={importing} className="w-full text-start px-3 py-1.5 hover:bg-gray-50">{importing ? 'Importing…' : 'Import script (legacy)'}</button>
              </div>
            )}
          </div>
          <button onClick={autoSchedule} disabled={scheduling} className="btn btn-secondary text-xs py-1.5 px-3" title="Auto-assign unscheduled scenes to shoot days → populates Day Out of Days">
            <Calendar size={13} className={cn('me-1', scheduling && 'animate-pulse')} /> {scheduling ? 'Scheduling…' : 'Auto-schedule'}
          </button>
          <button onClick={runOptimize} disabled={optBusy} className="btn btn-secondary text-xs py-1.5 px-3" title="Optimise shooting order — fewer company moves & cast hold days (preview before applying)">
            <Sparkles size={13} className={cn('me-1', optBusy && 'animate-pulse')} /> {optBusy ? 'Optimising…' : 'Optimize order'}
          </button>
          <button onClick={() => setAdding(a => !a)} className="btn btn-primary text-xs py-1.5 px-3"><Plus size={13} className="me-1" /> Add scene</button>
          <button onClick={load} className="btn btn-secondary p-1.5"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {adding && (
        <div className="card bg-blue-50/40 border-blue-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="label text-xs">Scene #</label><input className="input text-sm h-9 w-full" value={form.sceneNumber} onChange={e => setForm((f: any) => ({ ...f, sceneNumber: e.target.value }))} /></div>
            <div><label className="label text-xs">INT/EXT</label><select className="input text-sm h-9 w-full" value={form.intExt} onChange={e => setForm((f: any) => ({ ...f, intExt: e.target.value }))}>{IE.map(x => <option key={x} value={x}>{x.replace('_', '/')}</option>)}</select></div>
            <div><label className="label text-xs">D/N</label><select className="input text-sm h-9 w-full" value={form.dayNight} onChange={e => setForm((f: any) => ({ ...f, dayNight: e.target.value }))}>{DN.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
            <div><label className="label text-xs">Shoot day</label><input type="number" className="input text-sm h-9 w-full" value={form.shootDay} onChange={e => setForm((f: any) => ({ ...f, shootDay: e.target.value }))} placeholder="0 = unsched" /></div>
            <div><label className="label text-xs">Set / location</label><input className="input text-sm h-9 w-full" value={form.setName} onChange={e => setForm((f: any) => ({ ...f, setName: e.target.value }))} /></div>
            {locations.length > 0 && <div><label className="label text-xs">Location</label><select className="input text-sm h-9 w-full" value={form.locationId} onChange={e => setForm((f: any) => ({ ...f, locationId: e.target.value }))}><option value="">—</option>{locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}{l.emirate ? ` · ${l.emirate}` : ''}</option>)}</select></div>}
            <div className="md:col-span-2"><label className="label text-xs">Description</label><input className="input text-sm h-9 w-full" value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
            <div><label className="label text-xs">Pages (e.g. 1.5)</label><input type="number" step="0.125" className="input text-sm h-9 w-full" value={form.pages} onChange={e => setForm((f: any) => ({ ...f, pages: e.target.value }))} /></div>
            <div className="md:col-span-4"><label className="label text-xs">Cast (comma separated)</label><input className="input text-sm h-9 w-full" value={form.cast} onChange={e => setForm((f: any) => ({ ...f, cast: e.target.value }))} placeholder="e.g. Pierce Brosnan, Tim Roth" list="cast-dl" />
              <datalist id="cast-dl">{cast.map(c => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
          <div className="flex gap-2 mt-3"><button onClick={add} className="btn btn-primary text-xs py-1.5">Add scene</button><button onClick={() => setAdding(false)} className="btn btn-secondary text-xs py-1.5">Cancel</button></div>
        </div>
      )}

      {calOpen && (
        <div className="card bg-amber-50/40 border-amber-100">
          <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5"><Calendar size={13} /> Work-week &amp; holidays — shoot days skip these</div>
          <div className="flex gap-1.5 flex-wrap mb-3">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (<button key={i} onClick={() => toggleWeekend(i)} className={cn('text-xs px-2.5 py-1 rounded-lg border', (calCfg.weekendDays || []).includes(i) ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200')}>{d}{(calCfg.weekendDays || []).includes(i) ? ' · off' : ''}</button>))}</div>
          <label className="label text-xs">Holidays (one date per line, YYYY-MM-DD)</label>
          <textarea className="input text-xs w-full" rows={3} value={holText} onChange={e => setHolText(e.target.value)} placeholder="2026-06-16" />
          <div className="flex gap-2 mt-2"><button onClick={saveCal} className="btn btn-primary text-xs py-1.5">Save calendar</button><button onClick={() => setCalOpen(false)} className="btn btn-secondary text-xs py-1.5">Close</button></div>
          <p className="text-[11px] text-gray-400 mt-2">Highlighted days are days off. This drives shoot-day → date across the calendar, call sheets, DOOD and forecast.</p>
        </div>
      )}

      {optOpen && optRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOptOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Sparkles size={16} className="text-brand-500" />
              <span className="font-semibold text-sm">Optimised shooting order — preview</span>
              <span className="flex-1" />
              <span className="text-[11px] text-gray-400">Target {pagesLabel(optRes.pagesPerDay)} pg/day · {optRes.after?.shootDays} days</span>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[{ k: 'companyMoves', label: 'Company moves' }, { k: 'castHoldDays', label: 'Cast hold days' }, { k: 'dayNightSwitches', label: 'D/N switches' }, { k: 'multiLocationDays', label: 'Multi-loc days' }].map(m => {
                  const b = optRes.before?.[m.k] ?? 0, a = optRes.after?.[m.k] ?? 0; const better = a < b;
                  return (
                    <div key={m.k} className="rounded-lg border border-gray-100 p-2.5">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">{m.label}</div>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-gray-400 text-xs line-through">{b}</span>
                        <span className={cn('text-lg font-bold', better ? 'text-emerald-600' : a > b ? 'text-red-500' : 'text-gray-700')}>{a}</span>
                        {better && <span className="text-[10px] text-emerald-600">−{b - a}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1.5">Why this order</div>
                <ul className="space-y-1">{(optRes.rationale || []).map((r: string, i: number) => <li key={i} className="text-xs text-gray-600 flex gap-1.5"><span className="text-brand-400">•</span>{r}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1.5">Proposed days</div>
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-52 overflow-auto">
                  {Object.entries((optRes.plan || []).reduce((acc: any, p: any) => { (acc[p.shootDay] = acc[p.shootDay] || []).push(p); return acc; }, {})).map(([day, list]: [string, any]) => (
                    <div key={day} className="px-3 py-1.5 text-xs flex gap-2">
                      <span className="font-semibold text-gray-500 w-10 shrink-0">D{day}</span>
                      <span className="text-gray-700 truncate">{(list as any[])[0]?.location} · {(list as any[]).map((p: any) => p.sceneNumber || '—').join(', ')} <span className="text-gray-400">({pagesLabel((list as any[]).reduce((t: number, p: any) => t + Number(p.pages || 0), 0))} pg)</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setOptOpen(false)} className="btn btn-secondary text-xs py-1.5">Cancel</button>
              <button onClick={applyOptimize} disabled={optBusy} className="btn btn-primary text-xs py-1.5">{optBusy ? 'Applying…' : 'Apply this order'}</button>
            </div>
          </div>
        </div>
      )}


      {loading ? <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div> : view === 'board' ? (
        <div className="space-y-3">
          {conf?.count > 0 && (
            <div className="space-y-1.5">
              {conf.warnings.slice(0, 8).map((w: any, i: number) => (
                <div key={i} className={cn('rounded-lg border px-3 py-1.5 text-xs flex items-start gap-2', w.severity === 'high' ? 'border-red-200 bg-red-50 text-red-700' : w.severity === 'medium' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-gray-200 bg-gray-50 text-gray-600')}>
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /><span>{w.message}</span>
                </div>
              ))}
              {conf.warnings.length > 8 && <div className="text-[11px] text-gray-400 px-1">+{conf.warnings.length - 8} more conflicts…</div>}
            </div>
          )}
          {(conf?.light || []).length > 0 && (
            <div className="card py-2 px-3 text-xs text-gray-500">
              <span className="font-semibold text-amber-700 flex items-center gap-1 mb-1">☀ Light plan — EXT days</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1">{conf.light.map((l: any, i: number) => (<span key={i}>Day {l.day}: {l.sunrise}–{l.sunset} · golden {l.goldenAm}/{l.goldenPm}</span>))}</div>
            </div>
          )}
          <div className="card py-2 px-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 flex items-center gap-1"><Filter size={12} /> Filter</span>
            <select className="input text-xs h-8" value={filt.cast} onChange={e => setFilt((f: any) => ({ ...f, cast: e.target.value }))}><option value="">Cast: all</option>{cast.map(c => <option key={c} value={c}>{c}</option>)}</select>
            {locations.length > 0 && <select className="input text-xs h-8" value={filt.loc} onChange={e => setFilt((f: any) => ({ ...f, loc: e.target.value }))}><option value="">Location: all</option>{locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
            <select className="input text-xs h-8" value={filt.dn} onChange={e => setFilt((f: any) => ({ ...f, dn: e.target.value }))}><option value="">D/N: all</option>{DN.map(x => <option key={x} value={x}>{x}</option>)}</select>
            <select className="input text-xs h-8" value={filt.set} onChange={e => setFilt((f: any) => ({ ...f, set: e.target.value }))}><option value="">Set: all</option>{sets.map((x: any) => <option key={x} value={x}>{x}</option>)}</select>
            {(filt.cast || filt.loc || filt.dn || filt.set) && <button onClick={() => setFilt({ cast: '', loc: '', dn: '', set: '' })} className="text-xs text-brand-600">Clear</button>}
            <span className="flex-1" />
            <span className="text-[11px] text-gray-400">Drag strips between days · 🔒 to hold · + banner per day</span>
          </div>
          {board && board.board.length === 0 && board.unscheduled.length === 0 && (
            <div className="card p-10 text-center text-gray-400 text-sm"><Film size={24} className="mx-auto mb-2 opacity-30" />No scenes yet. Add scenes and assign them to shoot days.</div>
          )}
          <div className="flex gap-3 overflow-x-auto pb-2 items-start">
            {board && board.unscheduled.length > 0 && (
              <div className="w-60 flex-none card overflow-hidden p-0 border-dashed" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDayDrop(e, 0)}>
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">Unscheduled · {board.unscheduled.length}</div>
                {board.unscheduled.filter(stripMatches).map((s: any) => <Strip key={s.id} s={s} />)}
              </div>
            )}
            {board?.board.map((d: any) => (
              <div key={d.dayNumber} className="w-60 flex-none card overflow-hidden p-0" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDayDrop(e, d.dayNumber)}>
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <div className="text-xs font-semibold text-gray-800 flex items-center gap-1.5"><Calendar size={12} className="text-brand-600" /> Day {d.dayNumber}{d.date ? ` · ${formatDate(d.date)}` : ''}</div>
                  <div className="text-[10px] text-gray-400 flex items-center justify-between"><span className="truncate">{d.location || '—'}</span><span className="shrink-0">{d.sceneCount} sc · {pagesLabel(d.pages)} pg</span></div>
                </div>
                {d.strips.filter(stripMatches).map((s: any) => <Strip key={s.id} s={s} />)}
                <button onClick={() => addBanner(d.dayNumber)} className="w-full text-[10px] text-gray-400 hover:text-brand-600 py-1.5 border-t border-gray-50 flex items-center justify-center gap-1"><Plus size={10} /> banner</button>
              </div>
            ))}
          </div>
        </div>
      ) : view === 'dood' ? (
        /* Dynamic multi-category DOOD — computed live from strips × breakdown elements.
           Replaces the old cast-only table; CAST merges legacy scene-cast lists. */
        <UniversalDoodPanel projectId={projectId} />
      ) : (
        /* M6 — what-if scenarios + script↔strip reconciliation */
        <ScheduleScenariosPanel projectId={projectId} />
      )}

      {mapOpen && <BreakdownMappingModal projectId={projectId} currency={currency} onClose={() => setMapOpen(false)} onApplied={() => { load(); setView('dood'); }} />}
    </div>
  );
}
