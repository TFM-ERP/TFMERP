'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Truck, Package, AlertTriangle, Wrench, Calendar,
  ArrowRight, CheckCircle, TrendingUp, RefreshCw,
  FileText, Fuel, Users, BarChart2,
} from 'lucide-react';
import { rentalApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import StatusBadge from '@/components/StatusBadge';

// ── KPI card — token-bound soft tile + hover lift (matches Finance dashboard) ──
function KPICard({ title, value, sub, icon: Icon, soft, fg, href }: any) {
  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{title}</p>
        <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{value}</p>
        {sub && <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      </div>
      <div className="p-2.5 rounded-lg shrink-0" style={{ background: soft }}>
        <Icon size={20} style={{ color: fg }} />
      </div>
    </div>
  );
  const cardCls = 'rounded-xl p-5 block transition-all';
  const cardStyle = { background: 'var(--surface-1)', border: '1px solid var(--border-1)' } as const;
  const lift = {
    onMouseEnter: (e: any) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,.08)'; e.currentTarget.style.borderColor = 'var(--border-2)'; },
    onMouseLeave: (e: any) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-1)'; },
  };
  return href
    ? <Link href={href} className={cardCls} style={cardStyle} {...lift}>{inner}</Link>
    : <div className="rounded-xl p-5" style={cardStyle}>{inner}</div>;
}

export default function RentalDashboardPage() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const year = new Date().getFullYear();

  const load = () => {
    setLoading(true);
    rentalApi.dashboard()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const availableAssets = data?.assetStatusCounts?.find((s: any) => s.status === 'AVAILABLE')?._count?.status ?? 0;
  const onHireAssets    = data?.assetStatusCounts?.find((s: any) => ['ON_HIRE','ACTIVE'].includes(s.status))?._count?.status ?? 0;
  const inMaint         = data?.assetStatusCounts?.find((s: any) => s.status === 'IN_MAINTENANCE')?._count?.status ?? 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Rentals · Overview</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Rental Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Fleet &amp; booking operations · {year}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn btn-secondary" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <Link href="/rental/bookings/new" className="btn btn-primary">+ New Booking</Link>
        </div>
      </div>

      {/* ── KPI Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Active Hires" value={loading ? '…' : data?.active ?? 0} sub={`${onHireAssets} assets currently out`} icon={CheckCircle} soft="var(--ok-soft)" fg="var(--ok)" href="/rental/bookings?status=ACTIVE" />
        <KPICard title="Scheduled" value={loading ? '…' : data?.scheduled ?? 0} sub="Confirmed upcoming deliveries" icon={Calendar} soft="var(--accent-soft)" fg="var(--accent)" href="/rental/bookings?status=SCHEDULED" />
        <KPICard title="Today's Deliveries" value={loading ? '…' : data?.todayDeliveries ?? 0} sub="Equipment going out today" icon={Truck} soft="var(--warn-soft)" fg="var(--warn)" href="/rental/bookings" />
        <KPICard title="Today's Pickups" value={loading ? '…' : data?.todayPickups ?? 0} sub="Returns scheduled today" icon={TrendingUp} soft="var(--accent-soft)" fg="var(--accent)" href="/rental/bookings" />
      </div>

      {/* ── Chart + Recent Bookings ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly revenue bar chart */}
        <div className="rounded-xl p-5 lg:col-span-2" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-2)' }}>
            Monthly Booking Revenue — {year}
          </h2>
          {loading ? (
            <div className="h-[220px] rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.monthlyChart ?? []} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)', borderRadius: 8, fontSize: 12, boxShadow: '0 6px 18px rgba(0,0,0,.12)' }}
                  labelStyle={{ color: 'var(--text-2)', fontWeight: 600 }} itemStyle={{ color: 'var(--text-1)' }}
                  cursor={{ fill: 'var(--surface-2)', opacity: 0.5 }} />
                <Bar dataKey="Revenue" fill="#3E7CB1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Summary strip */}
          <div className="flex items-center gap-6 mt-3 pt-3 text-center" style={{ borderTop: '1px solid var(--border-1)' }}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>YTD Revenue</p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{loading ? '…' : formatCurrency(data?.ytdRevenue ?? 0)}</p>
            </div>
            <div className="h-8 w-px" style={{ background: 'var(--border-1)' }} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Available</p>
              <p className="text-sm font-bold" style={{ color: 'var(--ok)' }}>{availableAssets} assets</p>
            </div>
            <div className="h-8 w-px" style={{ background: 'var(--border-1)' }} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>In Maintenance</p>
              <p className="text-sm font-bold" style={{ color: 'var(--warn)' }}>{inMaint} assets</p>
            </div>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="rounded-xl p-5" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>Recent Bookings</h2>
            <Link href="/rental/bookings" className="text-xs hover:underline flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-1">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
                ))
              : (data?.recentBookings ?? []).map((bk: any) => (
                  <Link key={bk.id} href={`/rental/bookings/${bk.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg -mx-2.5 transition-colors"
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>{bk.bookingNumber}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{bk.client?.companyName}</p>
                    </div>
                    <div className="text-end ms-3 shrink-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{formatCurrency(bk.total)}</p>
                      <StatusBadge module="Booking" status={bk.status} size="sm" showIcon={false} />
                    </div>
                  </Link>
                ))
            }
            {!loading && !(data?.recentBookings?.length) && (
              <p className="text-xs text-center py-6" style={{ color: 'var(--text-3)' }}>No bookings yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Pipeline + Quick Actions ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Booking Pipeline */}
        <div className="rounded-xl p-5" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>Booking Pipeline</h2>
            <Link href="/rental/bookings" className="text-xs hover:underline flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />)
              : (data?.statusCounts ?? []).map((sc: any) => (
                  <div key={sc.status} className="flex items-center justify-between py-0.5">
                    <StatusBadge module="Booking" status={sc.status} size="sm" showIcon={false} showDot />
                    <span className="text-sm font-bold" style={{ color: 'var(--text-2)' }}>{sc._count.status}</span>
                  </div>
                ))
            }
            {!loading && !(data?.statusCounts?.length) && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-3)' }}>No active bookings</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-2)' }}>Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'All Bookings',   href: '/rental/bookings',    icon: Truck,         fg: 'var(--accent)' },
              { label: 'Manage Assets',  href: '/rental/assets',      icon: Package,       fg: 'var(--ok)' },
              { label: 'Drivers',        href: '/rental/drivers',     icon: Users,         fg: 'var(--accent)' },
              { label: 'Fuel Logs',      href: '/rental/fuel',        icon: Fuel,          fg: 'var(--warn)' },
              { label: 'Incidents',      href: '/rental/incidents',   icon: AlertTriangle, fg: 'var(--danger)' },
              { label: 'Maintenance',    href: '/rental/maintenance', icon: Wrench,        fg: 'var(--warn)' },
              { label: 'Damage Reports', href: '/rental/damage',      icon: FileText,      fg: 'var(--text-3)' },
              { label: 'Workflow Board', href: '/workflow',           icon: BarChart2,     fg: 'var(--accent)' },
            ].map(({ label, href, icon: Icon, fg }) => (
              <Link key={href} href={href}
                className="rounded-xl p-4 flex items-center gap-3 transition-all"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,.08)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-1)'; }}>
                <Icon size={18} style={{ color: fg }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
