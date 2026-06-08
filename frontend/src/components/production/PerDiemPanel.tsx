'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Wallet, CalendarCheck } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { PanelHeader, StatRow, Btn, EmptyState, inputCls } from './ui';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
  PAID: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' },
};

export default function PerDiemPanel({ projectId, currency = 'AED' }: { projectId: string; currency?: string }) {
  const money = (n: any) => formatCurrency(n, currency);
  const [items, setItems] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({ all: 0, PENDING: 0, APPROVED: 0, PAID: 0 });
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ assignmentId: '', crewName: '', location: '', ratePerDay: '', days: '1', startDate: '', endDate: '', notes: '' });

  const load = useCallback(() => {
    setLoading(true);
    productionApi.perdiem.list(projectId).then(r => { setItems(r.data.items || []); setTotals(r.data.totals || {}); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { productionApi.crew.list(projectId).then(r => setAssignments(r.data || [])).catch(() => {}); }, [projectId]);

  const pick = (id: string) => {
    const a = assignments.find(x => x.id === id);
    setForm((f: any) => ({ ...f, assignmentId: id, crewName: a?.name || f.crewName, location: a?.location || f.location, ratePerDay: f.ratePerDay }));
  };

  const add = async () => {
    if (!form.assignmentId && !form.crewName) return;
    await productionApi.perdiem.create({
      projectId, assignmentId: form.assignmentId || undefined, crewName: form.crewName || undefined,
      location: form.location || undefined, ratePerDay: form.ratePerDay ? Number(form.ratePerDay) : 0,
      days: form.days ? Number(form.days) : 1, startDate: form.startDate || undefined, endDate: form.endDate || undefined,
      notes: form.notes || undefined,
    });
    setAdding(false);
    setForm({ assignmentId: '', crewName: '', location: '', ratePerDay: '', days: '1', startDate: '', endDate: '', notes: '' });
    load();
  };

  const genFromSchedule = async () => {
    const raw = prompt('Daily per-diem rate to apply to each cast member (from their schedule work days):', '50');
    if (raw == null) return;
    const r = await productionApi.perdiem.generate({ projectId, ratePerDay: Number(raw) || 0 });
    alert(`Created ${r.data.created} per-diem entries from the schedule.`);
    load();
  };

  const setStatus = async (id: string, status: string) => { await productionApi.perdiem.setStatus(id, status); load(); };
  const remove = async (id: string) => { if (confirm('Delete this per diem?')) { await productionApi.perdiem.remove(id); load(); } };
  const liveTotal = (Number(form.ratePerDay) || 0) * (Number(form.days) || 0);

  return (
    <div className="space-y-4">
      <PanelHeader
        icon={Wallet}
        title={`Per Diem (${items.length})`}
        subtitle="Daily allowance per crew per location — rate × days."
        actions={<>
          <Btn variant="secondary" onClick={genFromSchedule}><CalendarCheck size={13} /> Generate from schedule</Btn>
          <Btn variant="primary" onClick={() => setAdding(a => !a)}><Plus size={13} /> Add per diem</Btn>
        </>}
      />

      {/* Summary */}
      <StatRow stats={[
        ['Total', money(totals.all || 0)],
        ['Pending', money(totals.PENDING || 0)],
        ['Approved', money(totals.APPROVED || 0)],
        ['Paid', money(totals.PAID || 0)],
      ]} />

      {adding && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="label text-xs">From assignment</label>
              <select className={inputCls} value={form.assignmentId} onChange={e => pick(e.target.value)}>
                <option value="">— Select crew —</option>
                {assignments.map(a => <option key={a.id} value={a.id}>{a.name}{a.role ? ` · ${String(a.role).replace(/_/g, ' ')}` : ''}</option>)}
              </select>
            </div>
            <div><label className="label text-xs">Or name</label><input className={inputCls} value={form.crewName} onChange={e => setForm((f: any) => ({ ...f, crewName: e.target.value, assignmentId: '' }))} /></div>
            <div><label className="label text-xs">Location</label><input className={inputCls} value={form.location} onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))} /></div>
            <div><label className="label text-xs">Rate / day (AED)</label><input type="number" className={inputCls} value={form.ratePerDay} onChange={e => setForm((f: any) => ({ ...f, ratePerDay: e.target.value }))} /></div>
            <div><label className="label text-xs">Days</label><input type="number" className={inputCls} value={form.days} onChange={e => setForm((f: any) => ({ ...f, days: e.target.value }))} /></div>
            <div><label className="label text-xs">From</label><input type="date" className={inputCls} value={form.startDate} onChange={e => setForm((f: any) => ({ ...f, startDate: e.target.value }))} /></div>
            <div><label className="label text-xs">To</label><input type="date" className={inputCls} value={form.endDate} onChange={e => setForm((f: any) => ({ ...f, endDate: e.target.value }))} /></div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-gray-600">Total: <b className="text-gray-900">{money(liveTotal)}</b></span>
            <div className="flex gap-2">
              <Btn variant="primary" onClick={add}>Add</Btn>
              <Btn variant="secondary" onClick={() => setAdding(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          items.length === 0 ? <div className="p-6"><EmptyState icon={Wallet}>No per diem recorded yet.</EmptyState></div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
                <th className="px-4 py-2.5 text-left">Crew</th><th className="px-3 py-2.5 text-left">Location</th>
                <th className="px-3 py-2.5 text-left">Dates</th><th className="px-3 py-2.5 text-right">Rate</th>
                <th className="px-3 py-2.5 text-center">Days</th><th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5 text-left">Status</th><th className="px-3 py-2.5"></th>
              </tr></thead>
              <tbody>
                {items.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{p.crewName}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{p.location || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{p.startDate ? formatDate(p.startDate) : '—'}{p.endDate ? ` → ${formatDate(p.endDate)}` : ''}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{money(Number(p.ratePerDay))}</td>
                    <td className="px-3 py-2.5 text-center text-gray-600">{p.days}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{money(Number(p.total))}</td>
                    <td className="px-3 py-2.5">
                      <select value={p.status} onChange={e => setStatus(p.id, e.target.value)}
                        className={cn('text-[11px] rounded-full px-2 py-0.5 border-0 cursor-pointer', STATUS_META[p.status].cls)}>
                        {Object.keys(STATUS_META).map(k => <option key={k} value={k}>{STATUS_META[k].label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-right"><button onClick={() => remove(p.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
