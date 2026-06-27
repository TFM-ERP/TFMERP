'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Eye, EyeOff } from 'lucide-react';

const SAVED_EMAIL_KEY   = 'tfm_saved_email';
const SAVED_REMEMBER_KEY = 'tfm_remember_me';

export default function LoginPage() {
  const router = useRouter();
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [rememberMe,   setRememberMe]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [needs2FA,     setNeeds2FA]     = useState(false);
  const [totpCode,     setTotpCode]     = useState('');
  const [useRecovery,  setUseRecovery]  = useState(false);

  useEffect(() => {
    const saved      = localStorage.getItem(SAVED_EMAIL_KEY);
    const remembered = localStorage.getItem(SAVED_REMEMBER_KEY) === 'true';
    if (saved && remembered) { setEmail(saved); setRememberMe(true); }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email: email.trim(), password, totpCode: totpCode || undefined });
      // Account has 2FA on but no code yet → reveal the code field and wait for the second step.
      if (res.data?.requires2FA) { setNeeds2FA(true); setLoading(false); return; }
      const { access_token, user } = res.data;
      localStorage.setItem('tfm_token', access_token);
      localStorage.setItem('tfm_user', JSON.stringify(user));
      if (rememberMe) {
        localStorage.setItem(SAVED_EMAIL_KEY, email);
        localStorage.setItem(SAVED_REMEMBER_KEY, 'true');
      } else {
        localStorage.removeItem(SAVED_EMAIL_KEY);
        localStorage.removeItem(SAVED_REMEMBER_KEY);
      }
      router.push('/finance');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // ── palette + field styling ──
  const C = { bg: '#0C0D10', gold: '#C6A463', goldHi: '#E6D2A2', cream: '#F3ECDD', label: '#9A7F52', mute: '#7c818a', line: '#33383F' };
  const goldGrad = 'linear-gradient(180deg, #E6D2A2 0%, #C6A463 100%)';
  const focusOn  = (el: HTMLInputElement) => { el.style.borderColor = C.gold; el.style.boxShadow = '0 0 0 3px rgba(198,164,99,.15)'; };
  const focusOff = (el: HTMLInputElement) => { el.style.borderColor = C.line; el.style.boxShadow = ''; };
  const inputStyle: React.CSSProperties = { background: 'rgba(12,13,16,0.7)', border: `1px solid ${C.line}`, color: C.cream };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6" style={{ background: C.bg }}>

      {/* ── Cinematic background ── */}
      <div aria-hidden style={{ position: 'absolute', top: -360, left: '50%', transform: 'translateX(-50%)', width: 1500, height: 1100, pointerEvents: 'none',
        background: 'radial-gradient(circle at center, rgba(198,164,99,0.20), rgba(198,164,99,0.05) 45%, transparent 70%)' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: -260, right: -120, width: 1000, height: 800, pointerEvents: 'none',
        background: 'radial-gradient(circle at center, rgba(94,131,168,0.12), transparent 70%)' }} />
      {/* letterbox hairlines + corner labels */}
      <div aria-hidden className="hidden md:block" style={{ position: 'absolute', left: 0, right: 0, top: 70, height: 1, background: 'rgba(198,164,99,0.18)', pointerEvents: 'none' }} />
      <div aria-hidden className="hidden md:block" style={{ position: 'absolute', left: 0, right: 0, bottom: 70, height: 1, background: 'rgba(198,164,99,0.18)', pointerEvents: 'none' }} />
      <span className="hidden md:block" style={{ position: 'absolute', top: 40, left: 56, color: '#6f654f', fontWeight: 700, fontSize: 11, letterSpacing: '4px' }}>THE FILM MAKERS · PRODUCTION OS</span>
      <span className="hidden md:block" style={{ position: 'absolute', top: 40, right: 56, color: '#6f654f', fontWeight: 700, fontSize: 11, letterSpacing: '4px' }}>SECURE SIGN-IN</span>

      {/* ── Frosted glass card ── */}
      <div className="relative w-full flex flex-col items-center"
        style={{
          maxWidth: 424, padding: '44px 42px 40px', borderRadius: 22,
          background: 'rgba(21,24,29,0.62)', border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          boxShadow: '0 30px 60px -10px rgba(0,0,0,0.55)',
        }}>

        {/* logo */}
        <div className="flex items-center justify-center" style={{ width: 54, height: 54, borderRadius: 15, background: goldGrad, marginBottom: 16 }}>
          <span style={{ color: '#15120B', fontWeight: 900, fontSize: 17, letterSpacing: '-1.5px' }}>TFM</span>
        </div>
        <p style={{ color: C.label, fontWeight: 700, fontSize: 11, letterSpacing: '4px', marginBottom: 12 }}>WELCOME BACK</p>
        <h2 style={{ color: C.cream, fontWeight: 900, fontSize: 27, letterSpacing: '-1px', margin: 0, textAlign: 'center' }}>Sign in to TFM</h2>
        <p style={{ color: C.mute, fontSize: 13.5, marginTop: 6, marginBottom: 22, textAlign: 'center' }}>Your production workspace — brief to wrap.</p>

        {error && (
          <div className="w-full mb-4 px-4 py-3 rounded-lg text-sm"
            style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4">

          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold uppercase mb-1.5" style={{ color: C.label, letterSpacing: '1.5px' }}>Email</label>
            <input
              type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              placeholder="you@thefilmmakers.com" value={email} onChange={e => setEmail(e.target.value.replace(/\s/g, ''))} required autoFocus
              className="w-full h-11 px-3.5 text-sm rounded-[11px] outline-none transition-all" style={inputStyle}
              onFocus={e => focusOn(e.currentTarget)} onBlur={e => focusOff(e.currentTarget)}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-semibold uppercase mb-1.5" style={{ color: C.label, letterSpacing: '1.5px' }}>Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} placeholder="••••••••••" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full h-11 px-3.5 pe-11 text-sm rounded-[11px] outline-none transition-all" style={inputStyle}
                onFocus={e => focusOn(e.currentTarget)} onBlur={e => focusOff(e.currentTarget)}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                className="absolute end-3.5 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#4a4d50' }}
                onMouseEnter={e => (e.currentTarget.style.color = C.gold)} onMouseLeave={e => (e.currentTarget.style.color = '#4a4d50')}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Two-factor code (second step) */}
          {needs2FA && (
            <div>
              <label className="block text-[11px] font-semibold uppercase mb-1.5" style={{ color: C.label, letterSpacing: '1.5px' }}>
                {useRecovery ? 'Recovery code' : 'Authenticator code'}
              </label>
              <input
                type="text" inputMode={useRecovery ? 'text' : 'numeric'} maxLength={useRecovery ? 11 : 6} autoFocus
                placeholder={useRecovery ? 'XXXXX-XXXXX' : '——————'} value={totpCode}
                onChange={e => setTotpCode(useRecovery
                  ? e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11)
                  : e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full h-11 px-3 text-sm text-center tracking-[0.3em] font-mono rounded-[11px] outline-none transition-all" style={inputStyle}
                onFocus={e => focusOn(e.currentTarget)} onBlur={e => focusOff(e.currentTarget)}
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[11px]" style={{ color: C.mute }}>
                  {useRecovery ? 'Enter one of your saved recovery codes.' : 'Enter the 6-digit code from your authenticator app.'}
                </p>
                <button type="button" onClick={() => { setUseRecovery(v => !v); setTotpCode(''); }}
                  className="text-[11px] underline" style={{ color: C.gold }}>
                  {useRecovery ? 'Use authenticator' : 'Use a recovery code'}
                </button>
              </div>
            </div>
          )}

          {/* Remember me */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none pt-0.5">
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: C.gold }} />
            <span className="text-sm" style={{ color: '#8a9096' }}>Remember my email</span>
          </label>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full h-12 rounded-[11px] text-sm font-bold tracking-wide transition-all mt-1 disabled:opacity-50"
            style={{ background: goldGrad, color: '#15120B', boxShadow: '0 8px 24px rgba(198,164,99,0.28)' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.filter = 'brightness(1.06)'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.filter = 'none'; }}>
            {loading ? 'Signing in…' : needs2FA ? 'Verify & continue' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs mt-6" style={{ color: '#4a4f55', letterSpacing: '1px' }}>Confidential · The Film Makers FZ LLC</p>
      </div>
    </div>
  );
}
