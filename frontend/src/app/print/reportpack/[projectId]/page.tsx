'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const GOLD = '#c2922f', NAVY = '#141d33';
const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const day = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export default function ReportPackPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [d, setD] = useState<any>(null); const [co, setCo] = useState<any>(null); const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([productionApi.costing.reportingPack(projectId), settingsApi.get().catch(() => ({ data: null }))])
      .then(([r, c]) => { setD(r.data); setCo(c.data); }).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { if (!loading && d) setTimeout(() => window.print(), 500); }, [loading, d]);
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing financier pack…</div>;
  if (!d) return <div style={{ padding: 32, color: 'red' }}>Reporting pack not available.</div>;

  const t = d.totals || {}; const s = d.summary || {}; const fc = d.forecast || {}; const cf = d.cashflow || {};
  const th: any = { padding: '4px 7px', color: '#fff', fontSize: 8.5, textTransform: 'uppercase', fontWeight: 700, textAlign: 'start' };
  const num: any = (x = {}) => ({ padding: '3px 7px', textAlign: 'end', fontSize: 9, borderBottom: '1px solid #f0f0f0', ...x });
  const Band = ({ items }: { items: [string, any, boolean?][] }) => (
    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
      {items.map(([l, v, neg]: any) => (
        <div key={l} style={{ flex: '1 0 11%', background: neg && v < 0 ? '#fdf3f3' : '#F8F4EA', borderRadius: 6, padding: '6px 8px', textAlign: 'center', minWidth: 78 }}>
          <div style={{ fontSize: 7, color: '#999', textTransform: 'uppercase', fontWeight: 700 }}>{l}</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: neg && v < 0 ? '#b91c1c' : NAVY }}>{neg && v < 0 ? '(' : ''}{fmt(Math.abs(v))}{neg && v < 0 ? ')' : ''}</div>
        </div>
      ))}
    </div>
  );
  const H = ({ children }: any) => <div style={{ fontSize: 11, fontWeight: 800, color: NAVY, margin: '16px 0 5px', borderBottom: `2px solid ${GOLD}`, paddingBottom: 3 }}>{children}</div>;

  return (
    <>
      <div className="print:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: NAVY, color: '#fff', padding: '9px 22px', display: 'flex', justifyContent: 'space-between', zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <button onClick={() => window.print()} style={{ background: GOLD, color: '#211807', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🖨 Print / Save PDF</button>
      </div>
      <div style={{ background: '#fff', minHeight: '100vh', paddingTop: 46 }} className="print:pt-0">
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 34px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 9.5, color: '#222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>COST REPORT — FINANCIER PACK</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{d.project?.title || ''} {d.project?.projectNumber ? `· ${d.project.projectNumber}` : ''}</div>
              <div style={{ color: '#777', marginTop: 1 }}>As of {new Date(d.generatedAt).toLocaleString('en-GB')} · Currency: {d.currency}</div>
            </div>
            {logoSrc(co?.logoUrl) ? <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 42, objectFit: 'contain' }} /> : <div style={{ fontSize: 9, color: '#999', textAlign: 'end' }}>{co?.name || 'The Film Makers FZ LLC'}</div>}
          </div>
          <div style={{ borderTop: `2px solid ${GOLD}`, margin: '10px 0 12px' }} />

          <Band items={[['Budget', t.revisedBudget ?? t.budget], ['Committed', t.committed], ['Actual', t.actual], ['EFC', t.efc], ['Forecast EFC', fc.forecastEfc], ['Variance', t.variance, true], ['Cash position', s.cashPosition, true]]} />

          {/* Cost report */}
          <H>Cost Report (by cost centre)</H>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: NAVY }}><th style={th}>Cost Centre</th><th style={{ ...th, textAlign: 'end' }}>Revised</th><th style={{ ...th, textAlign: 'end' }}>Committed</th><th style={{ ...th, textAlign: 'end' }}>Actual</th><th style={{ ...th, textAlign: 'end' }}>EFC</th><th style={{ ...th, textAlign: 'end' }}>Variance</th></tr></thead>
            <tbody>
              {(d.sections || []).map((sec: any) => (
                <tr key={sec.code} style={{ background: '#F2EAD3' }}>
                  <td style={{ padding: '4px 7px', fontWeight: 800, color: NAVY }}>{sec.code} — {sec.title}</td>
                  <td style={num({ fontWeight: 800 })}>{fmt(sec.revisedBudget ?? sec.budget)}</td>
                  <td style={num({ fontWeight: 800 })}>{fmt(sec.committed)}</td>
                  <td style={num({ fontWeight: 800 })}>{fmt(sec.actual)}</td>
                  <td style={num({ fontWeight: 800 })}>{fmt(sec.efc)}</td>
                  <td style={num({ fontWeight: 800, color: sec.variance < 0 ? '#b91c1c' : '#222' })}>{sec.variance < 0 ? '(' : ''}{fmt(Math.abs(sec.variance))}{sec.variance < 0 ? ')' : ''}</td>
                </tr>
              ))}
              <tr style={{ background: '#FAF6EC', borderTop: `2px solid ${GOLD}` }}>
                <td style={{ padding: '6px 7px', fontWeight: 800, color: NAVY }}>GRAND TOTAL</td>
                <td style={num({ fontWeight: 800, fontSize: 10 })}>{fmt(t.revisedBudget ?? t.budget)}</td>
                <td style={num({ fontWeight: 800, fontSize: 10 })}>{fmt(t.committed)}</td>
                <td style={num({ fontWeight: 800, fontSize: 10 })}>{fmt(t.actual)}</td>
                <td style={num({ fontWeight: 800, fontSize: 10 })}>{fmt(t.efc)}</td>
                <td style={num({ fontWeight: 800, fontSize: 10, color: t.variance < 0 ? '#b91c1c' : '#15803d' })}>{t.variance < 0 ? '(' : ''}{fmt(Math.abs(t.variance))}{t.variance < 0 ? ')' : ''}</td>
              </tr>
            </tbody>
          </table>

          {/* Forecast */}
          <H>Forecast — Estimated Final Cost (schedule/burn)</H>
          <div style={{ fontSize: 9, marginBottom: 4 }}>Shoot progress: <b>{fc.schedule?.daysElapsed || 0} / {fc.schedule?.totalDays || 0} days ({fc.schedule?.pctElapsed || 0}%)</b> · Forecast EFC <b>{fmt(fc.forecastEfc)}</b> · Forecast variance <b style={{ color: (fc.forecastVariance || 0) < 0 ? '#b91c1c' : '#15803d' }}>{fmt(fc.forecastVariance)}</b></div>
          {(fc.atRisk || []).length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: NAVY }}><th style={th}>Lines projected to overspend</th><th style={{ ...th, textAlign: 'end' }}>Revised</th><th style={{ ...th, textAlign: 'end' }}>Forecast EFC</th><th style={{ ...th, textAlign: 'end' }}>Over by</th></tr></thead>
              <tbody>{fc.atRisk.map((a: any, i: number) => (<tr key={i}><td style={{ padding: '3px 7px', borderBottom: '1px solid #f0f0f0' }}>{a.code} · {a.title}</td><td style={num()}>{fmt(a.revisedBudget)}</td><td style={num()}>{fmt(a.forecastEfc)}</td><td style={num({ color: '#b91c1c', fontWeight: 700 })}>{fmt(a.over)}</td></tr>))}</tbody>
            </table>
          )}

          {/* Cash flow */}
          <H>Weekly Cash-Flow Forecast</H>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: NAVY }}><th style={th}>Week</th><th style={{ ...th, textAlign: 'end' }}>Inflow</th><th style={{ ...th, textAlign: 'end' }}>Outflow</th><th style={{ ...th, textAlign: 'end' }}>Forecast out</th><th style={{ ...th, textAlign: 'end' }}>Net</th><th style={{ ...th, textAlign: 'end' }}>Cumulative</th></tr></thead>
            <tbody>
              {(cf.rows || []).slice(0, 20).map((r: any, i: number) => (<tr key={i}><td style={{ padding: '3px 7px', borderBottom: '1px solid #f0f0f0', fontSize: 9 }}>{r.week}</td><td style={num()}>{fmt(r.inflow + (r.forecastIn || 0))}</td><td style={num()}>{fmt(r.outflow)}</td><td style={num()}>{fmt(r.forecastOut)}</td><td style={num()}>{fmt(r.net)}</td><td style={num({ fontWeight: 700 })}>{fmt(r.cumulative)}</td></tr>))}
            </tbody>
          </table>
          <div style={{ fontSize: 9, marginTop: 3 }}>Projected closing cash: <b>{fmt(cf.closingCash)}</b> {d.currency}</div>

          {/* Hot costs */}
          {(d.hotCosts?.days || []).length > 0 && (<>
            <H>Daily Hot Costs</H>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: NAVY }}><th style={th}>Day</th><th style={th}>Date</th><th style={{ ...th, textAlign: 'end' }}>Sc shot</th><th style={{ ...th, textAlign: 'end' }}>Pg shot</th><th style={{ ...th, textAlign: 'end' }}>Hot cost</th><th style={{ ...th, textAlign: 'end' }}>Cumulative</th></tr></thead>
              <tbody>{d.hotCosts.days.map((h: any, i: number) => (<tr key={i}><td style={{ padding: '3px 7px', borderBottom: '1px solid #f0f0f0' }}>Day {h.dayNumber}</td><td style={{ padding: '3px 7px', borderBottom: '1px solid #f0f0f0', fontSize: 9 }}>{day(h.date)}</td><td style={num()}>{h.scenesShot}</td><td style={num()}>{h.pagesShot}</td><td style={num()}>{fmt(h.hot)}</td><td style={num({ fontWeight: 700 })}>{fmt(h.cumulative)}</td></tr>))}</tbody>
            </table>
          </>)}

          {/* Snapshots */}
          {(d.snapshots || []).length > 0 && (<>
            <H>Cost-Report Snapshot History</H>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: NAVY }}><th style={th}>As of</th><th style={th}>Label</th><th style={{ ...th, textAlign: 'end' }}>EFC</th><th style={{ ...th, textAlign: 'end' }}>Variance</th></tr></thead>
              <tbody>{d.snapshots.map((sn: any) => (<tr key={sn.id}><td style={{ padding: '3px 7px', borderBottom: '1px solid #f0f0f0', fontSize: 9 }}>{day(sn.asOf)}</td><td style={{ padding: '3px 7px', borderBottom: '1px solid #f0f0f0' }}>{sn.label || '—'}</td><td style={num()}>{fmt(sn.efc)}</td><td style={num({ color: Number(sn.variance) < 0 ? '#b91c1c' : '#15803d' })}>{fmt(sn.variance)}</td></tr>))}</tbody>
            </table>
          </>)}

          {/* Sign-off */}
          <div style={{ display: 'flex', gap: 40, marginTop: 34 }}>
            {['Prepared by — Production Accountant', 'Approved by — Line Producer', 'Approved by — Financier / Bond'].map(x => (
              <div key={x} style={{ flex: 1 }}><div style={{ borderTop: '1px solid #888', paddingTop: 4, fontSize: 8.5, color: '#666' }}>{x}</div><div style={{ fontSize: 8, color: '#aaa', marginTop: 12 }}>Signature &amp; date</div></div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #ddd', marginTop: 20, paddingTop: 8, textAlign: 'center', color: '#999', fontSize: 8 }}>{co?.name || 'The Film Makers FZ LLC'} · Financier reporting pack · Generated {new Date().toLocaleString('en-GB')}</div>
        </div>
      </div>
      <style>{`@media print { @page { size: A4 portrait; margin: 9mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print\\:hidden { display: none !important; } .print\\:pt-0 { padding-top: 0 !important; } }`}</style>
    </>
  );
}
