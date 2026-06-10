'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, Check, Mail } from 'lucide-react';
import { notificationsApi } from '@/lib/api';

const DISMISS_KEY = 'tfm_notif_dismissed';
const lsGet = (): string[] => { try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'); } catch { return []; } };
const lsSet = (v: string[]) => { try { localStorage.setItem(DISMISS_KEY, JSON.stringify(v)); } catch {} };

const SEV: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#6b7280' };

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => notificationsApi.list().then(r => setItems(r.data || [])).catch(() => {});
  useEffect(() => {
    setDismissed(lsGet());
    load();
    const t = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const visible = items.filter(i => !dismissed.includes(i.key));
  const dismiss = (key: string) => { const next = [...dismissed, key]; setDismissed(next); lsSet(next); };
  const dismissAll = () => { const next = [...new Set([...dismissed, ...visible.map(i => i.key)])]; setDismissed(next); lsSet(next); };
  const go = (link: string, key: string) => { setOpen(false); router.push(link); };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50" aria-label="Notifications">
        <span className="relative inline-flex">
          <Bell size={16} />
          {visible.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {visible.length}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            <div className="flex items-center gap-3">
              <button onClick={async () => { try { const r = await notificationsApi.emailDigest(); alert(r.data.sent ? `Digest emailed (${r.data.count} items).` : (r.data.message || 'Nothing to send.')); } catch (e: any) { alert(e.response?.data?.message || 'Could not send — check Email setup.'); } }}
                className="text-xs text-gray-500 hover:text-brand-700 flex items-center gap-1" title="Email this digest"><Mail size={12} /> Digest</button>
              {visible.length > 0 && <button onClick={dismissAll} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"><Check size={12} /> Clear all</button>}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">You're all caught up.</div>
            ) : visible.map(n => (
              <div key={n.key} className="flex items-start gap-2.5 px-4 py-3 border-b border-gray-50 hover:bg-gray-50/60">
                <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: SEV[n.severity] || SEV.low }} />
                <button onClick={() => go(n.link, n.key)} className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium text-gray-800">{n.title}</div>
                  <div className="text-xs text-gray-500">{n.message}</div>
                </button>
                <button onClick={() => dismiss(n.key)} className="text-gray-300 hover:text-gray-500 shrink-0" aria-label="Dismiss"><X size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
