'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Cloud, Check, RefreshCw, Link2, AlertTriangle } from 'lucide-react';
import { integrationsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const PROVIDERS = [
  { key: 'GDRIVE', label: 'Google Drive', color: 'text-green-600', desc: 'Connect a team Google account to browse and import Drive files.' },
  { key: 'DROPBOX', label: 'Dropbox', color: 'text-blue-600', desc: 'Connect a team Dropbox to browse and import files.' },
];

export default function IntegrationsPage() {
  const sp = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const justConnected = sp.get('connected');
  const errorMsg = sp.get('error');

  const load = () => { setLoading(true); integrationsApi.status().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const connect = async (p: string) => {
    try { const r = await integrationsApi.connectUrl(p); window.location.href = r.data.url; }
    catch (e: any) { alert(e.response?.data?.message || 'Not configured on the server (missing client id/secret).'); }
  };
  const disconnect = async (p: string) => { if (confirm('Disconnect this account?')) { await integrationsApi.disconnect(p); load(); } };

  const connOf = (p: string) => data?.connections?.find((c: any) => c.provider === p);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Cloud size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Setup · Connections</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Cloud Integrations</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Connect Google Drive / Dropbox for the team. Tokens are stored and refreshed automatically.</p>
          </div>
        </div>
        <button onClick={load} className="btn btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {justConnected && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2 flex items-center gap-2"><Check size={15} /> {justConnected} connected.</div>}
      {errorMsg && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 flex items-center gap-2"><AlertTriangle size={15} /> {errorMsg}</div>}

      <div className="space-y-3">
        {PROVIDERS.map(p => {
          const conn = connOf(p.key);
          const configured = data?.configured?.[p.key];
          return (
            <div key={p.key} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cloud size={22} className={p.color} />
                <div>
                  <div className="font-semibold text-gray-800">{p.label}</div>
                  <div className="text-xs text-gray-400">{conn ? `Connected as ${conn.accountName || conn.accountEmail || 'account'}` : p.desc}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!configured ? (
                  <span className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={12} /> Not configured</span>
                ) : conn ? (
                  <>
                    <span className="badge bg-green-100 text-green-700 text-xs flex items-center gap-1"><Check size={11} /> Connected</span>
                    <button onClick={() => disconnect(p.key)} className="btn btn-secondary text-xs py-1 px-3 text-red-600">Disconnect</button>
                  </>
                ) : (
                  <button onClick={() => connect(p.key)} className="btn btn-primary text-xs py-1.5 px-3"><Link2 size={13} className="mr-1" /> Connect</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card mt-5 bg-gray-50 text-xs text-gray-500 leading-relaxed">
        <p className="font-semibold text-gray-600 mb-1">Server setup</p>
        Configure these backend environment variables, then restart the API:
        <div className="font-mono mt-2 space-y-0.5">
          <div>GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET</div>
          <div>DROPBOX_APP_KEY / DROPBOX_APP_SECRET</div>
          <div>OAUTH_REDIRECT_BASE=http://localhost:3001/api/v1</div>
          <div>APP_URL=http://localhost:3000</div>
        </div>
        <p className="mt-2">Add redirect URIs <span className="font-mono">{'{OAUTH_REDIRECT_BASE}'}/integrations/gdrive/callback</span> and <span className="font-mono">.../dropbox/callback</span> in the Google / Dropbox app consoles.</p>
      </div>
    </div>
  );
}
