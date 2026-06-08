'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, ArrowDownCircle, ArrowUpCircle, Settings2, AlertTriangle, Package } from 'lucide-react';
import { inventoryApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

const UNITS = ['each', 'roll', 'box', 'pack', 'set', 'metre', 'litre', 'kg', 'pair'];
const MOVE_META: Record<string, { label: string; color: string; icon: any }> = {
  IN: { label: 'In', color: 'text-green-600', icon: ArrowDownCircle },
  OUT: { label: 'Out', color: 'text-red-600', icon: ArrowUpCircle },
  ADJUST: { label: 'Adjust', color: 'text-blue-600', icon: Settings2 },
};

export default function InventoryItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  // Movement form
  const [moveType, setMoveType] = useState<'IN' | 'OUT' | 'ADJUST'>('OUT');
  const [move, setMove] = useState({ quantity: '', unitCost: '', reference: '', reason: '', notes: '' });
  const [moveErr, setMoveErr] = useState('');
  const [moving, setMoving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await inventoryApi.get(id);
      setItem(r.data);
      setForm({
        name: r.data.name, sku: r.data.sku || '', category: r.data.category || '', unit: r.data.unit,
        unitCost: Number(r.data.unitCost), reorderLevel: Number(r.data.reorderLevel),
        location: r.data.location || '', supplierName: r.data.supplierName || '', notes: r.data.notes || '',
      });
    } catch { router.push('/inventory'); }
    finally { setLoading(false); }
  }, [id, router]);
  useEffect(() => { load(); }, [load]);

  const saveItem = async () => {
    setSaving(true);
    try {
      await inventoryApi.update(id, {
        ...form, unitCost: Number(form.unitCost) || 0, reorderLevel: Number(form.reorderLevel) || 0,
      });
      await load();
    } finally { setSaving(false); }
  };

  const submitMove = async () => {
    setMoveErr('');
    if (!move.quantity) { setMoveErr('Enter a quantity'); return; }
    setMoving(true);
    try {
      await inventoryApi.move(id, {
        type: moveType,
        quantity: Number(move.quantity),
        unitCost: move.unitCost ? Number(move.unitCost) : undefined,
        reference: move.reference || undefined,
        reason: move.reason || undefined,
        notes: move.notes || undefined,
      });
      setMove({ quantity: '', unitCost: '', reference: '', reason: '', notes: '' });
      await load();
    } catch (e: any) {
      setMoveErr(e.response?.data?.message || 'Could not record movement');
    } finally { setMoving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" /></div>;
  if (!item) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/inventory" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{item.name}</h1>
            {item.sku && <span className="text-sm text-gray-400 font-mono">{item.sku}</span>}
            {item.low && <span className="badge bg-amber-100 text-amber-700 text-xs flex items-center gap-1"><AlertTriangle size={11} /> Low stock</span>}
          </div>
          <p className="text-sm text-gray-500">{item.category || 'Uncategorised'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">On hand</p>
          <p className="text-2xl font-bold text-gray-900">{Number(item.quantity)} <span className="text-sm font-normal text-gray-400">{item.unit}</span></p>
        </div>
      </div>

      <div className="grid md:grid-cols-[1.3fr_1fr] gap-5">
        {/* Left: details + history */}
        <div className="space-y-5">
          {/* Edit details */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Item details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Name</label><input className="input w-full" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">SKU</label><input className="input w-full font-mono" value={form.sku} onChange={e => setForm((f: any) => ({ ...f, sku: e.target.value }))} /></div>
              <div><label className="label">Category</label><input className="input w-full" value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))} /></div>
              <div><label className="label">Unit</label><select className="input w-full" value={form.unit} onChange={e => setForm((f: any) => ({ ...f, unit: e.target.value }))}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
              <div><label className="label">Unit cost (AED)</label><input type="number" className="input w-full" value={form.unitCost} onChange={e => setForm((f: any) => ({ ...f, unitCost: e.target.value }))} /></div>
              <div><label className="label">Reorder level</label><input type="number" className="input w-full" value={form.reorderLevel} onChange={e => setForm((f: any) => ({ ...f, reorderLevel: e.target.value }))} /></div>
              <div><label className="label">Location</label><input className="input w-full" value={form.location} onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))} /></div>
              <div className="col-span-2"><label className="label">Supplier</label><input className="input w-full" value={form.supplierName} onChange={e => setForm((f: any) => ({ ...f, supplierName: e.target.value }))} /></div>
              <div className="col-span-2"><label className="label">Notes</label><input className="input w-full" value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <button onClick={async () => { if (confirm('Delete this item and its history?')) { await inventoryApi.remove(id); router.push('/inventory'); } }} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 size={12} /> Delete item</button>
              <button onClick={saveItem} disabled={saving} className="btn btn-primary text-sm"><Save size={13} className="mr-1" /> {saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>

          {/* Movement history */}
          <div className="card overflow-hidden p-0">
            <h3 className="text-sm font-semibold text-gray-700 p-4 pb-2">Stock movement history</h3>
            {(!item.movements || item.movements.length === 0) ? (
              <div className="p-8 text-center text-gray-400 text-sm"><Package size={24} className="mx-auto mb-2 opacity-30" />No movements yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-left">Reason / Ref</th>
                </tr></thead>
                <tbody>
                  {item.movements.map((m: any) => {
                    const meta = MOVE_META[m.type];
                    const Icon = meta.icon;
                    return (
                      <tr key={m.id} className="border-b border-gray-50">
                        <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(m.movementDate)}</td>
                        <td className="px-3 py-2"><span className={cn('inline-flex items-center gap-1 text-xs font-medium', meta.color)}><Icon size={13} /> {meta.label}</span></td>
                        <td className={cn('px-3 py-2 text-right font-medium', meta.color)}>{m.type === 'OUT' ? '-' : m.type === 'IN' ? '+' : '±'}{Number(m.quantity)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{Number(m.balanceAfter)}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{m.reason || '—'}{m.reference ? ` · ${m.reference}` : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: record movement */}
        <div>
          <div className="card sticky top-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Record movement</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(['IN', 'OUT', 'ADJUST'] as const).map(t => {
                const meta = MOVE_META[t]; const Icon = meta.icon; const on = moveType === t;
                return (
                  <button key={t} onClick={() => setMoveType(t)}
                    className={cn('flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium',
                      on ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}>
                    <Icon size={16} className={on ? '' : meta.color} /> {meta.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <div>
                <label className="label">{moveType === 'ADJUST' ? 'New counted quantity' : 'Quantity'}</label>
                <input type="number" className="input w-full" value={move.quantity} onChange={e => setMove(m => ({ ...m, quantity: e.target.value }))}
                  placeholder={moveType === 'ADJUST' ? `Current: ${Number(item.quantity)}` : '0'} />
              </div>
              {moveType === 'IN' && (
                <div><label className="label">Unit cost (AED)</label><input type="number" className="input w-full" value={move.unitCost} onChange={e => setMove(m => ({ ...m, unitCost: e.target.value }))} placeholder={String(Number(item.unitCost))} /></div>
              )}
              <div><label className="label">Reference</label><input className="input w-full" value={move.reference} onChange={e => setMove(m => ({ ...m, reference: e.target.value }))} placeholder="Job / project / PO (optional)" /></div>
              <div><label className="label">Reason</label><input className="input w-full" value={move.reason} onChange={e => setMove(m => ({ ...m, reason: e.target.value }))} placeholder={moveType === 'OUT' ? 'Consumed on shoot' : moveType === 'IN' ? 'Purchase' : 'Stocktake'} /></div>
            </div>
            {moveErr && <p className="text-xs text-red-500 mt-2">{moveErr}</p>}
            <button onClick={submitMove} disabled={moving} className="btn btn-primary w-full mt-3 text-sm">{moving ? 'Saving…' : 'Record movement'}</button>
            <p className="text-[10px] text-gray-400 mt-2">Stock on hand changes only through movements — keeping a full audit trail.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
