'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, AlertTriangle } from 'lucide-react';
import { crewApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

export default function CrewBookings({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crewApi.availability(id).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return null;
  const bookings = data?.bookings || [];

  return (
    <div className="max-w-3xl mx-auto px-6 pb-8">
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><CalendarDays size={15} /> Availability &amp; Bookings</h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-400">{data?.activeCount || 0} active</span>
            {data?.conflictCount > 0 && <span className="text-red-600 flex items-center gap-1"><AlertTriangle size={12} /> {data.conflictCount} overlap</span>}
          </div>
        </div>
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No project bookings yet. Assignments made on a project's Crew tab show up here.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-2 py-2 text-left">Project</th><th className="px-2 py-2 text-left">Role</th>
              <th className="px-2 py-2 text-left">Dates</th><th className="px-2 py-2 text-left">Location</th><th className="px-2 py-2 text-left">Deal memo</th>
            </tr></thead>
            <tbody>
              {bookings.map((b: any) => (
                <tr key={b.id} className={cn('border-b border-gray-50', b.conflict && 'bg-red-50/40')}>
                  <td className="px-2 py-2">
                    <Link href={`/production/projects/${b.projectId}`} className="font-medium text-gray-800 hover:text-brand-600">{b.project?.title || '—'}</Link>
                    {b.conflict && <AlertTriangle size={11} className="inline ml-1 text-red-500" />}
                    <div className="text-[11px] text-gray-400">{b.project?.projectNumber}</div>
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-xs">{String(b.role).replace(/_/g, ' ')}</td>
                  <td className="px-2 py-2 text-gray-500 text-xs">{b.startDate ? formatDate(b.startDate) : '—'}{b.endDate ? ` → ${formatDate(b.endDate)}` : ''}</td>
                  <td className="px-2 py-2 text-gray-500 text-xs">{b.location || '—'}</td>
                  <td className="px-2 py-2 text-gray-500 text-xs">{String(b.dealMemoStatus || '').replace(/_/g, ' ').toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
