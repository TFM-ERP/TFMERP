'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Plus, Sparkles, Search, BarChart3, Trash2 } from 'lucide-react';
import { accountingApi } from '@/lib/api';

const TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
const TYPE_META: Record<string, { label: string; color: string }> = {
  ASSET: { label: 'Assets', color: 'text-blue-700 bg-blue-50' },
  LIABILITY: { label: 'Liabilities', color: 'text-red-700 bg-red-50' },
  EQUITY: { label: 'Equity', color: 'text-purple-700 bg-purple-50' },
  INCOME: { label: 'Income', color: 'text-green-700 bg-green-50' },
  EXPENSE: { label: 'Expenses', color: 'text-amber-700 bg-amber-50' },
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'EXPENSE', subtype: '', isBank: false });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    accountingApi.accounts().then(r => setAccounts(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const seed = async () => { await accountingApi.seed(); load(); };

  const addAccount = async () => {
    setErr('');
    if (!form.code || !form.name) { setErr('Code and name are required'); return; }
    setSaving(true);
    try {
      await accountingApi.createAccount(form);
      setShowForm(false);
      setForm({ code: '', name: '', type: 'EXPENSE', subtype: '', isBank: false });
      load();
    } catch (e: any) { setErr(e.response?.data?.message || 'Could not create account'); }
    finally { setSaving(false); }
  };

  const filtered = accounts.filter(a => !q || `${a.code} ${a.name} ${a.subtype || ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><BookOpen size={18} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Chart of Accounts</h1>
            <p className="text-sm text-gray-500">{accounts.length} ledger accounts.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/accounting/trial-balance" className="btn btn-secondary"><BarChart3 size={14} /> Trial Balance</Link>
          <button onClick={() => setShowForm(s => !s)} className="btn btn-primary"><Plus size={14} /> Add account</button>
        </div>
      </div>

      {!loading && accounts.length === 0 && (
        <div className="card mb-5 text-center py-8">
          <Sparkles size={26} className="mx-auto text-brand-500 mb-2" />
          <h3 className="font-semibold text-gray-800">Start with a standard chart of accounts</h3>
          <p className="text-sm text-gray-500 mb-3">Seed a UAE SME template (assets, liabilities, equity, income, expenses) — then customise it.</p>
          <button onClick={seed} className="btn btn-primary mx-auto"><Sparkles size={14} /> Seed standard accounts</button>
        </div>
      )}

      {showForm && (
        <div className="card mb-5 bg-blue-50/40 border-blue-100">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div><label className="label">Code *</label><input className="input w-full font-mono" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="6700" /></div>
            <div className="md:col-span-2"><label className="label">Name *</label><input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="label">Type</label><select className="input w-full" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{TYPES.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}</select></div>
            <div><label className="label">Subtype</label><input className="input w-full" value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))} placeholder="Operating Expense" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 mt-3">
            <input type="checkbox" checked={form.isBank} onChange={e => setForm(f => ({ ...f, isBank: e.target.checked }))} /> This is a bank / cash account (reconcilable)
          </label>
          {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={addAccount} disabled={saving} className="btn btn-primary text-sm">{saving ? 'Saving…' : 'Add account'}</button>
            <button onClick={() => setShowForm(false)} className="btn btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search code or name…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      )}

      <div className="space-y-4">
        {TYPES.map(type => {
          const rows = filtered.filter(a => a.type === type);
          if (rows.length === 0) return null;
          const meta = TYPE_META[type];
          return (
            <div key={type} className="card overflow-hidden p-0">
              <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</div>
              <table className="w-full text-sm">
                <tbody>
                  {rows.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/60 group">
                      <td className="px-4 py-2.5 font-mono text-gray-500 w-20">{a.code}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/accounting/ledger/${a.id}`} className="font-medium text-gray-800 hover:text-brand-600">{a.name}</Link>
                        {a.isBank && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700">Bank</span>}
                        {!a.isActive && <span className="ml-2 text-[10px] text-gray-400">inactive</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">{a.subtype || ''}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Link href={`/accounting/ledger/${a.id}`} className="text-xs text-brand-600 opacity-0 group-hover:opacity-100">Ledger →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
