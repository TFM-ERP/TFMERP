'use client';

/** SYS-mobile — Meetings. Upcoming meetings for the active production. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { meetingsApi } from '@/lib/api';
import { Loader2, ChevronLeft, CalendarDays, MapPin } from 'lucide-react';

const fmt = (d?: string) => { try { return d ? new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; } catch { return ''; } };

export default function MobileMeetings() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = typeof window !== 'undefined' ? localStorage.getItem('tfm_m_project') : null;
    meetingsApi.list(pid ? { projectId: pid } : {}).then((m: any) => setRows(Array.isArray(m) ? m : (m?.items || []))).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 pt-4">
      <Link href="/m/me" className="inline-flex items-center gap-1 text-sm mb-3" style={{ color: 'var(--text-3)' }}><ChevronLeft size={16} /> Tools</Link>
      <h1 className="text-2xl font-bold mb-3">Meetings</h1>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
        : rows.length === 0 ? <div className="text-center py-16 text-sm" style={{ color: 'var(--text-3)' }}>No meetings scheduled.</div>
          : <div className="flex flex-col gap-2">
            {rows.map((m) => (
              <div key={m.id} className="rounded-xl px-3 py-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
                <div className="text-sm font-medium">{m.title || 'Meeting'}</div>
                <div className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--gold)' }}><CalendarDays size={12} /> {fmt(m.startsAt || m.scheduledAt || m.startTime || m.date) || '—'}</div>
                {(m.location || m.locationName) && <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-3)' }}><MapPin size={12} /> {m.location || m.locationName}</div>}
              </div>
            ))}
          </div>}
    </div>
  );
}
