'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Banknote, RefreshCw, Send, Settings, X, Mail, Play, FileText, AlertTriangle, Check } from 'lucide-react';
import { collectionsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const BUCKETS = [
  { k: 'current', label: 'Current' },
  { k: 'd30', label: '1–30 days' },
  { k: 'd60', label: '31–60 days' },
  { k: 'd90', label: '61–90 days' },
  { k: 'd90plus', label: '90+ days' },
];
const fmtD = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function CollectionsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => { setLoading(true); collectionsApi.aging().then(r => setData(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 5000); };

  const remind = async (it: any) => {
    setBusy(it.id); setMsg('');
    try { await collectionsApi.remind(it.id); flash(`Reminder sent for ${it.invoiceNumber}.`); load(); }
    catch (e: any) { flash(e.response?.data?.message || 'Reminder failed — check email settings.'); }
    finally { setBusy(''); }
  };
  const runScan = async () => {
    setBusy('scan'); setMsg('');
    try { const r = await collectionsApi.scan(); flash(`Scan complete — ${r.data?.sent ?? 0} reminder(s) sent.`); load(); }
    catch (e: any) { flash(e.response?.data?.message || 'Scan failed'); }
    finally { setBusy(''); }
  };

  const items = (data?.items || []).filter((it: any) =>
    filter === 'all' ? true : filter === 'overdue' ? it.daysOverdue > 0 : it.bucket === filter);
  const summary = data?.summary || {};

  return (
    <div className="p-6 max-w-[1700px] mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Banknote size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Finance · Receivables</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Collections</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Receivables aging, payment reminders and statements of account.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={runScan} disabled={busy === 'scan'} className="btn-secondary"><Play size={14} /> Run reminders</button>
          <button onClick={() => setShowSettings(true)} className="btn-secondary"><Settings size={14} /> Settings</button>
          <button onClick={load} className="btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {msg && <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">{msg}</div>}

      {/* Aging tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {BUCKETS.map(b => (
          <button key={b.k} onClick={() => setFilter(filter === b.k ? 'all' : b.k)}
            className={`card p-3 text-left ${filter === b.k ? 'ring-1 ring-brand-200 border-brand-300' : ''}`}>
            <div className="text-xs text-gray-500">{b.label}</div>
            <div className={`text-lg font-bold ${b.k === 'd90plus' ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(summary[b.k] || 0)}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <select className="input w-44" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All open</option>
          <option value="overdue">Overdue only</option>
          {BUCKETS.map(b => <option key={b.k} value={b.k}>{b.label}</option>)}
        </select>
        <span className="text-sm text-gray-500">{items.length} invoice(s) · {formatCurrency(summary.total || 0)} outstanding</span>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> : items.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">Nothing outstanding in this view.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2.5 text-left">Invoice</th>
                <th className="px-3 py-2.5 text-left">Client</th>
                <th className="px-3 py-2.5 text-left">Due</th>
                <th className="px-3 py-2.5 text-right">Amount due</th>
                <th className="px-3 py-2.5 text-left">Last reminder</th>
                <th className="px-5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any) => (
                <tr key={it.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/finance/invoices/${it.id}`} className="font-mono text-xs font-semibold text-brand-600">{it.invoiceNumber}</Link>
                    {it.daysOverdue > 0 && <div className="text-[11px] text-red-600">{it.daysOverdue}d overdue</div>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-gray-800">{it.client}</div>
                    {it.clientBlocked && <span className="text-[10px] text-red-600">blocked</span>}
                    {!it.clientEmail && <span className="text-[10px] text-amber-600">no email</span>}
                  </td>
                  <td className="px-3 py-3 text-gray-600">{fmtD(it.dueDate)}</td>
                  <td className="px-3 py-3 text-right font-medium">{formatCurrency(it.amountDue)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {it.lastReminder ? <span className={it.lastReminder.status === 'FAILED' ? 'text-red-600' : ''}>{it.lastReminder.level} · {fmtD(it.lastReminder.sentAt)}</span> : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => remind(it)} disabled={busy === it.id || !it.clientEmail || it.clientBlocked} title={!it.clientEmail ? 'No client email' : 'Send reminder'} className="text-brand-600 hover:text-brand-700 disabled:opacity-30 flex items-center gap-1 text-xs"><Send size={13} /> Remind</button>
                      {it.clientId && <Link href={`/finance/collections/statement/${it.clientId}`} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-xs"><FileText size={13} /> Statement</Link>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSaved={() => { setShowSettings(false); flash('Settings saved.'); }} />}
    </div>
  );
}

function SettingsModal({ onClose, onSaved }: any) {
  const [s, setS] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => { collectionsApi.getSettings().then(r => setS(r.data)); }, []);
  if (!s) return null;
  const smtp = s.smtp || {};
  const setSmtp = (k: string, v: any) => setS({ ...s, smtp: { ...s.smtp, [k]: v } });

  const save = async () => { setSaving(true); try { await collectionsApi.updateSettings({ smtp: s.smtp, remindersEnabled: s.remindersEnabled, rules: s.rules, statementFooter: s.statementFooter }); onSaved(); } finally { setSaving(false); } };
  const test = async () => { setTestMsg(''); try { await collectionsApi.testEmail(testTo); setTestMsg('Sent ✓'); } catch (e: any) { setTestMsg(e.response?.data?.message || 'Failed'); } };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h2 className="font-bold text-gray-900">Collections settings</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div>
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">Automatic reminders</span>
            <input type="checkbox" checked={!!s.remindersEnabled} onChange={e => setS({ ...s, remindersEnabled: e.target.checked })} />
          </label>
          <p className="text-xs text-gray-400 -mt-2">Scans every 6 hours and sends the appropriate reminder per the cadence below. Off until SMTP is set.</p>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">SMTP (outgoing email)</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><label className="label">Host</label><input className="input w-full" value={smtp.host || ''} onChange={e => setSmtp('host', e.target.value)} placeholder="smtp.gmail.com" /></div>
              <div><label className="label">Port</label><input type="number" className="input w-full" value={smtp.port || 587} onChange={e => setSmtp('port', Number(e.target.value))} /></div>
              <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!smtp.secure} onChange={e => setSmtp('secure', e.target.checked)} /> SSL/TLS (465)</label></div>
              <div><label className="label">Username</label><input className="input w-full" value={smtp.user || ''} onChange={e => setSmtp('user', e.target.value)} /></div>
              <div><label className="label">Password</label><input type="password" className="input w-full" value={smtp.pass || ''} onChange={e => setSmtp('pass', e.target.value)} /></div>
              <div className="col-span-2"><label className="label">From address</label><input className="input w-full" value={smtp.from || ''} onChange={e => setSmtp('from', e.target.value)} placeholder="accounts@thefilmmakers.ae" /></div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input className="input flex-1" placeholder="test@email.com" value={testTo} onChange={e => setTestTo(e.target.value)} />
              <button onClick={test} className="btn-secondary text-xs"><Mail size={13} /> Send test</button>
              {testMsg && <span className="text-xs text-gray-500">{testMsg}</span>}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Reminder cadence</h3>
            <div className="space-y-1">
              {(s.rules || []).map((r: any, i: number) => (
                <div key={r.key} className="flex items-center gap-2 text-sm">
                  <input className="input flex-1 py-1" value={r.label} onChange={e => { const rules = [...s.rules]; rules[i] = { ...r, label: e.target.value }; setS({ ...s, rules }); }} />
                  <span className="text-xs text-gray-400">day</span>
                  <input type="number" className="input w-16 py-1" value={r.offsetDays} onChange={e => { const rules = [...s.rules]; rules[i] = { ...r, offsetDays: Number(e.target.value) }; setS({ ...s, rules }); }} />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Negative = days before due date; positive = days overdue.</p>
          </div>

          <div><label className="label">Statement / email footer</label><textarea className="input w-full h-16 resize-none text-xs" value={s.statementFooter || ''} onChange={e => setS({ ...s, statementFooter: e.target.value })} /></div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3"><button onClick={onClose} classN