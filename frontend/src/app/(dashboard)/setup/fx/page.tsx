'use client';

import { useEffect, useState } from 'react';
import { Coins, Plus, Trash2, Save, CloudDownload } from 'lucide-react';
import { fxApi } from '@/lib/api';

export default function FxPage() {
  const [base, setBase] = useState('AED');
  const [rows, setRows] = useState<{ currency: string; toBase: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const fetchOnline = async () => {
    if (!confirm('Fetch live rates online? This updates the table with the quote more favourable for the AED side per currency (USD stays at the 3.6725 CBUAE peg). Existing values are overwritten.')) return;
    setFetching(true); setBanner(null);
    try {
      const r = await fxApi.refresh();
      if (r.data?.ok === false) { setBanner(r.data.message || 'Fetch failed.'); return; }
      const upd = r.data?.updated || [];
      setBanner(`Fetched ${upd.length} rate(s) — kept the AED-favourable quote per currency. ${upd.map((u: any) => `${u.currency} ${u.toBase}`).join(' · ')}`);
      load();
    } catch (e: any) { setBanner(e.response?.data?.message || 'Fetch failed — is the backend online?'); }
    finally { setFetching(false); }
  };

  const load = () => {
    setLoading(true);
    fxApi.rates().then(r => {
      setBase(r.data.base || 'AED');
      setRows((r.data.rates || []).map((x: any) => ({ currency: x.currency, toBase: String(Number(x.toBase)) })));
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const addRow = () => setRows(r => [...r, { currency: '', toBase: '' }]);
  const setRow = (i: number, k: 'currency' | 'toBase', v: string) => setRows(r => r.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  const delRow = async (i: number) => {
    const cur = rows[i].currency;
    setRows(r => r.filter((_, idx) => idx !== i));
    if (cur) await fxApi.remove(cur.toUpperCase()).catch(() => {});
  };
  const save = async () => {
    setSaving(true);
    try {
      await fxApi.save(rows.filter(r => r.currency && r.toBase).map(r => ({ currency: r.currency.toUpperCase(), toBase: Number(r.toBase) })));
      load();
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Coins size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Setup · Finance</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Currencies &amp; FX Rates</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Base reporting currency: <b>{base}</b>. Rates convert other currencies to {base} on consolidated dashboards.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchOnline} disabled={fetching} className="btn btn-secondary"><CloudDownload size={14} className="mr-1" /> {fetching ? 'Fetching…' : 'Fetch online'}</button>
          <button onClick={save} disabled={saving} className="btn btn-primary"><Save size={14} className="mr-1" /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      {banner && <div className="text-xs text-gray-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 mb-4">{banner}</div>}

      <div className="card">
        {loading ? <p className="text-sm text-gray-400 py-4 text-center">Loading…</p> : (
          <>
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="py-2 text-left">Currency</th><th className="py-2 text-left">1 unit = ? {base}</th><th className="w-8"></th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5 pr-2"><input className="input text-sm h-8 w-28 uppercase" value={r.currency} onChange={e => setRow(i, 'currency', e.target.value)} placeholder="USD" /></td>
                    <td className="py-1.5 pr-2"><input type="number" step="0.0001" className="input text-sm h-8 w-40" value={r.toBase} onChange={e => setRow(i, 'toBase', e.target.value)} placeholder="3.6725" /></td>
                    <td className="py-1.5"><button onClick={() => delRow(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-gray-400 text-sm">No rates yet. Add currencies used by your projects (e.g. USD, EUR).</td></tr>}
              </tbody>
            </table>
            <button onClick={addRow} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 mt-3"><Plus size={12} /> Add currency</button>
          </>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Example: if 1 USD = 3.6725 AED, enter currency <b>USD</b> and rate <b>3.6725</b>. The Executive and Production dashboards then total mixed‑currency projects in {base}.</p>
      <p className="text-[11px] text-gray-400 mt-1"><b>Fetch online</b> compares two independent rate sources per currency and keeps the one giving the higher AED value (prudent for for