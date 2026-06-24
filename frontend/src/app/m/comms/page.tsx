'use client';

/** SYS-mobile — Comms · Channels. The user's channels for the active production. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { commsApi } from '@/lib/api';
import { Loader2, Hash, ChevronRight } from 'lucide-react';

export default function MobileComms() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = typeof window !== 'undefined' ? localStorage.getItem('tfm_m_project') : null;
    commsApi.channels(pid || undefined)
      .then((c: any) => setChannels(Array.isArray(c) ? c : (c?.items || c?.channels || [])))
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold mb-4">Chat</h1>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
      ) : channels.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--text-3)' }}>No channels yet.</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
          {channels.map((c, i) => (
            <Link key={c.id} href={`/m/comms/${c.id}`} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? '1px solid var(--border-1)' : 'none' }}>
              <Hash size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.title || 'Channel'}</div>
                {c.lastMessage?.body && <div className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{c.lastMessage.body}</div>}
              </div>
              {c.unreadCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#e24b4a', color: '#fff' }}>{c.unreadCount}</span>}
              <ChevronRight size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
