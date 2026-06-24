'use client';

/** SYS-mobile — Search. Full-text across the channels you belong to. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { commsApi } from '@/lib/api';
import { Search as SearchIcon, Loader2, ChevronLeft } from 'lucide-react';

const fmt = (d?: string) => { try { return d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''; } catch { return ''; } };

export default function MobileSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setLoading(true); setDone(false);
    try {
      const d: any = await commsApi.search({ q: term });
      setRes(Array.isArray(d) ? d : (d?.items || d?.messages || []));
    } catch { setRes([]); } finally { setLoading(false); setDone(true); }
  };

  return (
    <div className="px-4 pt-4">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm mb-3" style={{ color: 'var(--text-3)' }}><ChevronLeft size={16} /> Back</button>
      <h1 className="text-2xl font-bold mb-3">Search</h1>
      <form onSubmit={run} className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
        <SearchIcon size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages…" autoFocus className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--text-1)' }} />
        {loading && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-3)' }} />}
      </form>
      {done && res.length === 0 && !loading && <div className="text-center py-12 text-sm" style={{ color: 'var(--text-3)' }}>No messages found.</div>}
      <div className="flex flex-col gap-2">
        {res.map((m) => (
          <button key={m.id} onClick={() => m.channel?.id && router.push(`/m/comms/${m.channel.id}`)} className="text-start rounded-xl px-3 py-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-xs font-medium truncate" style={{ color: 'var(--gold)' }}>{m.channel?.title || 'Channel'}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{fmt(m.createdAt)}</span>
            </div>
            <div className="text-sm line-clamp-2" style={{ color: 'var(--text-2)' }}>{m.body || '—'}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
