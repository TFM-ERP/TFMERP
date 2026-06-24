'use client';

/** SYS-mobile — Transport · Run-sheet. Today's runs for the active production. */
import { useEffect, useState } from 'react';
import { transportApi } from '@/lib/api';
import { useMobileAccess } from '@/lib/mobileAccess';
import { Loader2, ChevronRight, UserRound, Truck } from 'lucide-react';
import TravelTabs from '@/components/mobile/TravelTabs';

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtTime = (d?: string) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
const STATUS: Record<string, [string, string]> = {
  REQUESTED: ['Unassigned', 'var(--text-3)'], ASSIGNED: ['Dispatched', '#6aa3ff'], EN_ROUTE: ['En route', 'var(--gold)'],
  PASSENGER_ONBOARD: ['On board', '#34d399'], COMPLETED: ['Done', 'var(--ok)'], CANCELLED: ['Cancelled', 'var(--text-3)'],
};

export default function MobileTransport() {
  const { ready, can } = useMobileAccess();
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = typeof window !== 'undefined' ? localStorage.getItem('tfm_m_project') : null;
    if (!pid) { setLoading(false); return; }
    transportApi.orders({ projectId: pid, date: todayISO() }).then((r: any) => setRuns(Array.isArray(r.data) ? r.data : (r.data?.items || []))).catch(() => setRuns([])).finally(() => setLoading(false));
  }, []);

  if (ready && !can('transport')) return <div className="px-4 pt-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>Your role doesn’t include transport.</div>;

  return (
    <div className="px-4 pt-4">
      <TravelTabs active="transport" />
      <h1 className="text-2xl font-bold mb-3">Transport · Run-sheet</h1>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--text-3)' }}>No runs scheduled for today.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {runs.map((r) => {
            const [label, color] = STATUS[r.status] || ['—', 'var(--text-3)'];
            const veh = r.vehicle ? [r.vehicle.make, r.vehicle.model].filter(Boolean).join(' ') || r.vehicle.vehicleType : '';
            return (
              <div key={r.id} className="rounded-xl px-3 py-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold">{fmtTime(r.scheduledAt) || '—'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: 'var(--surface-2)', color }}>{label}</span>
                </div>
                <div className="text-sm flex items-center gap-1" style={{ color: 'var(--text-2)' }}>
                  <span className="truncate">{r.fromLocation || '?'}</span><ChevronRight size={12} style={{ color: 'var(--text-3)', flexShrink: 0 }} /><span className="truncate">{r.toLocation || '?'}</span>
                </div>
                {r.passengerNote && <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>👤 {r.passengerNote}</div>}
                {(r.driver || veh) && (
                  <div className="text-[11px] mt-1 flex flex-wrap gap-x-2" style={{ color: 'var(--text-3)' }}>
                    {r.driver && <span className="inline-flex items-center gap-1"><UserRound size={11} /> {r.driver.fullName}</span>}
                    {veh && <span className="inline-flex items-center gap-1"><Truck size={11} /> {veh} {r.vehicle?.plateNumber}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
