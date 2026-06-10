'use client';

import { useEffect, useRef, useState } from 'react';
import { accountApi, twoFactorApi, assetUrl } from '@/lib/api';
import {
  ShieldCheck, Camera, Loader2, Check, Monitor, Smartphone, Tablet,
  LogOut, AlertTriangle, User, Lock,
} from 'lucide-react';

type Profile = {
  id: string; fullName: string; email: string; role: string;
  jobTitle?: string | null; department?: string | null;
  avatarUrl?: string | null; legalName?: string | null; preferredName?: string | null;
  legalNameProposed?: string | null; legalNamePending?: boolean;
  twoFactorEnabled?: boolean; lastLoginAt?: string | null;
};
type Session = {
  id: string; deviceInfo?: string | null; ipAddress?: string | null;
  lastSeenAt: string; createdAt: string; current?: boolean;
};

const card = 'rounded-2xl border border-slate-200 bg-white';
const fmtWhen = (d?: string | null) => (d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Compact "last active" — relative for recent, date for older. */
function fmtAgo(d?: string | null): string {
  if (!d) return '—';
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day > 1 ? 's' : ''} ago`;
  return new Date(d).toLocaleDateString('en-GB', { dateStyle: 'medium' });
}

/** Best-effort device label + icon from a raw User-Agent. */
function device(ua?: string | null): { label: string; Icon: typeof Monitor } {
  const s = (ua || '').toLowerCase();
  if (!s) return { label: 'Unknown device', Icon: Monitor };
  let os = 'Unknown OS';
  if (s.includes('iphone')) os = 'iPhone';
  else if (s.includes('ipad')) os = 'iPad';
  else if (s.includes('android')) os = 'Android';
  else if (s.includes('mac os')) os = 'macOS';
  else if (s.includes('windows')) os = 'Windows';
  else if (s.includes('linux')) os = 'Linux';
  let browser = '';
  if (s.includes('edg/')) browser = 'Edge';
  else if (s.includes('chrome/')) browser = 'Chrome';
  else if (s.includes('firefox/')) browser = 'Firefox';
  else if (s.includes('safari/')) browser = 'Safari';
  const Icon = s.includes('iphone') || s.includes('android') ? Smartphone : s.includes('ipad') ? Tablet : Monitor;
  return { label: browser ? `${browser} on ${os}` : `${os} device`, Icon };
}

export default function AccountSecurityPage() {
  const [p, setP] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [preferred, setPreferred] = useState('');
  const [legal, setLegal] = useState('');
  const [savingNames, setSavingNames] = useState(false);
  const [savedNames, setSavedNames] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [pr, ss] = await Promise.all([accountApi.profile(), accountApi.sessions()]);
    setP(pr.data); setPreferred(pr.data.preferredName || ''); setLegal(pr.data.legalName || '');
    setSessions(ss.data); setLoading(false);
  };
  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setAvatarErr('');
    if (f.size > 5 * 1024 * 1024) { setAvatarErr('Image must be under 5 MB.'); if (fileRef.current) fileRef.current.value = ''; return; }
    setAvatarBusy(true);
    try {
      const r = await accountApi.uploadAvatar(f);
      setP((prev) => prev ? { ...prev, avatarUrl: r.data.avatarUrl } : prev);
      window.dispatchEvent(new Event('tfm:profile-updated')); // nudge the navbar avatar
    } catch (err: any) {
      setAvatarErr(err?.response?.data?.message || 'Upload failed. Use a JPG, PNG or WebP under 5 MB.');
    } finally { setAvatarBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const saveNames = async () => {
    setSavingNames(true); setSavedNames(false);
    try {
      const r = await accountApi.updateProfile({ preferredName: preferred, legalName: legal });
      setP((prev) => prev ? { ...prev, ...r.data } : prev);
      setSavedNames(true); setTimeout(() => setSavedNames(false), 2500);
      window.dispatchEvent(new Event('tfm:profile-updated'));
    } finally { setSavingNames(false); }
  };

  const revoke = async (id: string) => {
    await accountApi.revokeSession(id);
    setSessions((s) => s.filter((x) => x.id !== id));
  };
  const revokeOthers = async () => {
    await accountApi.revokeOthers();
    setSessions((s) => s.filter((x) => x.current));
  };

  const initial = (p?.preferredName || p?.fullName || 'A').trim()[0]?.toUpperCase() || 'A';
  const otherCount = sessions.filter((s) => !s.current).length;
  const namesDirty = !!p && (preferred !== (p.preferredName || '') || legal !== (p.legalName || ''));

  if (loading) return <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <header className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center"><ShieldCheck size={18} /></div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Personal identity &amp; security</h1>
          <p className="text-xs text-slate-500">Your profile, names of record, and the devices signed in to your account.</p>
        </div>
      </header>

      {/* Identity */}
      <section className={`${card} p-5`}>
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-500">
              {p?.avatarUrl ? <img src={assetUrl(p.avatarUrl)} alt="" className="w-full h-full object-cover" /> : initial}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={avatarBusy}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center border-2 border-white disabled:opacity-60"
              aria-label="Change avatar">
              {avatarBusy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onAvatar} className="hidden" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-900 truncate">{p?.preferredName || p?.fullName}</p>
            <p className="text-sm text-slate-500 truncate">{p?.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">{(p?.role || '').replace(/_/g, ' ')}</span>
              {p?.jobTitle && <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">{p.jobTitle}</span>}
              {p?.department && <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">{p.department}</span>}
            </div>
          </div>
        </div>
        <p className={`mt-3 text-[11px] ${avatarErr ? 'text-rose-600' : 'text-slate-400'}`}>
          {avatarErr || 'Click the camera to change your photo — JPG, PNG or WebP, up to 5 MB.'}
        </p>
      </section>

      {/* Names */}
      <section className={`${card} p-5`}>
        <h2 className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5 mb-1"><User size={15} /> Names</h2>
        <p className="text-xs text-slate-500 mb-4">Your <b>preferred name</b> is how the system addresses you — it updates instantly. Your <b>legal name</b> is the HR/Finance record of truth, so changes are verified before they take effect.</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Preferred (display) name</span>
            <input value={preferred} onChange={(e) => setPreferred(e.target.value)} placeholder={p?.fullName || ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 outline-none" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Legal name</span>
            <input value={legal} onChange={(e) => setLegal(e.target.value)} placeholder="As on official documents"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 outline-none" />
          </label>
        </div>

        {p?.legalNamePending && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>Legal-name change to <b>“{p.legalNameProposed}”</b> is pending HR/Finance verification. The record stays <b>“{p.legalName || '—'}”</b> until it's cleared.</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveNames} disabled={savingNames || !namesDirty}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white text-sm px-4 py-2 disabled:opacity-40">
            {savingNames ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
          </button>
          {savedNames && <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><Check size={13} /> Saved</span>}
        </div>
      </section>

      {/* Sessions */}
      <section className={`${card} p-5`}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5"><Monitor size={15} /> Active sessions</h2>
          {otherCount > 0 && (
            <button onClick={revokeOthers} className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:border-rose-400 hover:text-rose-600">
              <LogOut size={13} /> Sign out other devices ({otherCount})
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-4">Each device that's signed in to your account. Revoking one signs it out on its next request.</p>

        <div className="divide-y divide-slate-100">
          {sessions.map((s) => {
            const { label, Icon } = device(s.deviceInfo);
            return (
              <div key={s.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"><Icon size={17} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {label}
                    {s.current && <span className="ml-2 text-[10px] rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 align-middle">This device</span>}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate" title={fmtWhen(s.lastSeenAt)}>{s.ipAddress || 'IP unknown'} · active {fmtAgo(s.lastSeenAt)}</p>
                </div>
                {s.current ? (
                  <span className="text-[11px] text-slate-400 px-2">Current</span>
                ) : (
                  <button onClick={() => revoke(s.id)} className="text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:border-rose-400 hover:text-rose-600">Revoke</button>
                )}
              </div>
            );
          })}
          {sessions.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No active sessions.</p>}
        </div>
      </section>

      {/* 2FA */}
      <TwoFactorSection enabled={!!p?.twoFactorEnabled} onChanged={load} />
    </div>
  );
}

/** Authenticator-app 2FA: enrol (QR + verify) when off, disable / recovery codes when on. */
function TwoFactorSection({ enabled, onChanged }: { enabled: boolean; onChanged: () => void }) {
  const [stage, setStage] = useState<'idle' | 'enrolling' | 'disabling' | 'regenerating'>('idle');
  const [qr, setQr] = useState(''); const [secret, setSecret] = useState('');
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);   // shown ONCE after enable/regenerate
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (enabled) twoFactorApi.backupStatus().then((r) => setRemaining(r.data.remaining)).catch(() => {});
    else setRemaining(null);
  }, [enabled]);

  const numericCode = (e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
  const recoveryCode = (e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11));

  const begin = async () => {
    setBusy(true); setErr('');
    try { const r = await twoFactorApi.setup(); setQr(r.data.qrDataUrl); setSecret(r.data.secret); setStage('enrolling'); setCode(''); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Could not start enrolment.'); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true); setErr('');
    try { const r = await twoFactorApi.enable(code.trim()); setCodes(r.data.backupCodes || []); setStage('idle'); setCode(''); onChanged(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Invalid code.'); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true); setErr('');
    try { await twoFactorApi.disable(code.trim()); setStage('idle'); setCode(''); setCodes(null); onChanged(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Invalid code.'); }
    finally { setBusy(false); }
  };
  const regenerate = async () => {
    setBusy(true); setErr('');
    try { const r = await twoFactorApi.regenerateBackup(code.trim()); setCodes(r.data.backupCodes || []); setStage('idle'); setCode(''); twoFactorApi.backupStatus().then((s) => setRemaining(s.data.remaining)).catch(() => {}); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Invalid code.'); }
    finally { setBusy(false); }
  };
  const reset = () => { setStage('idle'); setCode(''); setErr(''); setQr(''); setSecret(''); };

  const copyCodes = () => { if (codes) navigator.clipboard?.writeText(codes.join('\n')).catch(() => {}); };
  const downloadCodes = () => {
    if (!codes) return;
    const blob = new Blob([`TFM ERP — two-factor recovery codes\nKeep these safe. Each works once.\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tfm-recovery-codes.txt'; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <section className={`${card} p-5`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5"><Lock size={15} /> Two-factor authentication</h2>
        <span className={`text-[11px] rounded-full px-2 py-0.5 ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{enabled ? 'Enabled' : 'Off'}</span>
      </div>
      <p className="text-xs text-slate-500 mt-1">An authenticator-app code (Google Authenticator, 1Password, Authy…) is required for sensitive actions like releasing payments.</p>

      {/* Recovery codes — shown once after enable/regenerate */}
      {codes && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-start gap-2 text-[12px] text-emerald-900 font-medium"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Save your recovery codes</p>
          <p className="text-[11px] text-emerald-800/80 mt-1">Each code works once if you lose your authenticator. This is the only time they're shown.</p>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {codes.map((c) => <code key={c} className="text-[12px] font-mono bg-white border border-emerald-200 rounded px-2 py-1 text-slate-700 text-center">{c}</code>)}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={copyCodes} className="text-xs rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-emerald-800 hover:border-emerald-500">Copy</button>
            <button onClick={downloadCodes} className="text-xs rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-emerald-800 hover:border-emerald-500">Download .txt</button>
            <button onClick={() => setCodes(null)} className="text-xs rounded-lg bg-emerald-600 text-white px-3 py-1.5 ml-auto">I've saved them</button>
          </div>
        </div>
      )}

      {/* OFF → enrol */}
      {!enabled && stage === 'idle' && !codes && (
        <button onClick={begin} disabled={busy} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white text-sm px-4 py-2 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Set up two-factor
        </button>
      )}

      {/* enrolling */}
      {stage === 'enrolling' && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-600 mb-3">1. Scan this with your authenticator app, then enter the 6-digit code it shows.</p>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {qr && <img src={qr} alt="2FA QR code" className="w-40 h-40 rounded-lg border border-slate-200" />}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400">Can't scan? Enter this key manually:</p>
              <code className="block mt-1 text-[11px] font-mono break-all bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-slate-700">{secret}</code>
              <div className="mt-3 flex items-center gap-2">
                <input value={code} onChange={numericCode} onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && confirm()}
                  inputMode="numeric" maxLength={6} placeholder="——————"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-center tracking-widest font-mono w-32 focus:border-slate-900 outline-none" />
                <button onClick={confirm} disabled={busy || code.length < 6} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white text-sm px-3 py-2 disabled:opacity-50">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Verify &amp; enable
                </button>
                <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-700">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ON → recovery status + actions */}
      {enabled && stage === 'idle' && !codes && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {remaining !== null && (
            <span className={`text-[12px] inline-flex items-center gap-1.5 ${remaining <= 2 ? 'text-amber-700' : 'text-slate-500'}`}>
              {remaining <= 2 && <AlertTriangle size={13} />} {remaining} recovery code{remaining === 1 ? '' : 's'} left
            </span>
          )}
          <button onClick={() => { setStage('regenerating'); setCode(''); setErr(''); }} className="text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:border-slate-400">Regenerate recovery codes</button>
          <button onClick={() => { setStage('disabling'); setCode(''); setErr(''); }} className="text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:border-rose-400 hover:text-rose-600 ml-auto">Disable two-factor</button>
        </div>
      )}

      {/* regenerate — needs a current code */}
      {stage === 'regenerating' && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <p className="text-[12px] text-slate-600">Enter a current authenticator (or recovery) code to issue a fresh set. The old codes stop working.</p>
          <div className="mt-3 flex items-center gap-2">
            <input value={code} onChange={recoveryCode} onKeyDown={(e) => e.key === 'Enter' && code.length >= 6 && regenerate()}
              maxLength={11} placeholder="code"
              className="rounded-lg border border-slate-200 px-3 py-2 text-center tracking-widest font-mono w-40 focus:border-slate-900 outline-none" />
            <button onClick={regenerate} disabled={busy || code.length < 6} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white text-sm px-3 py-2 disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : null} Regenerate
            </button>
            <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-700">Cancel</button>
          </div>
        </div>
      )}

      {/* disable — accepts a TOTP or recovery code */}
      {stage === 'disabling' && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-start gap-2 text-[12px] text-amber-800"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Enter a current authenticator code (or a recovery code) to turn 2FA off.</p>
          <div className="mt-3 flex items-center gap-2">
            <input value={code} onChange={recoveryCode} onKeyDown={(e) => e.key === 'Enter' && code.length >= 6 && disable()}
              maxLength={11} placeholder="code"
              className="rounded-lg border border-amber-300 px-3 py-2 text-center tracking-widest font-mono w-40 focus:border-amber-500 outline-none bg-white" />
            <button onClick={disable} disabled={busy || code.length < 6} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 text-white text-sm px-3 py-2 disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : null} Disable
            </button>
            <button onClick={reset} className="text-xs text-amber-700 hover:text-amber-900">Cancel</button>
          </div>
        </div>
      )}

      {err && <p className="text-[11px] text-rose-600 mt-2">{err}</p>}
    </section>
  );
}
