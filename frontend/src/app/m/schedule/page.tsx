'use client';

/** SYS-mobile — Schedule · Stripboard. Shoot days + scenes for the active production,
 *  wired to productionApi.scheduling.board. */
import { useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';
import { useMobileAccess } from '@/lib/mobileAccess';
import { Loader2 } from 'lucide-react';

const fmtDate = (d?: string) => { try { return d ? new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : ''; } catch { return ''; } };

function StripRow({ s, i }: { s: any; i: number }) {
  const cast = Array.isArray(s.cast) ? s.cast.filter(Boolean) : [];
  return (
    <div className="flex gap-3 px-3 py-2.5" style={{ borderTop: i ? '1px solid var(--border-1)' : 'none' }}>
      {s.sceneNumber && <span className="text-sm font-bold w-9 shrink-0" style={{ color: 'var(--text-2)' }}>{s.sceneNumber}</span>}
      <div className="min-w-0 flex-1">
        <div className="text-sm truncate">{[s.intExt, s.setName || s.description].filter(Boolean).join('  ')}</div>
        <div className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{[s.dayNight, s.pages ? `${s.pages}p` : null, cast.length ? `cast ${cast.join(', ')}` : null].filter(Boolean).join(' · ')}</div>
      </div>
    </div>
  );
}

export default function MobileSchedule() {
  const { ready, can } = useMobileAccess();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = typeof window !== 'undefined' ? localStorage.getItem('tfm_m_project') : null;
    if (!pid) { setLoading(false); return; }
    productionApi.scheduling.board(pid).then((r: any) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (ready && !can('schedule')) return <div className="px-4 pt-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>Your role doesn’t include the schedule.</div>;

  const board: any[] = Array.isArray(data?.board) ? data.board : [];
  const unscheduled: any[] = Array.isArray(data?.unscheduled) ? data.unscheduled : [];

  return (
    <div className="px-4 pt-6">
      <div className="flex items-baseline gap-2 mb-3">
        <h1 className="text-2xl font-bold">Schedule</h1>
        {data && <span className="text-xs" style={{ color: 'var(--text-3)' }}>{data.shootDays} days · {data.totalScenes} scenes</span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
      ) : board.length === 0 && unscheduled.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--text-3)' }}>No stripboard yet for this production.</div>
      ) : (
        <>
          {board.map((day) => (
            <div key={day.dayNumber} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold" style={{ color: 'var(--gold)' }}>Day {day.dayNumber}</span>
                <span className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{[fmtDate(day.date), day.location, day.callTime].filter(Boolean).join(' · ')}</span>
                <div className="flex-1" />
                <span className="text-[11px] shrink-0" style={{ color: 'var(--text-3)' }}>{day.pages}p</span>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
                {(day.strips || []).map((s: any, i: number) => <StripRow key={s.id || i} s={s} i={i} />)}
              </div>
            </div>
          ))}
          {unscheduled.length > 0 && (
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Unscheduled · {unscheduled.length}</div>
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
                {unscheduled.map((s: any, i: number) => <StripRow key={s.id || i} s={s} i={i} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
