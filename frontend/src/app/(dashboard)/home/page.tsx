'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, FileText, Receipt, Truck } from 'lucide-react';
import { statusApi, notificationsApi, complianceApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';
import '@/styles/tokens.css';

const SEV: Record<string, string> = { high: 'var(--danger)', medium: 'var(--warn)', low: 'var(--text-3)' };

export default function HomePage() {
  const { t: tr } = useLocale();
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

  const liftIn = (e: React.MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--accent)'; el.style.background = 'var(--surface-2)'; };
  const liftOut = (e: React.MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border-1)'; el.style.background = 'var(--surface-1)'; };
  const rowIn = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; };
  const rowOut = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 space-y-6" style={{ fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}>
      {/* Hero */}
      <div>
        <div className="text-[10px] font-bold uppercase" style={{ letterSpacing: '.18em', color: 'var(--gold)' }}>The Film Makers · Workspace</div>
        <h1 className="text-2xl sm:text-[26px] font-extrabold leading-tight mt-1" style={{ color: 'var(--text-1)', letterSpacing: '-.02em' }}>{tr(greeting)}{firstName ? `, ${firstName}` : ''}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>{tr("Here's what needs your attention today.")}</p>
      </div>

      {/* Quick actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map(a => (
            <Link key={a.href} href={a.href} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 h-9 text-[13px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}>
              <a.icon size={15} /> {tr(a.label)}
            </Link>
          ))}
        </div>
      )}

      {/* KPIs + attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {tiles.map(t => (
              <Link key={t.label} href={t.href} className="rounded-xl p-4 block transition-colors"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
                onMouseEnter={liftIn} onMouseLeave={liftOut}>
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{tr(t.label)}</div>
                <div className="text-2xl font-extrabold mt-1" style={{ color: t.danger ? 'var(--danger)' : 'var(--text-1)' }}>{t.value}</div>
              </Link>
            ))}
            {tiles.length === 0 && (
              <div className="col-span-2 md:col-span-3 rounded-xl p-8 text-center text-sm" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)', color: 'var(--text-3)' }}>{tr('No dashboards available for your role.')}</div>
            )}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden self-start" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--surface-2)' }}>
            <AlertCircle size={15} style={{ color: 'var(--warn)' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{tr('Needs attention')}</h2>
          </div>
          {notifs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>{tr("You're all caught up.")}</div>
          ) : (
            <div>
              {notifs.slice(0, 8).map(n => (
                <Link key={n.key} href={n.link} className="flex items-start gap-2.5 px-4 py-3 transition-colors"
                  style={{ borderTop: '1px solid var(--border-1)' }} onMouseEnter={rowIn} onMouseLeave={rowOut}>
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: SEV[n.severity] || SEV.low }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{n.title}</div>
                    <div className="text-xs" style={{ color: 'var(--text-3)' }}>{n.message}</div>
                  </div>
                  <ArrowRight size={13} className="mt-1 shrink-0" style={{ color: 'var(--text-3)' }} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
