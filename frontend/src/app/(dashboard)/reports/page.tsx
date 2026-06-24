'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, ArrowRight, DollarSign, Truck, Users } from 'lucide-react';
import { reportsApi } from '@/lib/api';

const CAT_ICON: Record<string, any> = { Financial: DollarSign, Rental: Truck, HR: Users };

export default function ReportsCenterPage() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { reportsApi.catalog().then(r => setCatalog(r.data || [])).finally(() => setLoading(false)); }, []);

  const groups = catalog.reduce((acc: any, r: any) => { (acc[r.category] = acc[r.category] || []).push(r); return acc; }, {});

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}><BarChart3 size={18} style={{ color: 'var(--accent)' }} /></div>
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Insights · Reporting</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Reports Center</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Run, filter, print and export any report. All share one branded PDF layout.</p>
        </div>
      </div>

      {loading ? <div className="rounded-xl h-40 animate-pulse" style={{ background: 'var(--surface-2)' }} /> : Object.keys(groups).map(cat => {
        const Icon = CAT_ICON[cat] || BarChart3;
        return (
          <div key={cat}>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--text-3)' }}><Icon size={14} /> {cat}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {groups[cat].map((r: any) => (
                <Link key={r.key} href={`/reports/${r.key}`} className="rounded-xl p-4 flex items-center justify-between transition-all"
                  style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,.07)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--text-1)' }}>{r.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{r.dateRange ? 'Date range' : 'Snapshot'}</div>
                  </div>
                  <ArrowRight size={15} style={{ color: 'var(--text-3)' }} />
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
