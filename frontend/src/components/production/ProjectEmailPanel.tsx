'use client';

import { useEffect, useState } from 'react';
import { Mail, Save, Send } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function ProjectEmailPanel({ projectId }: { projectId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [smtp, setSmtp] = useState<any>({ host: '', port: 587, secure: false, user: '', pass: '', from: '' });
  const [productionEnabled, setProductionEnabled] = useState(false);
  const [companyConfigured, setCompanyConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');

  const load = () => {
    setLoading(true);
    productionApi.mail.getProjectSettings(projectId).then(r => {
      const p = r.data.project || {};
      setEnabled(!!p.enabled);
      setSmtp({ host: '', port: 587, secure: false, user: '', pass: '', from: '', ...(p.smtp || {}) });
      setProductionEnabled(!!r.data.productionEnabled);
      setCompanyConfigured(!!r.data.companyConfigured);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [projectId]);

  const save = async () => {
    setSaving(true);
    try { await productionApi.mail.saveProjectSettings(projectId, { enabled, smtp: { ...smtp, port: Number(smtp.port) || 587 } }); load(); alert('Project email sender saved.'); }
    catch (e: any) { alert(e.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };
  const test = async () => {
    if (!testTo) return;
    try { const r = await productionApi.mail.testProject(projectId, testTo); alert(`Test sent to ${r.data.to} (via ${r.data.via} sender).`); }
    catch (e: any) { alert(e.response?.data?.message || 'Could not send — check the SMTP details.'); }
  };
  const f = (label: string, child: any) => <div><label className="label text-xs">{label}</label>{child}</div>;

  const fallback = productionEnabled ? 'the Production email sender' : (companyConfigured ? 'the company email' : 'the company email (not configured yet)');

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Mail size={15} /> Project Email Sender</h3>
          <p className="text-xs text-gray-400">A sender unique to this project. Leave off to use {fallback}.</p>
        </div>
        <button onClick={save} disabled={saving || loading} className="btn btn-primary text-xs py-1.5 px-3"><Save size={13} className="mr-1" /> {saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="card">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          Use a dedicated sender for this project
        </label>
        <p className="text-[11px] text-gray-400 mt-1">
          Order used when sending this project's call sheets, deal memos and cost reports: <b>project → production → company</b>.
        </p>
      </div>

      <div className={cn('card space-y-4', !enabled && 'opacity-50 pointer-events-none')}>
        <h4 className="text-xs font-semibold text-gray-600 uppercase">SMTP server</h4>
        <div className="grid grid-cols-2 gap-3">
          {f('Host', <input className="input w-full" value={smtp.host} onChange={e => setSmtp((s: any) => ({ ...s, host: e.target.value }))} placeholder="smtp.gmail.com" />)}
          {f('Port', <input type="number" className="input w-full" value={smtp.port} onChange={e => setSmtp((s: any) => ({ ...s, port: e.target.value }))} placeholder="587" />)}
          {f('Username', <input className="input w-full" value={smtp.user} onChange={e => setSmtp((s: any) => ({ ...s, user: e.target.value }))} placeholder="project@company.com" />)}
          {f('Password / app key', <input type="password" className="input w-full" value={smtp.pass} onChange={e => setSmtp((s: any) => ({ ...s, pass: e.target.value }))} placeholder="••••••••" />)}
          {f('From address', <input className="input w-full" value={smtp.from} onChange={e => setSmtp((s: any) => ({ ...s, from: e.target.value }))} placeholder="project@company.com" />)}
          {f('SSL/TLS', <select className="input w-full" value={smtp.secure ? '1' : '0'} onChange={e => setSmtp((s: any) => ({ ...s, secure: e.target.value === '1' }))}><option value="0">STARTTLS (587)</option><option value="1">SSL (465)</option></select>)}
        </div>
      </div>

      <div className="card">
        <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Send a test</h4>
        <div className="flex gap-2">
          <input className="input flex-1" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="your@email.com" />
          <button onClick={test} className="btn btn-secondary"><Send size={14} className="mr-1" /> Send test</button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Save first. The test follows the same project → production → company order and tells you which sender was used.</p>
      </div>
    </div>
  );
}
