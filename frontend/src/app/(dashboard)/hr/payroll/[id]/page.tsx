'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { payrollApi } from '@/lib/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const aed = (n: number) => (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PayrollRunDetail() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<any>(null);
  const [edit, setEdit] = useState<any>(null);

  const load = () => payrollApi.get(id).then((r) => setRun(r.data)).catch(() => {});
  useEffect(() => { load(); }, [id]);

  if (!run) return <div className="p-8 text-slate-400">Loading…</div>;

  const saveSlip = async () => {
    await payrollApi.updatePayslip(edit.id, { overtimePay: Number(edit.overtimePay) || 0, deductions: Number(edit.deductions) || 0, deductionNotes: edit.deductionNotes });
    setEdit(null);
    load();
  };
  const setStatus = async (status: string) => { await payrollApi.setStatus(id, status); load(); };

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/hr/payroll" className="text-sm text-slate-400 hover:text-slate-600">← Payroll</Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{run.reference}</h1>
          <p className="text-sm text-slate-400">{MONTHS[run.periodMonth - 1]} {run.periodYear} · {run.payslips.length} employees · {run.status}</p>
        </div>
        <div className="flex gap-2">
          {run.status === 'Draft' && <button onClick={() => setStatus('Approved')} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700">Approve</button>}
          {run.status === 'Approved' && <button onClick={() => setStatus('Paid')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700">Mark Paid</button>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-400">Total Gross</div><div className="text-xl font-bold text-slate-800">AED {aed(run.totalGross)}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-400">Total Deductions</div><div className="text-xl font-bold text-slate-800">AED {aed(run.totalDeductions)}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-400">Total Net</div><div className="text-xl font-bold text-emerald-700">AED {aed(run.totalNet)}</div></div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3 text-right">Basic</th>
              <th className="px-4 py-3 text-right">Allowances</th>
              <th className="px-4 py-3 text-right">Overtime</th>
              <th className="px-4 py-3 text-right">Deductions</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {run.payslips.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{p.employeeName}</td>
                <td className="px-4 py-3 text-right text-slate-500">{aed(p.basicSalary)}</td>
                <td className="px-4 py-3 text-right text-slate-500">{aed(p.allowances)}</td>
                <td className="px-4 py-3 text-right text-slate-500">{aed(p.overtimePay)}</td>
                <td className="px-4 py-3 text-right text-rose-500">{aed(p.deductions)}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">{aed(p.netPay)}</td>
                <td className="px-4 py-3 text-right">{run.status === 'Draft' && <button onClick={() => setEdit({ ...p })} className="text-xs text-slate-500 hover:text-slate-800">Edit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-xl p-6 w-[420px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">{edit.employeeName}</h3>
            <p className="text-xs text-slate-400 mb-4">Basic {aed(edit.basicSalary)} · Allowances {aed(edit.allowances)}</p>
            <div className="space-y-3">
              <label className="block"><span className="text-xs font-medium text-slate-500">Overtime Pay</span>
                <input type="number" value={edit.overtimePay} onChange={(e) => setEdit({ ...edit, overtimePay: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="block"><span className="text-xs font-medium text-slate-500">Deductions</span>
                <input type="number" value={edit.deductions} onChange={(e) => setEdit({ ...edit, deductions: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="block"><span className="text-xs font-medium text-slate-500">Deduction Notes</span>
                <input value={edit.deductionNotes ?? ''} onChange={(e) => setEdit({ ...edit, deductionNotes: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEdit(null)} className="rounded-lg px-4 py-2 text-sm text-slate-500">Cancel</button>
              <button onClick={saveSlip} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
