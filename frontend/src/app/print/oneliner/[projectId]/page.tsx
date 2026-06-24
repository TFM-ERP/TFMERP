'use client';

import { useEffect, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const NAVY = '#1a1a2e', GOLD = '#b08d57';
const pagesLabel = (p: number) => { const w = Math.floor(p); const e = Math.round((p - w) * 8); return (`${w || (e ? '' : '0')}${e ? ` ${e}/8` : ''}`).trim() || '0'; };

export default function OneLinerPrintPage() {
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

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing one-liner…</div>;
  if (!data) return <div style={{ padding: 32, color: 'red' }}>Schedule not available — restart the backend if scheduling was just updated.</div>;

  const th: any = { padding: '4px 6px', color: '#fff', fontSize: 8, textTransform: 'uppercase', fontWeight: 700, textAlign: 'start', letterSpacing: 0.3 };
  const td: any = { padding: '3px 6px', fontSize: 9.5, borderBottom: '1px solid #eee', verticalAlign: 'top' };

  return (
    <>
      <div className="print:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: NAVY, color: '#fff', padding: '9px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <span style={{ fontSize: 12, color: '#ddd' }}>One-Line Schedule</span>
        <button onClick={() => window.print()} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🖨️ Print / Save as PDF</button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 26px 40px', fontFamily: 'Arial, sans-serif', color: '#1a1a2e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2px solid ${NAVY}`, paddingBottom: 8, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {co?.logoUrl && <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 34, objectFit: 'contain' }} />}
            <div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{data.project?.title || 'Production'}</div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>One-Line Schedule</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 9, color: '#888' }}>
            <div>{data.shootDays} shoot days · {data.totalScenes} scenes · {pagesLabel(data.totalPages)} pages</div>
            <div>Generated {new Date(data.generatedAt).toLocaleDateString('en-GB')}</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: NAVY }}>
              <th style={{ ...th, width: 42 }}>Sc#</th>
              <th style={{ ...th, width: 34 }}>I/E</th>
              <th style={{ ...th, width: 34 }}>D/N</th>
              <th style={th}>Set / Location & Description</th>
              <th style={{ ...th, width: 42, textAlign: 'right' }}>Pgs</th>
              <th style={{ ...th, width: 150 }}>Cast</th>
            </tr>
          </thead>
          <tbody>
            {data.days.map((d: any) => (
              <Fragment key={d.day}>
                <tr style={{ background: '#f0ede6' }}>
                  <td colSpan={6} style={{ padding: '4px 6px', fontSize: 10, fontWeight: 800, color: NAVY, borderTop: `2px solid ${GOLD}` }}>
                    DAY {d.day}{d.dateLabel ? ` · ${d.dateLabel}` : ''}{d.locations?.length ? ` · ${d.locations.join(' / ')}` : ''}
                    <span style={{ float: 'right', fontWeight: 600, color: '#777' }}>{d.sceneCount} sc · {pagesLabel(d.pages)} pg</span>
                  </td>
                </tr>
                {(d.banners || []).map((b: string, i: number) => (
                  <tr key={`b${i}`}><td colSpan={6} style={{ padding: '2px 6px', fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: '#fff', background: '#333' }}>▦ {b}</td></tr>
                ))}
                {d.scenes.map((sc: any, i: number) => (
                  <tr key={i}>
                    <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{sc.sceneNumber || '—'}</td>
                    <td style={td}>{(sc.intExt || '').replace('_', '/')}</td>
                    <td style={td}>{sc.dayNight}</td>
                    <td style={td}><b>{sc.setName || sc.location || '—'}</b>{sc.description ? <span style={{ color: '#666' }}> — {sc.description}</span> : ''}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{pagesLabel(sc.pages)}</td>
                    <td style={{ ...td, color: '#555', fontSize: 8.5 }}>{(sc.cast || []).join(', ')}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>

        {data.cast?.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 8.5, color: '#777' }}>
            <b style={{ color: NAVY }}>Cast working span:</b> {data.cast.map((c: any) => `${c.name} (D${c.firstDay}–D${c.lastDay})`).join(' · ')}
          </div>
        )}
      </div>
    </>
  );
}
