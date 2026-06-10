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
      const res = await api.post('/auth/login', { email, password, totpCode: totpCode || undefined });
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

  return (
    <div className="min-h-screen flex" style={{ background: '#1e2022' }}>

      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-12"
        style={{ background: '#2B2E31', borderRight: '1px solid #3D4045' }}>
        <div>
          <img src="/tfm-logo.svg" alt="The Film Makers" className="h-12 w-auto brightness-0 invert opacity-90" />
        </div>
        <div>
          <p className="text-4xl font-black leading-tight" style={{ color: '#e0d5c5' }}>
            Enterprise<br />Resource<br />Planning
          </p>
          <div className="mt-6 h-0.5 w-12 rounded-full" style={{ background: '#0f172a' }} />
          <p className="mt-4 text-sm leading-relaxed" style={{ color: '#737679' }}>
            Fleet management · Production · Finance<br />
            Maintenance · Procurement · Reporting
          </p>
        </div>
        <p className="text-xs" style={{ color: '#4a4d50' }}>
          The Film Makers FZ LLC · Dubai, UAE
        </p>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <img src="/tfm-logo.svg" alt="TFM" className="h-10 w-auto brightness-0 invert opacity-90 mx-auto mb-3" />
          </div>

          {/* Card */}
          <div className="rounded-xl p-8" style={{ background: '#2B2E31', border: '1px solid #3D4045' }}>

            <h2 className="text-lg font-bold mb-1" style={{ color: '#e0d5c5' }}>Sign in</h2>
            <p className="text-sm mb-7" style={{ color: '#737679' }}>Access your TFM ERP dashboard</p>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-lg text-sm"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: '#8a7355' }}>
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="you@thefilmmakers.ae"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required autoFocus
                  className="w-full h-9 px-3 text-sm rounded-md outline-none transition-all"
                  style={{
                    background: '#1e2022',
                    border: '1px solid #3D4045',
                    color: '#e0d5c5',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#0f172a'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(195,165,110,.15)'; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#3D4045'; e.currentTarget.style.boxShadow = ''; }}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: '#8a7355' }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full h-9 px-3 pr-10 text-sm rounded-md outline-none transition-all"
                    style={{
                      background: '#1e2022',
                      border: '1px solid #3D4045',
                      color: '#e0d5c5',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#0f172a'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(195,165,110,.15)'; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = '#3D4045'; e.currentTarget.style.boxShadow = ''; }}
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#4a4d50' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#0f172a')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#4a4d50')}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Two-factor code (second step) */}
              {needs2FA && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8a7355' }}>
                    {useRecovery ? 'Recovery code' : 'Authenticator code'}
                  </label>
                  <input
                    type="text" inputMode={useRecovery ? 'text' : 'numeric'} maxLength={useRecovery ? 11 : 6} autoFocus
                    placeholder={useRecovery ? 'XXXXX-XXXXX' : '——————'}
                    value={totpCode}
                    onChange={e => setTotpCode(useRecovery
                      ? e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11)
                      : e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full h-9 px-3 text-sm text-center tracking-[0.3em] font-mono rounded-md outline-none transition-all"
                    style={{ background: '#1e2022', border: '1px solid #3D4045', color: '#e0d5c5' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#0f172a'; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = '#3D4045'; }}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[11px]" style={{ color: '#737679' }}>
                      {useRecovery ? 'Enter one of your saved recovery codes.' : 'Enter the 6-digit code from your authenticator app.'}
                    </p>
                    <button type="button" onClick={() => { setUseRecovery(v => !v); setTotpCode(''); }}
                      className="text-[11px] underline" style={{ color: '#8a7355' }}>
                      {useRecovery ? 'Use authenticator' : 'Use a recovery code'}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember me */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#0f172a' }}
                />
                <span className="text-sm" style={{ color: '#737679' }}>Remember my email</span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-9 rounded-md text-sm font-semibold transition-all mt-2 disabled:opacity-50"
                style={{ background: '#0f172a', color: '#1e2022' }}
                onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = '#b8954a'); }}
                onMouseLeave={e => { if (!loading) (e.currentTarget.style.background = '#0f172a'); }}
              >
                {loading ? 'Signing in…' : needs2FA ? 'Verify & continue' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: '#3D4045' }}>
            TFM ERP v1.0 · Confidential
          </p>
        </div>
      </div>
    </div>
  );
}
