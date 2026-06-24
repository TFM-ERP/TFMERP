'use client';

/**
 * SYS-UX Phase 3 — ⌘K command palette DEMO (NEW route /command-palette).
 * Try the palette here (press ⌘K / Ctrl-K, or click the bar). App-wide mount is the
 * optional flag-flip in layout.tsx — this proves the component standalone.
 */
import { useState } from 'react';
import CommandPalette, { type CmdItem } from '@/components/workspace/CommandPalette';
import '@/styles/tokens.css';

const ITEMS: CmdItem[] = [
  { label: 'Dashboard', group: 'Workspace', href: '/home' },
  { label: 'Production · Projects', group: 'Workspace', href: '/production/projects' },
  { label: 'Script Workspace', group: 'Workspace', href: '/script-workspace' },
  { label: 'Comms · Channels', group: 'Workspace', href: '/comms' },
  { label: 'Scheduling · Stripboard', group: 'Creative', href: '/scheduling-workspace' },
  { label: 'Casting · Talent', group: 'Creative', href: '/casting-workspace' },
  { label: 'Locations · Library', group: 'Creative', href: '/locations' },
  { label: 'Contracts', group: 'Creative', href: '/contracts' },
  { label: 'HR · Employees', group: 'People', href: '/hr/employees' },
  { label: 'Travel & Visas', group: 'People', href: '/travel' },
  { label: 'Transport · Dispatch', group: 'Logistics', href: '/dispatch' },
  { label: 'Rentals · Bookings', group: 'Logistics', href: '/rental/bookings' },
  { label: 'Finance · Invoices', group: 'Money', href: '/finance/invoices' },
  { label: 'Finance · Payments', group: 'Money', href: '/finance/payments' },
  { label: 'Reports Center', group: 'Insights', href: '/reports' },
  { label: 'Appearance & theme', group: 'Settings', href: '/appearance' },
  { label: 'Users & roles', group: 'Admin', href: '/setup/roles' },
  { label: 'New call sheet', group: 'Action', hint: 'create', href: '/production/dashboard' },
];

export default function CommandPaletteDemo() {
  const [sig, setSig] = useState(0);
  return (
    <div data-theme="graphite" style={{ minHeight: 'calc(100vh - 90px)', borderRadius: 12, border: '1px solid var(--border-1)', background: 'var(--surface-0)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 }}>
      <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700 }}>Phase 3 · Command palette</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', textAlign: 'center' }}>Jump anywhere in two keystrokes</h1>
      <p style={{ color: 'var(--text-3)', fontSize: 14, textAlign: 'center', maxWidth: 460 }}>Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> (or <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>), or click below. Type to filter modules, pages and actions — ↑↓ to move, ↵ to go.</p>
      <button onClick={() => setSig((s) => s + 1)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'min(440px, 90vw)', padding: '12px 16px', borderRadius: 12, cursor: 'pointer', background: 'var(--surface-1)', border: '1px solid var(--border-2)', color: 'var(--text-3)', fontSize: 14 }}>
        🔎 <span style={{ flex: 1, textAlign: 'start' }}>Search or jump to…</span>
        <span style={{ fontSize: 11, border: '1px solid var(--border-2)', borderRadius: 6, padding: '2px 7px' }}>⌘K</span>
      </button>
      <CommandPalette items={ITEMS} openSignal={sig} />
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 5, padding: '2px 7px', margin: '0 1px' }}>{children}</span>;
}
