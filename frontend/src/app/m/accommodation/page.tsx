'use client';

/** SYS-mobile — Accommodation. Room assignments for the active production. */
import { useEffect, useState } from 'react';
import { accommodationApi } from '@/lib/api';
import { useMobileAccess } from '@/lib/mobileAccess';
import { Loader2, BedDouble } from 'lucide-react';
import TravelTabs from '@/components/mobile/TravelTabs';

const fmt = (d?: string) => { try { return d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''; } catch { return ''; } };

export default function MobileAccommodation() {
  const { ready, can } = useMobileAccess();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = typeof window !== 'undefined' ? localStorage.getItem('tfm_m_project') : null;
    if (!pid) { setLoading(false); return; }
    accommodationApi.assignments({ projectId: pid }).then((r: any) => setRows(Array.isArray(r.data) ? r.data : (r.data?.items || []))).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  if (ready && !can('accommodation')) return <div className="px-4 pt-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>Your role doesn’t include accommodation.</div>;

  return (
    <div className="px-4 pt-4">
      <TravelTabs active="stay" />
      <h1 className="text-2xl font-bold mb-3">Accommodation</h1>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
        : rows.length === 0 ? <div className="text-center py-16 text-sm" style={{ color: 'var(--text-3)' }}>No room assignments yet.</div>
          : <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
            {rows.map((a, i) => {
              const who = a.traveler?.fullName || a.guestName || a.name || 'Guest';
              const where = [a.property?.name || a.propertyName, a.room?.name || a.roomName || a.roomNumber].filter(Boolean).join(' · ');
              const dates = [fmt(a.checkIn || a.checkInDate), fmt(a.checkOut || a.checkOutDate)].filter(Boolean).join(' – ');
              return (
                <div key={a.id || i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? '1px solid var(--border-1)' : 'none' }}>
                  <BedDouble size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{who}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{[where, dates].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                </div>
              );
            })}
          </div>}
    </div>
  );
}
