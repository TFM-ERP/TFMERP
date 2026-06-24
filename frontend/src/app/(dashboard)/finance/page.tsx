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
import { useLocale } from '@/lib/i18n';

interface DashboardData {
  ytd: { invoiced: number; collected: number; outstanding: number };
  thisMonth: { invoiced: number };
  counts: { overdueInvoices: number; activeQuotations: number };
  recentInvoices: any[];
}

// Theme-aware KPI tile: soft semantic background + strong icon, hover lift. Tokens resolve in all 8 themes.
function KPICard({ title, value, sub, icon: Icon, soft, fg, href }: any) {
  return (
    <Link href={href || '#'} className="block rounded-xl p-5 transition-all"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,.08)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-1)'; }}>
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
    </Link>
  );
}

export default function FinanceDashboard() {
  const { t } = useLocale();
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

  const overdue = !!data?.counts.overdueInvoices;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>{t('Finance · Overview')}</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>{t('Finance Dashboard')}</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>{t('Year to date')} {year} · {t('All activities')}</p>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {t('Refresh')}
        </button>
      </div>

      {/* KPI Grid — 1-up phone, 2-up small, 4-up desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={t('YTD Invoiced')}
          value={loading ? '…' : formatCurrency(data?.ytd.invoiced || 0)}
          sub={`${t('This month')}: ${formatCurrency(data?.thisMonth.invoiced || 0)}`}
          icon={TrendingUp}
          soft="var(--accent-soft)" fg="var(--accent)"
          href="/finance/invoices"
        />
        <KPICard
          title={t('Collected YTD')}
          value={loading ? '…' : formatCurrency(data?.ytd.collected || 0)}
          sub={`${collectionRate}% ${t('collection rate')}`}
          icon={CheckCircle}
          soft="var(--ok-soft)" fg="var(--ok)"
          href="/finance/payments"
        />
        <KPICard
          title={t('Outstanding')}
          value={loading ? '…' : formatCurrency(data?.ytd.outstanding || 0)}
          sub={`${data?.counts.overdueInvoices || 0} ${t('invoices overdue')}`}
          icon={AlertCircle}
          soft={overdue ? 'var(--danger-soft)' : 'var(--warn-soft)'}
          fg={overdue ? 'var(--danger)' : 'var(--warn)'}
          href="/finance/invoices?status=OVERDUE"
        />
        <KPICard
          title={t('Active Quotations')}
          value={loading ? '…' : data?.counts.activeQuotations || 0}
          sub={t('Pending approval or conversion')}
          icon={FileText}
          soft="var(--accent-soft)" fg="var(--accent)"
          href="/finance/quotations"
        />
      </div>

      {/* Revenue Chart + Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="rounded-xl p-5 lg:col-span-2" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-2)' }}>
            {t('Monthly Revenue by Activity')} — {year}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-1)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)', borderRadius: 8, fontSize: 12, boxShadow: '0 6px 18px rgba(0,0,0,.12)' }}
                labelStyle={{ color: 'var(--text-2)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--text-1)' }}
                cursor={{ fill: 'var(--surface-2)', opacity: 0.5 }} />
              <Bar dataKey="Rental" fill="#3E7CB1" radius={[3,3,0,0]} />
              <Bar dataKey="Production" fill="#C0954A" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-3)' }}>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#3E7CB1' }}/> {t('Rental')}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#C0954A' }}/> {t('Production')}</span>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="rounded-xl p-5" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>{t('Recent Invoices')}</h2>
            <Link href="/finance/invoices" className="text-xs hover:underline flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              {t('View all')} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-1">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
              ))
            ) : (
              (data?.recentInvoices || []).map((inv) => (
                <Link key={inv.id} href={`/finance/invoices/${inv.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg -mx-2.5 transition-colors"
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>{inv.invoiceNumber}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{inv.client?.companyName}</p>
                  </div>
                  <div className="text-end ms-3 shrink-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{formatCurrency(inv.total)}</p>
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
          { label: 'New Quotation', href: '/finance/quotations/new', icon: FileText, fg: 'var(--accent)' },
          { label: 'New Invoice', href: '/finance/invoices/new', icon: DollarSign, fg: 'var(--ok)' },
          { label: 'Record Payment', href: '/finance/payments', icon: CheckCircle, fg: 'var(--accent)' },
          { label: 'Aging Report', href: '/finance/invoices?overdueOnly=true', icon: Clock, fg: 'var(--danger)' },
        ].map(({ label, href, icon: Icon, fg }) => (
          <Link key={href} href={href}
            className="rounded-xl p-4 flex items-center gap-3 transition-all"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,.08)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-1)'; }}>
            <Icon size={18} style={{ color: fg }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{t(label)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
