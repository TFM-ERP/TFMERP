'use client';

import { useEffect, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const GOLD = '#0f172a', NAVY = '#1a1a2e';
const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function CostReportPrintPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      productionApi.costing.report(projectId),
      productionApi.projects.get(projectId).catch(() => ({ data: null })),
      settingsApi.get().catch(() => ({ data: null })),
    ]).then(([r, p, c]) => { setData(r.data); setProject(p.data); setCo(c.data); }).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { if (!loading && data) setTimeout(() => window.print(), 500); }, [loading, data]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing cost report…</div>;
  if (!data) return <div style={{ padding: 32, color: 'red' }}>Cost report not available.</div>;

  const cur = data.currency || 'USD';
  const t = data.totals;
  const th: any = { padding: '5px 8px', color: '#fff', fontSize: 8.5, textTransform: 'uppercase', fontWeight: 700 };
  const num: any = (extra = {}) => ({ padding: '3px 8px', textAlign: 'right', fontSize: 9, borderBottom: '1px solid #f0f0f0', ...extra });

  return (
    <>
      <div className="print:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: NAVY, color: '#fff', padding: '9px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <button onClick={() => window.print()} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🖨️ Print / Save as PDF</button>
      </div>

      <div style={{ background: '#fff', minHeight: '100vh', paddingTop: 46 }} className="print:pt-0">
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 34px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 9.5, color: '#222' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>WEEKLY COST REPORT</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{project?.title || ''} {project?.projectNumber ? `· ${project.projectNumber}` : ''}</div>
              <div style={{ color: '#777', marginTop: 1 }}>{data.versionName} · As of {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · Currency: {cur}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {project?.logoUrl && <img src={logoSrc(project.logoUrl)} alt="" style={{ height: 40, maxWidth: 150, objectFit: 'contain' }} />}
              {logoSrc(co?.logoUrl) ? <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 44, objectFit: 'contain' }} /> :
                <div style={{ fontSize: 9, color: '#999', textAlign: 'right' }}>{co?.name || 'The Film Makers FZ LLC'}</div>}
            </div>
          </div>
          <div style={{ borderTop: `2px solid ${GOLD}`, margin: '10px 0 6px' }} />

          {/* Summary band */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[['Budget', t.budget], ['Revised', t.revisedBudget ?? t.budget], ['Committed', t.committed], ['Actual', t.actual], ['Est. Final Cost', t.efc], ['Variance', t.variance]].map(([l, v]: any) => (
              <div key={l} style={{ flex: 1, background: l === 'Variance' && v < 0 ? '#fdf3f3' : '#F8F4EA', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#999', textTransform: 'uppercase', fontWeight: 700 }}>{l}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: l === 'Variance' && v < 0 ? '#b91c1c' : NAVY }}>{v < 0 ? '(' : ''}{fmt(Math.abs(v))}{v < 0 ? ')' : ''}</div>
              </div>
            ))}
          </div>

          {/* Cost table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: NAVY }}>
                <th style={{ ...th, textAlign: 'left' }}>Cost Center</th>
                <th style={{ ...th, textAlign: 'right' }}>Budget</th>
                <th style={{ ...th, textAlign: 'right' }}>Revised</th>
                <th style={{ ...th, textAlign: 'right' }}>Committed</th>
                <th style={{ ...th, textAlign: 'right' }}>Actual</th>
                <th style={{ ...th, textAlign: 'right' }}>EFC</th>
                <th style={{ ...th, textAlign: 'right' }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {data.sections.map((s: any) => (
                <Fragment key={s.code}>
                  <tr style={{ background: '#F2EAD3' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 800, color: NAVY, borderLeft: `3px solid ${s.color || '#6366f1'}` }}>{s.code} — {s.title}</td>
                    <td style={num({ fontWeight: 800 })}>{fmt(s.budget)}</td>
                    <td style={num({ fontWeight: 800 })}>{fmt(s.revisedBudget ?? s.budget)}</td>
                    <td style={num({ fontWeight: 800 })}>{fmt(s.committed)}</td>
                    <td style={num({ fontWeight: 800 })}>{fmt(s.actual)}</td>
                    <td style={num({ fontWeight: 800 })}>{fmt(s.efc)}</td>
                    <td style={num({ fontWeight: 800, color: s.variance < 0 ? '#b91c1c' : '#222' })}>{s.variance < 0 ? '(' : ''}{fmt(Math.abs(s.variance))}{s.variance < 0 ? ')' : ''}</td>
                  </tr>
                  {s.accounts.map((a: any) => (
                    <tr key={a.code}>
                      <td style={{ padding: '3px 8px 3px 18px', borderBottom: '1px solid #f0f0f0', color: '#444' }}>{a.code} · {a.title}</td>
                      <td style={num({ color: '#888' })}>{fmt(a.budget)}</td>
                      <td style={num()}>{fmt(a.revisedBudget ?? a.budget)}</td>
                      <td style={num({ color: a.committed ? '#1d4ed8' : '#bbb' })}>{a.committed ? fmt(a.committed) : '—'}</td>
                      <td style={num({ color: a.actual ? '#b45309' : '#bbb' })}>{a.actual ? fmt(a.actual) : '—'}</td>
                      <td style={num()}>{fmt(a.efc)}</td>
                      <td style={num({ color: a.variance < 0 ? '#b91c1c' : '#555' })}>{a.variance < 0 ? '(' : ''}{fmt(Math.abs(a.variance))}{a.variance < 0 ? ')' : ''}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr style={{ background: '#FAF6EC', borderTop: `2px solid ${GOLD}` }}>
                <td style={{ padding: '7px 8px', fontWeight: 800, color: NAVY }}>GRAND TOTAL</td>
                <td style={{ ...num({ fontWeight: 800, fontSize: 10 }) }}>{fmt(t.budget)}</td>
                <td style={{ ...num({ fontWeight: 800, fontSize: 10 }) }}>{fmt(t.revisedBudget ?? t.budget)}</td>
                <td style={{ ...num({ fontWeight: 800, fontSize: 10 }) }}>{fmt(t.committed)}</td>
                <td style={{ ...num({ fontWeight: 800, fontSize: 10 }) }}>{fmt(t.actual)}</td>
                <td style={{ ...num({ fontWeight: 800, fontSize: 10 }) }}>{fmt(t.efc)}</td>
                <td style={{ ...num({ fontWeight: 800, fontSize: 10, color: t.variance < 0 ? '#b91c1c' : '#15803d' }) }}>{t.variance < 0 ? '(' : ''}{fmt(Math.abs(t.variance))}{t.variance < 0 ? ')' : ''}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ fontSize: 8, color: '#888', marginTop: 6 }}>Revised = Budget ± transfers + approved overages. EFC = Actual + Estimate&nbsp;to&nbsp;Complete. Variance = Revised − EFC. Figures in parentheses are over budget.</div>

          {/* Sign-off */}
          <div style={{ display: 'flex', gap: 40, marginTop: 40 }}>
            {['Prepared by — Production Accountant', 'Approved by — Producer', 'Approved by — Financier'].map(s => (
              <div key={s} style={{ flex: 1 }}>
                <div style={{ borderTop: '1px solid #888', paddingTop: 4, fontSize: 8.5, color: '#666' }}>{s}</div>
                <div style={{ fontSize: 8, color: '#aaa', marginTop: 14 }}>Signature &amp; date</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #ddd', marginTop: 24, paddingTop: 8, textAlign: 'center', color: '#999', fontSize: 8 }}>
            {co?.name || 'The Film Makers FZ LLC'} · Generated {new Date().toLocaleString('en-GB')}
          </div>
        </div>
      </div>

      <style>{`@media print { @page { size: A4 landscape; margin: 9mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print\\:hidden { display: none !important; } .print\\:pt-0 { padding-top: 0 !important; } }`}</style>
    </>
  );
}
