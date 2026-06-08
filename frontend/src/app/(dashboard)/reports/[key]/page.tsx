'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, Download, RefreshCw } from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const iso = (d: Date) => d.toISOString().slice(0, 10);
export const fmtCell = (v: any, fmt?: string) => {
  if (v === null || v === undefined || v === '') return '';
  if (fmt === 'currency') return formatCurrency(Number(v));
  if (fmt === 'number') return Number(v).toLocaleString('en-AE');
  if (fmt === 'date') return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return String(v);
};

export default function ReportViewerPage() {
  const { key } = useParams<{ key: string }>();
  const [meta, setMeta] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [from, setFrom] = useState(() => iso(new Date(new Date().getFullYear(), 0, 1)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); reportsApi.run(key, { from, to }).then(r => setData(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { reportsApi.catalog().then(r => setMeta((r.data || []).find((x: any) => x.key === key))); }, [key]);
  useEffect(() => { load(); }, [key]); // eslint-disable-line

  const dateRange = meta?.dateRange;
  const cols = data?.columns || [];

  const csv = () => {
    const head = cols.map((c: any) => `"${c.label}"`).join(',');
    const body = (data.rows || []).map((r: any) => cols.map((c: any) => `"${String(r[c.key] ?? '')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([head + '\n' + body], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `${key}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const print = () => window.open(`/print/report/${key}?from=${from}&to=${to}`, '_blank');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="btn-ghost p-2"><ArrowLeft size={16} /></Link>
          <h1 className="text-xl font-bold text-gray-900">{data?.title || meta?.name || 'Report'}</h1>
        </div>
        <div className="flex items-end gap-2">
          {dateRange && <>
            <div><label className="label">From</label><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><label className="label">To</label><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
          </>}
          <button onClick={load} className="btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Run</button>
          <button onClick={csv} disabled={!data} className="btn-secondary"><Download size={14} /> CSV</button>
          <button onClick={print} disabled={!data} className="btn-primary"><Printer size={14} /> Print / PDF</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> : !data || data.rows.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No data for this report / period.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                {cols.map((c: any) => <th key={c.key} className={`px-3 py-2.5 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r: any, i: number) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
                  {cols.map((c: any) => <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.key === cols[0].key ? 'font-medium text-gray-800' : 'text-gray-600'}`}>{fmtCell(r[c.key], c.format)}</td>)}
                </tr>
              ))}
            </tbody>
            {data.totals && (
              <tfoot className="border-t-2 border-gray-200">
                {Object.entries(data.totals).map(([k, v]: any) => (
                  <tr key={k}><td className="px-3 py-2 text-right font-bold text-gray-700" colSpan={cols.length - 1}>{k}</td><td className="px-3 py-2 text-right font-bold text-brand-700">{typeof v === 'number' ? formatCurrency(v) : String(v)}</td></tr>
                ))}
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
