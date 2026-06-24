'use client';

/** SYS-mobile — Travel & Visa. Trips for the active production. */
import { useEffect, useState } from 'react';
import { travelApi } from '@/lib/api';
import { useMobileAccess } from '@/lib/mobileAccess';
import { Loader2, Plane } from 'lucide-react';
import TravelTabs from '@/components/mobile/TravelTabs';

const fmt = (d?: string) => { try { return d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''; } catch { return ''; } };

export default function MobileTravel() {
  const { ready, can } = useMobileAccess();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = typeof window !== 'undefined' ? localStorage.getItem('tfm_m_project') : null;
    if (!pid) { setLoading(false); return; }
    travelApi.trips({ projectId: pid }).then((r: any) => setTrips(Array.isArray(r.data) ? r.data : (r.data?.items || []))).catch(() => setTrips([])).finally(() => setLoading(false));
  }, []);

  if (ready && !can('travel')) return <div className="px-4 pt-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>Your role doesn’t include travel.</div>;

  return (
    <div className="px-4 pt-4">
      <TravelTabs active="travel" />
      <h1 className="text-2xl font-bold mb-3">Travel &amp; Visa</h1>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
        : trips.length === 0 ? <div className="text-center py-16 text-sm" style={{ color: 'var(--text-3)' }}>No trips booked yet.</div>
          : <div className="flex flex-col gap-2">
            {trips.map((t) => {
              const who = t.traveler?.fullName || t.travelerName || t.name || 'Traveler';
              const route = [t.originCity || t.fromCity || t.origin, t.destinationCity || t.toCity || t.destination].filter(Boolean).join(' → ');
              const dates = [fmt(t.departDate || t.startDate || t.outboundDate), fmt(t.returnDate || t.endDate)].filter(Boolean).join(' – ');
              return (
                <div key={t.id} className="rounded-xl px-3 py-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
                  <div className="flex items-center gap-2">
                    <Plane size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                    <span className="text-sm font-medium flex-1 truncate">{who}</span>
                    {t.status && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{String(t.status).toLowerCase()}</span>}
                  </div>
                  {route && <div className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>{route}</div>}
                  {dates && <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{dates}</div>}
                </div>
              );
            })}
          </div>}
    </div>
  );
}
