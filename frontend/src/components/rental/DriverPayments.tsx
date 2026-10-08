'use client';

import { useEffect, useState } from 'react';
import { Wallet, Check, CreditCard } from 'lucide-react';
import { rentalApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const now = new Date();
const STATUS_CLS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', APPROVED: 'bg-blue-50 text-blue-700', PAID: 'bg-green-50 text-green-700',
};

export default function DriverPayments({ driver }: { driver: any }) {
  const isFreelance = driver?.driverType === 'FREELANCE';
  const [jobs, setJobs] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  /**
   * A SEPARATE SLOT FROM `msg`, DELIBERATELY. `msg` carries the result of an action and clears
   * itself after four seconds (:36) — right for "Payout created", wrong for a read that failed and
   * is still failing. Both reads below swallowed into .catch(() => {}), so the two sections
   * rendered "No completed jobs awaiting payment." and "No payouts yet." over lists nobody managed
   * to read: for a freelance driver those two sentences are the difference between nothing owed and
   * nothing known. Both routes are rentals:1 (b57a35a), so a rentals:0 role hits exactly that.
   */
  const [loadError, setLoadError] = useState('');
  const errOf = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

  const load = () => {
    rentalApi.drivers.unbilledJobs(driver.id)
      .then(r => { setJobs(r.data); setLoadError(''); })
      .catch(e => { setJobs([]); setLoadError(errOf(e, 'Could not load unbilled jobs.')); });
    rentalApi.drivers.payouts(driver.id)
      .then(r => setPayouts(r.data))
      .catch(e => { setPayouts([]); setLoadError(prev => prev || errOf(e, 'Could not load the payout history.')); });
  };
  useEffect(() => { if (driver?.id) load(); }, [driver?.id]);

  const jobExtras = (j: any) => ['fuelExpense', 'tollExpense', 'parkingExpense', 'foodAllowance', 'otherExpense', 'bonusAmount']
    .reduce((s, k) => s + Number(j[k] || 0), 0);
  const selectedIds = Object.keys(sel).filter(k => sel[k]);
  const selectedTotal = jobs.filter(j => sel[j.id]).reduce((s, j) => s + jobExtras(j) + (isFreelance ? Number(driver.dailyRate || 0) : 0), 0);

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true); setMsg('');
    try { await fn(); setSel({}); setMsg(ok); load(); setTimeout(() => setMsg(''), 4000); }
    catch (e: any) { setMsg(e.response?.data?.message || 'Action failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2"><Wallet size={15} /> Payments</h2>
        <span className="text-[11px] text-gray-400">{isFreelance ? 'Freelancer — payout' : 'Direct hire — payroll'}</span>
      </div>

      {msg && <div className="mx-5 mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">{msg}</div>}
      {loadError && <div className="mx-5 mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{loadError}</div>}

      {/* Unbilled completed jobs */}
      <div className="px-5 py-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Unbilled completed jobs</div>
        {/* Both empty-state sentences are suppressed while loadError stands: each is a claim about
            money owed, and we do not have the data to make it. */}
        {jobs.length === 0 ? (loadError ? null : (
          <p className="text-sm text-gray-400 py-2">No completed jobs awaiting payment.</p>
        )) : (
          <div className="space-y-1">
            {jobs.map(j => (
              <label key={j.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                <input type="checkbox" checked={!!sel[j.id]} onChange={e => setSel(s => ({ ...s, [j.id]: e.target.checked }))} />
                <span className="flex-1 text-gray-700">{j.jobType} · {j.booking?.bookingNumber} {j.asset?.name ? `· ${j.asset.name}` : ''}</span>
                <span className="text-gray-500">{formatCurrency((isFreelance ? Number(driver.dailyRate || 0) : 0) + jobExtras(j))}</span>
              </label>
            ))}
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-medium">{selectedIds.length} selected · {formatCurrency(selectedTotal)}</span>
            {isFreelance ? (
              <button disabled={busy} onClick={() => act(() => rentalApi.drivers.createPayout(driver.id, selectedIds), 'Payout created (draft).')} className="btn-primary text-xs">Create payout</button>
            ) : (
              <div className="flex items-center gap-2">
                <select className="input text-xs w-24 py-1" value={month} onChange={e => setMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i).toLocaleString('en', { month: 'short' })}</option>)}
                </select>
                <input className="input text-xs w-20 py-1" type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
                <button disabled={busy} onClick={() => act(() => rentalApi.drivers.pushPayroll(driver.id, selectedIds, month, year), 'Added to payroll.')} className="btn-primary text-xs">Push to payroll</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payout history */}
      <div className="px-5 py-3 border-t border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">History</div>
        {payouts.length === 0 ? (loadError ? null : (
          <p className="text-sm text-gray-400 py-1">No payouts yet.</p>
        )) : (
          <div className="space-y-1.5">
            {payouts.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs text-gray-500">{p.payoutNumber}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[p.status] || ''}`}>{p.status}</span>
                <span className="text-gray-400 text-xs flex-1">{p.notes || `${(p.jobIds || []).length} job(s)`}</span>
                <span className="font-medium">{formatCurrency(Number(p.total))}</span>
                {isFreelance && p.status === 'DRAFT' && <button disabled={busy} onClick={() => act(() => rentalApi.drivers.approvePayout(p.id), 'Approved.')} className="text-blue-600 text-xs flex items-center gap-0.5"><Check size={12} /> Approve</button>}
                {isFreelance && p.status === 'APPROVED' && <button disabled={busy} onClick={() => { const ref = prompt('Payment reference (optional):') || ''; act(() => rentalApi.drivers.payPayout(p.id, { paymentRef: ref }), 'Marked paid & posted to expenses.'); }} className="text-green-600 text-xs flex items-center gap-0.5"><CreditCard size={12} /> Pay</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
