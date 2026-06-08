'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save, CheckCircle, Ban, AlertTriangle } from 'lucide-react';
import { accountingApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

type Line = { accountId: string; description: string; debit: string; credit: string };
const blankLine = (): Line => ({ accountId: '', description: '', debit: '', credit: '' });

export default function JournalEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<Line[]>([blankLine(), blankLine()]);
  const [status, setStatus] = useState('DRAFT');
  const [entryNumber, setEntryNumber] = useState('');
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { accountingApi.accounts().then(r => setAccounts(r.data || [])).catch(() => {}); }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await accountingApi.journal(id);
      const e = r.data;
      setDate(e.date.slice(0, 10)); setReference(e.reference || ''); setMemo(e.memo || '');
      setStatus(e.status); setEntryNumber(e.entryNumber);
      setLines(e.lines.map((l: any) => ({ accountId: l.accountId, description: l.description || '', debit: Number(l.debit) || '', credit: Number(l.credit) || '' })));
    } catch { router.push('/accounting/journals'); }
    finally { setLoading(false); }
  }, [id, router]);
  useEffect(() => { load(); }, [load]);

  const readOnly = status === 'POSTED' || status === 'VOID';
  const totalD = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalC = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.round(totalD * 100) === Math.round(totalC * 100) && totalD > 0;

  const setLine = (i: number, field: keyof Line, v: string) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [field]: v } : l));
  const addLine = () => setLines(ls => [...ls, blankLine()]);
  const delLine = (i: number) => setLines(ls => ls.filter((_, idx) => idx !== i));

  const payload = () => ({
    date, reference: reference || undefined, memo: memo || undefined,
    lines: lines.filter(l => l.accountId && (Number(l.debit) || Number(l.credit)))
      .map(l => ({ accountId: l.accountId, description: l.description, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
  });

  const save = async (post: boolean) => {
    setErr('');
    setSaving(true);
    try {
      if (id) {
        await accountingApi.updateJournal(id, payload());
        if (post) await accountingApi.postJournal(id);
        await load();
      } else {
        const r = await accountingApi.createJournal({ ...payload(), post });
        router.push(`/accounting/journals/${r.data.id}`);
      }
    } catch (e: any) { setErr(e.response?.data?.message || 'Could not save entry'); }
    finally { setSaving(false); }
  };

  const voidEntry = async () => { if (id && confirm('Void this posted entry?')) { await accountingApi.voidJournal(id); load(); } };
  const del = async () => { if (id && confirm('Delete this draft entry?')) { await accountingApi.deleteJournal(id); router.push('/accounting/journals'); } };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/accounting/journals" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{id ? `Journal ${entryNumber}` : 'New Journal Entry'}</h1>
          {status !== 'DRAFT' && <span className={cn('badge text-xs', status === 'POSTED' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500')}>{status}</span>}
        </div>
        {status === 'POSTED' && <button onClick={voidEntry} className="btn btn-secondary text-sm text-red-600"><Ban size={13} className="mr-1" /> Void</button>}
      </div>

      <div className="card mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><label className="label">Date</label><input type="date" disabled={readOnly} className="input w-full" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label className="label">Reference</label><input disabled={readOnly} className="input w-full" value={reference} onChange={e => setReference(e.target.value)} placeholder="Invoice / PO / note" /></div>
          <div className="md:col-span-1"><label className="label">Memo</label><input disabled={readOnly} className="input w-full" value={memo} onChange={e => setMemo(e.target.value)} /></div>
        </div>
      </div>

      <div className="card overflow-hidden p-0 mb-4">
        <table className="w-full text-sm">
          <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
            <th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-left">Description</th>
            <th className="px-3 py-2 text-right w-32">Debit</th><th className="px-3 py-2 text-right w-32">Credit</th><th className="w-8"></th>
          </tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="px-2 py-1.5">
                  <select disabled={readOnly} className="input text-sm h-8 w-full" value={l.accountId} onChange={e => setLine(i, 'accountId', e.target.value)}>
                    <option value="">Select account…</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5"><input disabled={readOnly} className="input text-sm h-8 w-full" value={l.description} onChange={e => setLine(i, 'description', e.target.value)} /></td>
                <td className="px-2 py-1.5"><input disabled={readOnly} type="number" className="input text-sm h-8 w-full text-right" value={l.debit} onChange={e => setLine(i, 'debit', e.target.value)} placeholder="0.00" /></td>
                <td className="px-2 py-1.5"><input disabled={readOnly} type="number" className="input text-sm h-8 w-full text-right" value={l.credit} onChange={e => setLine(i, 'credit', e.target.value)} placeholder="0.00" /></td>
                <td className="px-1">{!readOnly && lines.length > 2 && <button onClick={() => delLine(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold text-gray-800">
              <td className="px-3 py-2" colSpan={2}>
                {!readOnly && <button onClick={addLine} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"><Plus size={11} /> Add line</button>}
              </td>
              <td className="px-3 py-2 text-right">{formatCurrency(totalD)}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(totalC)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className={cn('text-sm flex items-center gap-1.5', balanced ? 'text-green-600' : 'text-amber-600')}>
          {balanced ? <><CheckCircle size={15} /> Balanced</> : <><AlertTriangle size={15} /> Out of balance by {formatCurrency(Math.abs(totalD - totalC))}</>}
        </div>
        {err && <p className="text-xs text-red-500">{err}</p>}
        {!readOnly && (
          <div className="flex gap-2">
            {id && status === 'DRAFT' && <button onClick={del} className="btn btn-secondary text-sm text-red-600"><Trash2 size={13} /></button>}
            <button onClick={() => save(false)} disabled={saving} className="btn btn-secondary text-sm"><Save size={13} className="mr-1" /> Save draft</button>
            <button onClick={() => save(true)} disabled={saving || !balanced} className="btn btn-primary text-sm"><CheckCircle size={13} className="mr-1" /> {saving ? 'Saving…' : 'Save & post'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
