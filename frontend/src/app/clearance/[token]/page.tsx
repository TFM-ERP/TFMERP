'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, assetUrl } from '@/lib/api';
import { ShieldCheck, Clock, AlertTriangle, Loader2, FileText, ExternalLink } from 'lucide-react';

const fmt = (d: any) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default function ClearanceLinkPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    productionApi.clearancePacks.resolvePublic(token)
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.message || 'This link is invalid or could not be opened.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-slate-400" size={28} /></div>;

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center">
        <AlertTriangle className="mx-auto text-rose-400" size={36} />
        <h1 className="text-lg font-semibold text-slate-900 mt-3">Link unavailable</h1>
        <p className="text-slate-500 text-sm mt-1">{error || 'Not found.'}</p>
      </div>
    </div>
  );

  if (data.expired) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center">
        <Clock className="mx-auto text-amber-400" size={36} />
        <h1 className="text-lg font-semibold text-slate-900 mt-3">{data.status === 'REVOKED' ? 'Access revoked' : 'Link expired'}</h1>
        <p className="text-slate-500 text-sm mt-1">This clearance pack{data.title ? ` (“${data.title}”)` : ''} is no longer accessible. Please request a new link from the production.</p>
      </div>
    </div>
  );

  const docLink = (label: string, url?: string | null) => url
    ? <a href={assetUrl(url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><FileText size={13} /> {label} <ExternalLink size={11} /></a>
    : <span className="text-sm text-slate-300">{label}</span>;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white px-6 py-5 flex items-center gap-3">
            <ShieldCheck size={22} />
            <div>
              <h1 className="text-lg font-semibold">Crew Clearance Pack</h1>
              <p className="text-slate-300 text-sm">{data.title}{data.projectName ? ` · ${data.projectName}` : ''}</p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {data.recipientOrg && <div><div className="text-[11px] uppercase tracking-wide text-slate-400">For</div><div className="font-medium text-slate-800">{data.recipientOrg}</div></div>}
              {data.recipientName && <div><div className="text-[11px] uppercase tracking-wide text-slate-400">Attn</div><div className="font-medium text-slate-800">{data.recipientName}</div></div>}
              <div><div className="text-[11px] uppercase tracking-wide text-slate-400">Party</div><div className="font-medium text-slate-800">{data.members.length} crew</div></div>
              <div><div className="text-[11px] uppercase tracking-wide text-slate-400">Link expires</div><div className="font-medium text-slate-800">{fmt(data.expiresAt)}</div></div>
            </div>
            {data.purpose && <p className="text-sm text-slate-600">{data.purpose}</p>}
            {data.message && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">{data.message}</p>}

            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">Identity documents</div>
              <div className="space-y-2">
                {data.members.map((m: any, i: number) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{m.name}</div>
                        <div className="text-[12px] text-slate-400">{[m.roleTitle, m.department].filter(Boolean).join(' · ')}</div>
                      </div>
                      {m.photoUrl && <img src={assetUrl(m.photoUrl)} alt={m.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      {docLink('Passport', m.passportUrl)}
                      {docLink('Emirates ID', m.emiratesIdUrl)}
                      {Array.isArray(m.otherDocs) && m.otherDocs.map((d: any, j: number) => docLink(d.label || 'Document', d.url))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
              Confidential. These documents are shared with the crew’s consent for pre-clearance only. Access to this link is logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
