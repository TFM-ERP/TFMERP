'use client';

/**
 * SYS-UX Phase 3 — notifications feed bell (ADDITIVE).
 * Bell + unread badge + dropdown of recent events; click to mark-read & deep-link.
 * Wired to userNotificationsApi (/me/notifications) with a sample fallback so it always renders.
 * Themed via tokens. Drop into any top bar (demo route now; app-wide behind a flag later).
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { userNotificationsApi } from '@/lib/api';

type Notif = { id: string; type?: string; title: string; body?: string; href?: string; readAt?: string | null; createdAt?: string };

const ICON: Record<string, string> = {
  CALL_SHEET_PUBLISHED: '📋', CONTRACT_SIGNED: '✍️', RUN_WRAPPED: '🚐', WEATHER_HOLD: '⛅', MENTION: '💬', DEFAULT: '🔔',
};
const SAMPLE: Notif[] = [
  { id: 'n1', type: 'CALL_SHEET_PUBLISHED', title: 'Call sheet published — Day 14', body: 'Desert Crossing · crew call 06:30', href: '/production/dashboard', createdAt: new Date(Date.now() - 6e5).toISOString() },
  { id: 'n2', type: 'WEATHER_HOLD', title: 'Weather hold flagged — Sc. 27', body: 'Checkpoint — rain rig on standby', href: '/scheduling-workspace', createdAt: new Date(Date.now() - 36e5).toISOString() },
  { id: 'n3', type: 'CONTRACT_SIGNED', title: 'Contract signed — L. Haddad', body: 'Cast · Lead', href: '/contracts', readAt: new Date().toISOString(), createdAt: new Date(Date.now() - 9e6).toISOString() },
  { id: 'n4', type: 'RUN_WRAPPED', title: 'Run wrapped — Director pickup', body: 'Transport · Sara', href: '/dispatch', readAt: new Date().toISOString(), createdAt: new Date(Date.now() - 1.2e7).toISOString() },
];
const ago = (iso?: string) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 6e4);
  if (m < 1) return 'now'; if (m < 60) return `${m}m`; const h = Math.round(m / 60); if (h < 24) return `${h}h`; return `${Math.round(h / 24)}d`;
};

export default function NotificationsFeed() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>(SAMPLE);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    userNotificationsApi.list().then((d: any) => { if (Array.isArray(d) && d.length) setItems(d); }).catch(() => { /* sample */ });
  }, []);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const unread = items.filter((n) => !n.readAt).length;
  const openItem = (n: Notif) => {
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    userNotificationsApi.markRead(n.id).catch(() => {});
    setOpen(false);
    if (n.href) router.push(n.href);
  };
  const markAll = () => {
    setItems((xs) => xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    userNotificationsApi.markAll().catch(() => {});
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} aria-label="Notifications"
        style={{ position: 'relative', width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border-1)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 15 }}>
        🔔
        {unread > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 99, background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{unread}</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 42, width: 340, maxHeight: 420, overflow: 'auto', zIndex: 70, background: 'var(--surface-1)', color: 'var(--text-1)', border: '1px solid var(--border-2)', borderRadius: 12, boxShadow: '0 18px 44px rgba(0,0,0,.4)', fontFamily: 'var(--font-sans)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--border-1)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>Notifications{unread ? ` · ${unread}` : ''}</span>
            {unread > 0 && <button onClick={markAll} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Mark all read</button>}
          </div>
          {items.length === 0 && <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>You’re all caught up.</div>}
          {items.map((n) => (
            <button key={n.id} onClick={() => openItem(n)}
              style={{ width: '100%', display: 'flex', gap: 11, textAlign: 'start', cursor: 'pointer', border: 'none', borderTop: '1px solid var(--border-1)', background: n.readAt ? 'transparent' : 'var(--accent-soft)', padding: '11px 14px' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{ICON[n.type ?? 'DEFAULT'] ?? ICON.DEFAULT}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)' }}>{n.title}</span>
                {n.body && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{n.body}</span>}
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--text-3)', flexShrink: 0 }}>{ago(n.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
