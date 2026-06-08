'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { payrollApi } from '@/lib/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const aed = (n: number) => 'AED ' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PayrollPage() {
  const now = new Date();
  const [runs, setRuns] = useState<any[]>([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => payrollApi.list().then((r) => setRuns(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setBusy(true); setErr('');
    try { await payrollApi.generate(month, year); load(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Error generating payroll'); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Payroll</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 flex items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Month</span>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Year</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <button onClick={generate} disabled={busy} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
          {busy ? 'Generating…' : 'Generate Payroll Run'}
        </button>
        {err && <span className="text-sm text-rose-600">{err}</span>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Employees</th>
              <th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {runs.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><Link href={`/hr/payroll/${r.id}`} className="font-medium text-slate-800 hover:underline">{r.reference}</Link></td>
                <td className="px-4 py-3 text-slate-500">{MONTHS[r.periodMonth - 1]} {r.periodYear}</td>
                <td className="px-4 py-3 text-slate-500">{r._count?.payslips ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{aed(r.totalGross)}</td>
                <td className="px-4 py-3 text-slate-700 font-medium">{aed(r.totalNet)}</td>
                <td className="px-4 py-3"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{r.status}</span></td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No payroll runs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
