'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const GOLD = '#0f172a';

export default function CreditsPrintPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      productionApi.credits.get(projectId),
      settingsApi.get().catch(() => ({ data: null })),
    ]).then(([r, c]) => { setDoc(r.data); setCo(c.data); }).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { if (!loading && doc) setTimeout(() => window.print(), 500); }, [loading, doc]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing credits…</div>;
  if (!doc) return <div style={{ padding: 32, color: 'red' }}>Credits not found.</div>;

  const blocks: any[] = (doc.blocks || []).filter((b: any) => (b.lines || []).length > 0);

  return (
    <>
      <div className="print:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#000', color: '#fff', padding: '9px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <button onClick={() => window.print()} style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🖨️ Print / Save as PDF</button>
      </div>

      <div style={{ background: '#000', minHeight: '100vh', paddingTop: 46 }} className="print:pt-0">
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 40px 80px', fontFamily: 'Georgia, "Times New Roman", serif', color: '#fff', textAlign: 'center' }}>
          {/* Title card */}
          {logoSrc(co?.logoUrl) ? <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 54, objectFit: 'contain', opacity: 0.95, marginBottom: 22, filter: 'brightness(0) invert(1)' }} /> : null}
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>{doc.title || 'Untitled'}</div>
          <div style={{ width: 60, height: 2, background: GOLD, margin: '14px auto 46px' }} />

          {blocks.map((b: any, i: number) => (
            <div key={i} style={{ marginBottom: 52 }}>
              <div style={{ fontSize: 13, letterSpacing: 4, textTransform: 'uppercase', color: GOLD, marginBottom: 22 }}>{b.heading}</div>
              {b.lines.map((l: any, j: number) => (
                <div key={j} style={{ marginBottom: 16 }}>
                  {l.role && <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#999' }}>{l.role}</div>}
                  <div style={{ fontSize: 19, fontWeight: 600, marginTop: 2 }}>{l.name}</div>
                </div>
              ))}
            </div>
          ))}

          {/* Production card */}
          <div style={{ marginTop: 70, paddingTop: 26, borderTop: `1px solid #333` }}>
            <div style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#777' }}>A Production of</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 8, letterSpacing: 1 }}>{co?.name || 'The Film Makers FZ LLC'}</div>
            <div style={{ fontSize: 10, color: '#555', marginTop: 18 }}>© {new Date().getFullYear()} {co?.name || 'The Film Makers FZ LLC'}. All rights reserved.</div>
          </div>
        </div>
      </div>

      <style>{`@media print { @page { size: A4 portrait; margin: 0; } body { background: #000 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print\\:hidden { display: none !important; } .print\\:pt-0 { padding-top: 0 !important; } }`}</style>
    </>
  );
}
