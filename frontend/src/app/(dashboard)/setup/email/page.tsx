'use client';

import { useEffect, useState } from 'react';
import { Mail, Save, Send, ShieldCheck } from 'lucide-react';
import { settingsApi } from '@/lib/api';

export default function EmailSettingsPage() {
  const [smtp, setSmtp] = useState<any>({ host: '', port: 587, secure: false, user: '', pass: '', from: '' });
  const [digestTo, setDigestTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');

  const load = () => {
    setLoading(true);
    settingsApi.get().then(r => {
      const e = r.data.emailSettings || {};
      setSmtp({ host: '', port: 587, secure: false, user: '', pass: '', from: '', ...(e.smtp || {}) });
      setDigestTo(e.digestTo || '');
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try { await settingsApi.update({ emailSettings: { smtp: { ...smtp, port: Number(smtp.port) || 587 }, digestTo: digestTo || null } }); load(); alert('Email settings saved.'); }
    catch (e: any) { alert(e.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };
  const test = async () => {
    try { const r = await settingsApi.emailTest(testTo || undefined); alert(r.data.ok ? `Test email sent to ${r.data.to}.` : (r.data.message || 'Failed.')); }
    catch (e: any) { alert(e.response?.data?.message || 'Could not send — check the SMTP details.'); }
  };

  const f = (label: string, child: any) => <div><label className="label text-xs">{label}</label>{child}</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Mail size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Setup · Connections</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Email &amp; Notifications</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>One mail connection powers call sheets, cost reports, deal memos, statements and the daily alert digest.</p>
          </div>
        </div>
        <button onClick={save} disabled={saving || loading} className="btn btn-primary"><Save size={14} className="mr-1" /> {saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><ShieldCheck size={14} /> SMTP server</h3>
        <div className="grid grid-cols-2 gap-3">
          {f('Host', <input className="input w-full" value={smtp.host} onChange={e => setSmtp((s: any) => ({ ...s, host: e.target.value }))} placeholder="smtp.gmail.com" />)}
          {f('Port', <input type="number" className="input w-full" value={smtp.port} onChange={e => setSmtp((s: any) => ({ ...s, port: e.target.value }))} placeholder="587" />)}
          {f('Username', <input className="input w-full" value={smtp.user} onChange={e => setSmtp((s: any) => ({ ...s, user: e.target.value }))} placeholder="you@company.com" />)}
          {f('Password / app key', <input type="password" className="input w-full" value={smtp.pass} onChange={e => setSmtp((s: any) => ({ ...s, pass: e.target.value }))} placeholder="••••••••" />)}
          {f('From address', <input className="input w-full" value={smtp.from} onChange={e => setSmtp((s: any) => ({ ...s, from: e.target.value }))} placeholder="no-reply@company.com" />)}
          {f('SSL/TLS', <select className="input w-full" value={smtp.secure ? '1' : '0'} onChange={e => setSmtp((s: any) => ({ ...s, secure: e.target.value === '1' }))}><option value="0">STARTTLS (port 587)</option><option value="1">SSL (port 465)</option></select>)}
        </div>
        <p className="text-[11px] text-gray-400">Gmail/Workspace: use an App Password (not your normal password) and host smtp.gmail.com. Office 365: smtp.office365.com.</p>
      </div>

      <div className="card mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Daily alerts digest</h3>
        {f('Send digest to', <input className="input w-full" value={digestTo} onChange={e => setDigestTo(e.target.value)} placeholder="manager@company.com (defaults to SMTP user)" />)}
        <p className="text-[11px] text-gray-400 mt-2">The notification bell's "Digest" button and any scheduled digest send to this address.</p>
      </div>

      <div className="card mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Send a test</h3>
        <div className="flex gap-2">
          <input className="input flex-1" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="your@email.com" />
          <button onClick={test} className="btn btn-secondary"><Send size={14} className="mr-1" /> Send test</button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Save first, then send a test to confirm the connection works.</p>
      </div>
    </div>
  );
}
