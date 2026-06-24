'use client';

/**
 * SYS-UX Phase 3 — notifications feed DEMO (NEW route /notifications-feed).
 * Shows the bell in a faux top bar; click it for the dropdown. App-wide mount (in the real
 * top bar) is the optional flag-flip — this proves the component standalone.
 */
import NotificationsFeed from '@/components/workspace/NotificationsFeed';
import '@/styles/tokens.css';

export default function NotificationsFeedDemo() {
  return (
    <div data-theme="graphite" style={{ minHeight: 'calc(100vh - 90px)', borderRadius: 12, border: '1px solid var(--border-1)', background: 'var(--surface-0)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)', overflow: 'hidden' }}>
      {/* faux top bar with the bell on the right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border-1)', background: 'var(--surface-1)' }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, background: 'var(--accent)', color: 'var(--accent-on)' }}>T</span>
        <span style={{ fontWeight: 800, fontSize: 14 }}>TFM</span>
        <span style={{ flex: 1 }} />
        <NotificationsFeed />
        <span style={{ width: 30, height: 30, borderRadius: 99, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, border: '1px solid var(--border-2)' }}>QQ</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700 }}>Phase 3 · Notifications feed</div>
        <h1 style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-.02em' }}>The system tells you — you don’t go checking</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 14, maxWidth: 480 }}>Click the 🔔 in the top bar. Call sheet published, weather hold, contract signed, run wrapped — each is a tap straight to the right screen. Unread are highlighted; “Mark all read” clears the badge.</p>
        <p style={{ color: 'var(--text-3)', fontSize: 12 }}>Wired to <code style={{ fontFamily: 'var(--font-mono)' }}>/me/notifications</code> · sample data until the backend is up.</p>
      </div>
    </div>
  );
}
