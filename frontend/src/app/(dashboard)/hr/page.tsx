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
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">HR Dashboard</h1>
          <p className="text-sm text-slate-400">Workforce management & compliance</p>
        </div>
        <Link href="/hr/employees/new" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          + New Employee
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {cards.map((c) => {
          const inner = (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-3xl font-bold text-slate-800">{c.value}</div>
              <div className="text-sm text-slate-400 mt-1">{c.label}</div>
            </div>
          );
          return c.href ? <Link key={c.label} href={c.href}>{inner}</Link> : <div key={c.label}>{inner}</div>;
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">⚠ Upcoming Expiries (next 60 days)</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {alerts.length === 0 && <p className="px-5 py-4 text-sm text-slate-400">Nothing expiring soon.</p>}
          {alerts.map((a, i) => {
            const expired = new Date(a.expiryDate) < new Date();
            return (
              <Link key={i} href={`/hr/employees/${a.employeeId}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                <div className="text-sm text-slate-700">{a.employee}</div>
                <div className="flex items-center gap-3">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{a.type}</span>
                  <span className={`text-xs ${expired ? 'text-rose-600 font-medium' : 'text-amber-600'}`}>
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
