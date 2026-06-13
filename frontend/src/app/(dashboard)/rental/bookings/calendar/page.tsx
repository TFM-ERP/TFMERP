'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { rentalApi } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#16a34a', ON_HIRE: '#16a34a', DELIVERED: '#16a34a', EXTENDED: '#0d9488',
  SCHEDULED: '#2563eb', DISPATCHED: '#2563eb', CONTRACT_SIGNED: '#2563eb', PICKUP_SCHEDULED: '#7c3aed',
  APPROVED: '#d97706', CONTRACT_SENT: '#d97706', AWAITING_PAYMENT: '#d97706',
  RETURNED: '#6b7280', INSPECTED: '#6b7280', COMPLETED: '#9ca3af', CLOSED: '#9ca3af',
};
const dayMs = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function AvailabilityCalendarPage() {
  const [days, setDays] = useState(30);
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const from = anchor;
  const to = useMemo(() => new Date(anchor.getTime() + (days - 1) * dayMs), [anchor, days]);

  const load = () => {
    setLoading(true);
    rentalApi.bookings.timeline(iso(from), iso(to)).then(r => setData(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [anchor, days]); // eslint-disable-line

  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => new Date(from.getTime() + i * dayMs)), [from, days]);
  const assets = data?.assets || [];
  const rangesByAsset: Record<string, any[]> = useMemo(() => {
    const m: Record<string, any[]> = {};
    (data?.ranges || []).forEach((r: any) => { (m[r.assetId] = m[r.assetId] || []).push(r); });
    return m;
  }, [data]);

  const COL = 30; // px per day
  const LABEL = 180;

  const barFor = (r: any) => {
    const s = new Date(r.startDate); s.setHours(0, 0, 0, 0);
    const e = new Date(r.endDate); e.setHours(0, 0, 0, 0);
    const startIdx = Math.max(0, Math.round((s.getTime() - from.getTime()) / dayMs));
    const endIdx = Math.min(days - 1, Math.round((e.getTime() - from.getTime()) / dayMs));
    if (endIdx < 0 || startIdx > days - 1) return null;
    const left = startIdx * COL;
    const width = (endIdx - startIdx + 1) * COL - 2;
    return { left, width, color: STATUS_COLOR[r.status] || '#6b7280' };
  };

  const shift = (n: number) => setAnchor(new Date(anchor.getTime() + n * days * dayMs));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/rental/bookings" className="btn-ghost p-2"><ArrowLeft size={16} /></Link>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Rentals · Scheduling</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Availability Calendar</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Who's on hire and when — spot free assets and clashes at a glance.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-28" value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
          </select>
          <button onClick={() => shift(-1)} className="btn-secondary p-2"><ChevronLeft size={15} /></button>
          <button onClick={() => setAnchor(() => { const d = new Date(); d.setHours(0,0,0,0); return d; })} className="btn-secondary text-xs">Today</button>
          <button onClick={() => shift(1)} className="btn-secondary p-2"><ChevronRight size={15} /></button>
        </div>
      </div>

      {/* legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: '#16a34a' }} /> On hire / active</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: '#2563eb' }} /> Scheduled</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: '#d97706' }} /> Pending</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: '#9ca3af' }} /> Closed</span>
      </div>

      {loading ? (
        <div className="card h-64 animate-pulse bg-gray-50" />
      ) : (
        <div className="card overflow-x-auto p-0">
          <div style={{ minWidth: LABEL + days * COL }}>
            {/* header row */}
            <div className="flex sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <div style={{ width: LABEL }} className="shrink-0 px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Asset</div>
              {dayList.map((d, i) => {
                const weekend = d.getDay() === 5 || d.getDay() === 6;
                return (
                  <div key={i} style={{ width: COL }} className={`shrink-0 text-center py-1 border-l border-gray-100 ${weekend ? 'bg-gray-100' : ''}`}>
                    <div className="text-[9px] text-gray-400">{d.toLocaleDateString('en-GB', { weekday: 'narrow' })}</div>
                    <div className="text-[11px] font-medium text-gray-600">{d.getDate()}</div>
                  </div>
                );
              })}
            </div>
            {/* rows */}
            {assets.map((a: any) => (
              <div key={a.id} className="flex border-b border-gray-50 hover:bg-gray-50/40 relative" style={{ height: 38 }}>
                <div style={{ width: LABEL }} className="shrink-0 px-3 py-2 truncate">
                  <Link href={`/rental/assets/${a.id}`} className="text-[13px] text-gray-700 hover:text-brand-600">{a.name}</Link>
                  <div className="text-[10px] text-gray-400">{String(a.assetType).replace(/_/g, ' ')}</div>
                </div>
                <div className="relative flex-1" style={{ height: 38 }}>
                  {dayList.map((d, i) => {
                    const weekend = d.getDay() === 5 || d.getDay() === 6;
                    return <div key={i} style={{ left: i * COL, width: COL }} className={`absolute top-0 bottom-0 border-l border-gray-50 ${weekend ? 'bg-gray-50/60' : ''}`} />;
                  })}
                  {(rangesByAsset[a.id] || []).map((r: any, idx: number) => {
                    const b = barFor(r);
                    if (!b) return null;
                    return (
                      <Link key={idx} href={`/rental/bookings/${r.bookingId}`} title={`${r.bookingNumber} · ${r.client} · ${r.status}`}
                        className="absolute rounded text-[10px] text-white px-1.5 flex items-center overflow-hidden whitespace-nowrap"
                        style={{ left: b.left + 1, width: b.width, top: 7, height: 24, background: b.color }}>
                        {r.bookingNumber}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            {assets.length === 0 && <div className="p-10 text-center text-gray-400 text-sm">No active assets.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
