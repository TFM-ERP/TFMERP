'use client';

/**
 * SYS-UX Phase 0 — Settings · Appearance + Admin · Theme policy (NEW route /appearance).
 * Wired to preferencesApi (/me/preferences, /org/theme-policy) with graceful fallback to
 * defaults if the backend isn't running the preferences module yet. The live preview is
 * SCOPED to a container (data-theme on a wrapper) — it does NOT re-theme the rest of the
 * app, so untokenized pages are untouched until the Phase 2 flip.
 */
import { useEffect, useState } from 'react';
import {
  THEMES, resolveTheme, canUseTheme, DEFAULT_PREF, DEFAULT_POLICY,
  type ThemeId, type Density, type PolicyMode, type UserPreference, type OrgThemePolicy,
} from '@/lib/theme';
import { preferencesApi } from '@/lib/api';
import { getLocale, setLocale, LOCALES, type Locale } from '@/lib/i18n';
import '@/styles/tokens.css';

export default function AppearancePage() {
  const [view, setView] = useState<'user' | 'admin'>('user');
  const [pref, setPref] = useState<UserPreference>(DEFAULT_PREF);
  const [policy, setPolicy] = useState<OrgThemePolicy>(DEFAULT_POLICY);
  const [saving, setSaving] = useState('');
  const [locale, setLoc] = useState<Locale>('en');

  useEffect(() => {
    let alive = true;
    Promise.allSettled([preferencesApi.me(), preferencesApi.policy()]).then(([mp, pp]) => {
      if (!alive) return;
      if (mp.status === 'fulfilled' && mp.value) {
        const v: any = mp.value;
        setPref({
          themeId: (v.themeId ?? 'graphite') as ThemeId,
          readingMode: v.readingMode ?? true,
          highContrast: v.highContrast ?? false,
          density: (v.density ?? 'comfortable') as Density,
        });
        if (v.locale === 'en' || v.locale === 'ar') { setLoc(v.locale); setLocale(v.locale); }
      }
      if (pp.status === 'fulfilled' && pp.value) {
        const v: any = pp.value;
        setPolicy({
          mode: (v.mode ?? 'restricted') as PolicyMode,
          allowedThemeIds: (v.allowedThemeIds ?? ['graphite', 'studio', 'ink']) as ThemeId[],
          forcedThemeId: (v.forcedThemeId ?? null) as ThemeId | null,
          defaultThemeId: (v.defaultThemeId ?? 'graphite') as ThemeId,
        });
      }
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => { setLoc(getLocale()); }, []);

  const flash = (m: string) => { setSaving(m); window.setTimeout(() => setSaving(''), 1600); };
  const savePref = (next: UserPreference) => { preferencesApi.setMe(next).then(() => flash('Saved')).catch(() => flash('Saved locally')); };
  const savePolicy = (next: OrgThemePolicy) => { preferencesApi.setPolicy(next).then(() => flash('Policy saved')).catch(() => flash('Admin only — not saved')); };

  const applyGlobalTheme = (id: ThemeId) => {
    if (typeof document === 'undefined') return;
    const map: Record<string, string> = { studio: 'light', graphite: 'graphite', ink: 'ink', slate: 'slate', aurora: 'aurora', midnight: 'midnight' };
    const t = map[id] || 'light';
    try { localStorage.setItem('tfm_theme', t); } catch { /* ignore */ }
    const el = document.documentElement;
    const DARK = ['dark', 'graphite', 'slate', 'aurora', 'midnight'];
    const PAL = ['ink', 'slate', 'aurora', 'midnight'];
    el.classList.toggle('dark', DARK.includes(t)); el.classList.remove('daylight');
    if (PAL.includes(t)) el.setAttribute('data-theme', t); else el.removeAttribute('data-theme');
  };
  const patchPref = (p: Partial<UserPreference>) => { const next = { ...pref, ...p }; setPref(next); savePref(next); if (p.themeId) applyGlobalTheme(p.themeId); };
  const patchPolicy = (p: Partial<OrgThemePolicy>) => { const next = { ...policy, ...p }; setPolicy(next); savePolicy(next); };
  const patchLocale = (l: Locale) => { setLoc(l); setLocale(l); preferencesApi.setMe({ locale: l } as any).then(() => flash('Saved')).catch(() => {}); };

  const effective = resolveTheme(policy, pref);
  const previewTheme: ThemeId = pref.readingMode ? 'ink' : effective;

  const policyText = () =>
    policy.mode === 'forced'
      ? `Locked to ${THEMES.find((t) => t.id === policy.forcedThemeId)?.name ?? '—'} by your studio. Reading mode stays available.`
      : policy.mode === 'restricted'
        ? `Your studio allows ${policy.allowedThemeIds.length} themes — pick any below.`
        : 'Open — choose any theme.';

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>Appearance</h1>
        {saving && <span style={{ fontSize: 12, color: '#1F9D63', fontWeight: 700 }}>✓ {saving}</span>}
      </div>
      <p style={{ color: '#667', fontSize: 13, marginBottom: 16 }}>Choose how TFM looks for you. Admins can set a studio-wide policy. Changes preview live below.</p>

      <div style={{ display: 'inline-flex', gap: 4, background: '#f1f3f7', border: '1px solid #e6e9ef', padding: 4, borderRadius: 999, marginBottom: 20 }}>
        {(['user', 'admin'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, padding: '7px 15px', borderRadius: 999, background: view === v ? '#5B5BD6' : 'transparent', color: view === v ? '#fff' : '#48536a' }}>
            {v === 'user' ? '👤 My appearance' : '🛡 Theme policy (admin)'}
          </button>
        ))}
      </div>

      {view === 'user' ? (
        <div>
          <div style={{ fontSize: 12.5, color: '#667', background: '#f7f8fa', border: '1px solid #e6e9ef', borderRadius: 9, padding: '9px 13px', marginBottom: 16 }}>🛈 {policyText()}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 11 }}>
            {THEMES.map((t) => {
              const lock = !canUseTheme(policy, t.id);
              const sel = effective === t.id && !pref.readingMode;
              return (
                <button key={t.id} disabled={lock} onClick={() => patchPref({ themeId: t.id, readingMode: false })}
                  style={{ textAlign: 'start', border: `1.5px solid ${sel ? '#5B5BD6' : '#e6e9ef'}`, borderRadius: 12, padding: 11, background: '#fff', cursor: lock ? 'not-allowed' : 'pointer', opacity: lock ? 0.45 : 1, position: 'relative' }}>
                  <div data-theme={t.id} style={{ height: 50, borderRadius: 8, marginBottom: 9, background: 'var(--surface-1)', border: '1px solid var(--border-1)', display: 'flex', alignItems: 'flex-end', gap: 4, padding: 7 }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--accent)' }} />
                    <span style={{ flex: 1, height: 8, borderRadius: 3, background: 'var(--accent)', opacity: 0.35, alignSelf: 'center' }} />
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t.name} {sel && <span style={{ color: '#5B5BD6' }}>✓</span>}{lock && ' 🔒'}</div>
                  <div style={{ fontSize: 10, color: '#8a93a6' }}>{t.mode} mode</div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Toggle label="Reading mode (Ink & Paper)" hint="Script/reader surfaces use the paper look." on={pref.readingMode} onClick={() => patchPref({ readingMode: !pref.readingMode })} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <div style={{ flex: 1 }}><b>Density</b><div style={{ fontSize: 11, color: '#8a93a6' }}>Comfortable for touch, Compact for data-heavy days.</div></div>
              <Seg value={pref.density} options={['comfortable', 'compact']} onPick={(d) => patchPref({ density: d as Density })} />
            </div>
            <Toggle label="High contrast (AAA)" hint="Boost contrast for night shoots & accessibility." on={pref.highContrast} onClick={() => patchPref({ highContrast: !pref.highContrast })} />
            <div style={{ borderTop: '1px solid #e6e9ef', marginTop: 4, paddingTop: 14, display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <div style={{ flex: 1 }}><b>Language &amp; layout</b><div style={{ fontSize: 11, color: '#8a93a6' }}>العربية switches the whole app to right-to-left with an Arabic typeface. English stays left-to-right.</div></div>
              <div style={{ display: 'inline-flex', gap: 3, background: '#f1f3f7', border: '1px solid #e6e9ef', padding: 3, borderRadius: 999 }}>
                {LOCALES.map((l) => (
                  <button key={l.id} onClick={() => patchLocale(l.id)} style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '6px 13px', borderRadius: 999, background: locale === l.id ? '#5B5BD6' : 'transparent', color: locale === l.id ? '#fff' : '#48536a' }}>
                    {l.native}{l.id === 'ar' ? ' · RTL' : ' · LTR'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 11, marginBottom: 8 }}>
            {([['open', '🌐 Open', 'Anyone picks any theme.'], ['restricted', '🎚 Restricted', 'Curate a subset; users pick within it.'], ['forced', '🔒 Forced', 'One theme locked studio-wide.']] as const).map(([id, t, d]) => (
              <button key={id} onClick={() => patchPolicy({ mode: id as PolicyMode })} style={{ textAlign: 'start', border: `1.5px solid ${policy.mode === id ? '#5B5BD6' : '#e6e9ef'}`, background: policy.mode === id ? '#ECECFB' : '#fff', borderRadius: 12, padding: 13, cursor: 'pointer' }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{t}</div><div style={{ fontSize: 11, color: '#667', marginTop: 5 }}>{d}</div>
              </button>
            ))}
          </div>
          {policy.mode === 'restricted' && (
            <div style={{ background: '#f7f8fa', border: '1px solid #e6e9ef', borderRadius: 10, padding: 13, marginTop: 12 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#8a93a6', fontWeight: 700, marginBottom: 10 }}>Allowed themes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {THEMES.map((t) => {
                  const on = policy.allowedThemeIds.includes(t.id);
                  return <button key={t.id} onClick={() => { const a = on ? policy.allowedThemeIds.filter((x) => x !== t.id) : [...policy.allowedThemeIds, t.id]; patchPolicy({ allowedThemeIds: (a.length ? a : [t.id]) as ThemeId[] }); }}
                    style={{ fontSize: 12, fontWeight: 600, padding: '6px 11px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${on ? '#5B5BD6' : '#d3d9e3'}`, background: on ? '#ECECFB' : '#fff', color: on ? '#16202e' : '#48536a' }}>{on ? '✓ ' : ''}{t.name}</button>;
                })}
              </div>
            </div>
          )}
          {policy.mode === 'forced' && (
            <div style={{ background: '#f7f8fa', border: '1px solid #e6e9ef', borderRadius: 10, padding: 13, marginTop: 12 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#8a93a6', fontWeight: 700, marginBottom: 10 }}>Locked theme for everyone</div>
              <select value={policy.forcedThemeId ?? 'graphite'} onChange={(e) => patchPolicy({ forcedThemeId: e.target.value as ThemeId })} style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1px solid #d3d9e3' }}>
                {THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ background: '#f7f8fa', border: '1px solid #e6e9ef', borderRadius: 10, padding: 13, marginTop: 12 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#8a93a6', fontWeight: 700, marginBottom: 10 }}>Default theme for new users</div>
            <select value={policy.defaultThemeId} onChange={(e) => patchPolicy({ defaultThemeId: e.target.value as ThemeId })} style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1px solid #d3d9e3' }}>
              {THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* live preview — scoped, does not affect the rest of the app */}
      <div style={{ marginTop: 24, borderTop: '1px solid #e6e9ef', paddingTop: 16 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a93a6', fontWeight: 700, marginBottom: 10 }}>Live preview</div>
        <div data-theme={previewTheme} data-contrast={pref.highContrast ? 'aaa' : 'no'} data-density={pref.density}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, background: 'var(--surface-0)', padding: 14, borderRadius: 12, border: '1px solid var(--border-1)' }}>
          <PvCard title="Dashboard"><div style={{ display: 'flex', gap: 6, marginBottom: 8 }}><Stat k="Crew" v="06:30" /><Stat k="Scenes" v="7" /></div><Row n="24" t="Field Hospital" /><Row n="25" t="Dune Ridge" /></PvCard>
          <PvCard title="Script"><div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, lineHeight: 1.5, color: 'var(--text-1)' }}><div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>INT. FIELD HOSPITAL — NIGHT</div>Rain hammers the canvas.<div style={{ textAlign: 'center', fontWeight: 700, marginTop: 5 }}>NADIA</div><div style={{ padding: '0 14%' }}>Stay with me.</div></div></PvCard>
          <PvCard title="Call Sheet"><div style={{ display: 'flex', gap: 6, marginBottom: 8 }}><Stat k="Shoot" v="08:00" /><Stat k="Wrap" v="19:00" /></div><div style={{ fontSize: 10.5, color: 'var(--text-2)' }}>⛅ 31° · 🌅 05:42</div><div style={{ fontSize: 10.5, color: 'var(--warn)', marginTop: 4 }}>Rain rig — Sc.24</div></PvCard>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, hint, on, onClick }: { label: string; hint: string; on: boolean; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
      <div style={{ flex: 1 }}><b>{label}</b><div style={{ fontSize: 11, color: '#8a93a6' }}>{hint}</div></div>
      <button onClick={onClick} style={{ width: 42, height: 24, borderRadius: 999, border: '1px solid #d3d9e3', background: on ? '#5B5BD6' : '#e8ebf0', position: 'relative', cursor: 'pointer' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 21 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </button>
    </div>
  );
}
function Seg({ value, options, onPick }: { value: string; options: string[]; onPick: (v: string) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 3, background: '#f1f3f7', border: '1px solid #e6e9ef', padding: 3, borderRadius: 999 }}>
      {options.map((o) => <button key={o} onClick={() => onPick(o)} style={{ border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '5px 11px', borderRadius: 999, background: value === o ? '#5B5BD6' : 'transparent', color: value === o ? '#fff' : '#8a93a6', textTransform: 'capitalize' }}>{o}</button>)}
    </div>
  );
}
function PvCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border-1)', borderRadius: 11, overflow: 'hidden', background: 'var(--bg, var(--surface-0))' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', padding: '7px 10px', borderBottom: '1px solid var(--border-1)', textTransform: 'uppercase', letterSpacing: '.04em', background: 'var(--surface-1)' }}>{title}</div>
      <div style={{ padding: 10 }}>{children}</div>
    </div>
  );
}
function Stat({ k, v }: { k: string; v: string }) {
  return <div style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border-1)', borderRadius: 8, padding: 6 }}><div style={{ fontSize: 7.5, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700 }}>{k}</div><div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>{v}</div></div>;
}
function Row({ n, t }: { n: string; t: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}><span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 11, width: 18 }}>{n}</span><span style={{ fontSize: 10.5, color: 'var(--text-2)' }}>{t}</span></div>;
}
