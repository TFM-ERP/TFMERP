'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const GOLD = '#0f172a', NAVY = '#1a1a2e';
const CATS = ['CAST', 'BACKGROUND', 'STUNTS', 'VEHICLES', 'ANIMALS', 'PROPS', 'SET_DRESSING', 'WARDROBE', 'MAKEUP_HAIR', 'SFX', 'VFX', 'SPECIAL_EQUIPMENT', 'SOUND_MUSIC', 'ART', 'GREENERY', 'SECURITY', 'OTHER'];
const label = (c: string) => c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, m => m.toUpperCase());
const pagesLabel = (p: number) => { const w = Math.floor(p); const e = Math.round((p - w) * 8); return `${w || (e ? '' : '0')}${e ? ` ${e}/8` : ''}`.trim() || '0'; };

export default function BreakdownSheetPrint() {
  const { stripId } = useParams<{ stripId: string }>();
  const [s, setS] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([productionApi.breakdown.sheet(stripId), settingsApi.get().catch(() => ({ data: null }))])
      .then(([r, c]) => { setS(r.data); setCo(c.data); }).finally(() => setLoading(false));
  }, [stripId]);
  useEffect(() => { if (!loading && s) setTimeout(() => window.print(), 500); }, [loading, s]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing breakdown…</div>;
  if (!s) return <div style={{ padding: 32, color: 'red' }}>Scene not found.</div>;

  const els: any[] = s.elements || [];
  const byCat: Record<string, any[]> = {};
  for (const e of els) (byCat[e.category] = byCat[e.category] || []).push(e);
  const cast: string[] = Array.isArray(s.cast) ? s.cast : [];
  const field = (l: string, v: any) => (
    <div style={{ flex: 1 }}><div style={{ fontSize: 7.5, color: '#999', textTransform: 'uppercase', fontWeight: 700 }}>{l}</div><div style={{ fontWeight: 700 }}>{v || '—'}</div></div>
  );

  return (
    <>
      <div className="print:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: NAVY, color: '#fff', padding: '9px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <button onClick={() => window.print()} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🖨️ Print / Save as PDF</button>
      </div>

      <div style={{ background: '#fff', minHeight: '100vh', paddingTop: 46 }} className="print:pt-0">
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 34px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 9.5, color: '#222' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>BREAKDOWN SHEET</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{s.project?.title || ''} {s.project?.projectNumber ? `· ${s.project.projectNumber}` : ''}</div>
            </div>
            {logoSrc(co?.logoUrl) ? <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 42, objectFit: 'contain' }} /> :
              <div style={{ fontSize: 9, color: '#999', textAlign: 'right' }}>{co?.name || 'The Film Makers FZ LLC'}</div>}
          </div>
          <div style={{ borderTop: `2px solid ${GOLD}`, margin: '10px 0 12px' }} />

          {/* Scene meta */}
          <div style={{ display: 'flex', gap: 10, background: '#F8F4EA', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
            {field('Scene', s.sceneNumber)}
            {field('INT/EXT', String(s.intExt).replace('_', '/'))}
            {field('Day/Night', s.dayNight)}
            {field('Pages', pagesLabel(Number(s.pages)))}
            {field('Shoot Day', s.shootDay > 0 ? s.shootDay : '—')}
          </div>
          <div style={{ display: 'flex', gap: 10, padding: '0 2px 10px' }}>
            {field('Set / Location', s.setName || s.location)}
            <div style={{ flex: 2 }}>{field('Description', s.description)}</div>
          </div>
          {cast.length > 0 && <div style={{ marginBottom: 10, fontSize: 9 }}><b>Cast:</b> {cast.join(', ')}</div>}

          {/* Element categories grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {CATS.filter(c => byCat[c]).map(c => (
              <div key={c} style={{ border: '1px solid #eee', borderRadius: 6, overflow: 'hidden', breakInside: 'avoid' }}>
                <div style={{ background: NAVY, color: '#fff', padding: '3px 8px', fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>{label(c)}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {byCat[c].map((e: any) => (
                      <tr key={e.id}>
                        <td style={{ padding: '2px 8px', fontSize: 9, borderBottom: '1px solid #f3f3f3' }}>{e.name}{e.quantity > 1 ? ` (×${e.quantity})` : ''}</td>
                        <td style={{ padding: '2px 8px', fontSize: 8.5, color: '#888', borderBottom: '1px solid #f3f3f3', textAlign: 'right', width: 70 }}>{e.costCenterCode || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {els.length === 0 && <div style={{ color: '#aaa', fontSize: 9 }}>No elements logged for this scene.</div>}
          </div>

          <div style={{ borderTop: '1px solid #ddd', marginTop: 18, paddingTop: 8, textAlign: 'center', color: '#999', fontSize: 8 }}>
            {co?.name || 'The Film Makers FZ LLC'} · Generated {new Date().toLocaleString('en-GB')}
          </div>
        </div>
      </div>

      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print\\:hidden { display: none !important; } .print\\:pt-0 { padding-top: 0 !important; } }`}</style>
    </>
  );
}
