'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, Mail, RefreshCw } from 'lucide-react';
import { collectionsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtD = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function StatementPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [from, setFrom] = useState(() => iso(new Date(new Date().getFullYear(), 0, 1)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = () => { setLoading(true); collectionsApi.statement(clientId, from, to).then(r => setData(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [clientId]); // eslint-disable-line

  const emailIt = async () => {
    setMsg('');
    try { const r = await collectionsApi.emailStatement(clientId, from, to); setMsg(`Emailed to ${r.data?.to}`); }
    catch (e: any) { setMsg(e.response?.data?.message || 'Email failed — check collections settings.'); }
  };

  const aging = data?.aging || {};

  return (
    <div className="p-6 max-w-[1700px] mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/finance/collections" className="btn-ghost p-2"><ArrowLeft size={16} /></Link>
          <h1 className="text-xl font-bold text-gray-900">Statement of Account</h1>
        </div>
        <div className="flex items-end gap-2">
          <div><label className="label">From</label><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
          <button onClick={load} className="btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={() => window.print()} className="btn-secondary"><Printer size={14} /> Print</button>
          <button onClick={emailIt} className="btn-primary"><Mail size={14} /> Email</button>
        </div>
      </div>

      {msg && <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 print:hidden">{msg}</div>}

      {data && (
        <div className="card p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{data.client.companyName}</h2>
              {data.client.trn && <p className="text-xs text-gray-500">TRN: {data.client.trn}</p>}
              {data.client.email && <p className="text-xs text-gray-500">{data.client.email}</p>}
            </div>
            <div className="text-right text-sm">
              <p className="text-gray-500">Period</p>
              <p className="font-medium">{fmtD(data.period.from)} – {fmtD(data.period.to)}</p>
            </div>
          </div>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-200">
                <th className="py-2 text-left">Date</th><th className="py-2 text-left">Ref</th><th className="py-2 text-left">Type</th>
                <th className="py-2 text-right">Debit</th><th className="py-2 text-right">Credit</th><th className="py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50"><td className="py-2 text-gray-400" colSpan={5}>Opening balance</td><td className="py-2 text-right font-medium">{formatCurrency(data.openingBalance)}</td></tr>
              {data.entries.map((e: any, i: number) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 text-gray-600">{fmtD(e.date)}</td>
                  <td className="py-2 font-mono text-xs">{e.ref}</td>
                  <td className="py-2 text-gray-600">{e.type}</td>
                  <td className="py-2 text-right">{e.debit ? formatCurrency(e.debit) : ''}</td>
                  <td className="py-2 text-right text-green-700">{e.credit ? formatCurrency(e.credit) : ''}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(e.balance)}</td>
                </tr>
              ))}
              {data.entries.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-gray-400">No transactions in this period.</td></tr>}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200"><td colSpan={5} className="py-2 text-right font-bold">Closing balance</td><td className="py-2 text-right font-bold text-lg text-brand-700">{formatCurrency(data.closingBalance)}</td></tr>
            </tfoot>
          </table>

          <div className="border-t border-gray-100 pt-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Aging of outstanding</div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[['current', 'Current'], ['d30', '1–30'], ['d60', '31–60'], ['d90', '61–90'], ['d90plus', '90+']].map(([k, l]) => (
                <div key={k} className="bg-gray-50 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400">{l}</div>
                  <div className={`text-sm font-semibold ${k === 'd90plus' ? 'text-red-600' : 'text-gray-800'}`}>{formatCurrency(aging[k] || 0)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
