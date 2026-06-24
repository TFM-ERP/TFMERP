'use client';

/**
 * SYS-mobile — production mobile app shell (/m), for ALL roles (admin included).
 * Auth-guarded; wrapped in MobileAccessProvider so the bottom tabs + screens are gated by
 * the user's role/permissions. Tabs flip to `ready: true` as each screen is implemented.
 */
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, CalendarDays, MessageSquare, Camera, User } from 'lucide-react';
import { MobileAccessProvider, useMobileAccess } from '@/lib/mobileAccess';

const TABS = [
  { href: '/m', label: 'Today', icon: Home, mod: 'callsheet', ready: true },
  { href: '/m/schedule', label: 'Schedule', icon: CalendarDays, mod: 'schedule', ready: true },
  { href: '/m/comms', label: 'Chat', icon: MessageSquare, mod: 'comms', ready: true },
  { href: '/m/recce', label: 'Capture', icon: Camera, mod: 'recce', ready: true },
  { href: '/m/me', label: 'Me', icon: User, mod: 'home', ready: true },
];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can, ready } = useMobileAccess();
  // Only show a tab if it's built AND the role may use it (before access loads, show optimistically).
  const tabs = TABS.filter((t) => t.ready && (!ready || can(t.mod)));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', color: 'var(--text-1)', maxWidth: 480, margin: '0 auto', paddingBottom: 70, position: 'relative' }}>
      {children}
      {tabs.length > 0 && (
        <nav className="fixed bottom-0 z-40 flex" style={{ left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'var(--surface-1)', borderTop: '1px solid var(--border-1)' }}>
          {tabs.map((t) => {
            const active = t.href === '/m' ? pathname === '/m' : pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <Link key={t.href} href={t.href} className="flex-1 text-center">
                <div className="flex flex-col items-center gap-0.5 py-2" style={{ color: active ? 'var(--gold)' : 'var(--text-3)' }}>
                  <Icon size={20} /><span style={{ fontSize: 10 }}>{t.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => { if (typeof window !== 'undefined' && !localStorage.getItem('tfm_token')) router.replace('/login'); }, [router]);
  return (
    <MobileAccessProvider>
      <Shell>{children}</Shell>
    </MobileAccessProvider>
  );
}
