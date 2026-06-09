'use client';

import { useState } from 'react';
import { otpApi } from '@/lib/api';
import { ShieldCheck, Eye, Loader2, Lock } from 'lucide-react';

/** Mask a sensitive value to its last 4 chars (e.g. "AE** **** ***1234"). */
export function maskPii(v?: string | null): string {
  if (!v) return '—';
  const s = String(v);
  if (s.length <= 4) return '••••';
  return `${s.slice(0, 2)}${'•'.repeat(Math.max(2, s.length - 6))}${s.slice(-4)}`;
}

type Field = { key: string; label: string };

/**
 * SYS-13 · D10 — reveal protected fields after an email OTP. Values stay masked until the data
 * subject's 6-digit code (sent over the existing SMTP) is verified. No SMS gateway, no third-party.
 */
export default function PiiReveal({ entityType, entityId, fields, title = 'Protected details' }: {
  entityType: string;
  entityId: string;
  fields: Field[];
  title?: string;
}) {
  const [stage, setStage] = useState<'masked' | 'sent' | 'revealed'>('masked');
  const [challengeId, setChallengeId] = useState('');
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const request = async () => {
    setBusy(true); setError('');
    try {
      const r = await otpApi.request({ entityType, entityId, fields: fields.map((f) => f.key) });
      setChallengeId(r.data.challengeId); setTarget(r.data.target); setStage('sent');
    } catch (e: any) { setError(e?.response?.data?.message || 'Could not send the code.'); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError('');
    try {
      const r = await otpApi.verify(challengeId, code.trim());
      setValues(r.data.fields || {}); setStage('revealed'); setCode('');
    } catch (e: any) { setError(e?.response?.data?.message || 'Invalid code.'); }
    finally { setBusy(false); }
  };
  const hide = () => { setStage('masked'); setValues({}); setChallengeId(''); setError(''); };

  const fmt = (v: any) => (v == null ? '—' : typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleDateString('en-GB') : String(v));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5"><ShieldCheck size={15} /> {title}</h4>
        {stage === 'masked' && <button onClick={request} disabled={busy} className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:border-slate-900 disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} Reveal</button>}
        {stage === 'revealed' && <button onClick={hide} className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-500 hover:border-slate-900"><Lock size={13} /> Hide</button>}
      </div>

      <div className="space-y-1">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center justify-between text-sm">
            <span className="text-slate-400 text-xs">{f.label}</span>
            <span className={`font-mono ${stage === 'revealed' ? 'text-slate-900' : 'text-slate-400'}`}>{stage === 'revealed' ? fmt(values[f.key]) : '•••• ••••'}</span>
          </div>
        ))}
      </div>

      {stage === 'sent' && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-500 mb-1.5">A 6-digit code was emailed to <b>{target}</b>. Enter it to reveal.</p>
          <div className="flex items-center gap-2">
            <input className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm tracking-widest w-28 text-center" maxLength={6} placeholder="——————" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <button onClick={verify} disabled={busy || code.length < 6} className="text-xs rounded-lg bg-slate-900 text-white px-3 py-2 disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : 'Verify'}</button>
            <button onClick={request} disabled={busy} className="text-[11px] text-slate-400 hover:text-slate-700">Resend</button>
          </div>
        </div>
      )}
      {error && <p className="text-[11px] text-rose-600 mt-2">{error}</p>}
    </div>
  );
}
