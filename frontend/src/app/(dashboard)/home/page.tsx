'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Plus, FileText, Receipt, Truck, ShieldCheck, DollarSign } from 'lucide-react';
import { statusApi, notificationsApi, complianceApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const SEV: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#6b7280' };

export default function HomePage() {
  const [kpi, setKpi] = useState<any>(null);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [renewals, setRenewals] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [perms, setPerms] = useState<Record<string, number>>({});

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('tfm_user') || 'null')); } catch {}
    try { setPerms(JSON.parse(localStorage.getItem('tfm_perms') || '{}')); } catch {}
    statusApi.kpi().then(r => setKpi(r.data)).catch(() => {});
    notificationsApi.list().then(r => setNotifs(r.data || [])).catch(() => {});
    complianceApi.renewals().then(r => setRenewals(r.data?.summary)).catch(() => {});
  }, []);

  const can = (m: string, l = 1) => (perms[m] ?? 0) >= l;
  // Time-based greeting must be client-only: computing it during render makes the
  // server HTML disagree with the browser across hour boundaries → hydration error.
  const [greeting, setGreeting] = useState('Welcome');
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
  }, []);
  const firstName = (user?.fullName || '').split(' ')[0] || '';

  const tiles: { show: boolean; label: string; value: any; href: string; danger?: boolean }[] = [
    { show: can('finance'), label: 'Outstanding', value: formatCurrency(Number(kpi?.finance?.totalOutstandingAED || 0)), href: '/finance/invoices' },
    { show: can('finance'), label: 'Overdue invoices', value: kpi?.finance?.overdueInvoices ?? 0, href: '/finance/invoices', danger: (kpi?.finance?.overdueInvoices || 0) > 0 },
    { show: can('finance'), label: 'Collected (30d)', value: formatCurrency(Number(kpi?.finance?.paidLast30dAED || 0)), href: '/finance/payments' },
    { show: can('rentals'), label: 'Active hires', value: kpi?.rental?.activeHires ?? 0, href: '/rental/bookings' },
    { show: can('rentals'), label: 'Available fleet', value: kpi?.assets?.availableAssets ?? 0, href: '/rental/bookings/calendar' },
    { show: can('rentals'), label: 'Open maintenance', value: kpi?.maintenance?.openMaintenance ?? 0, href: '/rental/maintenance' },
    { show: can('compliance'), label: 'Docs expiring', value: (renewals?.critical ?? 0) + (renewals?.expired ?? 0), href: '/compliance/renewals', danger: (renewals?.expired || 0) > 0 },
  ].filter(t => t.show);

  const actions = [
    { show: can('finance', 2), label: 'New invoice', href: '/finance/invoices/new', icon: Receipt },
    { show: can('finance', 2), label: 'New quotation', href: '/finance/quotations/new', icon: FileText },
    { show: can('rentals', 2), label: 'New booking', href: '/rental/bookings/new', icon: Truck },
  ].filter(a => a.show);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>The Film Makers · Workspace</div>
        <h1 className="text-[22px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>{greeting}{firstName ? `, ${firstName}` : ''}</h1>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Here's what needs your attention today.</p>
      </div>

      {/* Quick actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map(a => (
            <Link key={a.href} href={a.href} className="btn-secondary text-sm"><a.icon size={14} /> {a.label}</Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPI tiles */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {tiles.map(t => (
              <Link key={t.label} href={t.href} className="card p-4 hover:border-brand-200 transition-colors">
                <div className="text-xs text-gray-500">{t.label}</div>
                <div className={`text-2xl font-bold ${t.danger ? 'text-red-600' : 'text-gray-900'}`}>{t.value}</div>
              </Link>
            ))}
            {tiles.length === 0 && <div className="col-span-3 card p-8 text-center text-gray-400 text-sm">No dashboards available for your role.</div>}
          </div>
        </div>

        {/* Action items / notifications */}
        <div className="card overflow-hidden self-start">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <AlertCircle size={15} className="text-amber-500" />
            <h2 className="font-semibold text-gray-800 text-sm">Needs attention</h2>
          </div>
          {notifs.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">You're all caught up.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifs.slice(0, 8).map(n => (
                <Link key={n.key} href={n.link} className="flex items-start gap-2.5 px-5 py-3 hover:bg-gray-50/60">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: SEV[n.severity] || SEV.low }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{n.title}</div>
                    <div className="text-xs text-gray-500">{n.message}</div>
                  </div>
                  <ArrowRight size={13} className="text-gray-300 mt-1" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
