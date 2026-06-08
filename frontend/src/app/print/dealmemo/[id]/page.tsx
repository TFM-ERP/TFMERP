'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const GOLD = '#0f172a', NAVY = '#1a1a2e';
const fmtD = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = (n: any) => n == null ? '—' : `AED ${Number(n).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`;

export default function DealMemoPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      productionApi.crew.assignment(id),
      settingsApi.get().catch(() => ({ data: null })),
    ]).then(([r, c]) => { setA(r.data); setCo(c.data); }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { if (!loading && a) setTimeout(() => window.print(), 500); }, [loading, a]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing deal memo…</div>;
  if (!a) return <div style={{ padding: 32, color: 'red' }}>Assignment not found.</div>;

  const m = a.crewMember;
  const total = a.dailyRate && a.totalDays ? Number(a.dailyRate) * a.totalDays : null;
  const row = (label: string, val: any) => (
    <tr>
      <td style={{ padding: '6px 10px', color: '#777', width: 170, fontWeight: 600, verticalAlign: 'top' }}>{label}</td>
      <td style={{ padding: '6px 10px', color: '#222' }}>{val || '—'}</td>
    </tr>
  );

  return (
    <>
      <div className="print:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: NAVY, color: '#fff', padding: '9px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <button onClick={() => window.print()} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🖨️ Print / Save as PDF</button>
      </div>

      <div style={{ background: '#fff', minHeight: '100vh', paddingTop: 46 }} className="print:pt-0">
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '30px 44px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 11, color: '#222' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>CREW DEAL MEMO</div>
              <div style={{ color: '#777', marginTop: 2 }}>{co?.name || 'The Film Makers FZ LLC'}</div>
            </div>
            {logoSrc(co?.logoUrl) ? <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 46, objectFit: 'contain' }} /> : null}
          </div>
          <div style={{ borderTop: `2px solid ${GOLD}`, margin: '12px 0 18px' }} />

          {/* Production */}
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Production</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18, background: '#FAF7F0', borderRadius: 6 }}>
            <tbody>
              {row('Project', `${a.project?.title || ''}  ${a.project?.projectNumber ? `(${a.project.projectNumber})` : ''}`)}
              {row('Type', a.project?.projectType)}
            </tbody>
          </table>

          {/* Crew member */}
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Crew Member</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
            <tbody>
              {row('Name', a.name)}
              {row('Role', a.roleTitle || String(a.role).replace(/_/g, ' '))}
              {row('Department', a.department || m?.department)}
              {row('Nationality', m ? `${m.nationality || '—'}${m.isLocal === false ? ' · flown in' : ' · local hire'}` : null)}
              {row('Email / Phone', [a.email || m?.email, a.mobile || m?.phone].filter(Boolean).join('  ·  '))}
            </tbody>
          </table>

          {/* Engagement */}
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Engagement &amp; Rate</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
            <tbody>
              {row('Location', a.location)}
              {row('Dates', `${fmtD(a.startDate)}  →  ${fmtD(a.endDate)}`)}
              {row('Daily rate', fmtMoney(a.dailyRate))}
              {row('Days', a.totalDays || '—')}
              <tr style={{ background: '#FAF7F0' }}>
                <td style={{ padding: '8px 10px', color: NAVY, fontWeight: 800 }}>Estimated total</td>
                <td style={{ padding: '8px 10px', color: NAVY, fontWeight: 800, fontSize: 13 }}>{fmtMoney(total)}</td>
              </tr>
            </tbody>
          </table>

          {/* Banking */}
          {m && (m.iban || m.accountNumber) && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Payment Details</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
                <tbody>
                  {row('Account name', m.accountName)}
                  {row('Bank', m.bankName)}
                  {row('IBAN', m.iban)}
                  {row('SWIFT', m.swiftCode)}
                </tbody>
              </table>
            </>
          )}

          {/* Status */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, fontSize: 10, color: '#666' }}>
            <span>Deal memo: <b style={{ color: NAVY }}>{(a.dealMemoStatus || 'NOT_SENT').replace(/_/g, ' ')}</b></span>
            <span>NDA: <b style={{ color: NAVY }}>{(a.ndaStatus || 'NOT_REQUIRED').replace(/_/g, ' ')}</b></span>
          </div>

          {/* Terms + signatures */}
          <div style={{ fontSize: 9, color: '#888', lineHeight: 1.5, marginBottom: 26 }}>
            This deal memo confirms the engagement above. Rates are inclusive unless otherwise stated. Overtime, kit and per‑diem
            to be agreed in writing. The crew member agrees to keep all production information confidential.
          </div>
          <div style={{ display: 'flex', gap: 40, marginTop: 30 }}>
            {['Crew member', 'For ' + (co?.name || 'The Film Makers FZ LLC')].map(s => (
              <div key={s} style={{ flex: 1 }}>
                <div style={{ borderTop: '1px solid #888', paddingTop: 4, fontSize: 9, color: '#666' }}>{s} — signature &amp; date</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #ddd', marginTop: 30, paddingTop: 8, color: '#999', fontSize: 8, textAlign: 'center' }}>
            {co?.name || 'The Film Makers FZ LLC'} · Generated {new Date().toLocaleString('en-GB')}
          </div>
        </div>
      </div>

      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print\\:hidden { display: none !important; } .print\\:pt-0 { padding-top: 0 !important; } }`}</style>
    </>
  );
}
