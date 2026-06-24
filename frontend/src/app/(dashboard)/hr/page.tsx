'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { hrApi } from '@/lib/api';

export default function HrDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    hrApi.stats().then((r) => setStats(r.data)).catch(() => {});
    hrApi.expiryAlerts(60).then((r) => setAlerts(r.data)).catch(() => {});
  }, []);

  const cards = [
    { label: 'Total Employees', value: stats?.total ?? '—', href: '/hr/employees' },
    { label: 'Active', value: stats?.active ?? '—' },
    { label: 'On Leave', value: stats?.onLeave ?? '—', href: '/hr/leave' },
    { label: 'Drivers', value: stats?.drivers ?? '—' },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Human Resources</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>HR Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Workforce management &amp; compliance</p>
        </div>
        <Link href="/hr/employees/new" className="btn btn-primary text-sm">+ New Employee</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => {
          const inner = (
            <div className="rounded-xl p-5 h-full transition-all" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,.07)'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-1)'; }}>
              <div className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>{c.value}</div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>{c.label}</div>
            </div>
          );
          return c.href ? <Link key={c.label} href={c.href} className="block">{inner}</Link> : <div key={c.label}>{inner}</div>;
        })}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-1)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>⚠ Upcoming Expiries (next 60 days)</h2>
        </div>
        <div>
          {alerts.length === 0 && <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-3)' }}>Nothing expiring soon.</p>}
          {alerts.map((a, i) => {
            const expired = new Date(a.expiryDate) < new Date();
            return (
              <Link key={i} href={`/hr/employees/${a.employeeId}`} className="flex items-center justify-between px-5 py-3 transition-colors"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-1)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <div className="text-sm" style={{ color: 'var(--text-2)' }}>{a.employee}</div>
                <div className="flex items-center gap-3">
                  <span className="rounded px-2 py-0.5 text-xs" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>{a.type}</span>
                  <span className="text-xs font-medium" style={{ color: expired ? 'var(--danger)' : 'var(--warn)' }}>
                    {expired ? 'Expired' : 'Expires'} {String(a.expiryDate).slice(0, 10)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
