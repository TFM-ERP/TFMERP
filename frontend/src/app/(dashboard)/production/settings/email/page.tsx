'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, Save, Send, ArrowLeft } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function ProductionEmailSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [smtp, setSmtp] = useState<any>({ host: '', port: 587, secure: false, user: '', pass: '', from: '' });
  const [companyConfigured, setCompanyConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');

  const load = () => {
    setLoading(true);
    productionApi.mail.getSettings().then(r => {
      const p = r.data.production || {};
      setEnabled(!!p.enabled);
      setSmtp({ host: '', port: 587, secure: false, user: '', pass: '', from: '', ...(p.smtp || {}) });
      setCompanyConfigured(!!r.data.companyConfigured);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try { await productionApi.mail.saveSettings({ enabled, smtp: { ...smtp, port: Number(smtp.port) || 587 } }); load(); alert('Production email settings saved.'); }
    catch (e: any) { alert(e.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };
  const test = async () => {
    if (!testTo) return;
    try { const r = await productionApi.mail.test(testTo); alert(`Test sent to ${r.data.to}.`); }
    catch (e: any) { alert(e.response?.data?.message || 'Could not send — check the SMTP details.'); }
  };
  const f = (label: string, child: any) => <div><label className="label text-xs">{label}</label>{child}</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/production/dashboard" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Mail size={18} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Production Email Sender</h1>
            <p className="text-sm text-gray-500">A dedicated sender for production emails — call sheets, deal memos and cost reports.</p>
          </div>
        </div>
        <button onClick={save} disabled={saving || loading} className="btn btn-primary"><Save size={14} className="mr-1" /> {saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="card mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          Use a dedicated production email account
        </label>
        <p className="text-[11px] text-gray-400 mt-1">
          {enabled
            ? 'Production emails will be sent from the account below.'
            : `Off — production emails use the company‑wide email (${companyConfigured ? 'configured' : 'not configured yet — set it in Setup → Email & Notifications'}).`}
        </p>
      </div>

      <div className={cn('card space-y-4', !enabled && 'opacity-50 pointer-events-none')}>
        <h3 className="text-sm font-semibold text-gray-700">SMTP server</h3>
        <div className="grid grid-cols-2 gap-3">
          {f('Host', <input className="input w-full" value={smtp.host} onChange={e => setSmtp((s: any) => ({ ...s, host: e.target.value }))} placeholder="smtp.gmail.com" />)}
          {f('Port', <input type="number" className="input w-full" value={smtp.port} onChange={e => setSmtp((s: any) => ({ ...s, port: e.target.value }))} placeholder="587" />)}
          {f('Username', <input className="input w-full" value={smtp.user} onChange={e => setSmtp((s: any) => ({ ...s, user: e.target.value }))} placeholder="production@company.com" />)}
          {f('Password / app key', <input type="password" className="input w-full" value={smtp.pass} onChange={e => setSmtp((s: any) => ({ ...s, pass: e.target.value }))} placeholder="••••••••" />)}
          {f('From address', <input className="input w-full" value={smtp.from} onChange={e => setSmtp((s: any) => ({ ...s, from: e.target.value }))} placeholder="production@company.com" />)}
          {f('SSL/TLS', <select className="input w-full" value={smtp.secure ? '1' : '0'} onChange={e => setSmtp((s: any) => ({ ...s, secure: e.target.value === '1' }))}><option value="0">STARTTLS (587)</option><option value="1">SSL (465)</option></select>)}
        </div>
      </div>

      <div className="card mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Send a test</h3>
        <div className="flex gap-2">
          <input className="input flex-1" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="your@email.com" />
          <button onClick={test} className="btn btn-secondary"><Send size={14} className="mr-1" /> Send test</button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Save first. If the dedicated sender is off, the test uses the company email.</p>
      </div>
    </div>
  );
}
