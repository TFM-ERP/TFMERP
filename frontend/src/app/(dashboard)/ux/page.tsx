'use client';

/**
 * SYS-UX — launcher hub (NEW route /ux). One front door to the whole revamp layer
 * (Phases 0–3), so you can walk every new workspace/feature without typing URLs.
 * Additive; links to the parallel routes — your live app is unchanged.
 */
import Link from 'next/link';
import '@/styles/tokens.css';

type Item = { href: string; name: string; sub: string };
type Group = { phase: string; title: string; items: Item[] };

const GROUPS: Group[] = [
  { phase: '0', title: 'Foundation', items: [
    { href: '/appearance', name: 'Appearance & theme', sub: 'User picker + admin policy + live preview' },
  ] },
  { phase: '1', title: 'Navigation', items: [
    { href: '/nav-preview', name: 'Collapsible rail', sub: 'Grouped icon rail · collapse + theme toggles' },
  ] },
  { phase: '2', title: 'Module workspaces', items: [
    { href: '/script-workspace', name: 'Script', sub: 'Reader / Pages / Audio · Ink · full-screen' },
    { href: '/scheduling-workspace', name: 'Scheduling', sub: 'Stripboard + Cast DOOD' },
    { href: '/casting-workspace', name: 'Casting', sub: 'Talent grid + profile panel' },
    { href: '/locations-workspace', name: 'Locations', sub: 'Recce gallery + map + detail' },
    { href: '/finance-workspace', name: 'Finance', sub: 'Budget vs actual cost report' },
    { href: '/contracts-workspace', name: 'Contracts', sub: 'List + e-sign document' },
  ] },
  { phase: '3', title: 'Features', items: [
    { href: '/command-palette', name: '⌘K command palette', sub: 'Jump to any module / action' },
    { href: '/notifications-feed', name: 'Notifications feed', sub: 'Events → one tap to the screen' },
    { href: '/saved-views-demo', name: 'Saved views', sub: 'Per-user table filters/sorts' },
    { href: '/rtl-preview', name: 'RTL / Arabic', sub: 'Mirrored shell · logical properties' },
  ] },
];

export default function UxHub() {
  return (
    <div data-theme="graphite" style={{ minHeight: 'calc(100vh - 90px)', borderRadius: 12, border: '1px solid var(--border-1)', background: 'var(--surface-0)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)', padding: '26px 24px 40px' }}>
      <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700 }}>TFM · UX revamp layer</div>
      <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-.02em', margin: '5px 0 4px' }}>The new system, ready to walk</h1>
      <p style={{ color: 'var(--text-3)', fontSize: 14, maxWidth: 620, marginBottom: 8 }}>Every screen below is a new parallel route on the shared tokens + Workspace shell. Your existing app is untouched — these are the switch-on-when-ready next-gen surfaces.</p>

      {GROUPS.map((g) => (
        <div key={g.phase} style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent)', color: 'var(--accent-on)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800 }}>{g.phase}</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{g.title}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border-1)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px,1fr))', gap: 12 }}>
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} style={{ textDecoration: 'none', border: '1px solid var(--border-1)', borderRadius: 12, background: 'var(--surface-1)', padding: '14px 15px', display: 'block', transition: 'border-color .15s' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>{it.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{it.sub}</div>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 9, fontWeight: 700 }}>{it.href} →</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
