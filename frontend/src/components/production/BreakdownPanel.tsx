'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Trash2, ListChecks, RefreshCw, Printer, Coins, FileUp, Wand2, MousePointerClick } from 'lucide-react';
import { productionApi, uploadFile } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import BreakdownMappingModal from './BreakdownMappingModal';

const CATS = ['CAST', 'BACKGROUND', 'STUNTS', 'VEHICLES', 'ANIMALS', 'PROPS', 'SET_DRESSING', 'WARDROBE', 'MAKEUP_HAIR', 'SFX', 'VFX', 'SPECIAL_EQUIPMENT', 'SOUND_MUSIC', 'ART', 'GREENERY', 'SECURITY', 'OTHER'];
const CAT_CLR: Record<string, string> = {
  CAST: 'bg-red-100 text-red-700', BACKGROUND: 'bg-amber-100 text-amber-700', STUNTS: 'bg-orange-100 text-orange-700',
  VEHICLES: 'bg-green-100 text-green-700', ANIMALS: 'bg-lime-100 text-lime-700', PROPS: 'bg-violet-100 text-violet-700',
  SET_DRESSING: 'bg-emerald-100 text-emerald-700', WARDROBE: 'bg-pink-100 text-pink-700', MAKEUP_HAIR: 'bg-rose-100 text-rose-700',
  SFX: 'bg-blue-100 text-blue-700', VFX: 'bg-indigo-100 text-indigo-700', SPECIAL_EQUIPMENT: 'bg-cyan-100 text-cyan-700',
  SOUND_MUSIC: 'bg-sky-100 text-sky-700', ART: 'bg-purple-100 text-purple-700', GREENERY: 'bg-teal-100 text-teal-700',
  SECURITY: 'bg-gray-200 text-gray-700', OTHER: 'bg-gray-100 text-gray-500',
};
const label = (c: string) => c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, m => m.toUpperCase());

export default function BreakdownPanel({ projectId, currency = 'AED', accounts = [], scenes = [] }:
  { projectId: string; currency?: string; accounts?: { code: string; title: string }[]; scenes?: any[] }) {
  const money = (n: any) => formatCurrency(n || 0, currency);
  const [selStrip, setSelStrip] = useState<string | null>(scenes[0]?.id || null);
  const [els, setEls] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [form, setForm] = useState<any>({ category: 'PROPS', name: '', quantity: '1', costCenterCode: '', estCost: '' });

  const loadEls = useCallback(() => { if (selStrip) productionApi.breakdown.byStrip(selStrip).then(r => setEls(r.data || [])).catch(() => {}); }, [selStrip]);
  const loadSummary = useCallback(() => { productionApi.breakdown.summary(projectId).then(r => setSummary(r.data)).catch(() => {}); }, [projectId]);
  useEffect(() => { loadEls(); }, [loadEls]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const add = async () => {
    if (!selStrip || !form.name) return;
    const acct = accounts.find(a => a.code === form.costCenterCode);
    await productionApi.breakdown.create({
      projectId, stripId: selStrip, category: form.category, name: form.name,
      quantity: Number(form.quantity) || 1, costCenterCode: form.costCenterCode || undefined,
      costCenterTitle: acct?.title || undefined, estCost: Number(form.estCost) || 0,
    });
    setForm({ category: form.category, name: '', quantity: '1', costCenterCode: form.costCenterCode, estCost: '' });
    loadEls(); loadSummary();
  };
  const del = async (id: string) => { await productionApi.breakdown.remove(id); loadEls(); loadSummary(); };
  const pushToBudget = async () => {
    if (!confirm('Create budget line items from breakdown estimated costs? Re-running replaces previously pushed breakdown lines.')) return;
    const r = await productionApi.breakdown.pushToBudget(projectId);
    alert(`Pushed ${r.data.created} line items to the budget. New total: ${money(r.data.grandTotal)}.`);
    loadSummary();
  };

  // ── Import script (auto-breakdown) ──
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const onScriptFile = async (e: any) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (!confirm(`Import & auto-break-down "${file.name}"? Parses scenes + AI-tags elements onto the stripboard.`)) return;
    setImporting(true);
    try {
      const up = await uploadFile(file);
      const r = await productionApi.breakdown.importScript(projectId, { fileUrl: up.url, originalName: up.originalName, replace: true });
      alert(`Imported ${r.data.scenes} scenes and ${r.data.elements} elements from the ${r.data.format}. Reopen the Schedule tab to see them.`);
      loadEls(); loadSummary();
    } catch (err: any) { alert(err.response?.data?.message || 'Script import failed.'); }
    finally { setImporting(false); }
  };

  // ── Visual drag-and-drop mapping ──
  const [mapOpen, setMapOpen] = useState(false);

  // ── Generate budget lines from element counts (rate card) ──
  const [genRows, setGenRows] = useState<any[] | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const openGen = async () => {
    const r = await productionApi.breakdown.budgetPreview(projectId);
    setGenRows((r.data.rows || []).map((x: any) => ({ ...x })));
  };
  const runGen = async () => {
    if (!genRows) return;
    setGenBusy(true);
    try {
      const rateCard: Record<string, number> = {};
      for (const r of genRows) rateCard[r.category] = Number(r.rate) || 0;
      const res = await productionApi.breakdown.budgetGenerate(projectId, rateCard);
      const unmapped = (res.data.unmapped || []).map((u: any) => u.category).join(', ');
      alert(`Created ${res.data.created} budget lines. New total: ${money(res.data.grandTotal)}.${unmapped ? `\nNo matching cost center for: ${unmapped} — add those accounts or tag manually.` : ''}`);
      setGenRows(null);
    } catch (e: any) { alert(e.response?.data?.message || 'Generate failed.'); }
    finally { setGenBusy(false); }
  };

  const scene = scenes.find(s => s.id === selStrip);
  const grouped: Record<string, any[]> = {};
  for (const e of els) (grouped[e.category] = grouped[e.category] || []).push(e);

  return (
    <div className="space-y-4">
      {/* Project summary */}
      {summary && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><ListChecks size={12} /> Elements summary · {summary.total} items · est. {money(summary.totalCost)}</h4>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".fdx,.pdf,.docx,.txt,.fountain" className="hidden" onChange={onScriptFile} />
              <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn btn-secondary text-xs py-1 px-2" title="Upload .fdx/.pdf/.docx — auto-break the script"><FileUp size={12} className={cn('mr-1', importing && 'animate-pulse')} /> {importing ? 'Importing…' : 'Import script'}</button>
              <button onClick={() => setMapOpen(true)} className="btn btn-primary text-xs py-1 px-2" title="Drag categories onto budget accounts"><MousePointerClick size={12} className="mr-1" /> Visual map</button>
              <button onClick={openGen} className="btn btn-secondary text-xs py-1 px-2" title="Auto-generate from the rate card"><Wand2 size={12} className="mr-1" /> Quick generate</button>
              <button onClick={pushToBudget} className="btn btn-secondary text-xs py-1 px-2" title="Push manual est. costs (with cost centers) to budget"><Coins size={12} className="mr-1" /> Push est. costs</button>
              <button onClick={() => { loadEls(); loadSummary(); }} className="btn btn-secondary p-1.5"><RefreshCw size={12} /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {summary.byCategory.map((c: any) => (
              <span key={c.category} className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', CAT_CLR[c.category])}>{label(c.category)}: {c.qty}{c.estCost ? ` · ${money(c.estCost)}` : ''}</span>
            ))}
            {summary.byCategory.length === 0 && <span className="text-xs text-gray-400">No elements yet.</span>}
          </div>
          {summary.byCostCenter.length > 0 && (
            <div className="mt-3 text-xs text-gray-500">
              <span className="font-semibold">By cost center: </span>
              {summary.byCostCenter.map((c: any) => <span key={c.code} className="mr-3">{c.code} · {money(c.estCost)}</span>)}
            </div>
          )}
        </div>
      )}

      {/* Generate budget — rate card */}
      {genRows && (
        <div className="card border-brand-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Wand2 size={14} className="text-brand-600" /> Generate budget lines from breakdown</h4>
            <button onClick={() => setGenRows(null)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">Element counts × your rate, mapped to matching cost centers. Cast/Background/Stunts are tagged with a labor classification so fringes apply. Re-running replaces previously generated lines.</p>
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase border-b border-gray-100">
              <th className="py-1.5 text-left">Category</th><th className="py-1.5 text-right">Qty</th><th className="py-1.5 text-left pl-3">Unit</th>
              <th className="py-1.5 text-right">Rate ({currency})</th><th className="py-1.5 text-right">Line total</th><th className="py-1.5 text-left pl-3">Class</th>
            </tr></thead>
            <tbody>
              {genRows.map((r, i) => (
                <tr key={r.category} className="border-b border-gray-50">
                  <td className="py-1.5 text-gray-700">{label(r.category)}</td>
                  <td className="py-1.5 text-right text-gray-600">{r.quantity}</td>
                  <td className="py-1.5 text-gray-400 text-xs pl-3">{r.unit}</td>
                  <td className="py-1.5 text-right"><input type="number" className="input text-xs py-0.5 h-7 w-24 text-right" value={r.rate}
                    onChange={(e) => setGenRows((rows) => rows!.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))} /></td>
                  <td className="py-1.5 text-right font-medium text-gray-800">{money((Number(r.quantity) || 0) * (Number(r.rate) || 0))}</td>
                  <td className="py-1.5 text-[10px] text-gray-400 pl-3">{r.classification || '—'}</td>
                </tr>
              ))}
              {!genRows.length && <tr><td className="py-2 text-gray-400 text-xs" colSpan={6}>No elements to budget. Import a script or add elements first.</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={4} className="py-2 text-right font-semibold text-gray-700">Estimated total</td>
              <td className="py-2 text-right font-bold text-gray-900">{money(genRows.reduce((t, r) => t + (Number(r.quantity) || 0) * (Number(r.rate) || 0), 0))}</td><td /></tr></tfoot>
          </table>
          <button onClick={runGen} disabled={genBusy || !genRows.length} className="btn btn-primary text-xs py-1.5 mt-2"><Coins size={12} className="mr-1" /> {genBusy ? 'Generating…' : 'Create budget lines'}</button>
        </div>
      )}

      <div className="grid md:grid-cols-[240px_1fr] gap-4">
        {/* Scene picker */}
        <div>
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Scenes</h4>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {scenes.length === 0 && <p className="text-xs text-gray-400">Add scenes in the Stripboard first.</p>}
            {scenes.map(s => (
              <button key={s.id} onClick={() => setSelStrip(s.id)}
                className={cn('w-full text-left px-3 py-2 rounded-lg border text-sm', selStrip === s.id ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:bg-gray-50')}>
                <div className="font-medium text-gray-800">Sc {s.sceneNumber || '—'} {s.shootDay > 0 ? <span className="text-[10px] text-gray-400">D{s.shootDay}</span> : ''}</div>
                <div className="text-[11px] text-gray-400 truncate">{s.setName || s.description || ''}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Elements for selected scene */}
        <div>
          {!scene ? (
            <div className="card p-10 text-center text-gray-400 text-sm">Select a scene to break it down.</div>
          ) : (
            <>
              <div className="card mb-3">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-gray-700">Sc {scene.sceneNumber || '—'} — {scene.setName || scene.description}</h4>
                  <button onClick={() => window.open(`/print/breakdown/${selStrip}`, '_blank')} className="btn btn-secondary text-xs py-1 px-2"><Printer size={12} className="mr-1" /> Print sheet</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-2">
                  <div className="md:col-span-1"><label className="label text-xs">Category</label>
                    <select className="input text-sm h-9 w-full" value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))}>{CATS.map(c => <option key={c} value={c}>{label(c)}</option>)}</select>
                  </div>
                  <div className="md:col-span-2"><label className="label text-xs">Element</label><input className="input text-sm h-9 w-full" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. Vintage pistol" /></div>
                  <div><label className="label text-xs">Qty</label><input type="number" className="input text-sm h-9 w-full" value={form.quantity} onChange={e => setForm((f: any) => ({ ...f, quantity: e.target.value }))} /></div>
                  <div><label className="label text-xs">Cost center</label>
                    <select className="input text-sm h-9 w-full" value={form.costCenterCode} onChange={e => setForm((f: any) => ({ ...f, costCenterCode: e.target.value }))}><option value="">—</option>{accounts.map(a => <option key={a.code} value={a.code}>{`${a.code} · ${a.title || ''}`}</option>)}</select>
                  </div>
                  <div><label className="label text-xs">Est. cost</label><input type="number" className="input text-sm h-9 w-full" value={form.estCost} onChange={e => setForm((f: any) => ({ ...f, estCost: e.target.value }))} /></div>
                </div>
                <button onClick={add} className="btn btn-primary text-xs py-1.5 mt-2"><Plus size={12} className="mr-1" /> Add element</button>
              </div>

              {Object.keys(grouped).length === 0 ? (
                <div className="card p-8 text-center text-gray-400 text-sm">No elements for this scene yet.</div>
              ) : (
                <div className="space-y-3">
                  {CATS.filter(c => grouped[c]).map(c => (
                    <div key={c} className="card overflow-hidden p-0">
                      <div className={cn('px-4 py-1.5 text-xs font-bold uppercase tracking-wide', CAT_CLR[c])}>{label(c)} ({grouped[c].length})</div>
                      <table className="w-full text-sm">
                        <tbody>
                          {grouped[c].map(e => (
                            <tr key={e.id} className="border-b border-gray-50">
                              <td className="px-4 py-2 text-gray-800">{e.name}</td>
                              <td className="px-3 py-2 text-gray-500 text-xs w-16">×{e.quantity}</td>
                              <td className="px-3 py-2 text-gray-500 text-xs w-32">{e.costCenterCode ? `${e.costCenterCode}${e.costCenterTitle ? ` · ${e.costCenterTitle}` : ''}` : '—'}</td>
                              <td className="px-3 py-2 text-right text-gray-700 w-28">{e.estCost ? money(Number(e.estCost)) : '—'}</td>
                              <td className="px-3 py-2 text-right w-10"><button onClick={() => del(e.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {mapOpen && <BreakdownMappingModal projectId={projectId} currency={currency} onClose={() => setMapOpen(false)} onApplied={() => { loadSummary(); }} />}
    </div>
  );
}
