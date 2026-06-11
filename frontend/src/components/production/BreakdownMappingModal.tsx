'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, GripVertical, Wand2, RotateCcw, Pencil } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

const TIER_CLS: Record<string, string> = { ATL: 'border-l-purple-400', BTL: 'border-l-cyan-400', POST: 'border-l-indigo-400', OTHER: 'border-l-gray-300' };

/**
 * Visual drag-and-drop step inserted before budget generation.
 * Left: AI-tagged breakdown categories. Right: budget-account buckets.
 * Drag a category into an account (or change its rate) → that line is flagged
 * MANUAL_OVERRIDE on save, while the AI's original rate is preserved server-side.
 * Uses native HTML5 DnD (same pattern as the stripboard — no extra dependency).
 */
export default function BreakdownMappingModal({ projectId, currency = 'AED', onClose, onApplied }:
  { projectId: string; currency?: string; onClose: () => void; onApplied?: () => void }) {
  const money = (n: any) => formatCurrency(n || 0, currency);
  const [data, setData] = useState<any>(null);
  const [assign, setAssign] = useState<Record<string, string>>({});   // category → accountCode
  const [rates, setRates] = useState<Record<string, number>>({});     // category → rate
  const [drag, setDrag] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    productionApi.breakdown.mappingPreview(projectId).then(r => {
      const d = r.data; setData(d);
      const a: Record<string, string> = {}, rt: Record<string, number> = {};
      for (const c of d.categories || []) { if (c.suggestedAccountCode) a[c.category] = c.suggestedAccountCode; rt[c.category] = Number(c.aiRate) || 0; }
      setAssign(a); setRates(rt);
    }).catch(() => setData({ categories: [], accounts: [] }));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return null;
  const cats: any[] = data.categories || [];
  const accounts: any[] = data.accounts || [];
  const catByName = (c: string) => cats.find(x => x.category === c);

  // is this category overridden vs the AI suggestion?
  const isOverride = (c: any) => (assign[c.category] && assign[c.category] !== c.suggestedAccountCode) || Math.abs((rates[c.category] ?? c.aiRate) - c.aiRate) > 0.001;
  const drop = (code: string) => { if (drag) { setAssign(a => ({ ...a, [drag]: code })); setDrag(null); } };
  const unassign = (c: string) => setAssign(a => { const n = { ...a }; delete n[c]; return n; });
  const resetCat = (c: any) => { setRates(r => ({ ...r, [c.category]: Number(c.aiRate) || 0 })); setAssign(a => ({ ...a, [c.category]: c.suggestedAccountCode })); };

  const unassigned = cats.filter(c => !assign[c.category]);
  const lineTotal = (c: any) => (c.quantity || 0) * (rates[c.category] ?? c.aiRate);
  const grandTotal = cats.filter(c => assign[c.category]).reduce((s, c) => s + lineTotal(c), 0);

  const save = async () => {
    const mappings = cats.filter(c => assign[c.category]).map(c => ({ category: c.category, accountCode: assign[c.category], rate: rates[c.category] ?? c.aiRate }));
    if (mappings.length === 0) { alert('Assign at least one category to a budget account first.'); return; }
    setSaving(true);
    try {
      const r = await productionApi.breakdown.applyMapping(projectId, mappings);
      alert(`Created ${r.data.created} budget line${r.data.created === 1 ? '' : 's'}. New total: ${money(r.data.grandTotal)}.`);
      onApplied?.(); onClose();
    } catch (e: any) { alert(e?.response?.data?.message || 'Could not create budget lines.'); }
    finally { setSaving(false); }
  };

  const CatCard = ({ c, inBucket = false }: { c: any; inBucket?: boolean }) => (
    <div draggable onDragStart={() => setDrag(c.category)} onDragEnd={() => setDrag(null)}
      className={cn('rounded-lg border bg-white px-2.5 py-2 cursor-grab active:cursor-grabbing', isOverride(c) ? 'border-amber-300' : 'border-gray-200', drag === c.category && 'opacity-50')}>
      <div className="flex items-center gap-1.5">
        <GripVertical size={12} className="text-gray-300 shrink-0" />
        <span className="text-xs font-semibold text-gray-800 flex-1 capitalize">{c.label.toLowerCase()}</span>
        {c.classification && <span className="text-[9px] font-mono bg-indigo-100 text-indigo-700 rounded px-1">{c.classification}</span>}
        {isOverride(c) && <span className="text-[9px] font-semibold bg-amber-100 text-amber-700 rounded px-1">edited</span>}
      </div>
      <div className="flex items-center gap-1.5 mt-1 pl-4">
        <span className="text-[11px] text-gray-400">{c.quantity} {c.unit} ×</span>
        <input type="number" value={rates[c.category] ?? c.aiRate} onChange={e => setRates(r => ({ ...r, [c.category]: Number(e.target.value) }))}
          onClick={e => e.stopPropagation()} className="input text-[11px] h-6 w-20 px-1" title={`AI suggested ${money(c.aiRate)}`} />
        <span className="text-[11px] font-medium text-gray-700 ml-auto">{money(lineTotal(c))}</span>
        {isOverride(c) && <button onClick={(e) => { e.stopPropagation(); resetCat(c); }} title="Reset to AI suggestion" className="text-gray-300 hover:text-gray-600"><RotateCcw size={11} /></button>}
      </div>
      {inBucket && <button onClick={() => unassign(c.category)} className="text-[10px] text-gray-400 hover:text-red-500 mt-1 pl-4">remove</button>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div>
            <div className="font-semibold text-gray-800 text-sm flex items-center gap-1.5"><Wand2 size={15} className="text-brand-600" /> Map breakdown → budget</div>
            <div className="text-[11px] text-gray-400">Drag each category onto a budget account. Edit a rate or move it to a different account and it's saved as a manual override (the AI's original is kept).</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Two INDEPENDENT scroll panes: the draggable items on the left stay locked
            in view while you scroll the account list on the right to find the code. */}
        <div className="flex-1 min-h-0 p-4 grid grid-cols-[1fr_1.2fr] gap-4">
          {/* Left — categories to place (own scrollbar, stays put) */}
          <div className="overflow-y-auto pr-1 min-h-0">
            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 sticky top-0 glass-bar py-1 z-10">AI breakdown categories {unassigned.length > 0 && <span className="text-amber-600">· {unassigned.length} unplaced</span>}</h4>
            <div className="space-y-1.5">
              {cats.length === 0 && <p className="text-xs text-gray-400">No breakdown elements yet — import a script first.</p>}
              {unassigned.map(c => <CatCard key={c.category} c={c} />)}
              {unassigned.length === 0 && cats.length > 0 && <p className="text-[11px] text-gray-400">All categories placed. 🎬</p>}
            </div>
          </div>

          {/* Right — account buckets (scrolls on its own while dragging) */}
          <div className="overflow-y-auto pr-1 min-h-0">
            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 sticky top-0 glass-bar py-1 z-10">Budget accounts</h4>
            <div className="space-y-1.5">
              {accounts.map(a => {
                const placed = cats.filter(c => assign[c.category] === a.code);
                return (
                  <div key={a.code} onDragOver={e => e.preventDefault()} onDrop={() => drop(a.code)}
                    className={cn('rounded-lg border border-l-4 bg-gray-50/60 px-2.5 py-2 min-h-[44px]', TIER_CLS[a.tier || 'OTHER'], drag && 'ring-1 ring-brand-300 bg-brand-50/40')}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">{a.code} · {a.title}</span>
                      {a.tier && <span className="text-[9px] text-gray-400">{a.tier}</span>}
                    </div>
                    {placed.length > 0 && <div className="space-y-1.5 mt-1.5">{placed.map(c => <CatCard key={c.category} c={c} inBucket />)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">Budget from mapping: <span className="font-semibold text-gray-800">{money(grandTotal)}</span></div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-secondary text-xs py-1.5">Cancel</button>
            <button onClick={save} disabled={saving} className="btn btn-primary text-xs py-1.5 disabled:opacity-50">{saving ? 'Creating…' : 'Create budget lines'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
