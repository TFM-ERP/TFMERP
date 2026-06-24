'use client';

/**
 * SYS-LOC V2 · Location workspace — full-page detail that replaces the AssessModal as the
 * primary surface. Consolidates the per-location data (overview, clearance gate, tech recce,
 * media, budget, risk, sun) wired to the existing per-location APIs. Deep edit forms still
 * route to the proven AssessModal (legacy 'library' tab) during the transition.
 */
import { useEffect, useMemo, useState } from 'react';
import { productionApi, assessmentApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const up = (s: any) => String(s || '').toUpperCase();
const label = (s: any) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
const daysTo = (d: any) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

const STY = `
.ld-top{display:flex;align-items:flex-end;gap:12px;margin-bottom:13px;flex-wrap:wrap}
.ld-back{font-size:12px;font-weight:700;color:var(--text-3);cursor:pointer;display:inline-flex;align-items:center;gap:5px;margin-bottom:10px}.ld-back:hover{color:var(--accent)}
.ld-top h2{font-family:var(--font-display,inherit);font-size:21px;font-weight:800;letter-spacing:-.02em}
.ld-top .s{font-size:12px;color:var(--text-3);margin-top:2px}
.ld-btn{border:none;cursor:pointer;font-weight:700;font-size:12px;padding:8px 13px;border-radius:9px;background:var(--accent);color:var(--accent-on);display:inline-flex;align-items:center;gap:6px}
.ld-btn.ghost{background:var(--surface-2);color:var(--text-2);border:1px solid var(--border-1)}
.ld-sub{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px}
.ld-st{font-size:11.5px;font-weight:600;color:var(--text-3);padding:6px 11px;border-radius:8px;cursor:pointer}.ld-st.on{background:var(--accent);color:var(--accent-on)}
.ld-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.ld-card{background:var(--surface-1);border:1px solid var(--border-1);border-radius:12px;overflow:hidden}
.ld-card .hd{padding:11px 14px;border-bottom:1px solid var(--border-1);font-size:13px;font-weight:700}
.ld-pad{padding:13px 14px}
.ld-kv{display:flex;justify-content:space-between;gap:8px;padding:6px 0;font-size:12.5px;border-bottom:1px solid var(--border-1)}.ld-kv:last-child{border-bottom:none}.ld-kv .l{color:var(--text-3)}.ld-kv .r{font-weight:700;color:var(--text-1);text-align:end}
.ld-chk{display:flex;align-items:center;gap:9px;font-size:12.5px;padding:6px 0}.ld-chk .s{width:16px;text-align:center}.ld-chk .s.ok{color:var(--ok)}.ld-chk .s.no{color:var(--text-3)}.ld-chk .s.wn{color:var(--warn)}.ld-chk .s.dn{color:var(--danger)}
.ld-bars{height:7px;border-radius:999px;background:var(--surface-2);overflow:hidden;margin-top:9px}.ld-bars>i{display:block;height:100%;background:var(--accent)}
.ld-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-1);font-size:12px}.ld-row:last-child{border-bottom:none}.ld-row .m{flex:1}.ld-row .m b{display:block;color:var(--text-1)}.ld-row .m small{color:var(--text-3);font-size:10.5px}
.ld-bdg{display:inline-flex;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px}
.b-ok{background:var(--ok-soft);color:var(--ok)}.b-warn{background:var(--warn-soft);color:var(--warn)}.b-dn{background:var(--danger-soft);color:var(--danger)}.b-n{background:var(--surface-2);color:var(--text-3);border:1px solid var(--border-1)}
.ld-mgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.ld-mtile{aspect-ratio:4/3;border-radius:9px;background:linear-gradient(135deg,var(--surface-2),var(--surface-3));border:1px solid var(--border-1);overflow:hidden}.ld-mtile img{width:100%;height:100%;object-fit:cover}
.ld-empty{font-size:12px;color:var(--text-3);padding:12px;text-align:center}
@media(max-width:900px){.ld-grid{grid-template-columns:1fr}.ld-mgrid{grid-template-columns:repeat(3,1fr)}}
`;

const STAGE_STEPS = ['SOURCING', 'NOC_REQUESTED', 'AGREEMENT_SENT', 'PERMIT_APPLIED', 'INSURANCE_RECEIVED', 'CONFIRMED', 'WRAPPED'];

export default function LocationDetail({ locationId, projectId, currency = 'AED', onBack, onNavigateInner }:
  { locationId: string; projectId?: string; currency?: string; onBack: () => void; onNavigateInner?: (t: string) => void }) {
  const [tab, setTab] = useState('overview');
  const [loc, setLoc] = useState<any>(null);
  const [permits, setPermits] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [recces, setRecces] = useState<any[]>([]);
  const [sun, setSun] = useState<any>(null);
  const money = (n: any) => formatCurrency(Number(n) || 0, currency);

  useEffect(() => {
    let alive = true;
    const setIf = (fn: any) => (r: any) => { if (alive) fn(Array.isArray(r.data) ? r.data : (r.data || [])); };
    productionApi.locations.get(locationId).then((r: any) => { if (alive) setLoc(r.data); }).catch(() => {});
    productionApi.locations.permits(locationId).then(setIf(setPermits)).catch(() => {});
    productionApi.locations.documents(locationId).then(setIf(setDocs)).catch(() => {});
    productionApi.locations.risks(locationId).then(setIf(setRisks)).catch(() => {});
    productionApi.locations.payments(locationId).then(setIf(setPays)).catch(() => {});
    assessmentApi.recces(locationId).then(setIf(setRecces)).catch(() => {});
    productionApi.sunPath.forLocation(locationId, new Date().toISOString()).then((r: any) => { if (alive) setSun(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, [locationId]);

  const gate = useMemo(() => {
    const docCat = (c: string) => docs.some((d: any) => up(d.category) === c && ['SIGNED', 'APPROVED', 'RECEIVED', 'VALID', 'COMPLETE'].includes(up(d.status)));
    return [
      ['NOC received', docCat('NOC')],
      ['Permit approved', permits.some((p: any) => up(p.status) === 'APPROVED')],
      ['COI / insurance valid', docCat('INSURANCE')],
      ['Location agreement signed', docCat('LOCATION_AGREEMENT') || docCat('RELEASE')],
      ['Risk assessment', risks.length > 0 && risks.every((r: any) => up(r.status) !== 'OPEN') ? true : (risks.length === 0 ? null : false)],
    ] as [string, boolean | null][];
  }, [docs, permits, risks]);
  const gatePct = Math.round((gate.filter(g => g[1]).length / gate.length) * 100);
  const paid = useMemo(() => pays.filter((p: any) => up(p.status) === 'PAID').reduce((a: number, p: any) => a + (Number(p.amount) || 0), 0), [pays]);
  const committed = useMemo(() => pays.reduce((a: number, p: any) => a + (Number(p.amount) || 0), 0), [pays]);
  const photos: string[] = useMemo(() => { const u = loc?.photoUrls; return Array.isArray(u) ? u : []; }, [loc]);

  const SUB = ['overview', 'clearance', 'recce', 'media', 'budget', 'risk', 'sun'];
  const stageIdx = loc ? STAGE_STEPS.indexOf(loc.pipelineStage || 'SOURCING') : 0;

  return (
    <div>
      <style>{STY}</style>
      <div className="ld-back" onClick={onBack}>← Back to Board</div>
      <div className="ld-top">
        <div><div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>Location workspace</div>
          <h2>{loc?.name || 'Location'}</h2>
          <div className="s">{loc?.type || '—'}{loc?.scenes ? ` · Sc ${loc.scenes}` : ''} · stage: {label(loc?.pipelineStage || loc?.status || 'sourcing')}</div></div>
        <span style={{ flex: 1 }} />
        <button className="ld-btn ghost" onClick={() => onNavigateInner?.('library')}>✎ Edit (Assess)</button>
        <button className="ld-btn" disabled={gatePct < 100}>✓ Clear to confirm</button>
      </div>
      <div className="ld-sub">{SUB.map(s => <span key={s} className={`ld-st ${tab === s ? 'on' : ''}`} onClick={() => setTab(s)}>{label(s)}</span>)}</div>

      {tab === 'overview' && (
        <div className="ld-grid">
          <div className="ld-card"><div className="hd">📋 Overview</div><div className="ld-pad">
            <div className="ld-kv"><span className="l">Type / status</span><span className="r">{loc?.type || '—'} · {label(loc?.status)}</span></div>
            <div className="ld-kv"><span className="l">Address</span><span className="r">{loc?.fullAddress || [loc?.area, loc?.emirate].filter(Boolean).join(', ') || '—'}</span></div>
            <div className="ld-kv"><span className="l">GPS · what3words</span><span className="r">{loc?.lat && loc?.lng ? `${loc.lat}, ${loc.lng}` : '—'}{loc?.what3words ? ` · ${loc.what3words}` : ''}</span></div>
            <div className="ld-kv"><span className="l">Access · parking</span><span className="r">{loc?.accessNotes || '—'}{loc?.parkingNotes ? ` · ${loc.parkingNotes}` : ''}</span></div>
            <div className="ld-kv"><span className="l">Owner</span><span className="r">{loc?.ownerContactName || '—'}{loc?.ownerContactPhone ? ` · ${loc.ownerContactPhone}` : ''}</span></div>
            <div className="ld-kv"><span className="l">Nearest hospital</span><span className="r">{loc?.nearestHospitalName || '—'}{loc?.nearestHospitalPhone ? ` · ${loc.nearestHospitalPhone}` : ''}</span></div>
            {loc?.googleMapsUrl && <div className="ld-kv"><span className="l">Map</span><span className="r"><a href={loc.googleMapsUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>📍 Open</a></span></div>}
          </div></div>
          <div className="ld-card"><div className="hd">🛡 Clearance gate · {gatePct}%</div><div className="ld-pad">
            {gate.map(([k, v]) => <div key={k} className="ld-chk"><span className={`s ${v === true ? 'ok' : v === null ? 'no' : 'wn'}`}>{v === true ? '✓' : v === null ? '○' : '⧗'}</span>{k}</div>)}
            <div className="ld-bars"><i style={{ width: `${gatePct}%` }} /></div>
            <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>{STAGE_STEPS.map((s, i) => <span key={s} className={`ld-bdg ${i <= stageIdx ? 'b-ok' : 'b-n'}`}>{label(s).split(' ')[0]}</span>)}</div>
          </div></div>
        </div>
      )}
      {tab === 'clearance' && (
        <div className="ld-card"><div className="hd">🪪 Permits &amp; documents</div><div className="ld-pad">
          {permits.length === 0 && docs.length === 0 ? <div className="ld-empty">No permits or documents yet — add them in Assess.</div> : <>
            {permits.map((p: any) => <div key={p.id} className="ld-row"><div className="m"><b>{label(p.permitType)}</b><small>{p.expiryDate ? `expires ${fmtDate(p.expiryDate)}` : 'no expiry'}</small></div><span className={`ld-bdg ${up(p.status) === 'APPROVED' ? 'b-ok' : up(p.status) === 'REJECTED' ? 'b-dn' : 'b-warn'}`}>{label(p.status) || 'Draft'}</span></div>)}
            {docs.map((d: any) => { const ex = daysTo(d.expiryDate); return <div key={d.id} className="ld-row"><div className="m"><b>{label(d.category)}</b><small>{d.partyName || d.authority || ''}{d.refNumber ? ` · ${d.refNumber}` : ''}</small></div><span className={`ld-bdg ${ex != null && ex <= 30 ? 'b-warn' : ['SIGNED', 'APPROVED', 'VALID', 'RECEIVED'].includes(up(d.status)) ? 'b-ok' : 'b-n'}`}>{ex != null && ex <= 30 ? `${ex}d` : (label(d.status) || 'Pending')}</span></div>; })}
          </>}
        </div></div>
      )}
      {tab === 'recce' && (
        <div className="ld-card"><div className="hd">🎥 Tech recce</div><div className="ld-pad">
          {recces.length === 0 ? <div className="ld-empty">No recce recorded yet.</div> : recces.map((rc: any) => (
            <div key={rc.id} style={{ marginBottom: 12 }}>
              <div className="ld-kv"><span className="l">{rc.reccedAt ? fmtDate(rc.reccedAt) : 'Recce'}{rc.conductedBy ? ` · ${rc.conductedBy}` : ''}</span><span className="r">{label(rc.status) || ''}</span></div>
              {(rc.notes || []).slice(0, 8).map((n: any) => <div key={n.id} className="ld-row"><div className="m"><b>{n.department || 'Dept'}</b><small>{String(n.note || '').slice(0, 60)}</small></div><span className={`ld-bdg ${up(n.severity) === 'BLOCKER' ? 'b-dn' : up(n.severity) === 'WARN' || up(n.severity) === 'WARNING' ? 'b-warn' : 'b-n'}`}>{n.resolved ? 'resolved' : label(n.severity) || 'note'}</span></div>)}
            </div>
          ))}
        </div></div>
      )}
      {tab === 'media' && (
        <div className="ld-card"><div className="hd">🖼 Media</div><div className="ld-pad">
          {photos.length === 0 ? <div className="ld-empty">No media yet — add plates in Report &amp; plates.</div> : <div className="ld-mgrid">{photos.slice(0, 12).map((u, i) => <div key={i} className="ld-mtile"><img src={u} alt="" /></div>)}</div>}
        </div></div>
      )}
      {tab === 'budget' && (
        <div className="ld-card"><div className="hd">💷 Budget</div><div className="ld-pad">
          <div className="ld-kv"><span className="l">Fee / day</span><span className="r">{money(loc?.locationFeePerDay)}</span></div>
          <div className="ld-kv"><span className="l">Committed (payments)</span><span className="r">{money(committed)}</span></div>
          <div className="ld-kv"><span className="l">Paid (actual)</span><span className="r" style={{ color: 'var(--ok)' }}>{money(paid)}</span></div>
          <div className="ld-bars"><i style={{ width: `${committed ? Math.round((paid / committed) * 100) : 0}%`, background: 'var(--ok)' }} /></div>
        </div></div>
      )}
      {tab === 'risk' && (
        <div className="ld-card"><div className="hd">⚠ Risk register</div><div className="ld-pad">
          {risks.length === 0 ? <div className="ld-empty">No risks recorded.</div> : risks.map((r: any) => { const high = Number(r.riskScore) >= 9; return <div key={r.id} className="ld-row"><div className="m"><b>{r.hazard || r.category}</b><small>L{r.likelihood}×I{r.impact} = {r.riskScore}{r.mitigation ? ` · ${String(r.mitigation).slice(0, 40)}` : ''}</small></div><span className={`ld-bdg ${high ? 'b-dn' : up(r.status) === 'OPEN' ? 'b-warn' : 'b-ok'}`}>{up(r.status) === 'OPEN' ? (high ? 'High' : 'Open') : label(r.status)}</span></div>; })}
        </div></div>
      )}
      {tab === 'sun' && (
        <div className="ld-card"><div className="hd">🌅 Sun &amp; daylight</div><div className="ld-pad">
          {!sun ? <div className="ld-empty">Add coordinates to compute sun-path.</div> : <>
            <div className="ld-kv"><span className="l">Sunrise · sunset</span><span className="r">{sun.sunrise || '—'} · {sun.sunset || '—'}</span></div>
            <div className="ld-kv"><span className="l">Golden hour (am)</span><span className="r">{sun.sunrise || '—'} – {sun.goldenHourAm || '—'}</span></div>
            <div className="ld-kv"><span className="l">Golden hour (pm)</span><span className="r">{sun.goldenHourPm || '—'} – {sun.sunset || '—'}</span></div>
            {sun.solarNoon && <div className="ld-kv"><span className="l">Solar noon</span><span className="r">{sun.solarNoon}</span></div>}
          </>}
        </div></div>
      )}
    </div>
  );
}
