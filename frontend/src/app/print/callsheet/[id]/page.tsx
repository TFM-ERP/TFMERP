'use client';

import { useEffect, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const GOLD = '#0f172a', NAVY = '#1a1a2e';
const fmtDay = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '';

export default function CallSheetPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [cs, setCs] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      productionApi.callsheets.get(id),
      settingsApi.get().catch(() => ({ data: null })),
    ]).then(([r, c]) => { setCs(r.data); setCo(c.data); }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { if (!loading && cs) setTimeout(() => window.print(), 500); }, [loading, cs]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing call sheet…</div>;
  if (!cs) return <div style={{ padding: 32, color: 'red' }}>Call sheet not found.</div>;

  const billingEmail = co?.billingEmail || co?.email;
  const contacts = cs.keyContacts || [];
  const schedule = cs.scheduleItems || [];
  const cast = cs.castCalls || [];
  const crew = cs.crewCalls || [];
  const background = cs.backgroundCalls || [];
  const advance = cs.advanceSchedule || [];
  const th: any = { textAlign: 'left', padding: '4px 6px', fontWeight: 700, color: NAVY, borderBottom: `1.5px solid ${GOLD}`, fontSize: 8.5, textTransform: 'uppercase' };
  const td: any = { padding: '3px 6px', borderBottom: '1px solid #eee', fontSize: 9 };

  // Group crew by department
  const crewByDept: Record<string, any[]> = {};
  for (const c of crew) { const d = c.department || 'Crew'; (crewByDept[d] = crewByDept[d] || []).push(c); }

  return (
    <>
      <div className="print:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: NAVY, color: '#fff', padding: '9px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <button onClick={() => window.print()} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🖨️ Print / Save as PDF</button>
      </div>

      <div style={{ background: '#fff', minHeight: '100vh', paddingTop: 46 }} className="print:pt-0">
        <div style={{ maxWidth: 850, margin: '0 auto', padding: '24px 34px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 9.5, color: '#222' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: NAVY }}>CALL SHEET</div>
              <div style={{ fontWeight: 700, fontSize: 12, marginTop: 2 }}>{cs.project?.title || ''}</div>
              <div style={{ color: '#777' }}>{cs.project?.projectNumber} · {cs.project?.projectType}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: NAVY, color: '#fff', borderRadius: 8, padding: '6px 14px', fontWeight: 800 }}>
                DAY {cs.dayNumber}{cs.totalDays ? ` OF ${cs.totalDays}` : ''}
              </div>
              <div style={{ fontSize: 8.5, color: '#666', marginTop: 4 }}>{fmtDay(cs.shootDate)}</div>
              {cs.status !== 'PUBLISHED' && <div style={{ fontSize: 8, color: '#c00', marginTop: 2, fontWeight: 700 }}>DRAFT</div>}
            </div>
            {logoSrc(co?.logoUrl) ? <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 42, objectFit: 'contain' }} /> :
              <div style={{ fontSize: 9, color: '#999', textAlign: 'right' }}>{co?.name || 'The Film Makers FZ LLC'}</div>}
          </div>
          <div style={{ borderTop: `2px solid ${GOLD}`, margin: '10px 0 12px' }} />

          {/* Call times + weather strip */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[
              ['General Call', cs.generalCall], ['Shooting Call', cs.shootingCall], ['Est. Wrap', cs.estWrap],
              ['Sunrise', cs.sunrise], ['Sunset', cs.sunset], ['Weather', cs.weather],
              ['High / Low', [cs.tempHigh, cs.tempLow].filter(Boolean).join(' / ')],
            ].map(([label, val]: any) => (
              <div key={label} style={{ flex: 1, background: '#F8F4EA', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#999', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>{val || '—'}</div>
              </div>
            ))}
          </div>

          {/* Location + Hospital */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1, border: '1px solid #eee', borderRadius: 6, padding: 10 }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, color: NAVY, textTransform: 'uppercase', marginBottom: 4 }}>📍 Location</div>
              <div style={{ fontWeight: 700 }}>{cs.locationName || '—'}</div>
              <div style={{ color: '#555' }}>{cs.locationAddress}</div>
              {cs.locationMapUrl && <div style={{ fontSize: 8.5, marginTop: 2 }}><a href={cs.locationMapUrl} style={{ color: '#1d4ed8' }}>📍 Open map</a></div>}
              {cs.parkingNotes && <div style={{ color: '#777', fontSize: 8.5, marginTop: 3 }}>Parking: {cs.parkingNotes}</div>}
              {cs.basecampNotes && <div style={{ color: '#777', fontSize: 8.5 }}>Basecamp: {cs.basecampNotes}</div>}
            </div>
            <div style={{ flex: 1, border: '1px solid #f3d6d6', background: '#fdf5f5', borderRadius: 6, padding: 10 }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', marginBottom: 4 }}>🚑 Nearest Hospital</div>
              <div style={{ fontWeight: 700 }}>{cs.hospitalName || '—'}</div>
              <div style={{ color: '#555' }}>{cs.hospitalAddress}</div>
              {cs.hospitalPhone && <div style={{ color: '#b91c1c', fontWeight: 700, marginTop: 2 }}>{cs.hospitalPhone}</div>}
            </div>
          </div>

          {/* Key contacts */}
          {contacts.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
              <thead><tr><th style={th} colSpan={6}>Key Contacts</th></tr></thead>
              <tbody>
                {chunk(contacts, 2).map((pair: any[], i: number) => (
                  <tr key={i}>
                    {[0, 1].map(j => pair[j] ? (
                      <Fragment key={j}>
                        <td style={{ ...td, fontWeight: 700, width: '12%' }}>{pair[j].role}</td>
                        <td style={td}>{pair[j].name}</td>
                        <td style={{ ...td, color: '#555' }}>{pair[j].phone}</td>
                      </Fragment>
                    ) : <td key={j} colSpan={3} style={td} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Schedule */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 50 }}>Time</th><th style={{ ...th, width: 44 }}>Scene</th>
                <th style={{ ...th, width: 28 }}>I/E</th><th style={th}>Description</th>
                <th style={{ ...th, width: 38 }}>Pages</th><th style={{ ...th, width: 60 }}>Cast</th><th style={{ ...th, width: 90 }}>Location</th>
              </tr>
            </thead>
            <tbody>
              {schedule.length === 0 ? <tr><td style={{ ...td, color: '#aaa' }} colSpan={7}>No scenes scheduled.</td></tr> :
                schedule.map((r: any, i: number) => (
                  <tr key={i} style={{ background: i % 2 ? '#FDFAF4' : '#fff' }}>
                    <td style={{ ...td, fontWeight: 700 }}>{r.time}</td><td style={td}>{r.scene}</td>
                    <td style={td}>{r.intExt}</td><td style={td}>{r.description}</td>
                    <td style={td}>{r.pages}</td><td style={td}>{r.cast}</td><td style={td}>{r.location}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* Cast + Crew calls side by side */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
            <table style={{ flex: 1, borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Cast</th><th style={th}>Character</th><th style={{ ...th, width: 40 }}>Call</th><th style={{ ...th, width: 40 }}>On Set</th>
              </tr></thead>
              <tbody>
                {cast.length === 0 ? <tr><td style={{ ...td, color: '#aaa' }} colSpan={4}>—</td></tr> :
                  cast.map((c: any, i: number) => (
                    <tr key={i}><td style={td}>{c.cast}</td><td style={td}>{c.character}</td><td style={{ ...td, fontWeight: 700 }}>{c.callTime}</td><td style={td}>{c.onSet}</td></tr>
                  ))}
              </tbody>
            </table>
            <table style={{ flex: 1, borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Dept</th><th style={th}>Name</th><th style={th}>Role</th><th style={{ ...th, width: 40 }}>Call</th>
              </tr></thead>
              <tbody>
                {crew.length === 0 ? <tr><td style={{ ...td, color: '#aaa' }} colSpan={4}>—</td></tr> :
                  crew.map((c: any, i: number) => (
                    <tr key={i}><td style={td}>{c.department}</td><td style={td}>{c.name}</td><td style={{ ...td, color: '#666' }}>{c.role}</td><td style={{ ...td, fontWeight: 700 }}>{c.callTime}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Background / Extras */}
          {background.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
              <thead><tr>
                <th style={th}>Background / Extras</th><th style={{ ...th, width: 50 }}>Count</th><th style={{ ...th, width: 50 }}>Call</th><th style={{ ...th, width: 110 }}>Location</th>
              </tr></thead>
              <tbody>
                {background.map((b: any, i: number) => (
                  <tr key={i} style={{ background: i % 2 ? '#FDFAF4' : '#fff' }}>
                    <td style={td}>{b.description}</td><td style={{ ...td, textAlign: 'center' }}>{b.count}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{b.callTime}</td><td style={td}>{b.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Advance schedule (next day) */}
          {advance.length > 0 && (
            <div style={{ border: '1px solid #e5e5e5', borderRadius: 6, padding: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, color: NAVY, textTransform: 'uppercase', marginBottom: 5 }}>Advance Schedule — Next Day</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={{ ...th, width: 50 }}>Time</th><th style={{ ...th, width: 44 }}>Scene</th><th style={th}>Description</th><th style={{ ...th, width: 110 }}>Location</th>
                </tr></thead>
                <tbody>
                  {advance.map((r: any, i: number) => (
                    <tr key={i}>
                      <td style={{ ...td, fontWeight: 700 }}>{r.time}</td><td style={td}>{r.scene}</td><td style={td}>{r.description}</td><td style={td}>{r.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes + safety */}
          {(cs.notes || cs.safetyNotes) && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              {cs.notes && <div style={{ flex: 1, border: '1px solid #eee', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: NAVY, textTransform: 'uppercase', marginBottom: 3 }}>Notes</div>
                <div style={{ color: '#444', whiteSpace: 'pre-wrap' }}>{cs.notes}</div>
              </div>}
              {cs.safetyNotes && <div style={{ flex: 1, border: '1px solid #f3d6d6', background: '#fdf5f5', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', marginBottom: 3 }}>⚠ Safety</div>
                <div style={{ color: '#444', whiteSpace: 'pre-wrap' }}>{cs.safetyNotes}</div>
              </div>}
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: '1px solid #ddd', marginTop: 14, paddingTop: 8, display: 'flex', justifyContent: 'space-between', color: '#999', fontSize: 8 }}>
            <div>{co?.name || 'The Film Makers FZ LLC'} · Generated {new Date().toLocaleString('en-GB')}</div>
            <div style={{ textAlign: 'right' }}>{co?.website}{co?.website && billingEmail ? ' · ' : ''}{billingEmail}</div>
          </div>
        </div>
      </div>

      <style>{`@media print { @page { size: A4 portrait; margin: 9mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print\\:hidden { display: none !important; } .print\\:pt-0 { padding-top: 0 !important; } }`}</style>
    </>
  );
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
