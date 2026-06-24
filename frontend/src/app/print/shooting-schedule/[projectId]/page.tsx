'use client';

import { useEffect, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const NAVY = '#1a1a2e', GOLD = '#b08d57';
const pagesLabel = (p: number) => { const w = Math.floor(p); const e = Math.round((p - w) * 8); return (`${w || (e ? '' : '0')}${e ? ` ${e}/8` : ''}`).trim() || '0'; };
const CAT_LABEL: Record<string, string> = {
  CAST: 'Cast', BACKGROUND: 'Background', STUNTS: 'Stunts', VEHICLES: 'Vehicles', ANIMALS: 'Animals',
  PROPS: 'Props', SET_DRESSING: 'Set Dressing', WARDROBE: 'Wardrobe', MAKEUP_HAIR: 'Makeup/Hair',
  SFX: 'SFX', VFX: 'VFX', SPECIAL_EQUIPMENT: 'Special Equipment', SOUND_MUSIC: 'Sound/Music',
  ART: 'Art', GREENERY: 'Greenery', SECURITY: 'Security', OTHER: 'Other',
};

export default function ShootingSchedulePrintPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      productionApi.scheduling.shootingSchedule(projectId),
      settingsApi.get().catch(() => ({ data: null })),
    ]).then(([s, c]) => { setData(s.data); setCo(c.data); }).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { if (!loading && data) setTimeout(() => window.print(), 500); }, [loading, data]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing shooting schedule…</div>;
  if (!data) return <div style={{ padding: 32, color: 'red' }}>Schedule not available — restart the backend if scheduling was just updated.</div>;

  return (
    <>
      <div className="print:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: NAVY, color: '#fff', padding: '9px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <span style={{ fontSize: 12, color: '#ddd' }}>Shooting Schedule</span>
        <button onClick={() => window.print()} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🖨️ Print / Save as PDF</button>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '60px 26px 40px', fontFamily: 'Arial, sans-serif', color: '#1a1a2e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2px solid ${NAVY}`, paddingBottom: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {co?.logoUrl && <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 36, objectFit: 'contain' }} />}
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{data.project?.title || 'Production'}</div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Shooting Schedule</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 9, color: '#888' }}>
            <div>{data.shootDays} shoot days · {data.totalScenes} scenes · {pagesLabel(data.totalPages)} pages</div>
            <div>Generated {new Date(data.generatedAt).toLocaleDateString('en-GB')}</div>
          </div>
        </div>

        {data.days.map((d: any) => (
          <div key={d.day} style={{ marginBottom: 18, breakInside: 'avoid' }}>
            <div style={{ background: NAVY, color: '#fff', padding: '6px 10px', borderRadius: '5px 5px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>DAY {d.day}{d.dateLabel ? ` · ${d.dateLabel}` : ''}</span>
              <span style={{ fontSize: 9, color: GOLD, fontWeight: 700 }}>{d.locations?.join(' / ') || ''} · {d.sceneCount} sc · {pagesLabel(d.pages)} pg</span>
            </div>
            <div style={{ border: '1px solid #e5e2db', borderTop: 'none', borderRadius: '0 0 5px 5px' }}>
              {(d.banners || []).map((b: string, i: number) => (
                <div key={`b${i}`} style={{ background: '#333', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: 0.5, padding: '3px 10px' }}>▦ {b}</div>
              ))}
              {d.scenes.map((sc: any, i: number) => {
                const cats = Object.keys(sc.elements || {});
                return (
                  <div key={i} style={{ padding: '6px 10px', borderBottom: i < d.scenes.length - 1 ? '1px solid #f0eee9' : 'none' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 11, minWidth: 34 }}>{sc.sceneNumber || '—'}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: sc.intExt === 'EXT' ? '#d8f0ec' : '#eee', color: sc.intExt === 'EXT' ? '#0c7a6b' : '#555' }}>{(sc.intExt || '').replace('_', '/')}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: sc.dayNight === 'NIGHT' ? '#1a1a2e' : '#fde68a', color: sc.dayNight === 'NIGHT' ? '#fff' : '#92400e' }}>{sc.dayNight}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, flex: 1 }}>{sc.setName || sc.location || '—'}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#777' }}>{pagesLabel(sc.pages)} pg</span>
                    </div>
                    {sc.description && <div style={{ fontSize: 9.5, color: '#555', margin: '2px 0 0 42px' }}>{sc.description}</div>}
                    {sc.cast?.length > 0 && <div style={{ fontSize: 9, color: '#1a1a2e', margin: '3px 0 0 42px' }}><b style={{ color: GOLD }}>Cast:</b> {sc.cast.join(', ')}</div>}
                    {cats.length > 0 && (
                      <div style={{ margin: '2px 0 0 42px', fontSize: 8.5, color: '#666' }}>
                        {cats.map((c: string) => <span key={c} style={{ marginRight: 10 }}><b>{CAT_LABEL[c] || c}:</b> {(sc.elements[c] || []).join(', ')}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
