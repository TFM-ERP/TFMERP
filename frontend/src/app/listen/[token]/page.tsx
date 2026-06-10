'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { scriptAudioApi } from '@/lib/api';
import { Music, Clock, AlertTriangle, Loader2, Download, Lock } from 'lucide-react';

const fmt = (d: any) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default function ListenLinkPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback((code?: string) => {
    if (!token) return;
    setError(null); setGone(null);
    scriptAudioApi.resolveShare(token, code)
      .then((r) => setData(r.data))
      .catch((e) => {
        const status = e?.response?.status;
        const msg = e?.response?.data?.message || 'This link is invalid or could not be opened.';
        if (status === 410) setGone(msg); else setError(msg);
      })
      .finally(() => { setLoading(false); setSubmitting(false); });
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-slate-400" size={28} /></div>;

  if (gone) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center">
        <Clock className="mx-auto text-amber-400" size={36} />
        <h1 className="text-lg font-semibold text-slate-900 mt-3">Link no longer available</h1>
        <p className="text-slate-500 text-sm mt-1">{gone} Please request a new link from the production.</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center">
        <AlertTriangle className="mx-auto text-rose-400" size={36} />
        <h1 className="text-lg font-semibold text-slate-900 mt-3">Link unavailable</h1>
        <p className="text-slate-500 text-sm mt-1">{error || 'Not found.'}</p>
      </div>
    </div>
  );

  // Passcode gate
  if (data.needsPasscode) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm w-full text-center">
        <Lock className="mx-auto text-slate-400" size={32} />
        <h1 className="text-lg font-semibold text-slate-900 mt-3">{data.title || 'Protected audio'}</h1>
        <p className="text-slate-500 text-sm mt-1">Enter the passcode to listen.</p>
        <form onSubmit={(e) => { e.preventDefault(); setSubmitting(true); load(passcode); }} className="mt-4 space-y-3">
          <input autoFocus value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Passcode"
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-center text-sm" />
          <button type="submit" disabled={submitting || !passcode}
            className="w-full bg-slate-900 text-white rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50">
            {submitting ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 font-sans flex items-start justify-center">
      <div className="max-w-xl w-full">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white px-6 py-5 flex items-center gap-3">
            <Music size={22} />
            <div>
              <h1 className="text-lg font-semibold">{data.title || 'Audio'}</h1>
              <p className="text-slate-300 text-sm">{data.format || 'Audio'}{data.durationSec ? ` · ${Math.round(data.durationSec / 60)} min` : ''}{data.generatedAt ? ` · ${fmt(data.generatedAt)}` : ''}</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {data.note && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">{data.note}</p>}
            <audio controls autoPlay={false} src={data.audioUrl} className="w-full" />
            {data.allowDownload && (
              <a href={data.audioUrl} download className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                <Download size={14} /> Download
              </a>
            )}
            <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
              Shared for review. Please do not redistribute. This link may be time-limited and access is counted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
