'use client';

/** SYS-mobile — ScriptON reader. Browse script documents; open the active revision. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { productionApi, assetUrl } from '@/lib/api';
import { useMobileAccess } from '@/lib/mobileAccess';
import { Loader2, ChevronLeft, FileText, ChevronRight } from 'lucide-react';

export default function MobileScript() {
  const { ready, can } = useMobileAccess();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    const pid = typeof window !== 'undefined' ? localStorage.getItem('tfm_m_project') : null;
    if (!pid) { setLoading(false); return; }
    productionApi.script.list(pid).then((r: any) => setDocs(Array.isArray(r.data) ? r.data : [])).catch(() => { }).finally(() => setLoading(false));
  }, []);

  const open = async (doc: any) => {
    const revId = doc.activeRevisionId || doc.revisions?.[0]?.id;
    if (!revId) return;
    setOpening(doc.id);
    try {
      const r: any = await productionApi.script.getRevision(revId);
      const url = r.data?.pdfUrl;
      if (url) window.open(assetUrl(url), '_blank');
    } catch { /* ignore */ } finally { setOpening(null); }
  };

  if (ready && !can('script')) return <div className="px-4 pt-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>Your role doesn’t include the script.</div>;

  return (
    <div className="px-4 pt-4">
      <Link href="/m/me" className="inline-flex items-center gap-1 text-sm mb-3" style={{ color: 'var(--text-3)' }}><ChevronLeft size={16} /> Tools</Link>
      <h1 className="text-2xl font-bold mb-3">Script</h1>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
        : docs.length === 0 ? <div className="text-center py-16 text-sm" style={{ color: 'var(--text-3)' }}>No scripts uploaded yet.</div>
          : <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
            {docs.map((d, i) => {
              const active = d.revisions?.find((r: any) => r.id === d.activeRevisionId) || d.revisions?.[0];
              return (
                <button key={d.id} onClick={() => open(d)} disabled={!active} className="w-full flex items-center gap-3 px-4 py-3 text-start disabled:opacity-50" style={{ borderTop: i ? '1px solid var(--border-1)' : 'none' }}>
                  <FileText size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.title || 'Untitled'}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                      {active ? `${active.revisionLabel || 'Rev'}${active.pageCount ? ` · ${active.pageCount} pp` : ''}` : 'No revision'}
                    </div>
                  </div>
                  {opening === d.id ? <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-3)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />}
                </button>
              );
            })}
          </div>}
    </div>
  );
}
