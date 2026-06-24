'use client';

/**
 * SYS-UX Phase 3 — RTL / Arabic preview (NEW route /rtl-preview).
 * Proves the shell mirrors for Arabic: dir="rtl" + logical CSS properties (inline-start/end)
 * so the rail, toolbar and content flip without per-pixel rework. Toggle LTR/RTL to compare.
 * Foundation note: components adopt logical properties as they migrate; this demonstrates the target.
 */
import { useEffect, useState } from 'react';
import '@/styles/tokens.css';

const NAV = [
  { en: 'Dashboard', ar: 'لوحة القيادة', icon: '▦' },
  { en: 'Scheduling', ar: 'الجدول', icon: '🗓' },
  { en: 'Script', ar: 'السيناريو', icon: '📄' },
  { en: 'Casting', ar: 'اختيار الممثلين', icon: '🎭' },
  { en: 'Locations', ar: 'المواقع', icon: '📍' },
  { en: 'Transport', ar: 'النقل', icon: '🚐' },
  { en: 'Finance', ar: 'المالية', icon: '💷' },
];

export default function RtlPreview() {
  const [dir, setDir] = useState<'rtl' | 'ltr'>('rtl');
  const ar = dir === 'rtl';
  const t = (en: string, arabic: string) => (ar ? arabic : en);

  useEffect(() => {
    const id = 'tfm-ar-font';
    if (!document.getElementById(id)) {
      const l = document.createElement('link');
      l.id = id; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;800&display=swap';
      document.head.appendChild(l);
    }
  }, []);

  const fontFamily = ar ? "'Noto Sans Arabic','Tahoma','Segoe UI',sans-serif" : 'var(--font-sans)';

  return (
    <div style={{ padding: 18, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>RTL / Arabic preview</h1>
      <p style={{ color: '#667', fontSize: 13, margin: '5px 0 14px', maxWidth: 620 }}>The same shell, mirrored for Arabic with <code>dir=&quot;rtl&quot;</code> + logical CSS (inline-start/end). Rail moves to the right, the toolbar and content flow right-to-left — no per-pixel rework. Toggle to compare.</p>

      <div style={{ display: 'inline-flex', gap: 4, background: '#f1f3f7', border: '1px solid #e6e9ef', padding: 4, borderRadius: 999, marginBottom: 14 }}>
        {(['rtl', 'ltr'] as const).map((d) => (
          <button key={d} onClick={() => setDir(d)} style={{ border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '7px 16px', borderRadius: 999, background: dir === d ? '#5B5BD6' : 'transparent', color: dir === d ? '#fff' : '#48536a' }}>
            {d === 'rtl' ? 'العربية · RTL' : 'English · LTR'}
          </button>
        ))}
      </div>

      {/* mirrored frame */}
      <div data-theme="graphite" dir={dir} lang={ar ? 'ar' : 'en'}
        style={{ height: 520, border: '1px solid var(--border-1)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface-0)', color: 'var(--text-1)', fontFamily, display: 'flex', flexDirection: 'column', boxShadow: '0 16px 40px rgba(0,0,0,.3)' }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border-1)', background: 'var(--surface-1)' }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, background: 'var(--accent)', color: 'var(--accent-on)' }}>T</span>
          <span style={{ fontWeight: 800, fontSize: 14 }}>TFM</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('Desert Crossing', 'عبور الصحراء')}</span>
          <span style={{ width: 30, height: 30, borderRadius: 99, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>ق</span>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* rail — borderInlineEnd is the divider on the correct side in both dirs */}
          <aside style={{ width: 210, flexShrink: 0, borderInlineEnd: '1px solid var(--border-1)', background: 'var(--surface-1)', padding: '12px 10px', overflow: 'auto' }}>
            {NAV.map((n, i) => (
              <div key={n.en} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 8, marginBottom: 2, fontSize: 13, fontWeight: i === 0 ? 700 : 500, background: i === 0 ? 'var(--accent-soft)' : 'transparent', color: i === 0 ? 'var(--accent)' : 'var(--text-2)' }}>
                <span style={{ fontSize: 15 }}>{n.icon}</span>
                <span style={{ flex: 1, textAlign: 'start' }}>{t(n.en, n.ar)}</span>
              </div>
            ))}
          </aside>
          {/* content */}
          <main style={{ flex: 1, padding: 22, overflow: 'auto' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('Productions / Desert Crossing / Dashboard', 'الإنتاجات / عبور الصحراء / لوحة القيادة')}</div>
            <h2 style={{ fontSize: 23, fontWeight: 800, margin: '4px 0 16px', textAlign: 'start' }}>{t('Production Dashboard', 'لوحة الإنتاج')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
              {[[t('Crew call', 'نداء الطاقم'), '06:30'], [t('Shoot', 'التصوير'), '08:00'], [t('Scenes', 'المشاهد'), '7'], [t('Budget', 'الميزانية'), '61%']].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-1)', borderRadius: 12, padding: 13, textAlign: 'start' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.04em' }}>{k}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 5 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ border: '1px solid var(--border-1)', borderRadius: 12, padding: 14, color: 'var(--text-2)', fontSize: 13, textAlign: 'start' }}>
              {t('Notice the rail is now on the right, numbers stay LTR, and text aligns to the start edge — all from dir="rtl" + logical properties.',
                 'لاحظ أن الشريط الجانبي أصبح على اليمين، وتبقى الأرقام بالاتجاه اللاتيني، ويُحاذى النص إلى الحافة الابتدائية — كل ذلك من dir="rtl" والخصائص المنطقية.')}
            </div>
          </main>
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#667', marginTop: 12 }}>Foundation: build with <b>logical properties</b> (margin/padding/border <i>inline-start/end</i>, <code>text-align:start</code>) and the whole system mirrors from one <code>dir</code> attribute. Numbers and Latin script (Courier scripts) stay LTR inside RTL pages automatically.</p>
    </div>
  );
}
