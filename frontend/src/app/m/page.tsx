'use client';

/** SYS-mobile — "Run the Day" home. Role-universal: today's call sheet for the active
 *  production (crew/shoot/wrap calls + today's scenes), wired to productionApi.scheduling. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { productionApi } from '@/lib/api';
import { useMobileAccess } from '@/lib/mobileAccess';
import ProductionSwitcher from '@/components/mobile/ProductionSwitcher';
import { Loader2, ChevronRight, FileText } from 'lucide-react';

const todayISO = () => new Date().toISOString().slice(0, 10);
const dOnly = (d?: string) => (d ? String(d).slice(0, 10) : '');
// Deterministic, locale-independent date label so server and client render identically (no hydration mismatch).
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d?: string) => {
  if (!d) return '';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return '';
  const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return `${WD[wd]}, ${day} ${MO[m - 1]}`;
};

export default function MobileHome() {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [cs, setCs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'INT' | 'EXT'>('all');
  const access = useMobileAccess();

  useEffect(() => {
    if (!access.ready) return;
    const isAdmin = /ADMIN/i.test(access.role || '');
    const req = isAdmin ? productionApi.projects.list() : productionApi.projects.mine();
    req.then((r: any) => {
      const d = r.data; const list = Array.isArray(d) ? d : (d?.items || d?.projects || []);
      setProjects(list);
      const saved = typeof window !== 'undefined' ? localStorage.getItem('tfm_m_project') : null;
      setProjectId((saved && list.some((p: any) => p.id === saved)) ? saved : (list[0]?.id || ''));
      if (!list.length) setLoading(false);
    }).catch(() => setLoading(false));
  }, [access.ready, access.role]);

  useEffect(() => {
    if (!projectId) return;
    localStorage.setItem('tfm_m_project', projectId);
    setLoading(true);
    const today = todayISO();
    // Today's published call sheet is the rich source (calls/location/scenes); if none is
    // authored yet, fall back to the auto-generated schedule so today's scenes still show.
    productionApi.callsheets.list(projectId).then((r: any) => {
      const list: any[] = Array.isArray(r.data) ? r.data : (r.data?.items || []);
      const sheet = list.find((c) => dOnly(c.shootDate) === today)
        || list.find((c) => c.status === 'PUBLISHED' && dOnly(c.shootDate) >= today)
        || list.find((c) => c.status === 'PUBLISHED') || list[0] || null;
      if (sheet) { setCs(sheet); setLoading(false); return; }
      return productionApi.scheduling.callsheetData(projectId, today).then((s: any) => {
        const scenes = (Array.isArray(s.data?.scenes) ? s.data.scenes : []).map((x: any) => ({ scene: x.sceneNumber, intExt: x.intExt, description: x.description || x.setName, location: x.location, pages: x.pages }));
        setCs({ scheduleItems: scenes, _fromSchedule: true });
      }).catch(() => setCs(null)).finally(() => setLoading(false));
    }).catch(() => { setCs(null); setLoading(false); });
  }, [projectId]);

  if (access.ready && !access.can('callsheet')) {
    return <div className="px-4 pt-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>Your role doesn’t include the call sheet — use the tabs below for what you can access.</div>;
  }
  const project = projects.find((p) => p.id === projectId);
  const scenes: any[] = Array.isArray(cs?.scheduleItems) ? cs.scheduleItems : [];
  const shown = scenes.filter((s) => filter === 'all' || String(s.intExt || '').toUpperCase().includes(filter));
  const stat = (label: string, v: any) => (
    <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
      <div className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{label}</div>
      <div className="text-xl font-bold mt-0.5" style={{ color: 'var(--text-1)' }}>{v || '—'}</div>
    </div>
  );

  return (
    <div className="px-4 pt-5">
      {/* Header */}
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>
            {cs?.dayNumber ? `Today · day ${cs.dayNumber}${cs.totalDays ? ` of ${cs.totalDays}` : ''}` : `Today · ${fmtDate(todayISO())}`}
          </div>
          <h1 className="text-2xl font-bold leading-tight mt-0.5 truncate">{project?.title || project?.projectNumber || 'Production'}</h1>
          <div className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>{[fmtDate(cs?.shootDate) || fmtDate(todayISO()), cs?.locationName].filter(Boolean).join(' · ')}</div>
        </div>
        <ProductionSwitcher projects={projects} value={projectId} onChange={setProjectId} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
      ) : !projects.length ? (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--text-3)' }}>No productions yet.</div>
      ) : (
        <>
          {/* Call stat cards */}
          <div className="flex gap-2 mb-4">
            {stat('Crew call', cs?.generalCall)}
            {stat('Shoot call', cs?.shootingCall)}
            {stat('Est. wrap', cs?.estWrap)}
          </div>

          {/* Today's scenes */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold">Today’s scenes</span>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{shown.length} setup{shown.length === 1 ? '' : 's'}</span>
            <div className="flex-1" />
            {(['all', 'INT', 'EXT'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: filter === f ? 'var(--gold)' : 'var(--surface-2)', color: filter === f ? '#161C28' : 'var(--text-3)', fontWeight: 600 }}>
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {shown.length === 0 ? (
              <div className="text-center py-10 text-sm rounded-xl" style={{ border: '1px dashed var(--border-2)', color: 'var(--text-3)' }}>
                {cs ? 'No scenes scheduled for today.' : 'No call sheet published for today.'}
              </div>
            ) : shown.map((s, i) => (
              <Link key={i} href="/m/call-sheet" className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
                {s.scene && <span className="text-sm font-bold w-9 shrink-0" style={{ color: 'var(--gold)' }}>{s.scene}</span>}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{[s.intExt, s.description || s.location].filter(Boolean).join('  ')}</div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{[s.pages, s.time, s.cast ? `cast ${s.cast}` : null].filter(Boolean).join(' · ')}</div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <Link href="/m/call-sheet" className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm" style={{ background: 'var(--gold)', color: '#161C28' }}>
              <FileText size={16} /> Call sheet
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
