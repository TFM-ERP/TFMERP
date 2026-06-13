'use client';

import { useEffect, useState } from 'react';
import { Wrench, RefreshCw, Plus, Check, Trash2, Gauge, X } from 'lucide-react';
import { pmApi, rentalApi } from '@/lib/api';

const DUE_META: Record<string, { label: string; cls: string }> = {
  overdue:    { label: 'Overdue',   cls: 'bg-red-50 text-red-700' },
  'due-soon': { label: 'Due soon',  cls: 'bg-amber-50 text-amber-700' },
  ok:         { label: 'OK',        cls: 'bg-green-50 text-green-700' },
  'no-data':  { label: 'No basis',  cls: 'bg-gray-100 text-gray-500' },
};

function dueText(due: any) {
  if (!due?.bases?.length) return 'Set intervals & last service / readings';
  return due.bases.map((b: any) => {
    if (b.metric === 'date') return b.left < 0 ? `${Math.abs(b.left)}d overdue` : `${b.left}d left`;
    if (b.metric === 'km') return b.left < 0 ? `${Math.abs(b.left)}km over` : `${b.left}km left`;
    return b.left < 0 ? `${Math.abs(b.left)}hrs over` : `${b.left}hrs left`;
  }).join(' · ');
}

export default function PmSchedulePage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlan, setShowPlan] = useState(false);
  const [showReadings, setShowReadings] = useState(false);
  const [form, setForm] = useState<any>({ assetId: '', taskName: '', intervalDays: '', intervalKm: '', intervalHours: '', lastServiceDate: '', lastServiceOdometer: '', lastServiceHours: '', notes: '' });
  const [reading, setReading] = useState<any>({ assetId: '', currentOdometer: '', currentEngineHours: '' });

  const load = () => {
    setLoading(true);
    Promise.all([pmApi.plans(), rentalApi.assets.list({ limit: 500 })])
      .then(([p, a]) => { setPlans(p.data); setAssets(a.data.items || a.data || []); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const counts = { overdue: 0, 'due-soon': 0, ok: 0 } as Record<string, number>;
  plans.forEach(p => { if (counts[p.due?.status] !== undefined) counts[p.due.status]++; });

  const savePlan = async () => {
    if (!form.assetId || !form.taskName) return;
    await pmApi.createPlan(form);
    setShowPlan(false);
    setForm({ assetId: '', taskName: '', intervalDays: '', intervalKm: '', intervalHours: '', lastServiceDate: '', lastServiceOdometer: '', lastServiceHours: '', notes: '' });
    load();
  };
  const markServiced = async (p: any) => {
    if (!confirm(`Mark "${p.taskName}" on ${p.asset?.name} as serviced now?`)) return;
    await pmApi.complete(p.id, {});
    load();
  };
  const del = async (p: any) => { if (confirm('Remove this maintenance plan?')) { await pmApi.deletePlan(p.id); load(); } };
  const saveReading = async () => {
    if (!reading.assetId) return;
    await pmApi.readings(reading.assetId, { currentOdometer: reading.currentOdometer, currentEngineHours: reading.currentEngineHours });
    setShowReadings(false); setReading({ assetId: '', currentOdometer: '', currentEngineHours: '' });
    load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Rentals · Servicing</div>
          <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Preventive Maintenance</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Service schedules by date, kilometres or engine-hours — with due alerts.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowReadings(true)} className="btn-secondary"><Gauge size={14} /> Update readings</button>
          <button onClick={() => setShowPlan(true)} className="btn-primary"><Plus size={14} /> Add plan</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4"><div className="text-xs text-red-600">Overdue</div><div className="text-2xl font-bold text-red-700">{counts.overdue}</div></div>
        <div className="card p-4"><div className="text-xs text-amber-600">Due soon</div><div className="text-2xl font-bold text-amber-700">{counts['due-soon']}</div></div>
        <div className="card p-4"><div className="text-xs text-green-600">On track</div><div className="text-2xl font-bold text-green-700">{counts.ok}</div></div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm">Service plans ({plans.length})</h2>
          <button onClick={load} className="text-gray-400 hover:text-gray-600"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> : plans.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No maintenance plans yet — add one to start tracking service intervals.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2.5 text-left">Asset / Task</th>
                <th className="px-3 py-2.5 text-left">Interval</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(p => {
                const m = DUE_META[p.due?.status] || DUE_META['no-data'];
                const iv = [p.intervalDays && `${p.intervalDays}d`, p.intervalKm && `${p.intervalKm}km`, p.intervalHours && `${p.intervalHours}hrs`].filter(Boolean).join(' / ');
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-800">{p.asset?.name}</div>
                      <div className="text-xs text-gray-500">{p.taskName}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{iv || '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${m.cls}`}>{m.label}</span>
                      <div className="text-[11px] text-gray-400 mt-0.5">{dueText(p.due)}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => markServiced(p)} title="Mark serviced" className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600"><Check size={15} /></button>
                        <button onClick={() => del(p)} title="Remove" className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add plan modal */}
      {showPlan && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowPlan(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">New maintenance plan</h2>
              <button onClick={() => setShowPlan(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div><label className="label">Asset *</label>
                <select className="input w-full" value={form.assetId} onChange={e => setForm({ ...form, assetId: e.target.value })}>
                  <option value="">Select asset…</option>
                  {assets.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div><label className="label">Task *</label><input className="input w-full" placeholder="e.g. Engine oil & filter" value={form.taskName} onChange={e => setForm({ ...form, taskName: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="label">Every (days)</label><input type="number" className="input w-full" value={form.intervalDays} onChange={e => setForm({ ...form, intervalDays: e.target.value })} /></div>
                <div><label className="label">Every (km)</label><input type="number" className="input w-full" value={form.intervalKm} onChange={e => setForm({ ...form, intervalKm: e.target.value })} /></div>
                <div><label className="label">Every (hrs)</label><input type="number" className="input w-full" value={form.intervalHours} onChange={e => setForm({ ...form, intervalHours: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="label">Last service</label><input type="date" className="input w-full" value={form.lastServiceDate} onChange={e => setForm({ ...form, lastServiceDate: e.target.value })} /></div>
                <div><label className="label">at km</label><input type="number" className="input w-full" value={form.lastServiceOdometer} onChange={e => setForm({ ...form, lastServiceOdometer: e.target.value })} /></div>
                <div><label className="label">at hrs</label><input type="number" className="input w-full" value={form.lastServiceHours} onChange={e => setForm({ ...form, lastServiceHours: e.target.value })} /></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowPlan(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={savePlan} className="btn-primary flex-1">Add plan</button>
            </div>
          </div>
        </div>
      )}

      {/* Readings modal */}
      {showReadings && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowReadings(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Update asset readings</h2>
              <button onClick={() => setShowReadings(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div><label className="label">Asset</label>
                <select className="input w-full" value={reading.assetId} onChange={e => {
                  const a = assets.find((x: any) => x.id === e.target.value);
                  setReading({ assetId: e.target.value, currentOdometer: a?.currentOdometer ?? '', currentEngineHours: a?.currentEngineHours ?? '' });
                }}>
                  <option value="">Select asset…</option>
                  {assets.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Odometer (km)</label><input type="number" className="input w-full" value={reading.currentOdometer} onChange={e => setReading({ ...reading, currentOdometer: e.target.value })} /></div>
                <div><label className="label">Engine hours</label><input type="number" className="input w-full" value={reading.currentEngineHours} onChange={e => setReading({ ...reading, currentEngineHours: e.target.value })} /></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowReadings(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveReading} className="btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
