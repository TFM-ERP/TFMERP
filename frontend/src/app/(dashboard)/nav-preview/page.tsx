'use client';

/**
 * SYS-UX Phase 1 — PREVIEW of the collapsible grouped rail (NEW route /nav-preview).
 * Renders GroupedRail with a model mirroring the real dashboard nav (parity), plus
 * collapse + theme toggles. Standalone — does NOT touch the live layout/sidebar.
 */
import { useState } from 'react';
import GroupedRail, { type RailGroup } from '@/components/workspace/GroupedRail';
import type { ThemeId } from '@/lib/theme';
import {
  Home, Film, ScrollText, MessageSquare, Clapperboard, MapPin, FileSignature,
  Users, Plane, Building2, BedDouble, Car, Truck, Wrench, DollarSign, ShieldCheck,
  Target, BarChart2, Settings,
} from 'lucide-react';
import '@/styles/tokens.css';

// Mirrors the live MODULES/GROUPS (parity). When wired into layout.tsx the rail reuses the real data.
const GROUPS: RailGroup[] = [
  { caption: 'Workspace', modules: [
    { key: 'home', label: 'Home', icon: Home, pages: [{ label: 'Dashboard', href: '/home' }, { label: 'Executive', href: '/executive' }, { label: 'Workflow & KPIs', href: '/workflow' }] },
    { key: 'production', label: 'Production', icon: Film, pages: [{ label: 'Dashboard', href: '/production/dashboard' }, { label: 'Projects', href: '/production/projects' }, { label: 'Crew Directory', href: '/production/crew' }] },
    { key: 'scripts', label: 'ScriptON', icon: ScrollText, pages: [{ label: 'Script Library', href: '/scripts' }, { label: 'Audio Engines', href: '/setup/audio-engines' }] },
    { key: 'comms', label: 'Comms', icon: MessageSquare, pages: [{ label: 'Channels', href: '/comms' }, { label: 'Meetings', href: '/meetings' }, { label: 'Audit vault', href: '/comms/audit' }] },
  ] },
  { caption: 'Creative & planning', modules: [
    { key: 'casting', label: 'Casting', icon: Clapperboard, pages: [{ label: 'Dashboard', href: '/casting' }, { label: 'Talent Database', href: '/casting/talent' }] },
    { key: 'locations', label: 'Locations', icon: MapPin, pages: [{ label: 'Library', href: '/locations' }, { label: 'Map', href: '/locations/map' }, { label: 'Scouting', href: '/locations/scouting' }] },
    { key: 'contracts', label: 'Contracts', icon: FileSignature, pages: [{ label: 'Dashboard', href: '/contracts' }, { label: 'Templates', href: '/contracts/templates' }] },
  ] },
  { caption: 'People', modules: [
    { key: 'hr', label: 'HR', icon: Users, pages: [{ label: 'Dashboard', href: '/hr' }, { label: 'Employees', href: '/hr/employees' }, { label: 'Payroll', href: '/hr/payroll' }] },
    { key: 'travel', label: 'Travel & Visas', icon: Plane, pages: [{ label: 'Dashboard', href: '/travel' }, { label: 'Travelers', href: '/travel/travelers' }] },
    { key: 'partners', label: 'Partners', icon: Building2, pages: [{ label: 'All Partners', href: '/business-partners' }, { label: 'Clients', href: '/clients' }, { label: 'Contacts', href: '/contacts' }] },
  ] },
  { caption: 'Logistics & assets', modules: [
    { key: 'accommodation', label: 'Accommodation', icon: BedDouble, pages: [{ label: 'Properties', href: '/accommodation' }] },
    { key: 'transport', label: 'Transport', icon: Car, pages: [{ label: 'Vehicles & Drivers', href: '/transport' }, { label: 'Dispatch (live map)', href: '/dispatch' }] },
    { key: 'rentals', label: 'Rentals', icon: Truck, pages: [{ label: 'Dashboard', href: '/rental' }, { label: 'Bookings', href: '/rental/bookings' }, { label: 'Assets', href: '/rental/assets' }] },
    { key: 'maintenance', label: 'Maintenance', icon: Wrench, pages: [{ label: 'Jobs', href: '/maintenance/jobs' }, { label: 'Spare Parts', href: '/maintenance/parts' }] },
  ] },
  { caption: 'Finance', modules: [
    { key: 'finance', label: 'Finance', icon: DollarSign, pages: [{ label: 'Dashboard', href: '/finance' }, { label: 'Invoices', href: '/finance/invoices' }, { label: 'Payments', href: '/finance/payments' }] },
    { key: 'compliance', label: 'Compliance', icon: ShieldCheck, pages: [{ label: 'Renewals', href: '/compliance/renewals' }, { label: 'VAT Return', href: '/finance/vat-return' }] },
  ] },
  { caption: 'Insights', modules: [
    { key: 'crm', label: 'CRM', icon: Target, pages: [{ label: 'Pipeline', href: '/crm' }, { label: 'Leads', href: '/crm/leads' }] },
    { key: 'reports', label: 'Reports', icon: BarChart2, pages: [{ label: 'Reports Center', href: '/reports' }] },
  ] },
  { caption: 'Admin', modules: [
    { key: 'setup', label: 'Setup', icon: Settings, pages: [{ label: 'Company', href: '/company' }, { label: 'Users', href: '/users' }, { label: 'Roles & Permissions', href: '/setup/roles' }] },
  ] },
];

const PV_THEMES: { id: ThemeId; name: string }[] = [
  { id: 'graphite', name: 'Graphite' }, { id: 'studio', name: 'Studio' }, { id: 'ink', name: 'Ink' }, { id: 'slate', name: 'Slate' },
];

export default function NavPreviewPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<ThemeId>('graphite');

  return (
    <div style={{ padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>Navigation preview — collapsible grouped rail</h1>
      <p style={{ color: '#667', fontSize: 13, margin: '5px 0 14px' }}>Same groups as your live sidebar (Workspace · Creative · People · Logistics · Finance · Insights · Admin), now collapsible to icons so content gets the space. Standalone preview — your real sidebar is untouched.</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <button onClick={() => setCollapsed((v) => !v)} style={{ border: '1px solid #d3d9e3', background: '#fff', borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {collapsed ? '» Expand rail' : '« Collapse to icons'}
        </button>
        <div style={{ display: 'inline-flex', gap: 4, background: '#f1f3f7', border: '1px solid #e6e9ef', padding: 4, borderRadius: 999 }}>
          {PV_THEMES.map((t) => (
            <button key={t.id} onClick={() => setTheme(t.id)} style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999, background: theme === t.id ? '#5B5BD6' : 'transparent', color: theme === t.id ? '#fff' : '#48536a' }}>{t.name}</button>
          ))}
        </div>
      </div>

      {/* themed frame: rail + content placeholder */}
      <div data-theme={theme} style={{ display: 'flex', height: 560, border: '1px solid var(--border-1)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface-0)', boxShadow: '0 16px 40px rgba(0,0,0,.25)' }}>
        <GroupedRail groups={GROUPS} collapsed={collapsed} onToggleCollapse={() => setCollapsed((v) => !v)} />
        <div style={{ flex: 1, padding: 24, color: 'var(--text-1)', overflow: 'auto' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Productions / Desert Crossing / Dashboard</div>
          <h2 style={{ fontFamily: 'var(--font-serif, Inter)', fontSize: 24, fontWeight: 700, margin: '4px 0 16px' }}>Production Dashboard</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
            {[['Crew call', '06:30'], ['Shoot', '08:00'], ['Scenes', '7'], ['Budget', '61%']].map(([k, v]) => (
              <div key={k} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-1)', borderRadius: 12, padding: 13 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.05em' }}>{k}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 5 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ border: '1px solid var(--border-1)', borderRadius: 12, padding: 16, color: 'var(--text-2)', fontSize: 13 }}>
            Content area — with the rail collapsed, modules become a slim icon strip and the canvas gets the room. Click a module in the rail to expand its pages.
          </div>
        </div>
      </div>
    </div>
  );
}
