'use client';

import { useEffect, useState } from 'react';
import { Car, Plus, X } from 'lucide-react';
import { rentalApi } from '@/lib/api';

const JOB_TYPES = ['DELIVERY', 'PICKUP', 'TRANSFER'];
const STATUSES = ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'DELIVERED', 'PICKED_UP', 'COMPLETED', 'CANCELLED'];
const STATUS_CLS: Record<string, string> = {
  ASSIGNED: 'bg-gray-100 text-gray-600', EN_ROUTE: 'bg-blue-50 text-blue-700', ARRIVED: 'bg-blue-50 text-blue-700',
  DELIVERED: 'bg-teal-50 text-teal-700', PICKED_UP: 'bg-teal-50 text-teal-700',
  COMPLETED: 'bg-green-50 text-green-700', CANCELLED: 'bg-red-50 text-red-700',
};

export default function BookingDrivers({ bookingId, assets }: { bookingId: string; assets: { id: string; name: string }[] }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ driverId: '', jobType: 'DELIVERY', assetId: assets[0]?.id || '', scheduledAt: '', pickupLocation: '', dropoffLocation: '', notes: '' });

  const load = () => rentalApi.drivers.jobsByBooking(bookingId).then(r => setJobs(r.data)).catch(() => {});
  useEffect(() => { load(); rentalApi.drivers.list({ limit: 200 }).then(r => setDrivers(r.data.items || r.data || [])).catch(() => {}); }, [bookingId]);

  const save = async () => {
    if (!form.driverId || !form.scheduledAt) return;
    setSaving(true);
    try { await rentalApi.drivers.createJob({ ...form, bookingId }); setOpen(false); setForm({ driverId: '', jobType: 'DELIVERY', assetId: assets[0]?.id || '', scheduledAt: '', pickupLocation: '', dropoffLocation: '', notes: '' }); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Failed to assign driver'); }
    finally { setSaving(false); }
  };

  const changeStatus = async (jobId: string, status: string) => {
    await rentalApi.drivers.updateJobStatus(jobId, status);
    load();
  };

  const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const jobCost = (j: any) => ['fuelExpense', 'tollExpense', 'parkingExpense', 'foodAllowance', 'otherExpense', 'bonusAmount']
    .reduce((s, k) => s + Number(j[k] || 0), 0);

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2"><Car size={15} /> Drivers &amp; Logistics</h2>
        <button onClick={() => setOpen(true)} className="btn-secondary text-xs"><Plus size={12} /> Assign driver</button>
      </div>

      {jobs.length === 0 ? (
        <div className="px-5 py-8 text-center text-gray-400 text-sm">No driver assigned. Add a delivery, pickup or transfer leg.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {jobs.map(j => (
            <div key={j.id} className="px-5 py-3 flex items-center gap-3">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{j.jobType}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-800">{j.driver?.fullName || 'Driver'} <span className="text-gray-400 text-xs">· {j.asset?.name || ''}</span></div>
                <div className="text-xs text-gray-400">{fmt(j.scheduledAt)}{j.dropoffLocation ? ` → ${j.dropoffLocation}` : ''}{jobCost(j) > 0 ? ` · cost AED ${jobCost(j).toLocaleString('en-AE')}` : ''}</div>
              </div>
              <select value={j.status} onChange={e => changeStatus(j.id, e.target.value)}
                className={`text-[11px] rounded-full px-2 py-1 border-0 cursor-pointer ${STATUS_CLS[j.status] || 'bg-gray-100 text-gray-600'}`}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Assign driver</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div><label className="label">Driver *</label>
                <select className="input w-full" value={form.driverId} onChange={e => setForm({ ...form, driverId: e.target.value })}>
                  <option value="">Select driver…</option>
                  {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.fullName} · {d.driverType === 'FREELANCE' ? 'Freelance' : 'Hire'}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Job type</label>
                  <select className="input w-full" value={form.jobType} onChange={e => setForm({ ...form, jobType: e.target.value })}>
                    {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label">Asset</label>
                  <select className="input w-full" value={form.assetId} onChange={e => setForm({ ...form, assetId: e.target.value })}>
                    <option value="">—</option>
                    {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Scheduled *</label><input type="datetime-local" className="input w-full" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">From</label><input className="input w-full" value={form.pickupLocation} onChange={e => setForm({ ...form, pickupLocation: e.target.value })} /></div>
                <div><label className="label">To</label><input className="input w-full" value={form.dropoffLocation} onChange={e => setForm({ ...form, dropoffLocation: e.target.value })} /></div>
              </div>
              <div><label className="label">Notes</label><input className="input w-full" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Assigning…' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
