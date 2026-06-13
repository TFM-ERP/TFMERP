'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { accountingApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

export default function TrialBalancePage() {
  const [data, setData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      accountingApi.trialBalance({ to: to || undefined }),
      accountingApi.summary({ to: to || undefined }),
    ]).then(([t, s]) => { setData(t.data); setSummary(s.data); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [to]); // eslint-disable-line

  const csv = () => {
    if (!data) return;
    const rows = [['Code', 'Account', 'Type', 'Debit', 'Credit']];
    for (const r of data.rows) rows.push([r.code, r.name, r.type, String(r.debitBalance), String(r.creditBalance)]);
    rows.push(['', '', 'TOTAL', String(data.totalDebit), String(data.totalCredit)]);
    const blob = new Blob([rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' });
    const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = 'trial-balance.csv'; a.click(); URL.revokeObjectURL(u);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><BarChart3 size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Accounting · Reports</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Trial Balance</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Posted entries only.</p>
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div><label className="label text-xs">As of</label><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
          <button onClick={csv} className="btn btn-secondary">CSV</button>
          <button onClick={load} className="btn btn-secondary p-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {/* P&L / BS summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="card"><p className="text-xs text-gray-400">Income</p><p className="text-lg font-bold text-green-600">{formatCurrency(summary.INCOME)}</p></div>
          <div className="card"><p className="text-xs text-gray-400">Expenses</p><p className="text-lg font-bold text-amber-600">{formatCurrency(summary.EXPENSE)}</p></div>
          <div className="card">
            <p className="text-xs text-gray-400">Net profit</p>
            <p className={cn('text-lg font-bold flex items-center gap-1', summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600')}>
              {summary.netProfit >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}{formatCurrency(Math.abs(summary.netProfit))}
            </p>
          </div>
          <div className="card"><p className="text-xs text-gray-400">Assets</p><p className="text-lg font-bold text-blue-600">{formatCurrency(summary.ASSET)}</p></div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          !data || data.rows.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm">No posted entries yet.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2.5 text-left">Code</th><th className="px-3 py-2.5 text-left">Account</th>
                <th className="px-3 py-2.5 text-right">Debit</th><th className="px-3 py-2.5 text-right">Credit</th>
              </tr></thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={r.code} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-5 py-2.5 font-mono text-gray-500">{r.code}</td>
                    <td className="px-3 py-2.5 text-gray-800">{r.name}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{r.debitBalance ? formatCurrency(r.debitBalance) : ''}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{r.creditBalance ? formatCurrency(r.creditBalance) : ''}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold text-gray-900">
                  <td className="px-5 py-3" colSpan={2}>TOTAL</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(data.totalDebit)}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(data.totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          )}
      </div>
      {data && Math.round(data.totalDebit * 100) !== Math.round(data.totalCredit * 100) && (
        <p className="text-xs text-red-500 mt-2">⚠ Trial balance does not tie — check journal postings.</p>
      )}
    </div>
  );
}
