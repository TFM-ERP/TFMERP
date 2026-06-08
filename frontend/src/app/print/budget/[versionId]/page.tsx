'use client';

import { useEffect, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const GOLD = '#0f172a', NAVY = '#1a1a2e';
const fmtAmt = (n: any) => Number(n ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BudgetPrintPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const [version, setVersion] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const vr = await productionApi.budget.getVersion(versionId);
        setVersion(vr.data);
        const [pr, cr] = await Promise.all([
          productionApi.projects.get(vr.data.projectId).catch(() => ({ data: null })),
          settingsApi.get().catch(() => ({ data: null })),
        ]);
        setProject(pr.data);
        setCo(cr.data);
      } finally { setLoading(false); }
    })();
  }, [versionId]);

  useEffect(() => { if (!loading && version) setTimeout(() => window.print(), 500); }, [loading, version]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing budget…</div>;
  if (!version) return <div style={{ padding: 32, color: 'red' }}>Budget not found.</div>;

  const billingEmail = co?.billingEmail || co?.email;

  // Roll-ups
  const tierOf = (code?: string, tier?: string) => {
    if (tier && ['ATL', 'BTL', 'POST', 'OTHER'].includes(tier)) return tier;
    if (!code) return 'OTHER';
    if (code.startsWith('1')) return 'ATL';
    if (['2', '3', '4'].includes(code[0])) return 'BTL';
    if (code.startsWith('5')) return 'POST';
    return 'OTHER';
  };
  const sections = (version.sections || []).map((s: any) => {
    const accounts = (s.accounts || []).map((a: any) => ({
      ...a,
      total: (a.lineItems || []).reduce((t: number, i: any) => t + Number(i.total), 0),
    }));
    return { ...s, accounts, total: accounts.reduce((t: number, a: any) => t + a.total, 0), _tier: tierOf(s.code, s.tier) };
  });
  const grandTotal = sections.reduce((t: number, s: any) => t + s.total, 0);
  const tierTotals: Record<string, number> = { ATL: 0, BTL: 0, POST: 0, OTHER: 0 };
  for (const s of sections) tierTotals[s._tier] += s.total;
  const TIER_LABEL: Record<string, string> = { ATL: 'ABOVE-THE-LINE', BTL: 'BELOW-THE-LINE', POST: 'POST PRODUCTION', OTHER: 'OTHER' };
  const TIER_ORDER = ['ATL', 'BTL', 'POST', 'OTHER'].filter((t) => sections.some((s: any) => s._tier === t));
  const globals = (version.globals || []).filter((g: any) => ['prep_days', 'shoot_days', 'wrap_days', 'crew_count'].includes(g.key));

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
              <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>Production Budget</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{project?.title || ''} {project?.projectNumber ? `· ${project.projectNumber}` : ''}</div>
              <div style={{ color: '#777', marginTop: 1 }}>{version.versionName} · {version.status}</div>
              <div style={{ color: '#999', fontSize: 9, marginTop: 1 }}>{co?.name || 'The Film Makers FZ LLC'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {project?.logoUrl && <img src={logoSrc(project.logoUrl)} alt="" style={{ height: 40, maxWidth: 150, objectFit: 'contain' }} />}
              {logoSrc(co?.logoUrl) ? <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 44, objectFit: 'contain' }} /> : null}
            </div>
          </div>
          <div style={{ borderTop: `2px solid ${GOLD}`, margin: '10px 0 14px' }} />

          {/* ── TOP SHEET (page 1) ── */}
          <div style={{ pageBreakAfter: 'always' }}>
            <div style={{ textAlign: 'center', margin: '6px 0 14px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, letterSpacing: 1 }}>BUDGET TOP SHEET</div>
              <div style={{ color: '#777', fontSize: 9, marginTop: 2 }}>
                {version.versionName} · {version.status}{version.status === 'LOCKED' ? ' (baseline)' : ''} · As of {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Meta band */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[['Project', `${project?.title || ''}`], ['Number', project?.projectNumber || '—'], ['Currency', project?.currency || 'AED'],
                ...globals.map((g: any) => [g.label || g.key.replace('_', ' '), String(Number(g.value))])].map(([l, v]: any) => (
                <div key={l} style={{ flex: 1, background: '#F8F4EA', borderRadius: 5, padding: '5px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 7.5, color: '#999', textTransform: 'uppercase', fontWeight: 700 }}>{l}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
                </div>
              ))}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: NAVY }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#fff', fontSize: 9, textTransform: 'uppercase' }}>Acct</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#fff', fontSize: 9, textTransform: 'uppercase' }}>Category</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: '#fff', fontSize: 9, textTransform: 'uppercase' }}>Budget ({project?.currency || 'AED'})</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: '#fff', fontSize: 9, textTransform: 'uppercase', width: 50 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {TIER_ORDER.map((tier) => (
                  <Fragment key={tier}>
                    {sections.filter((s: any) => s._tier === tier).map((s: any) => (
                      <tr key={s.code}>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', fontFamily: 'monospace', color: '#555' }}>{s.code}</td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', borderLeft: `3px solid ${s.color || '#6366f1'}` }}>{s.title}</td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmtAmt(s.total)}</td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', textAlign: 'right', color: '#999' }}>{grandTotal > 0 ? ((s.total / grandTotal) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#F2EAD3' }}>
                      <td />
                      <td style={{ padding: '5px 8px', fontWeight: 800, color: NAVY, fontSize: 9 }}>TOTAL {TIER_LABEL[tier]}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800, color: NAVY }}>{fmtAmt(tierTotals[tier])}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: '#999' }}>{grandTotal > 0 ? ((tierTotals[tier] / grandTotal) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  </Fragment>
                ))}
                <tr>
                  <td />
                  <td style={{ padding: '6px 8px', fontWeight: 800, color: NAVY, borderTop: `1px solid ${GOLD}` }}>TOTAL ABOVE AND BELOW-THE-LINE</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: NAVY, borderTop: `1px solid ${GOLD}` }}>{fmtAmt(tierTotals.ATL + tierTotals.BTL)}</td>
                  <td style={{ borderTop: `1px solid ${GOLD}` }} />
                </tr>
                <tr style={{ background: '#FAF6EC' }}>
                  <td />
                  <td style={{ padding: '8px 8px', fontWeight: 800, color: NAVY, fontSize: 11, borderTop: `2px solid ${GOLD}` }}>GRAND TOTAL</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 800, color: NAVY, fontSize: 12, borderTop: `2px solid ${GOLD}` }}>{fmtAmt(grandTotal)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#999', borderTop: `2px solid ${GOLD}` }}>100%</td>
                </tr>
              </tbody>
            </table>

            {/* Signature block */}
            <div style={{ display: 'flex', gap: 30, marginTop: 36 }}>
              {['Producer', 'Line Producer', 'Financier / Client'].map((r) => (
                <div key={r} style={{ flex: 1 }}>
                  <div style={{ borderTop: '1px solid #999', paddingTop: 4, fontSize: 8, color: '#777' }}>{r} — name, signature & date</div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Budget Detail</div>
          {sections.map((s: any) => (
            <div key={s.code} style={{ marginBottom: 14, breakInside: 'avoid' }}>
              <div style={{ background: '#f5f5f5', padding: '5px 8px', fontWeight: 700, color: NAVY, borderLeft: `3px solid ${s.color || '#6366f1'}`, display: 'flex', justifyContent: 'space-between' }}>
                <span>{s.code} — {s.title}</span><span>{fmtAmt(s.total)}</span>
              </div>
              {s.accounts.map((a: any) => (
                a.lineItems.length === 0 ? null : (
                  <div key={a.code}>
                    <div style={{ padding: '4px 8px', background: '#fbfbfb', display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>
                      <span><span style={{ background: '#efe6d2', color: '#7a5c1e', padding: '0 3px', borderRadius: 3, fontSize: 7, marginRight: 4 }}>CC</span>{a.code} · {a.title}</span><span>{fmtAmt(a.total)}</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                      <thead>
                        <tr style={{ color: '#999' }}>
                          <th style={{ textAlign: 'left', padding: '3px 8px', width: 42 }}>Code</th>
                          <th style={{ textAlign: 'left', padding: '3px 8px' }}>Description</th>
                          <th style={{ textAlign: 'right', padding: '3px 8px' }}>Qty</th>
                          <th style={{ textAlign: 'left', padding: '3px 8px' }}>Units</th>
                          <th style={{ textAlign: 'right', padding: '3px 8px' }}>Rate</th>
                          <th style={{ textAlign: 'right', padding: '3px 8px' }}>Fringe</th>
                          <th style={{ textAlign: 'right', padding: '3px 8px' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.lineItems.map((i: any) => (
                          <Fragment key={i.id}>
                          <tr>
                            <td style={{ padding: '3px 8px', borderBottom: '1px solid #f0f0f0', fontFamily: 'monospace', color: '#7a5c1e', fontWeight: 700 }} title={i.subTitle || ''}>{i.code || ''}</td>
                            <td style={{ padding: '3px 8px', borderBottom: '1px solid #f0f0f0' }}>{i.description}</td>
                            <td style={{ padding: '3px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{Number(i.quantity).toFixed(2)}</td>
                            <td style={{ padding: '3px 8px', borderBottom: '1px solid #f0f0f0' }}>{i.units || ''}</td>
                            <td style={{ padding: '3px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{fmtAmt(i.rate)}</td>
                            <td style={{ padding: '3px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{Number(i.fringePct) > 0 ? `${i.fringePct}%` : '—'}</td>
                            <td style={{ padding: '3px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 700 }}>{fmtAmt(i.total)}</td>
                          </tr>
                          {Array.isArray(i.stages) && i.stages.map((s: any, si: number) => (
                            <tr key={si}>
                              <td />
                              <td style={{ padding: '1px 8px 1px 20px', color: '#777', fontSize: 8 }}>{({ PREP: 'Prep', SHOOT: 'Shoot', WRAP: 'Wrap', POST: 'Post' } as any)[s.stage] || s.stage}</td>
                              <td style={{ padding: '1px 8px', textAlign: 'right', color: '#777', fontSize: 8 }}>{Number(s.qty)}</td>
                              <td style={{ padding: '1px 8px', color: '#777', fontSize: 8 }}>{s.unit}</td>
                              <td style={{ padding: '1px 8px', textAlign: 'right', color: '#777', fontSize: 8 }}>{fmtAmt(s.rate)}</td>
                              <td />
                              <td style={{ padding: '1px 8px', textAlign: 'right', color: '#777', fontSize: 8 }}>{fmtAmt((Number(s.qty) || 0) * (Number(s.rate) || 0))}</td>
                            </tr>
                          ))}
                          </Fragment>
                        ))}
                        <tr style={{ background: '#FAF6EC' }}>
                          <td colSpan={6} style={{ padding: '4px 8px', fontWeight: 700, color: '#7a5c1e', fontSize: 8.5 }}>ACCOUNT TOTAL FOR {a.code}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 800, color: NAVY }}>{fmtAmt(a.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )
              ))}
              {/* Section total */}
              <div style={{ background: '#F2EAD3', padding: '6px 8px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: NAVY, fontSize: 9.5, borderTop: `2px solid ${GOLD}` }}>
                <span>TOTAL {String(s.title || '').toUpperCase()}</span><span>{fmtAmt(s.total)}</span>
              </div>
            </div>
          ))}

          {/* Budget totals */}
          <div style={{ marginTop: 16, breakInside: 'avoid' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Budget Totals</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <tbody>
                <tr><td style={{ padding: '5px 8px', borderBottom: '1px solid #eee' }}>Total Above-The-Line</td><td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmtAmt(tierTotals.ATL)}</td></tr>
                <tr><td style={{ padding: '5px 8px', borderBottom: '1px solid #eee' }}>Total Below-The-Line</td><td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmtAmt(tierTotals.BTL)}</td></tr>
                <tr><td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', fontWeight: 700 }}>Total Above and Below-The-Line</td><td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 700 }}>{fmtAmt(tierTotals.ATL + tierTotals.BTL)}</td></tr>
                <tr style={{ background: '#FAF6EC' }}><td style={{ padding: '7px 8px', fontWeight: 800, color: NAVY, borderTop: `2px solid ${GOLD}` }}>GRAND TOTAL</td><td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 800, color: NAVY, fontSize: 11, borderTop: `2px solid ${GOLD}` }}>{fmtAmt(grandTotal)}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #ddd', marginTop: 18, paddingTop: 8, display: 'flex', justifyContent: 'space-between', color: '#999', fontSize: 8 }}>
            <div>Generated {new Date().toLocaleString('en-GB')}</div>
            <div style={{ textAlign: 'right' }}>{co?.website}{co?.website && billingEmail ? ' · ' : ''}{billingEmail}</div>
          </div>
        </div>
      </div>

      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print\\:hidden { display: none !important; } .print\\:pt-0 { padding-top: 0 !important; } }`}</style>
    </>
  );
}
