'use client';

import { WifiOff, RefreshCw, AlertTriangle, X, CloudUpload } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Status strip for offline-capable modules. Shows connection state, queued count,
 * and any items the backend permanently rejected (e.g. a CLOSED accounting period).
 * Driven by the useOfflineSync hook.
 */
export default function OfflineSyncBar({ sync }: { sync: any }) {
  const { online, pending, errors, syncing, flush, dismissError } = sync;
  if (online && pending === 0 && errors.length === 0) return null;

  return (
    <div className="space-y-2">
      {!online && (
        <div className="card bg-amber-50 border-amber-200 flex items-center gap-2 py-2 text-xs text-amber-800">
          <WifiOff size={14} /> Offline — entries are saved on this device and will sync automatically when you reconnect.
          {pending > 0 && <span className="font-semibold">({pending} queued)</span>}
        </div>
      )}
      {online && pending > 0 && (
        <div className="card bg-blue-50 border-blue-200 flex items-center justify-between py-2 text-xs text-blue-800">
          <span className="flex items-center gap-2"><CloudUpload size={14} /> {pending} entr{pending === 1 ? 'y' : 'ies'} waiting to sync.</span>
          <button onClick={flush} className="btn btn-secondary text-xs py-1 px-2"><RefreshCw size={11} className={cn('mr-1', syncing && 'animate-spin')} /> Sync now</button>
        </div>
      )}
      {errors.length > 0 && (
        <div className="card bg-red-50 border-red-200 py-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-700 mb-1"><AlertTriangle size={13} /> {errors.length} entr{errors.length === 1 ? 'y' : 'ies'} couldn't be posted</div>
          <ul className="space-y-1">
            {errors.map((e: any) => (
              <li key={e.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1 border border-red-100">
                <span className="text-gray-700 truncate">{e.label} — <span className="text-red-600">{e.error}</span></span>
                <button onClick={() => dismissError(e.id)} title="Discard this queued entry" className="text-gray-300 hover:text-red-500 ml-2 shrink-0"><X size={13} /></button>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-red-500 mt-1">Tip: a closed accounting period rejects late entries — reopen the period (Accounting → Periods) or discard and re-enter with an open date.</p>
        </div>
      )}
    </div>
  );
}
