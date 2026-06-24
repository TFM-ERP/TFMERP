'use client';

/** SYS-mobile — DOOD. Day-out-of-days cast schedule for the active production. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { productionApi } from '@/lib/api';
import { useMobileAccess } from '@/lib/mobileAccess';
import { Loader2, ChevronLeft } from 'lucide-react';

const CODE: Record<string, [string, string]> = {
  W: ['W', 'var(--gold)'], H: ['H', 'var(--text-3)'],
  SW: ['S', '#34d399'], WF: ['F', '#6aa3ff'], SWF: ['SF', '#34d399'],
};

export default function MobileDood() {
  const { ready, can } = useMobileAccess();
  const [data, setData] = useState<{ days: number[]; rows: any[] }>({ days: [], rows: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = typeof window !== 'undefined' ? localStorage.getItem('tfm_m_project') : null;
    if (!pid) { setLoading(false); return; }
    productionApi.scheduling.dood(pid).then((r: any) => setData(r.data || { days: [], rows: [] })).catch(() => { }).finally(() => setLoading(false));
  }, []);

  if (ready && !can('dood')) return <div className="px-4 pt-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>Your role doesn’t include the schedule board.</div>;

  return (
    <div className="px-4 pt-4">
      <Link href="/m/me" className="inline-flex items-center gap-1 text-sm mb-3" style={{ color: 'var(--text-3)' }}><ChevronLeft size={16} /> Tools</Link>
      <h1 className="text-2xl font-bold mb-1">Cast · DOOD</h1>
      <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>Day-out-of-days · who works which day</p>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
        : data.rows.length === 0 ? <div className="text-center py-16 text-sm" style={{ color: 'var(--text-3)' }}>No cast schedule yet.</div>
          : (
            <div className="overflow-x-auto -mx-4 px-4 pb-2">
              <table className="border-collapse" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th className="sticky start-0 z-10 text-start px-2 py-1.5" style={{ background: 'var(--surface-0)', color: 'var(--text-3)', minWidth: 96 }}>Cast</th>
                    {data.days.map((d) => <th key={d} className="px-1.5 py-1.5 text-center font-medium" style={{ color: 'var(--text-3)', minWidth: 24 }}>{d}</th>)}
                    <th className="px-2 py-1.5 text-center" style={{ color: 'var(--text-3)' }}>Σ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.name} style={{ borderTop: '1px solid var(--border-1)' }}>
                      <td className="sticky start-0 z-10 px-2 py-1.5 font-medium truncate" style={{ background: 'var(--surface-0)', maxWidth: 96 }}>{row.name}</td>
                      {data.days.map((d) => {
                        const c = row.codes?.[d] || '';
                        const [label, color] = CODE[c] || ['', ''];
                        return <td key={d} className="px-1.5 py-1.5 text-center" style={{ color, fontWeight: c ? 700 : 400 }}>{label || '·'}</td>;
                      })}
                      <td className="px-2 py-1.5 text-center font-semibold" style={{ color: 'var(--gold)' }}>{row.workDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px]" style={{ color: 'var(--text-3)' }}>
        <span><b style={{ color: 'var(--gold)' }}>W</b> work</span>
        <span><b style={{ color: '#34d399' }}>S</b> start</span>
        <span><b style={{ color: '#6aa3ff' }}>F</b> finish</span>
        <span><b>H</b> hold</span>
      </div>
    </div>
  );
}
