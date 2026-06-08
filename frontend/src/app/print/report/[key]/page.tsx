'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { reportsApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const GOLD = '#0f172a', NAVY = '#1a1a2e';
const fmtAmt = (n: any) => Number(n ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCell = (v: any, fmt?: string) => {
  if (v === null || v === undefined || v === '') return '';
  if (fmt === 'currency') return fmtAmt(v);
  if (fmt === 'number') return Number(v).toLocaleString('en-AE');
  if (fmt === 'date') return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return String(v);
};
const fmtD = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export default function ReportPrintPage() {
  const { key } = useParams<{ key: string }>();
  const sp = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      reportsApi.run(key, { from: sp.get('from') || undefined, to: sp.get('to') || undefined }),
      settingsApi.get(),
    ]).then(([r, c]) => { setData(r.data); setCo(c.data); }).finally(() => setLoading(false));
  }, [key]); // eslint-disable-line

  useEffect(() => { if (!loading && data) setTimeout(() => window.print(), 500); }, [loading, data]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing report…</div>;
  if (!data) return <div style={{ padding: 32, color: 'red' }}>Report not found.</div>;

  const cols = data.columns || [];
  const billingEmail = co?.billingEmail || co?.email;

  return (
    <>
      <div className="print:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: NAVY, color: '#fff', padding: '9px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <button onClick={() => window.print()} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🖨️ Print / Save as PDF</button>
      </div>

      <div style={{ background: '#fff', minHeight: '100vh', paddingTop: 46 }} className="print:pt-0">
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 38px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 10, color: '#222' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>{data.title}</div>
              <div style={{ color: '#777', marginTop: 2 }}>{co?.name || 'The Film Makers FZ LLC'}</div>
              {data.period && <div style={{ color: '#999', fontSize: 9 }}>{fmtD(data.period.from)} – {fmtD(data.period.to)}</div>}
            </div>
            {logoSrc(co?.logoUrl) ? <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 44, objectFit: 'contain' }} /> : null}
          </div>
          <div style={{ borderTop: `2px solid ${GOLD}`, margin: '10px 0 14px' }} />

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5 }}>
            <thead>
              <tr style={{ background: '#F2EAD3' }}>
                {cols.map((c: any) => <th key={c.key} style={{ textAlign: c.align === 'right' ? 'right' : 'left', padding: '6px 8px', fontWeight: 700, color: NAVY, borderBottom: `2px solid ${GOLD}` }}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {(data.rows || []).map((r: any, i: number) => (
                <tr key={i} style={{ background: i % 2 ? '#FDFAF4' : '#fff' }}>
                  {cols.map((c: any) => <td key={c.key} style={{ textAlign: c.align === 'right' ? 'right' : 'left', padding: '5px 8px', borderBottom: '1px solid #eee' }}>{fmtCell(r[c.key], c.format)}</td>)}
                </tr>
              ))}
            </tbody>
            {data.totals && (
              <tfoot>
                {Object.entries(data.totals).map(([k, v]: any) => (
                  <tr key={k}><td colSpan={cols.length - 1} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, borderTop: '1px solid #ddd' }}>{k}</td><td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, borderTop: '1px solid #ddd', color: NAVY }}>{typeof v === 'number' ? fmtAmt(v) : String(v)}</td></tr>
                ))}
              </tfoot>
            )}
          </table>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #ddd', marginTop: 18, paddingTop: 8, display: 'flex', justifyContent: 'space-between', color: '#999', fontSize: 8 }}>
            <div>Generated {new Date().toLocaleString('en-GB')}</div>
            <div style={{ textAlign: 'right' }}>{co?.website}{co?.website && billingEmail ? ' · ' : ''}{billingEmail}</div>
          </div>
        </div>
      </div>

      <style>{`@media print { @page { size: A4 landscape; margin: 8mm 10mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print\\:hidden { display: none !important; } .print\\:pt-0 { padding-top: 0 !important; } }`}</style>
    </>
  );
}
