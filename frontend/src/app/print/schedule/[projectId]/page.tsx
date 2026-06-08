'use client';

import { useEffect, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const GOLD = '#0f172a', NAVY = '#1a1a2e';
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) : '';
const pagesLabel = (p: number) => { const w = Math.floor(p); const e = Math.round((p - w) * 8); return `${w || (e ? '' : '0')}${e ? ` ${e}/8` : ''}`.trim() || '0'; };

export default function SchedulePrintPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [board, setBoard] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      productionApi.scheduling.board(projectId),
      productionApi.projects.get(projectId).catch(() => ({ data: null })),
      settingsApi.get().catch(() => ({ data: null })),
    ]).then(([b, p, c]) => { setBoard(b.data); setProject(p.data); setCo(c.data); }).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { if (!loading && board) setTimeout(() => window.print(), 500); }, [loading, board]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing schedule…</div>;
  if (!board) return <div style={{ padding: 32, color: 'red' }}>Schedule not available.</div>;

  const th: any = { padding: '4px 6px', color: '#fff', fontSize: 8, textTransform: 'uppercase', fontWeight: 700, textAlign: 'left' };
  const td: any = { padding: '3px 6px', fontSize: 9, borderBottom: '1px solid #eee', verticalAlign: 'top' };

  return (
    <>
      <div className="print:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: NAVY, color: '#fff', padding: '9px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <button onClick={() => window.print()} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🖨️ Print / Save as PDF</button>
      </div>

      <div style={{ background: '#fff', minHeight: '100vh', paddingTop: 46 }} className="print:pt-0">
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 34px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 9.5, color: '#222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>ONE-LINE SHOOTING SCHEDULE</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{project?.title || ''} {project?.projectNumber ? `· ${project.projectNumber}` : ''}</div>
              <div style={{ color: '#777' }}>{board.totalScenes} scenes · {pagesLabel(board.totalPages)} pages · {board.shootDays} shoot days</div>
            </div>
            {logoSrc(co?.logoUrl) ? <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 42, objectFit: 'contain' }} /> :
              <div style={{ fontSize: 9, color: '#999', textAlign: 'right' }}>{co?.name || 'The Film Makers FZ LLC'}</div>}
          </div>
          <div style={{ borderTop: `2px solid ${GOLD}`, margin: '10px 0 12px' }} />

          {board.board.map((d: any) => (
            <div key={d.dayNumber} style={{ marginBottom: 14, breakInside: 'avoid' }}>
              <div style={{ background: NAVY, color: '#fff', padding: '5px 8px', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                <span>DAY {d.dayNumber}{d.date ? ` · ${fmtDate(d.date)}` : ''}{d.location ? ` · ${d.location}` : ''}</span>
                <span>{d.sceneCount} sc · {pagesLabel(d.pages)} pg</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#F2EAD3' }}>
                  <th style={{ ...th, width: 44 }}>Scene</th><th style={{ ...th, width: 30 }}>I/E</th><th style={{ ...th, width: 30 }}>D/N</th>
                  <th style={th}>Set / Description</th><th style={{ ...th, width: 44, textAlign: 'right' }}>Pages</th><th style={{ ...th, width: 160 }}>Cast</th>
                </tr></thead>
                <tbody>
                  {d.strips.map((s: any) => (
                    <tr key={s.id}>
                      <td style={{ ...td, fontWeight: 700 }}>{s.sceneNumber || '—'}</td>
                      <td style={td}>{String(s.intExt).replace('_', '/')}</td>
                      <td style={td}>{String(s.dayNight)[0]}</td>
                      <td style={td}>{s.setName ? <b>{s.setName}</b> : ''}{s.setName && s.description ? ' — ' : ''}{s.description}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{pagesLabel(Number(s.pages))}</td>
                      <td style={{ ...td, color: '#555' }}>{(Array.isArray(s.cast) ? s.cast : []).join(', ')}</td>
                    </tr>
                  ))}
                  {d.strips.length === 0 && <tr><td style={{ ...td, color: '#aaa' }} colSpan={6}>No scenes.</td></tr>}
                </tbody>
              </table>
            </div>
          ))}

          {board.unscheduled.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ background: '#eee', padding: '4px 8px', fontWeight: 700, color: '#666' }}>UNSCHEDULED</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>{board.unscheduled.map((s: any) => (
                  <tr key={s.id}><td style={{ ...td, width: 44, fontWeight: 700 }}>{s.sceneNumber || '—'}</td><td style={td}>{s.setName} {s.description}</td><td style={{ ...td, textAlign: 'right', width: 44 }}>{pagesLabel(Number(s.pages))}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          <div style={{ borderTop: '1px solid #ddd', marginTop: 18, paddingTop: 8, textAlign: 'center', color: '#999', fontSize: 8 }}>
            {co?.name || 'The Film Makers FZ LLC'} · Generated {new Date().toLocaleString('en-GB')}
          </div>
        </div>
      </div>

      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print\\:hidden { display: none !important; } .print\\:pt-0 { padding-top: 0 !important; } }`}</style>
    </>
  );
}
