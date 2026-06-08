'use client';

import { useEffect, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';
import { laborApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const GOLD = '#0f172a', NAVY = '#1a1a2e';
const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const RATE_TYPE_LABEL: Record<string, string> = {
  PENSION: 'Pension', HEALTH: 'Health', PENSION_HEALTH: 'Pension & Health',
  PAYROLL_TAX: 'Payroll Tax', WORKERS_COMP: "Workers' Comp", UNEMPLOYMENT: 'Unemployment',
  VACATION_PAY: 'Vacation', HOLIDAY_PAY: 'Holiday', EMPLOYER_TAX: 'Employer Tax',
  UNION_DUES: 'Union Dues', GUILD_CONTRIB: 'Guild', STATUTORY_GRATUITY: 'Gratuity',
  HANDLING_FEE: 'Handling', OTHER: 'Other',
};

export default function FringePrintPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const [data, setData] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      laborApi.fringeDetail(versionId),
      settingsApi.get().catch(() => ({ data: null })),
    ]).then(([r, c]) => { setData(r.data); setCo(c.data); }).finally(() => setLoading(false));
  }, [versionId]);

  useEffect(() => { if (!loading && data) setTimeout(() => window.print(), 500); }, [loading, data]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing fringe report…</div>;
  if (!data) return <div style={{ padding: 32, color: 'red' }}>Fringe report not available.</div>;

  const cur = data.project?.currency || 'USD';
  const th: any = { padding: '5px 8px', color: '#fff', fontSize: 8.5, textTransform: 'uppercase', fontWeight: 700 };
  const num: any = (extra = {}) => ({ padding: '3px 8px', textAlign: 'right', fontSize: 9, borderBottom: '1px solid #f0f0f0', ...extra });
  const types = Object.keys(data.typeTotals || {});

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
              <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>FRINGE & EMPLOYER BURDEN REPORT</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{data.project?.title || ''} {data.project?.projectNumber ? `· ${data.project.projectNumber}` : ''}</div>
              <div style={{ color: '#777', marginTop: 1 }}>{data.versionName} · As of {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · Currency: {cur}</div>
            </div>
            {logoSrc(co?.logoUrl) ? <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 44, objectFit: 'contain' }} /> :
              <div style={{ fontSize: 9, color: '#999', textAlign: 'right' }}>{co?.name || 'The Film Makers FZ LLC'}</div>}
          </div>
          <div style={{ borderTop: `2px solid ${GOLD}`, margin: '10px 0 6px' }} />

          {/* Summary band */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[['Wages (straight time)', data.grandWages], ['Total Burden', data.grandFringe], ['Burdened Labor', data.grandWages + data.grandFringe], ['Eff. Burden %', data.grandBurdenPct]].map(([l, v]: any, i: number) => (
              <div key={l} style={{ flex: 1, background: '#F8F4EA', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#999', textTransform: 'uppercase', fontWeight: 700 }}>{l}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: NAVY }}>{i === 3 ? `${v}%` : fmt(v)}</div>
              </div>
            ))}
          </div>

          {/* Burden by type */}
          {types.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>Burden by Type</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {types.map((tp) => (
                  <div key={tp} style={{ background: '#F2EAD3', borderRadius: 5, padding: '4px 8px', fontSize: 9 }}>
                    <b style={{ color: NAVY }}>{RATE_TYPE_LABEL[tp] || tp}</b>: {fmt(data.typeTotals[tp])}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per cost center */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: NAVY }}>
                <th style={{ ...th, textAlign: 'left' }}>Cost Center</th>
                <th style={{ ...th, textAlign: 'right' }}>Wages</th>
                <th style={{ ...th, textAlign: 'right' }}>Burden</th>
                <th style={{ ...th, textAlign: 'right' }}>Burden %</th>
              </tr>
            </thead>
            <tbody>
              {data.sections.map((s: any) => (
                <Fragment key={s.code}>
                  <tr style={{ background: '#F2EAD3' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 800, color: NAVY }}>{s.code} — {s.title}</td>
                    <td style={num({ fontWeight: 800 })}></td>
                    <td style={num({ fontWeight: 800 })}>{fmt(s.fringeTotal)}</td>
                    <td style={num({ fontWeight: 800 })}></td>
                  </tr>
                  {s.accounts.map((a: any) => (
                    <tr key={a.code}>
                      <td style={{ padding: '3px 8px 3px 18px', borderBottom: '1px solid #f0f0f0', color: '#444' }}>
                        {a.code} · {a.title}{a.anyEstimate ? ' ⚠' : ''}
                      </td>
                      <td style={num()}>{fmt(a.wages)}</td>
                      <td style={num()}>{a.fringeTotal ? fmt(a.fringeTotal) : '—'}</td>
                      <td style={num({ color: '#666' })}>{a.burdenPct ? `${a.burdenPct}%` : '—'}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr style={{ background: '#FAF6EC', borderTop: `2px solid ${GOLD}` }}>
                <td style={{ padding: '7px 8px', fontWeight: 800, color: NAVY }}>TOTAL</td>
                <td style={{ ...num({ fontWeight: 800, fontSize: 10 }) }}>{fmt(data.grandWages)}</td>
                <td style={{ ...num({ fontWeight: 800, fontSize: 10 }) }}>{fmt(data.grandFringe)}</td>
                <td style={{ ...num({ fontWeight: 800, fontSize: 10 }) }}>{data.grandBurdenPct}%</td>
              </tr>
            </tbody>
          </table>

          <div style={{ fontSize: 8, color: '#888', marginTop: 6 }}>⚠ = cost center contains estimated figures (caps/wage-bases approximated at line level).</div>

          {/* Disclaimer */}
          <div style={{ borderTop: '1px solid #ddd', marginTop: 18, paddingTop: 8, fontSize: 8, color: '#999' }}>
            <b>Decision-support only — not legal, tax, or payroll advice.</b> Rates are drawn from the project's frozen labor snapshot, which cites official union/guild/statutory sources. Confirm all figures with your payroll provider before reliance. {co?.name || 'The Film Makers FZ LLC'} · Generated {new Date().toLocaleString('en-GB')}
          </div>
        </div>
      </div>

      <style>{`@media print { @page { size: A4 portrait; margin: 9mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print\\:hidden { display: none !important; } .print\\:pt-0 { padding-top: 0 !important; } }`}</style>
    </>
  );
}
