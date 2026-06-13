'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, AlertCircle, FileText,
  DollarSign, Clock, CheckCircle, ArrowRight, RefreshCw,
} from 'lucide-react';
import { financeApi } from '@/lib/api';
import { formatCurrency, formatDate, STATUS_COLORS, cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DashboardData {
  ytd: { invoiced: number; collected: number; outstanding: number };
  thisMonth: { invoiced: number };
  counts: { overdueInvoices: number; activeQuotations: number };
  recentInvoices: any[];
}

function KPICard({ title, value, sub, icon: Icon, color, href }: any) {
  return (
    <Link href={href || '#'} className="card p-5 hover:shadow-md transition-shadow block">
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
    </Link>
  );
}

export default function FinanceDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [year] = useState(new Date().getFullYear());
  const [chartData, setChartData] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [dash, revenue] = await Promise.all([
        financeApi.dashboard(),
        financeApi.revenueByActivity(year),
      ]);
      setData(dash.data);

      // Build chart data from revenue by month
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const rev = revenue.data;
      const chart = months.map((name, i) => {
        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
        return {
          name,
          Rental: rev.RENTAL?.[key] || 0,
          Production: rev.PRODUCTION?.[key] || 0,
        };
      });
      setChartData(chart);
    } catch (e) {
      console.error('Failed to load dashboard', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const collectionRate = data
    ? Math.round((data.ytd.collected / (data.ytd.invoiced || 1)) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Finance · Overview</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Finance Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Year to date {year} · All activities</p>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="YTD Invoiced"
          value={loading ? '...' : formatCurrency(data?.ytd.invoiced || 0)}
          sub={`This month: ${formatCurrency(data?.thisMonth.invoiced || 0)}`}
          icon={TrendingUp}
          color="bg-brand-600"
          href="/finance/invoices"
        />
        <KPICard
          title="Collected YTD"
          value={loading ? '...' : formatCurrency(data?.ytd.collected || 0)}
          sub={`${collectionRate}% collection rate`}
          icon={CheckCircle}
          color="bg-green-600"
          href="/finance/payments"
        />
        <KPICard
          title="Outstanding"
          value={loading ? '...' : formatCurrency(data?.ytd.outstanding || 0)}
          sub={`${data?.counts.overdueInvoices || 0} invoices overdue`}
          icon={AlertCircle}
          color={data?.counts.overdueInvoices ? 'bg-red-500' : 'bg-amber-500'}
          href="/finance/invoices?status=OVERDUE"
        />
        <KPICard
          title="Active Quotations"
          value={loading ? '...' : data?.counts.activeQuotations || 0}
          sub="Pending approval or conversion"
          icon={FileText}
          color="bg-purple-600"
          href="/finance/quotations"
        />
      </div>

      {/* Revenue Chart + Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Monthly Revenue by Activity — {year}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="Rental" fill="#1F4E79" radius={[3,3,0,0]} />
              <Bar dataKey="Production" fill="#7B5E14" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand-600 inline-block"/> Rental</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-production-500 inline-block"/> Production</span>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Recent Invoices</h2>
            <Link href="/finance/invoices" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))
            ) : (
              (data?.recentInvoices || []).map((inv) => (
                <Link key={inv.id} href={`/finance/invoices/${inv.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 -mx-2.5 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-500 truncate">{inv.client?.companyName}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="text-xs font-semibold text-gray-900">{formatCurrency(inv.total)}</p>
                    <span className={cn('badge text-[10px]', STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-600')}>
                      {inv.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'New Quotation', href: '/finance/quotations/new', icon: FileText, color: 'text-brand-600' },
          { label: 'New Invoice', href: '/finance/invoices/new', icon: DollarSign, color: 'text-green-600' },
          { label: 'Record Payment', href: '/finance/payments', icon: CheckCircle, color: 'text-purple-600' },
          { label: 'Aging Report', href: '/finance/invoices?overdueOnly=true', icon: Clock, color: 'text-red-600' },
        ].map(({ label, href, icon: Icon, color }) => (
          <Link key={href} href={href}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <Icon size={18} className={color} />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
