'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Film, Calendar, RefreshCw, Users, Printer, GripVertical, FileUp, Wand2 } from 'lucide-react';
import { productionApi, uploadFile } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import BreakdownMappingModal from './BreakdownMappingModal';
import UniversalDoodPanel from './UniversalDoodPanel';

const IE = ['INT', 'EXT', 'INT_EXT'];
const DN = ['DAY', 'NIGHT', 'DUSK', 'DAWN'];
const DN_CLR: Record<string, string> = { DAY: 'bg-amber-50 text-amber-700', NIGHT: 'bg-indigo-50 text-indigo-700', DUSK: 'bg-orange-50 text-orange-700', DAWN: 'bg-sky-50 text-sky-700' };
const CODE_CLR: Record<string, string> = { SW: 'bg-green-100 text-green-700', W: 'bg-blue-50 text-blue-700', H: 'bg-gray-100 text-gray-400', WF: 'bg-amber-100 text-amber-700', SWF: 'bg-purple-100 text-purple-700' };
const pagesLabel = (p: number) => { const whole = Math.floor(p); const e = Math.round((p - whole) * 8); return `${whole || (e ? '' : '0')}${e ? ` ${e}/8` : ''}`.trim() || '0'; };

export default function StripboardPanel({ projectId, cast = [], currency = 'AED', accounts = [] }: { projectId: string; cast?: string[]; currency?: string; accounts?: { code: string; title: string }[] }) {
  const [view, setView] = useState<'board' | 'dood'>('board');
  const [board, setBoard] = useState<any>(null);
  const [dood, setDood] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ sceneNumber: '', intExt: 'INT', dayNight: 'DAY', setName: '', locationId: '', description: '', pages: '', shootDay: '1', cast: '' });
  const [locations, setLocations] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([productionApi.scheduling.board(projectId), productionApi.scheduling.dood(projectId)])
      .then(([b, d]) => { setBoard(b.data); setDood(d.data); }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { productionApi.locations.list(projectId).then(r => setLocations(r.data || [])).catch(() => {}); }, [projectId]);

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

  const Strip = ({ s }: { s: any }) => (
    <div draggable onDragStart={() => setDragId(s.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onStripDrop(e, s)}
      className={cn('flex items-center gap-2 px-3 py-2 border-b border-gray-50 hover:bg-gray-50/60 text-sm cursor-move', dragId === s.id && 'opacity-40')}>
      <GripVertical size={13} className="text-gray-300 shrink-0" />
      <span className="font-mono text-xs text-gray-500 w-10">{s.sceneNumber || '—'}</span>
      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', s.intExt === 'EXT' ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-600')}>{s.intExt.replace('_', '/')}</span>
      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', DN_CLR[s.dayNight])}>{s.dayNight[0]}</span>
      <div className="flex-1 min-w-0">
        <div className="text-gray-800 truncate">{s.setName ? <b>{s.setName}</b> : ''}{s.setName && s.description ? ' — ' : ''}{s.description}</div>
        {Array.isArray(s.cast) && s.cast.length > 0 && <div className="text-[11px] text-gray-400 truncate">Cast: {s.cast.join(', ')}</div>}
      </div>
      <span className="text-xs text-gray-500 w-14 text-right">{pagesLabel(Number(s.pages))} pg</span>
      <select value={s.shootDay} onChange={e => moveDay(s.id, Number(e.target.value))} className="input text-xs h-7 w-20" title="Move to day">
        {uniqueDays.map(d => <option key={d} value={d}>{d === 0 ? 'Unsched' : `Day ${d}`}</option>)}
      </select>
      <button onClick={() => del(s.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          <button onClick={() => setView('board')} className={cn('text-xs px-3 py-1.5 rounded-lg', view === 'board' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50')}>Stripboard</button>
          <button onClick={() => setView('dood')} className={cn('text-xs px-3 py-1.5 rounded-lg', view === 'dood' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50')}>Day Out of Days</button>
        </div>
        <div className="flex gap-2 items-center">
          {board && <span className="text-xs text-gray-400">{board.totalScenes} scenes · {pagesLabel(board.totalPages)} pages · {board.shootDays} days</span>}
          <button onClick={() => window.open(`/print/schedule/${projectId}`, '_blank')} className="btn btn-secondary text-xs py-1.5 px-2"><Printer size={13} className="mr-1" /> Print</button>
          <input ref={fullRef} type="file" accept=".fdx,.pdf,.docx,.txt,.fountain" className="hidden" onChange={onFullSetup} />
          <button onClick={() => fullRef.current?.click()} disabled={fullBusy} className="btn btn-primary text-xs py-1.5 px-3" title="Import script + auto-schedule + generate budget, in one step">
            <Wand2 size={13} className={cn('mr-1', fullBusy && 'animate-pulse')} /> {fullBusy ? 'Setting up…' : 'Script → full setup'}
          </button>
          <input ref={fileRef} type="file" accept=".fdx,.pdf,.docx,.txt,.fountain" className="hidden" onChange={onScriptFile} />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn btn-secondary text-xs py-1.5 px-3" title="Upload .fdx, .pdf or .docx — auto-breaks the script into scenes + elements">
            <FileUp size={13} className={cn('mr-1', importing && 'animate-pulse')} /> {importing ? 'Importing…' : 'Import script'}
          </button>
          <button onClick={autoSchedule} disabled={scheduling} className="btn btn-secondary text-xs py-1.5 px-3" title="Auto-assign unscheduled scenes to shoot days → populates Day Out of Days">
            <Calendar size={13} className={cn('mr-1', scheduling && 'animate-pulse')} /> {scheduling ? 'Scheduling…' : 'Auto-schedule'}
          </button>
          <button onClick={() => setAdding(a => !a)} className="btn btn-primary text-xs py-1.5 px-3"><Plus size={13} className="mr-1" /> Add scene</button>
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

      {loading ? <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div> : view === 'board' ? (
        <div className="space-y-3">
          {board && board.board.length === 0 && board.unscheduled.length === 0 && (
            <div className="card p-10 text-center text-gray-400 text-sm"><Film size={24} className="mx-auto mb-2 opacity-30" />No scenes yet. Add scenes and assign them to shoot days.</div>
          )}
          {board?.board.map((d: any) => (
            <div key={d.dayNumber} className="card overflow-hidden p-0" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDayDrop(e, d.dayNumber)}>
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Calendar size={13} className="text-brand-600" /> Day {d.dayNumber}{d.date ? ` · ${formatDate(d.date)}` : ''}{d.location ? ` · ${d.location}` : ''}</span>
                <span className="text-xs text-gray-400">{d.sceneCount} scenes · {pagesLabel(d.pages)} pages</span>
              </div>
              {d.strips.map((s: any) => <Strip key={s.id} s={s} />)}
            </div>
          ))}
          {board && board.unscheduled.length > 0 && (
            <div className="card overflow-hidden p-0 border-dashed" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDayDrop(e, 0)}>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-500">Unscheduled</div>
              {board.unscheduled.map((s: any) => <Strip key={s.id} s={s} />)}
            </div>
          )}
        </div>
      ) : (
        /* Dynamic multi-category DOOD — computed live from strips × breakdown elements.
           Replaces the old cast-only table; CAST merges legacy scene-cast lists. */
        <UniversalDoodPanel projectId={projectId} />
      )}

      {mapOpen && <BreakdownMappingModal projectId={projectId} currency={currency} onClose={() => setMapOpen(false)} onApplied={() => { load(); setView('dood'); }} />}
    </div>
  );
}
