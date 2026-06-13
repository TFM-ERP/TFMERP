'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, RefreshCw, Zap } from 'lucide-react';
import { accountingApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

const STATUS_META: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  POSTED: 'bg-green-100 text-green-700',
  VOID: 'bg-red-50 text-red-500 line-through',
};

export default function JournalsPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [post, setPost] = useState<any>(null);
  const [posting, setPosting] = useState(false);

  const load = () => {
    setLoading(true);
    accountingApi.journals({ status: status || undefined }).then(r => setEntries(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [status]); // eslint-disable-line
  useEffect(() => { accountingApi.postingStatus().then(r => setPost(r.data)).catch(() => {}); }, []);

  const runPost = async () => {
    setPosting(true);
    try {
      const r = await accountingApi.postAll();
      alert(`Posted: ${r.data.invoices} invoices, ${r.data.expenses} expenses, ${r.data.payments} payments.`);
      load(); accountingApi.postingStatus().then(r => setPost(r.data)).catch(() => {});
    } catch (e: any) { alert(e.response?.data?.message || 'Posting failed.'); }
    finally { setPosting(false); }
  };
  const pendingCount = post ? (post.invoices + post.expenses + post.payments) : 0;

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><FileText size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Accounting · Ledger</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Journal Entries</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Double-entry transactions in the general ledger.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={runPost} disabled={posting} className="btn btn-secondary" title="Auto-post invoices, expenses & payments to the GL">
            <Zap size={14} className="mr-1" /> {posting ? 'Posting…' : `Auto-post${pendingCount ? ` (${pendingCount})` : ''}`}
          </button>
          <Link href="/accounting/journals/new" className="btn btn-primary"><Plus size={14} /> New entry</Link>
        </div>
      </div>
      {post && pendingCount > 0 && (
        <div className="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-2">
          {post.invoices} invoices, {post.expenses} expenses, {post.payments} payments not yet in the ledger. Click Auto-post to generate balanced journal entries.
          {!post.chartReady && <span className="font-semibold"> Seed the Chart of Accounts first.</span>}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <select className="input w-40" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="DRAFT">Draft</option><option value="POSTED">Posted</option><option value="VOID">Void</option>
        </select>
        <button onClick={load} className="btn btn-secondary p-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          entries.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm">No journal entries yet.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2.5 text-left">Entry</th><th className="px-3 py-2.5 text-left">Date</th>
                <th className="px-3 py-2.5 text-left">Memo</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5 text-left">Status</th>
              </tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-5 py-3"><Link href={`/accounting/journals/${e.id}`} className="font-mono font-medium text-gray-800 hover:text-brand-600">{e.entryNumber}</Link></td>
                    <td className="px-3 py-3 text-gray-500">{formatDate(e.date)}</td>
                    <td className="px-3 py-3 text-gray-600">{e.memo || e.reference || '—'}</td>
                    <td className="px-3 py-3 text-right font-medium text-gray-800">{formatCurrency(e.totalDebit)}</td>
                    <td className="px-3 py-3"><span 