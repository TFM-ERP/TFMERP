'use client';

/** SYS-mobile — Me / Settings. Profile + quick links + sign out. */
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMobileAccess } from '@/lib/mobileAccess';
import { LogOut, Truck, ShieldCheck, ChevronRight, Route, Plane, BedDouble, CalendarDays, FileText, CalendarRange, Search, Film } from 'lucide-react';

export default function MobileMe() {
  const router = useRouter();
  const { name, role, ready, can } = useMobileAccess();
  const logout = () => { localStorage.removeItem('tfm_token'); localStorage.removeItem('tfm_user'); router.replace('/login'); };

  const Row = ({ href, icon: Icon, label, ext }: { href: string; icon: any; label: string; ext?: boolean }) => (
    <Link href={href} target={ext ? '_blank' : undefined} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--border-1)' }}>
      <Icon size={18} style={{ color: 'var(--text-3)' }} /><span className="flex-1 text-sm">{label}</span><ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
    </Link>
  );

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-3 mb-5">
        <div style={{ width: 52, height: 52, borderRadius: 99, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{(name || '?')[0]?.toUpperCase()}</div>
        <div><div className="text-lg font-bold">{name || 'You'}</div><div className="text-xs" style={{ color: 'var(--text-3)' }}>{(role || '').replace(/_/g, ' ')}</div></div>
      </div>
      <div className="rounded-xl overflow-hidden mb-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
        <div className="px-4 py-2 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Tools</div>
        <Row href="/m/search" icon={Search} label="Search" />
        <Row href="/m/projects" icon={Film} label="Productions" />
        {(!ready || can('transport')) && <Row href="/m/transport" icon={Route} label="Transport run-sheet" />}
        {(!ready || can('travel')) && <Row href="/m/travel" icon={Plane} label="Travel & visa" />}
        {(!ready || can('accommodation')) && <Row href="/m/accommodation" icon={BedDouble} label="Accommodation" />}
        {(!ready || can('dood')) && <Row href="/m/dood" icon={CalendarRange} label="Cast DOOD" />}
        {(!ready || can('script')) && <Row href="/m/script" icon={FileText} label="Script" />}
        <Row href="/m/meetings" icon={CalendarDays} label="Meetings" />
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
        <div className="px-4 py-2 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Account</div>
        <Row href="/account/security" icon={ShieldCheck} label="Identity & security" />
        <Row href="/driver/dispatch" icon={Truck} label="Driver app" ext />
      </div>
      <button onClick={logout} className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)', color: '#e24b4a' }}>
        <LogOut size={16} /> Sign out
      </button>
      <div className="text-center text-[11px] mt-6" style={{ color: 'var(--text-3)' }}>The Film Makers · mobile</div>
    </div>
  );
}
