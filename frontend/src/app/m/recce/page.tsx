'use client';

/** SYS-mobile — Tech Recce. Locations for the active production; tap to capture photos. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { productionApi } from '@/lib/api';
import { useMobileAccess } from '@/lib/mobileAccess';
import { Loader2, MapPin, ChevronRight } from 'lucide-react';

export default function MobileRecce() {
  const { ready, can } = useMobileAccess();
  const [locs, setLocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = typeof window !== 'undefined' ? localStorage.getItem('tfm_m_project') : null;
    if (!pid) { setLoading(false); return; }
    productionApi.locations.list(pid).then((r: any) => { const d = r.data; setLocs(Array.isArray(d) ? d : (d?.items || d?.locations || [])); }).catch(() => setLocs([])).finally(() => setLoading(false));
  }, []);

  if (ready && !can('recce')) return <div className="px-4 pt-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>Your role doesn’t include locations.</div>;

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold mb-1">Tech Recce</h1>
      <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>Capture photos at each location for the recce pack.</p>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
      ) : locs.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--text-3)' }}>No locations yet for this production.</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
          {locs.map((l, i) => (
            <Link key={l.id} href={`/m/recce/${l.id}`} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? '1px solid var(--border-1)' : 'none' }}>
              <MapPin size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.name || l.title || 'Location'}</div>
                {(l.address || l.city) && <div className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{l.address || l.city}</div>}
              </div>
              <ChevronRight size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
