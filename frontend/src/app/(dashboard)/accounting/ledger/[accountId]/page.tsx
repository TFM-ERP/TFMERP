'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { accountingApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function GeneralLedgerPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const [data, setData] = useState<any>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    accountingApi.ledger(accountId, { from: from || undefined, to: to || undefined })
      .then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [accountId, from, to]);
  useEffect(() => { load(); }, [load]);

  const acc = data?.account;

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/accounting/accounts" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><BookOpen size={18} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{acc ? `${acc.code} · ${acc.name}` : 'General Ledger'}</h1>
            <p className="text-sm text-gray-500">{acc?.type} {acc?.subtype ? `· ${acc.subtype}` : ''}</p>
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div><label className="label text-xs">From</label><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="label text-xs">To</label><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          !data || data.rows.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm">No posted activity.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2.5 text-left">Date</th><th className="px-3 py-2.5 text-left">Entry</th>
                <th className="px-3 py-2.5 text-left">Memo</th><th className="px-3 py-2.5 text-right">Debit</th>
                <th className="px-3 py-2.5 text-right">Credit</th><th className="px-3 py-2.5 text-right">Balance</th>
              </tr></thead>
              <tbody>
                {data.rows.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-5 py-2.5 text-gray-500">{formatDate(r.date)}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-500">{r.entryNumber}</td>
                    <td className="px-3 py-2.5 text-gray-600">{r.memo || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{r.debit ? formatCurrency(r.debit) : ''}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{r.credit ? formatCurrency(r.credit) : ''}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900">{formatCurrency(r.balance)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold text-gray-900">
                  <td className="px-5 py-3" colSpan={5}>Closing balance</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(data.closingBalance)}</td>
                </tr>
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
