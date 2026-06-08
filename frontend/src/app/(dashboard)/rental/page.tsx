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

// ── KPI card — same component + styling as Finance Dashboard ─────────────────
function KPICard({ title, value, sub, icon: Icon, color, href }: any) {
  const inner = (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
      </div>
      <div className={cn('p-2.5 rounded-lg', color)}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  );
  return href
    ? <Link href={href} className="card p-5 hover:shadow-md transition-shadow block">{inner}</Link>
    : <div className="card p-5">{inner}</div>;
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
    <div className="p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rental Dashboard</h1>
          <p className="text-sm text-gray-500">Fleet & booking operations · {year}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <Link href="/rental/bookings/new" className="btn-primary">+ New Booking</Link>
        </div>
      </div>

      {/* ── KPI Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Active Hires"
          value={loading ? '…' : data?.active ?? 0}
          sub={`${onHireAssets} assets currently out`}
          icon={CheckCircle}
          color="bg-green-600"
          href="/rental/bookings?status=ACTIVE"
        />
        <KPICard
          title="Scheduled"
          value={loading ? '…' : data?.scheduled ?? 0}
          sub="Confirmed upcoming deliveries"
          icon={Calendar}
          color="bg-blue-600"
          href="/rental/bookings?status=SCHEDULED"
        />
        <KPICard
          title="Today's Deliveries"
          value={loading ? '…' : data?.todayDeliveries ?? 0}
          sub="Equipment going out today"
          icon={Truck}
          color="bg-brand-600"
          href="/rental/bookings"
        />
        <KPICard
          title="Today's Pickups"
          value={loading ? '…' : data?.todayPickups ?? 0}
          sub="Returns scheduled today"
          icon={TrendingUp}
          color="bg-purple-600"
          href="/rental/bookings"
        />
      </div>

      {/* ── Chart + Recent Bookings ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly revenue bar chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Monthly Booking Revenue — {year}
          </h2>
          {loading ? (
            <div className="h-[220px] bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.monthlyChart ?? []} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="Revenue" fill="#1F4E79" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Summary strip */}
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100 text-center">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">YTD Revenue</p>
              <p className="text-sm font-bold text-gray-900">{loading ? '…' : formatCurrency(data?.ytdRevenue ?? 0)}</p>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Available</p>
              <p className="text-sm font-bold text-green-700">{availableAssets} assets</p>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">In Maintenance</p>
              <p className="text-sm font-bold text-amber-700">{inMaint} assets</p>
            </div>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Recent Bookings</h2>
            <Link href="/rental/bookings" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))
              : (data?.recentBookings ?? []).map((bk: any) => (
                  <Link key={bk.id} href={`/rental/bookings/${bk.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 -mx-2.5 transition-colors">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{bk.bookingNumber}</p>
                      <p className="text-xs text-gray-500 truncate">{bk.client?.companyName}</p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-xs font-semibold text-gray-900">{formatCurrency(bk.total)}</p>
                      <StatusBadge module="Booking" status={bk.status} size="sm" showIcon={false} />
                    </div>
                  </Link>
                ))
            }
            {!loading && !(data?.recentBookings?.length) && (
              <p className="text-xs text-gray-400 text-center py-6">No bookings yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Pipeline + Quick Actions ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Booking Pipeline */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Booking Pipeline</h2>
            <Link href="/rental/bookings" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-gray-50 rounded-lg animate-pulse" />)
              : (data?.statusCounts ?? []).map((sc: any) => (
                  <div key={sc.status} className="flex items-center justify-between py-0.5">
                    <StatusBadge module="Booking" status={sc.status} size="sm" showIcon={false} showDot />
                    <span className="text-sm font-bold text-gray-800">{sc._count.status}</span>
                  </div>
                ))
            }
            {!loading && !(data?.statusCounts?.length) && (
              <p className="text-xs text-gray-400 text-center py-4">No active bookings</p>
            )}
          </div>
        </div>

        {/* Quick Actions — same 4-grid style as Finance Dashboard */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'All Bookings',   href: '/rental/bookings',    icon: Truck,         color: 'text-brand-600'  },
              { label: 'Manage Assets',  href: '/rental/assets',      icon: Package,       color: 'text-green-600'  },
              { label: 'Drivers',        href: '/rental/drivers',     icon: Users,         color: 'text-purple-600' },
              { label: 'Fuel Logs',      href: '/rental/fuel',        icon: Fuel,          color: 'text-amber-600'  },
              { label: 'Incidents',      href: '/rental/incidents',   icon: AlertTriangle, color: 'text-red-600'    },
              { label: 'Maintenance',    href: '/rental/maintenance', icon: Wrench,        color: 'text-orange-600' },
              { label: 'Damage Reports', href: '/rental/damage',      icon: FileText,      color: 'text-gray-600'   },
              { label: 'Workflow Board', href: '/workflow',           icon: BarChart2,     color: 'text-indigo-600' },
            ].map(({ label, href, icon: Icon, color }) => (
              <Link key={href} href={href}
                className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <Icon size={18} className={color} />
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
