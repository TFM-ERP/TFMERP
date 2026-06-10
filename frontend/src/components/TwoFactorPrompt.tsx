'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2, X } from 'lucide-react';

/**
 * Step-up authentication modal. Pops when a @Require2FA() action needs a fresh
 * authenticator code; calls onVerify(code) and shows any returned error.
 */
export default function TwoFactorPrompt({
  open, title = 'Confirm with two-factor', message = 'Enter the 6-digit code from your authenticator app to continue.',
  busy = false, error = '', onVerify, onClose,
}: {
  open: boolean;
  title?: string;
  message?: string;
  busy?: boolean;
  error?: string;
  onVerify: (code: string) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setCode(''); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);
  if (!open) return null;

  const submit = () => { if (code.length >= 6 && !busy) onVerify(code.trim()); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center"><ShieldCheck size={16} /></div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
        </div>
        <p className="text-xs text-slate-500 mt-2.5">{message}</p>
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          inputMode="numeric" maxLength={6} placeholder="——————"
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-center text-lg tracking-[0.4em] font-mono focus:border-slate-900 outline-none"
        />
        {error && <p className="text-[11px] text-rose-600 mt-2">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 text-sm py-2 text-slate-600 hover:border-slate-400">Cancel</button>
          <button onClick={submit} disabled={busy || code.length < 6}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 text-white text-sm py-2 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
