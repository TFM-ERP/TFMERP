'use client';

import { useEffect, useState } from 'react';
import { hrApi } from '@/lib/api';

const TYPES = ['Annual', 'Sick', 'Emergency', 'Compassionate', 'Unpaid', 'Maternity', 'Paternity'];
const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-rose-100 text-rose-700',
};

export default function LeavePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [emps, setEmps] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);

  const load = () => hrApi.leave.list().then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => {
    load();
    hrApi.employees.list({ status: 'Active' }).then((r) => setEmps(r.data)).catch(() => {});
  }, []);

  const save = async () => {
    if (!form.employeeId || !form.startDate || !form.endDate) { alert('Employee, start and end dates are required'); return; }
    await hrApi.leave.create(form);
    setForm(null);
    load();
  };
  const setStatus = async (id: string, status: string) => { await hrApi.leave.setStatus(id, status); load(); };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Leave Requests</h1>
        <button onClick={() => setForm({ type: 'Annual', status: 'Pending' })} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">+ New Request</button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Days</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{l.employee?.displayName || l.employee?.firstName}</td>
                <td className="px-4 py-3 text-slate-500">{l.type}</td>
                <td className="px-4 py-3 text-slate-500">{l.startDate?.slice(0, 10)}</td>
                <td className="px-4 py-3 text-slate-500">{l.endDate?.slice(0, 10)}</td>
                <td className="px-4 py-3 text-slate-500">{l.days}</td>
                <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[l.status] || 'bg-slate-100'}`}>{l.status}</span></td>
                <td className="px-4 py-3 text-right">
                  {l.status === 'Pending' && (
                    <span className="flex gap-2 justify-end">
                      <button onClick={() => setStatus(l.id, 'Approved')} className="text-xs text-emerald-600 hover:underline">Approve</button>
                      <button onClick={() => setStatus(l.id, 'Rejected')} className="text-xs text-rose-600 hover:underline">Reject</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No leave requests.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl p-6 w-[440px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Leave Request</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Employee</span>
                <select value={form.employeeId ?? ''} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                  <option value="">Select…</option>
                  {emps.map((e) => <option key={e.id} value={e.id}>{e.displayName || `${e.firstName} ${e.lastName || ''}`}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Type</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">From</span>
                  <input type="date" value={form.startDate ?? ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">To</span>
                  <input type="date" value={form.endDate ?? ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Reason</span>
                <input value={form.reason ?? ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setForm(null)} className="rounded-lg px-4 py-2 text-sm text-slate-500">Cancel</button>
              <button onClick={save} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
