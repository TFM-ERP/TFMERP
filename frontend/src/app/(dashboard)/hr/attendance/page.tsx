'use client';

import { useEffect, useState } from 'react';
import { attendanceApi, hrApi } from '@/lib/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AttendancePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [timesheet, setTimesheet] = useState<any[]>([]);
  const [emps, setEmps] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [empId, setEmpId] = useState('');

  const load = () => {
    attendanceApi.timesheet(month, year).then((r) => setTimesheet(r.data)).catch(() => {});
    attendanceApi.list({ limit: 50 }).then((r) => setRecent(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, [month, year]);
  useEffect(() => { hrApi.employees.list({ status: 'Active' }).then((r) => setEmps(r.data)).catch(() => {}); }, []);

  const nameOf = (id: string) => {
    const e = emps.find((x) => x.id === id);
    return e ? e.displayName || `${e.firstName} ${e.lastName || ''}` : id.slice(0, 6);
  };

  const clockIn = async () => { if (!empId) return; await attendanceApi.clockIn(empId); load(); };
  const clockOut = async (id: string) => { await attendanceApi.clockOut(id); load(); };

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>HR · Time</div>
        <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Attendance & Timesheets</h1>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 flex items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Employee</span>
          <select value={empId} onChange={(e) => setEmpId(e.target.value)} className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
            <option value="">Select…</option>
            {emps.map((e) => <option key={e.id} value={e.id}>{e.displayName || `${e.firstName} ${e.lastName || ''}`}</option>)}
          </select>
        </label>
        <button onClick={clockIn} disabled={!empId} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40">Clock In</button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Monthly Timesheet</h2>
            <div className="flex gap-2">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded border border-slate-200 px-2 py-1 text-xs bg-white">
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded border border-slate-200 px-2 py-1 text-xs bg-white">
                {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
              <tr><th className="px-4 py-2">Employee</th><th className="px-4 py-2">Days</th><th className="px-4 py-2">Hours</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {timesheet.map((t) => (
                <tr key={t.employeeId}><td className="px-4 py-2 text-slate-700">{t.name}</td><td className="px-4 py-2 text-slate-500">{t.days}</td><td className="px-4 py-2 text-slate-500">{t.hours}</td></tr>
              ))}
              {timesheet.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No records for this period.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3"><h2 className="text-sm font-semibold text-slate-700">Recent Punches</h2></div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
              <tr><th className="px-4 py-2">Employee</th><th className="px-4 py-2">In</th><th className="px-4 py-2">Out</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-slate-700">{nameOf(r.employeeId)}</td>
                  <td className="px-4 py-2 text-slate-500">{r.clockIn ? new Date(r.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{r.clockOut ? new Date(r.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="px-4 py-2 text-right">{!r.clockOut && <button onClick={() => clockOut(r.id)} className="text-xs text-amber-600 hover:underline">Clock Out</button>}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No punches yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
