'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, DollarSign, Truck, Building2, Film, Users, BarChart2, Settings, ShieldCheck, Target, Wrench,
  Search, Plus, Star, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  LogOut, X, Clock, ArrowRight, Sun, Moon, MapPin, Plane, FileSignature, Clapperboard, BedDouble, Car, ScrollText,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import SetupGate from '@/components/SetupGate';
import NotificationBell from '@/components/NotificationBell';
import PwaRegister from '@/components/PwaRegister';
import { settingsApi, statusApi, permissionsApi, accountApi, assetUrl } from '@/lib/api';

type Page = { label: string; href: string; divider?: boolean };
type Module = { key: string; label: string; icon: any; pages: Page[] };

const MODULES: Module[] = [
  { key: 'home', label: 'Home', icon: Home, pages: [
    { label: 'Dashboard', href: '/home' },
    { label: 'Executive', href: '/executive' },
    { label: 'Workflow & KPIs', href: '/workflow' },
  ]},
  { key: 'finance', label: 'Finance', icon: DollarSign, pages: [
    { label: 'Dashboard', href: '/finance' },
    { label: 'Quotations', href: '/finance/quotations' },
    { label: 'Invoices', href: '/finance/invoices' },
    { label: 'Payments', href: '/finance/payments' },
    { label: 'Collections', href: '/finance/collections' },
    { label: 'Expenses', href: '/finance/expenses' },
    { label: 'Approvals', href: '/finance/approvals' },
    { label: 'Chart of Accounts', href: '/accounting/accounts' },
    { label: 'Journal Entries', href: '/accounting/journals' },
    { label: 'Trial Balance', href: '/accounting/trial-balance' },
    { label: 'Bank Reconciliation', href: '/accounting/bank-rec' },
  ]},
  { key: 'rentals', label: 'Rentals', icon: Truck, pages: [
    { label: 'Dashboard', href: '/rental' },
    { label: 'Bookings', href: '/rental/bookings' },
    { label: 'Availability', href: '/rental/bookings/calendar' },
    { label: 'Utilization', href: '/rental/utilization' },
    { label: 'Assets', href: '/rental/assets' },
    { label: 'Inventory', href: '/inventory' },
    { label: 'Service Catalog', href: '/finance/services' },
    { label: 'Drivers', href: '/rental/drivers' },
    { label: 'Driver Approvals', href: '/rental/driver-approvals' },
    { label: 'Incidents', href: '/rental/incidents' },
    { label: 'Fuel Logs', href: '/rental/fuel' },
  ]},
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, pages: [
    { label: 'Maintenance Records', href: '/rental/maintenance' },
    { label: 'Maintenance Jobs', href: '/maintenance/jobs' },
    { label: 'PM Schedule', href: '/rental/maintenance-schedule' },
    { label: 'Damage Reports', href: '/rental/damage' },
    { label: 'Tire Records', href: '/maintenance/tires' },
    { label: 'Spare Parts', href: '/maintenance/parts' },
  ]},
  { key: 'crm', label: 'CRM', icon: Target, pages: [
    { label: 'Pipeline', href: '/crm' },
    { label: 'Leads', href: '/crm/leads' },
  ]},
  { key: 'partners', label: 'Partners', icon: Building2, pages: [
    { label: 'All Partners', href: '/business-partners' },
    { label: 'Clients', href: '/clients' },
    { label: 'Suppliers', href: '/finance/suppliers' },
    { label: 'Vendors / Workshops', href: '/maintenance/vendors' },
    { label: 'Contacts', href: '/contacts' },
  ]},
  { key: 'production', label: 'Production', icon: Film, pages: [
    // Daily-work domain entry points
    { label: 'Dashboard', href: '/production/dashboard' },
    { label: 'Projects', href: '/production/projects' },
    { label: 'Crew Directory', href: '/production/crew' },
    { label: 'My Approvals', href: '/production/approvals' },
    { label: 'Email Sender', href: '/production/settings/email' },
    // Master data / setup (separated)
    { label: 'Masters', href: '#prod-masters', divider: true },
    { label: 'Labor & Fringe Master', href: '/setup/labor' },
    { label: 'Rate Approvals', href: '/setup/rate-approvals' },
  ]},
  { key: 'scripts', label: 'ScriptON', icon: ScrollText, pages: [
    { label: 'Script Library', href: '/scripts' },
    { label: 'Audio Engines', href: '/setup/audio-engines' },
  ]},
  { key: 'locations', label: 'Locations', icon: MapPin, pages: [
    { label: 'Library', href: '/locations' },
    { label: 'Map', href: '/locations/map' },
    { label: 'Scouting', href: '/locations/scouting' },
    { label: 'Scout Visits', href: '/locations/scout-visits' },
    { label: 'Permit Authorities', href: '/locations/authorities' },
  ]},
  { key: 'travel', label: 'Travel & Visas', icon: Plane, pages: [
    { label: 'Dashboard', href: '/travel' },
    { label: 'Travelers', href: '/travel/travelers' },
  ]},
  { key: 'contracts', label: 'Contracts', icon: FileSignature, pages: [
    { label: 'Dashboard', href: '/contracts' },
    { label: 'Templates', href: '/contracts/templates' },
  ]},
  { key: 'casting', label: 'Casting', icon: Clapperboard, pages: [
    { label: 'Dashboard', href: '/casting' },
    { label: 'Talent Database', href: '/casting/talent' },
  ]},
  { key: 'accommodation', label: 'Accommodation', icon: BedDouble, pages: [
    { label: 'Properties', href: '/accommodation' },
  ]},
  { key: 'transport', label: 'Transport', icon: Car, pages: [
    { label: 'Vehicles & Drivers', href: '/transport' },
    { label: 'Logistics dashboard', href: '/logistics' },
  ]},
  { key: 'hr', label: 'HR', icon: Users, pages: [
    { label: 'Dashboard', href: '/hr' },
    { label: 'Employees', href: '/hr/employees' },
    { label: 'Attendance', href: '/hr/attendance' },
    { label: 'Payroll', href: '/hr/payroll' },
    { label: 'Leave', href: '/hr/leave' },
  ]},
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck, pages: [
    { label: 'Renewals', href: '/compliance/renewals' },
    { label: 'VAT Return', href: '/finance/vat-return' },
    { label: 'e-Invoicing', href: '/compliance/einvoicing' },
  ]},
  { key: 'reports', label: 'Reports', icon: BarChart2, pages: [
    { label: 'Reports Center', href: '/reports' },
    { label: 'Report Designer', href: '/finance/report-designer' },
    { label: 'Report Builder', href: '/finance/report-builder' },
  ]},
  { key: 'setup', label: 'Setup', icon: Settings, pages: [
    { label: 'Company Management', href: '/company' },
    { label: 'Users', href: '/users' },
    { label: 'Roles & Permissions', href: '/setup/roles' },
    { label: 'Identity Changes', href: '/setup/identity-changes' },
    { label: 'Approval Workflows', href: '/setup/workflows' },
    { label: 'Email & Notifications', href: '/setup/email' },
    { label: 'Integrations', href: '/setup/integrations' },
    { label: 'Audit Log', href: '/setup/audit' },
    { label: 'Currencies (FX)', href: '/setup/fx' },
    { label: 'Backups', href: '/backups' },
  ]},
];

// Option A — grouped sections (the master sidebar). Ordered; empty groups (by permission) hide.
const GROUPS: { caption: string; keys: string[] }[] = [
  { caption: 'Workspace', keys: ['home', 'production'] },
  { caption: 'Creative & planning', keys: ['casting', 'locations', 'contracts'] },
  { caption: 'People', keys: ['hr', 'travel', 'partners'] },
  { caption: 'Logistics & assets', keys: ['accommodation', 'transport', 'rentals', 'maintenance'] },
  { caption: 'Finance', keys: ['finance', 'compliance'] },
  { caption: 'Insights', keys: ['crm', 'reports'] },
  { caption: 'Admin', keys: ['setup'] },
];
// Sections that don't have their own permission key piggyback on another module's access.
const PERM_ALIAS: Record<string, string> = { maintenance: 'rentals', locations: 'production', travel: 'production', contracts: 'production', casting: 'production', accommodation: 'production', transport: 'production' };

// Pages that have a "+ New" route (only verified routes — avoids 404s)
const NEW_ROUTES: Record<string, { label: string; href: string }> = {
  '/finance/quotations': { label: 'New quotation', href: '/finance/quotations/new' },
  '/finance/invoices': { label: 'New invoice', href: '/finance/invoices/new' },
  '/rental/bookings': { label: 'New booking', href: '/rental/bookings/new' },
};

const GOLD = '#0f172a';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const fileSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);

const ALL_PAGES = MODULES.flatMap(m => m.pages.filter(p => !p.divider).map(p => ({ ...p, module: m.label, mkey: m.key })));

function matchActive(pathname: string) {
  let best: { mkey: string; page: Page } | null = null;
  let bestLen = -1;
  for (const m of MODULES) {
    for (const p of m.pages) {
      if (p.divider) continue;
      if (pathname === p.href || pathname.startsWith(p.href + '/')) {
        if (p.href.length > bestLen) { best = { mkey: m.key, page: p }; bestLen = p.href.length; }
      }
    }
  }
  return best;
}

const lsGet = (k: string, fb: any) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; }
};
const lsSet = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<{ fullName: string; role: string; avatarUrl?: string | null; preferredName?: string | null } | null>(null);
  const [company, setCompany] = useState<{ name?: string; logoUrl?: string } | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [pins, setPins] = useState<Page[]>([]);
  const [recents, setRecents] = useState<Page[]>([]);
  const [lastTab, setLastTab] = useState<Record<string, string>>({});
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [acctOpen, setAcctOpen] = useState(false);
  // Dark mode — class on <html>, persisted; applied in an effect so SSR markup never differs
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const on = lsGet('tfm_dark', false);
    setDarkMode(on);
    document.documentElement.classList.toggle('dark', on);
  }, []);
  const toggleTheme = () => setDarkMode(v => {
    const n = !v;
    lsSet('tfm_dark', n);
    document.documentElement.classList.toggle('dark', n);
    return n;
  });
  const [perms, setPerms] = useState<Record<string, number> | null>(null);

  const active = matchActive(pathname);
  const activeMkey = active?.mkey || 'home';
  const activeModule = MODULES.find(m => m.key === activeMkey)!;
  const activePage = active?.page;
  // A record-detail route (e.g. /production/projects/[id]) sits one segment below its page.
  // Those screens carry their own header/back, so we drop the module title, pins and sub-tabs there.
  const isDetail = !!activePage && pathname.startsWith(activePage.href + '/');

  // boot
  useEffect(() => {
    const token = localStorage.getItem('tfm_token');
    if (!token) { router.push('/login'); return; }
    const stored = localStorage.getItem('tfm_user');
    if (stored) setUser(JSON.parse(stored));
    setExpanded(lsGet('tfm_nav_expanded', true));
    setPins(lsGet('tfm_nav_pins', []));
    setRecents(lsGet('tfm_nav_recents', []));
    setLastTab(lsGet('tfm_nav_lasttab', {}));
    settingsApi.get().then(r => setCompany({ name: r.data?.name, logoUrl: r.data?.logoUrl })).catch(() => {});
    permissionsApi.me().then(r => { setPerms(r.data?.permissions || {}); lsSet('tfm_perms', r.data?.permissions || {}); }).catch(() => {});
    statusApi.kpi().then((r: any) => {
      const k = r.data || {};
      const overdue = Number(k?.finance?.overdueInvoices || 0);
      const pending = Number(k?.finance?.pendingApprovalInvoices || 0);
      const openMaint = Number(k?.maintenance?.openMaintenance || 0);
      setBadges({ finance: overdue + pending, rentals: openMaint });
      const c: Record<string, number> = {};
      if (overdue) c['/finance/invoices'] = overdue;
      if (openMaint) c['/rental/maintenance'] = openMaint;
      setCounts(c);
    }).catch(() => {});
  }, [router]);

  // Global identity — hydrate avatar + preferred name, and re-pull when the Account page edits them
  useEffect(() => {
    const sync = () => accountApi.profile()
      .then(r => setUser({
        fullName: r.data.fullName,
        role: r.data.role,
        avatarUrl: r.data.avatarUrl,
        preferredName: r.data.preferredName,
      }))
      .catch(() => {});
    sync();
    window.addEventListener('tfm:profile-updated', sync);
    return () => window.removeEventListener('tfm:profile-updated', sync);
  }, []);

  // track recents + last tab on navigation
  useEffect(() => {
    if (!active) return;
    setLastTab(prev => { const next = { ...prev, [active.mkey]: active.page.href }; lsSet('tfm_nav_lasttab', next); return next; });
    setRecents(prev => {
      const entry = { label: active.page.label, href: active.page.href };
      const next = [entry, ...prev.filter(p => p.href !== entry.href)].slice(0, 6);
      lsSet('tfm_nav_recents', next); return next;
    });
    setShowAll(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd-K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o); setQuery(''); }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleExpanded = () => setExpanded(v => { lsSet('tfm_nav_expanded', !v); return !v; });

  const goModule = (m: Module) => {
    const firstPage = m.pages.find(p => !p.divider)!;
    const target = lastTab[m.key] && m.pages.some(p => !p.divider && p.href === lastTab[m.key]) ? lastTab[m.key] : firstPage.href;
    router.push(target);
  };

  const isPinned = activePage ? pins.some(p => p.href === activePage.href) : false;
  const togglePin = () => {
    if (!activePage) return;
    setPins(prev => {
      const exists = prev.some(p => p.href === activePage.href);
      const next = exists ? prev.filter(p => p.href !== activePage.href) : [...prev, { label: activePage.label, href: activePage.href }];
      lsSet('tfm_nav_pins', next); return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('tfm_token');
    localStorage.removeItem('tfm_user');
    router.push('/login');
  };

  const newAction = activePage ? NEW_ROUTES[activePage.href] : undefined;
  const paletteResults = (() => {
    const q = query.trim().toLowerCase();
    const actions = Object.values(NEW_ROUTES).map(a => ({ label: a.label, href: a.href, kind: 'action' as const }));
    const pages = ALL_PAGES.map(p => ({ label: `${p.module} › ${p.label}`, href: p.href, kind: 'page' as const }));
    const all = [...actions, ...pages];
    if (!q) return pages.slice(0, 8);
    return all.filter(r => r.label.toLowerCase().includes(q)).slice(0, 10);
  })();

  const RAIL_W = expanded ? 220 : 60;
  const logoSrc = fileSrc(company?.logoUrl);

  // Theme-following rail palette — neutral in light, charcoal brand in dark.
  const pal = darkMode ? {
    bg: '#0f172a', border: 'rgba(255,255,255,0.08)', cap: '#5b6b85', brand: '#f1f5f9', brandSub: '#5b6b85',
    item: '#94a3b8', itemHover: '#1e293b', itemHoverText: '#f1f5f9', activeBg: '#1e293b', activeText: '#ffffff',
    searchBg: '#0b1322', searchBorder: 'rgba(255,255,255,0.09)', searchText: '#5b6b85',
    footerText: '#f1f5f9', footerSub: '#5b6b85', avBg: '#1e293b', avText: '#ffffff', menuBg: '#1e293b',
  } : {
    bg: '#ffffff', border: '#e8eaed', cap: '#94a3b8', brand: '#0f172a', brandSub: '#94a3b8',
    item: '#475569', itemHover: '#f1f5f9', itemHoverText: '#0f172a', activeBg: '#e6f1fb', activeText: '#185fa5',
    searchBg: '#ffffff', searchBorder: '#e8eaed', searchText: '#94a3b8',
    footerText: '#0f172a', footerSub: '#94a3b8', avBg: '#e6f1fb', avText: '#185fa5', menuBg: '#ffffff',
  };

  const railBtn = (m: Module) => {
    const on = m.key === activeMkey;
    const badge = badges[m.key];
    return (
      <button key={m.key} onClick={() => goModule(m)} title={m.label} aria-label={m.label}
        className="relative flex items-center rounded-md mx-1.5 my-0.5 transition-colors"
        style={{
          padding: expanded ? '7px 10px' : '10px 0',
          justifyContent: expanded ? 'flex-start' : 'center',
          gap: 10,
          background: on ? pal.activeBg : 'transparent',
          color: on ? pal.activeText : pal.item,
          fontWeight: on ? 500 : 400,
        }}
        onMouseEnter={e => { if (!on) { (e.currentTarget as HTMLElement).style.background = pal.itemHover; (e.currentTarget as HTMLElement).style.color = pal.itemHoverText; } }}
        onMouseLeave={e => { if (!on) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = pal.item; } }}
      >
        <m.icon size={18} style={{ flexShrink: 0 }} />
        {expanded && <span className="text-[13px] truncate">{m.label}</span>}
        {badge > 0 && (
          <span className="absolute flex items-center justify-center text-[9px] font-bold text-white rounded-full"
            style={{ top: 4, right: expanded ? 8 : 6, minWidth: 15, height: 15, padding: '0 3px', background: '#e24b4a' }}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  // Overflow threshold counts real pages, not dividers.
  const realPageCount = activeModule.pages.filter(p => !p.divider).length;
  const visibleTabs = (showAll || realPageCount <= 7) ? activeModule.pages : activeModule.pages.slice(0, 7);
  // Show a module if permissions haven't loaded yet, or the role has at least view access.
  const canSee = (key: string) => {
    const k = PERM_ALIAS[key] || key;
    return k === 'home' || !perms || (perms[k] ?? 0) >= 1;
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: darkMode ? '#0B1120' : '#F4F5F7' }}>

      {/* ── Rail (Option A — grouped, theme-following) ── */}
      <aside className="flex flex-col shrink-0 transition-all" style={{ width: RAIL_W, background: pal.bg, borderRight: `1px solid ${pal.border}` }}>
        {/* Brand header */}
        <div className="flex items-center gap-2 px-2.5 py-3" style={{ borderBottom: `1px solid ${pal.border}`, justifyContent: expanded ? 'space-between' : 'center' }}>
          {expanded ? (
            logoSrc
              ? <div className="bg-white rounded-md px-2 py-1.5 flex items-center justify-center flex-1 mr-1"><img src={logoSrc} alt={company?.name || 'Company'} className="h-8 w-auto max-w-[140px] object-contain" /></div>
              : <img src="/tfm-logo.svg" alt="Company" className="h-7 w-auto ml-1" style={{ filter: darkMode ? 'brightness(0) invert(1)' : 'none', opacity: 0.9 }} />
          ) : (
            logoSrc
              ? <div className="bg-white rounded-md p-1 flex items-center justify-center"><img src={logoSrc} alt="" className="h-6 w-6 object-contain" /></div>
              : <img src="/tfm-logo.svg" alt="" className="h-6 w-auto" style={{ filter: darkMode ? 'brightness(0) invert(1)' : 'none', opacity: 0.9 }} />
          )}
          <button onClick={toggleExpanded} aria-label="Toggle navigation" className="shrink-0" style={{ color: pal.searchText }}>
            {expanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* Grouped modules (search lives in the top bar to avoid duplication) */}
        <nav className="flex-1 overflow-y-auto py-1.5" style={{ scrollbarWidth: 'none' }}>
          {GROUPS.map(g => {
            const keys = g.keys.filter(canSee);
            if (!keys.length) return null;
            return (
              <div key={g.caption}>
                {expanded && <div className="px-3.5 pt-3 pb-1 text-[10.5px]" style={{ color: pal.cap, letterSpacing: '.04em' }}>{g.caption}</div>}
                {keys.map(k => railBtn(MODULES.find(m => m.key === k)!))}
              </div>
            );
          })}
        </nav>

        {/* Account footer + menu */}
        <div className="relative px-1.5 py-2" style={{ borderTop: `1px solid ${pal.border}` }}>
          {acctOpen && expanded && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAcctOpen(false)} />
              <div className="absolute z-50 left-1.5 right-1.5 rounded-md overflow-hidden" style={{ bottom: 'calc(100% - 2px)', background: pal.menuBg, border: `1px solid ${pal.border}` }}>
                <Link href="/account/security" onClick={() => setAcctOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-[12.5px]" style={{ color: pal.footerText }}
                  onMouseEnter={e => (e.currentTarget.style.background = pal.itemHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <ShieldCheck size={15} /> Personal identity &amp; security
                </Link>
                <div style={{ height: 1, background: pal.border }} />
                <button onClick={handleLogout} className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-[12.5px]" style={{ color: '#e24b4a' }}
                  onMouseEnter={e => (e.currentTarget.style.background = pal.itemHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            </>
          )}
          <button onClick={() => expanded ? setAcctOpen(o => !o) : router.push('/account/security')} aria-label="Account menu"
            className="flex items-center w-full rounded-md transition-colors"
            style={{ padding: expanded ? '7px 9px' : '9px 0', gap: 9, justifyContent: expanded ? 'flex-start' : 'center' }}
            onMouseEnter={e => (e.currentTarget.style.background = pal.itemHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0" style={{ background: pal.avBg, color: pal.avText }}>
              {user?.avatarUrl
                ? <img src={assetUrl(user.avatarUrl)} alt="" className="w-full h-full object-cover" />
                : (user?.preferredName || user?.fullName)?.[0]?.toUpperCase() || 'A'}
            </div>
            {expanded && (
              <>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate" style={{ color: pal.footerText }}>{user?.preferredName || user?.fullName || 'Administrator'}</p>
                  <p className="text-[10px] truncate" style={{ color: pal.footerSub }}>{(user?.role || 'SYSTEM_ADMIN').replace(/_/g, ' ')}</p>
                </div>
                <ChevronUp size={14} className="shrink-0" style={{ color: pal.footerSub, transform: acctOpen ? 'rotate(180deg)' : 'none' }} />
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Utility bar */}
        <header className="flex items-center gap-3 px-5 h-12 bg-white shrink-0" style={{ borderBottom: `1px solid ${darkMode ? '#243349' : '#e6e7ea'}` }}>
          <button onClick={() => { setPaletteOpen(true); setQuery(''); }}
            className="flex items-center gap-2 text-sm text-gray-400 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 h-8 transition-colors"
            style={{ maxWidth: 340, flex: 1 }}>
            <Search size={15} />
            <span className="text-[12.5px]">Search pages, records, actions…</span>
            <span className="ml-auto text-[11px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">⌘K</span>
          </button>
          <div className="flex-1" />
          {newAction && (
            <Link href={newAction.href} className="hidden sm:flex items-center gap-1.5 text-[12.5px] font-medium text-white rounded-lg px-3 h-8" style={{ background: GOLD }}>
              <Plus size={14} /> {newAction.label}
            </Link>
          )}
          <button onClick={toggleTheme} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle dark mode"
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <NotificationBell />
        </header>

        {/* Breadcrumb + title — hidden inside a record (it has its own header + back button) */}
        {!isDetail && (
          <div className="flex items-center justify-between gap-3 px-5 pt-3 bg-white">
            <div className="min-w-0">
              <div className="text-[11.5px] text-gray-400 flex items-center gap-1">
                <span>{activeModule.label}</span>
                {activePage && <><ChevronRight size={11} /> <span>{activePage.label}</span></>}
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-[18px] font-bold text-gray-900 truncate">{activePage?.label || activeModule.label}</h1>
                {activePage && (
                  <button onClick={togglePin} title={isPinned ? 'Unpin' : 'Pin'} aria-label="Pin page"
                    className="text-gray-300 hover:text-amber-500" style={{ color: isPinned ? GOLD : undefined }}>
                    <Star size={15} fill={isPinned ? GOLD : 'none'} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pinned + recents */}
        {!isDetail && (pins.length > 0 || recents.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap px-5 pt-2 pb-1 bg-white text-[11.5px]">
            {pins.length > 0 && <span className="text-gray-400">Pinned</span>}
            {pins.map(p => (
              <Link key={'pin' + p.href} href={p.href} className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full px-2.5 py-1 text-gray-700">
                <Star size={11} style={{ color: GOLD }} fill={GOLD} /> {p.label}
              </Link>
            ))}
            {recents.length > 0 && <span className="text-gray-400 ml-1">Recent</span>}
            {recents.slice(0, 4).map(p => (
              <Link key={'rec' + p.href} href={p.href} className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full px-2.5 py-1 text-gray-600">
                <Clock size={11} /> {p.label}
              </Link>
            ))}
          </div>
        )}

        {/* Sub-tabs — hidden on record-detail screens (they bring their own header) */}
        {!isDetail && (
        <div className="flex items-stretch flex-wrap gap-0.5 px-4 bg-white" style={{ borderBottom: '1px solid #e6e7ea' }}>
          {visibleTabs.map(p => {
            if (p.divider) return (
              <span key={p.href} className="flex items-center gap-1.5 pl-3 pr-1 text-[10px] uppercase tracking-wide text-gray-300 select-none" style={{ borderLeft: '1px solid #e6e7ea', marginLeft: 6 }}>
                {p.label}
              </span>
            );
            const on = activePage?.href === p.href;
            const cnt = counts[p.href];
            return (
              <Link key={p.href} href={p.href}
                className="flex items-center gap-1.5 text-[13px] px-3 py-2.5 transition-colors"
                style={{ color: on ? '#1a1a2e' : '#6b7280', borderBottom: `2px solid ${on ? GOLD : 'transparent'}`, fontWeight: on ? 500 : 400 }}>
                {p.label}
                {cnt > 0 && <span className="text-[10.5px] rounded-full px-1.5 font-medium text-white" style={{ background: '#e24b4a' }}>{cnt}</span>}
              </Link>
            );
          })}
          {!showAll && realPageCount > 7 && (
            <button onClick={() => setShowAll(true)} className="flex items-center gap-1 text-[13px] px-3 py-2.5 text-blue-600">
              More <ChevronDown size={13} />
            </button>
          )}
        </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <SetupGate>{children}</SetupGate>
        </main>
      </div>

      {/* PWA: production manifest + service worker (offline petty cash & locations) */}
      <PwaRegister />

      {/* ── Command palette ── */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center" style={{ background: 'rgba(0,0,0,0.4)', paddingTop: '12vh' }}
          onClick={() => setPaletteOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[460px] max-w-[92%] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Search size={16} className="text-gray-400" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && paletteResults[0]) { router.push(paletteResults[0].href); setPaletteOpen(false); } }}
                placeholder="Jump to page or action…" className="flex-1 outline-none text-sm bg-transparent" />
              <button onClick={() => setPaletteOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="max-h-80 overflow-y-auto py-1.5">
              {paletteResults.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-400">No matches</div>}
              {paletteResults.map((r, i) => (
                <button key={r.href + i} onClick={() => { router.push(r.href); setPaletteOpen(false); }}
                  className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50">
                  {r.kind === 'action' ? <Plus size={15} className="text-gray-400" /> : <ArrowRight size={15} className="text-gray-400" />}
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
