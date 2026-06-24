'use client';

/** SYS-mobile — Comms thread. Messages + composer for one channel, wired to commsApi. */
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { commsApi } from '@/lib/api';
import { Loader2, ChevronLeft, Send } from 'lucide-react';

export default function MobileThread() {
  const params = useParams();
  const channelId = String((params as any)?.id || '');
  const [channel, setChannel] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => commsApi.messages(channelId).then((m: any) => setMsgs(Array.isArray(m) ? m : (m?.items || []))).catch(() => {}), [channelId]);

  useEffect(() => {
    if (!channelId) return;
    commsApi.channel(channelId).then(setChannel).catch(() => {});
    load().finally(() => setLoading(false));
    commsApi.markRead(channelId).catch(() => {});
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [channelId, load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  const send = async () => {
    const b = text.trim(); if (!b) return;
    setText('');
    try { await commsApi.send(channelId, { type: 'TEXT', body: b }); load(); } catch { /* ignore */ }
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3" style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-1)' }}>
        <Link href="/m/comms" style={{ color: 'var(--text-3)' }}><ChevronLeft size={20} /></Link>
        <span className="font-semibold text-sm truncate">{channel?.title || 'Channel'}</span>
      </div>

      <div className="px-4 py-3" style={{ paddingBottom: 120 }}>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
          : msgs.length === 0 ? <div className="text-center py-10 text-sm" style={{ color: 'var(--text-3)' }}>No messages yet.</div>
            : msgs.map((m) => {
              const author = m.author?.preferredName || m.author?.fullName || m.authorName || '';
              if (m.type === 'SYSTEM') return <div key={m.id} className="text-center text-[11px] my-2" style={{ color: 'var(--text-3)' }}>{m.body}</div>;
              return (
                <div key={m.id} className="mb-3">
                  {author && <div className="text-[11px] mb-0.5" style={{ color: 'var(--gold)' }}>{author}</div>}
                  <div className="inline-block rounded-2xl px-3 py-2 text-sm" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)', maxWidth: '85%', whiteSpace: 'pre-wrap' }}>{m.body}</div>
                </div>
              );
            })}
        <div ref={endRef} />
      </div>

      {/* Composer — fixed just above the bottom tab bar */}
      <div className="fixed z-20 flex items-center gap-2 px-3 py-2" style={{ bottom: 54, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'var(--surface-1)', borderTop: '1px solid var(--border-1)' }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Message…"
          className="flex-1 rounded-full px-4 py-2 text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text-1)', outline: 'none' }} />
        <button onClick={send} aria-label="Send" style={{ width: 38, height: 38, borderRadius: 99, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#161C28', flexShrink: 0 }}><Send size={16} /></button>
      </div>
    </div>
  );
}
