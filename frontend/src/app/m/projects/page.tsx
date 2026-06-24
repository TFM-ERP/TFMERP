'use client';

/** SYS-mobile — Productions. Admins see every project; others see theirs. Tap to make active. */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { productionApi } from '@/lib/api';
import { useMobileAccess } from '@/lib/mobileAccess';
import { Loader2, ChevronLeft, Film, Check } from 'lucide-react';

const STATUS: Record<string, string> = {
  ACTIVE: 'var(--ok)', IN_PRODUCTION: 'var(--gold)', PREP: '#6aa3ff', WRAP: '#a78bfa', ARCHIVED: 'var(--text-3)',
};

export default function MobileProjects() {
  const router = useRouter();
  const { ready, role } = useMobileAccess();
  const isAdmin = /ADMIN/i.test(role || '');
  const [rows, setRows] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    setActive(typeof window !== 'undefined' ? localStorage.getItem('tfm_m_project') : null);
    const call = isAdmin ? productionApi.projects.list() : productionApi.projects.mine();
    call.then((r: any) => setRows(r.data?.items || (Array.isArray(r.data) ? r.data : []))).catch(() => setRows([])).finally(() => setLoading(false));
  }, [ready, isAdmin]);

  const choose = (id: string) => { localStorage.setItem('tfm_m_project', id); router.push('/m'); };

  return (
    <div className="px-4 pt-4">
      <Link href="/m/me" className="inline-flex items-center gap-1 text-sm mb-3" style={{ color: 'var(--text-3)' }}><ChevronLeft size={16} /> Tools</Link>
      <h1 className="text-2xl font-bold mb-1">{isAdmin ? 'All productions' : 'My productions'}</h1>
      <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>Tap to set the active production</p>
      {loading || !ready ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
        : rows.length === 0 ? <div className="text-center py-16 text-sm" style={{ color: 'var(--text-3)' }}>No productions.</div>
          : <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
            {rows.map((p, i) => (
              <button key={p.id} onClick={() => choose(p.id)} className="w-full flex items-center gap-3 px-4 py-3 text-start" style={{ borderTop: i ? '1px solid var(--border-1)' : 'none' }}>
                <Film size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.title || 'Untitled'}</div>
                  <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
                    {p.projectNumber && <span>#{p.projectNumber}</span>}
                    {p.status && <span style={{ color: STATUS[p.status] || 'var(--text-3)' }}>{String(p.status).replace(/_/g, ' ').toLowerCase()}</span>}
                  </div>
                </div>
                {active === p.id && <Check size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
              </button>
            ))}
          </div>}
    </div>
  );
}
