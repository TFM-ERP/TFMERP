'use client';

import { useEffect, useState } from 'react';
import { getStatusDef, StatusModule } from '@/lib/statusConfig';
import { statusApi } from '@/lib/api';

interface StatusLogEntry {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  changedAt: string;
  notes: string | null;
  isAutomatic: boolean;
  changedBy: { fullName: string; role: string; avatarUrl?: string | null };
}

interface Props {
  module: StatusModule;
  recordId: string;
  className?: string;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function StatusTimeline({ module, recordId, className = '' }: Props) {
  const [history, setHistory] = useState<StatusLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    statusApi.history(module, recordId)
      .then(res => setHistory(Array.isArray(res.data) ? res.data : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [module, recordId]);

  if (loading) return (
    <div className={`space-y-3 ${className}`}>
      {[1, 2].map(i => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 space-y-1.5 pt-1">
            <div className="h-3 bg-gray-200 rounded w-1/3" />
            <div className="h-2.5 bg-gray-100 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );

  if (history.length === 0) return (
    <div className={`text-sm text-gray-400 py-4 text-center ${className}`}>
      No status history recorded yet.
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      {/* Vertical line */}
      <div className="absolute left-3 top-4 bottom-4 w-px bg-gray-200" />

      <div className="space-y-5">
        {history.map((entry, idx) => {
          const def = getStatusDef(module, entry.newStatus);
          const isFirst = idx === 0;
          const isLast = idx === history.length - 1;

          return (
            <div key={entry.id} className="flex gap-3 relative">
              {/* Status dot */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 text-sm border-2 border-white shadow-sm"
                style={{ background: def.dot }}
                title={def.label}
              >
                <span style={{ fontSize: 12 }}>{def.icon}</span>
              </div>

              {/* Content */}
              <div className="flex-1 pb-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${def.color} ${def.textColor} ${def.borderColor}`}
                  >
                    {def.label}
                  </span>
                  {entry.previousStatus && (
                    <span className="text-[10px] text-gray-400">
                      ← {getStatusDef(module, entry.previousStatus).label}
                    </span>
                  )}
                  {entry.isAutomatic && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full border border-gray-200">
                      Auto
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                  <span className="font-medium text-gray-700">{entry.changedBy?.fullName ?? 'System'}</span>
                  <span>·</span>
                  <span>{formatDateTime(entry.changedAt)}</span>
                </div>

                {entry.notes && (
                  <div className="mt-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 italic">
                    "{entry.notes}"
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
