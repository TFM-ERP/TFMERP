'use client';

import { useEffect, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, settingsApi } from '@/lib/api';

/**
 * Studio Master call sheet — live print/PDF.
 * Header production block (top-left) · graphical weather (Open-Meteo) · SVG sun-position compass
 * + daylight timeline (computed on-device) · multi-location schedule · dense cast grid ·
 * transportation band · crew roster (page 2). Auto-populated; manual fields override.
 * (Previous simple layout preserved at page.tsx.bak.)
 */
const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const fmtDay = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '';
const num = (v: any) => (v == null || isNaN(Number(v)) ? null : Number(v));

// "05:30" | "5:30 AM" | "6:00PM" -> minutes since midnight
function parseHM(s: any): number | null {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/);
  if (!m) return null;
  let h = parseInt(m[1], 10); const min = parseInt(m[2], 10); const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

export default function CallSheetPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [cs, setCs] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [loc, setLoc] = useState<any>(null);
  const [sun, setSun] = useState<any>(null);
  const [wx, setWx] = useState<any>(null);
  const [hosp, setHosp] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [r, c] = await Promise.all([productionApi.callsheets.get(id), settingsApi.get().catch(() => ({ data: null }))]);
        const sheet = r.data; setCs(sheet); setCo(c.data);
        const date = (sheet.shootDate || '').slice(0, 10);
        let lat: number | null = null, lng: number | null = null;
        if (sheet.locationId) {
          try { const L = await productionApi.locations.get(sheet.locationId); setLoc(L.data); lat = num(L.data?.lat); lng = num(L.data?.lng); } catch {}
        }
        if (lat != null && lng != null) {
          await Promise.allSettled([
            productionApi.sunPath.compute(lat, lng, date).then((s) => setSun(s.data)),
            productionApi.sunPath.weather(lat, lng, date).then((w) => setWx(w.data)),
            productionApi.sunPath.hospitalsNear(lat, lng).then((h) => setHosp(h.data?.items || [])),
          ]);
        }
      } finally { setLoading(false); }
    })();
  }, [id]);

  useEffect(() => { if (!loading && cs) setTimeout(() => window.print(), 600); }, [loading, cs]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing call sheet…</div>;
  if (!cs) return <div style={{ padding: 32, color: 'red' }}>Call sheet not found.</div>;

  const contacts = cs.keyContacts || [];
  const schedule = cs.scheduleItems || [];
  const cast = cs.castCalls || [];
  const crew = cs.crewCalls || [];
  const background = cs.backgroundCalls || [];
  const advance = cs.advanceSchedule || [];
  const shuttles = cs.hotelShuttles || [];           // [{hotel, leave}]
  const pickups = cs.transportPickups || [];           // [{label,from,leave}]
  const fleet = cs.transportFleet || [];               // [{label,qty}]
  const walkie: Record<string, string> = {};
  (cs.walkieChannels || []).forEach((w: any) => { if (w.department) walkie[w.department] = w.channel; });
  const elements = cs.shootingElements || {};         // {props,art,ge,hmu,sound,animals,vehicles}
  const cateringTimes = cs.cateringTimes || [];        // [{meal,pax,ready}]

  // ----- locations (multi) -----
  const schedLocs: string[] = Array.from(new Set(schedule.map((s: any) => s.location).filter(Boolean)));
  const locList: string[] = Array.from(new Set([cs.locationName, ...schedLocs].filter(Boolean)));
  const locIndex = (n: any) => { const i = locList.indexOf(n); return i >= 0 ? i + 1 : (n ? 1 : ''); };

  // ----- sun compass geometry -----
  const sr = sun?.sunrise || cs.sunrise, ss = sun?.sunset || cs.sunset;
  const gA = sun?.goldenHourAm || cs.goldenHourAm, gP = sun?.goldenHourPm || cs.goldenHourPm;
  const riseAz = num(sun?.sunriseAzimuth) ?? 90, setAz = num(sun?.sunsetAzimuth) ?? 270;
  const R = 60, CX = 75, CY = 78;
  const pt = (az: number) => ({ x: CX + R * Math.sin(az * Math.PI / 180), y: CY - R * Math.cos(az * Math.PI / 180) });
  const rp = pt(riseAz), sp = pt(setAz);
  const dome = `M ${rp.x.toFixed(1)} ${rp.y.toFixed(1)} C ${rp.x.toFixed(1)} 6, ${sp.x.toFixed(1)} 6, ${sp.x.toFixed(1)} ${sp.y.toFixed(1)}`;
  const noonElev = num(sun?.noonElevation);

  // ----- daylight bar -----
  const mSr = parseHM(sr), mSs = parseHM(ss), mgA = parseHM(gA), mgP = parseHM(gP);
  const mNoon = parseHM(sun?.solarNoon), mGc = parseHM(cs.generalCall), mSc = parseHM(cs.shootingCall), mWrap = parseHM(cs.estWrap);
  const axisStart = (mSr ?? 330) - 75, axisEnd = (mSs ?? 1140) + 75, span = axisEnd - axisStart;
  const P = (m: number | null) => m == null ? null : Math.max(0, Math.min(100, ((m - axisStart) / span) * 100));
  const haveDL = mSr != null && mSs != null;
  const seg = haveDL ? {
    blue1: P(mSr)!, goldA: (P(mgA ?? mSr)! - P(mSr)!), day: (P(mgP ?? mSs)! - P(mgA ?? mSr)!),
    goldP: (P(mSs)! - P(mgP ?? mSs)!), night: 100 - P(mSs)!,
  } : null;

  const NAVY = '#141d33', GOLD = '#c2922f', RED = '#b3261e';
  // hospital: stored primary, else top suggestion; alt: stored, else 2nd suggestion
  const hospPrimary = cs.hospitalName ? { name: cs.hospitalName, address: cs.hospitalAddress, phone: cs.hospitalPhone, driveMin: null, suggested: false } : (hosp[0] ? { ...hosp[0], suggested: true } : null);
  const hospAlt = cs.hospitalAlt || (hosp[0] && cs.hospitalName ? hosp[0] : hosp[1]) || null;

  const crewByDept: Record<string, any[]> = {};
  for (const c of crew) { const dpt = c.department || 'Crew'; (crewByDept[dpt] = crewByDept[dpt] || []).push(c); }

  return (
    <>
      <div className="noprint" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: NAVY, color: '#fff', padding: '9px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <button onClick={() => window.print()} style={{ background: GOLD, color: '#211807', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🖨️ Print / Save as PDF</button>
      </div>

      <div className="wrap">
        {/* ===== PAGE 1 ===== */}
        <section className="page">
          <div className="hdr">
            <div>
              <div className="co">{co?.name || 'The Film Makers FZ LLC'}</div>
              <div className="ttl">{cs.project?.title || 'Production'}</div>
              <div className="meta">{cs.project?.projectNumber} · {cs.project?.projectType}{cs.directorName ? ` · Dir. ${cs.directorName}` : ''}</div>
              {contacts.length > 0 && <div className="ep">{contacts.slice(0, 4).map((k: any, i: number) => <span key={i}>{k.role}: {k.name}{i < Math.min(3, contacts.length - 1) ? ' · ' : ''}</span>)}</div>}
            </div>
            <div className="mid">
              <div className="day">DAY {cs.dayNumber}{cs.totalDays ? ` / ${cs.totalDays}` : ''}</div>
              <div className="dt">{fmtDay(cs.shootDate)}</div>
              {cs.unitName && <div className="unit">{cs.unitName}</div>}
              {(cs.scriptVersion || cs.scheduleVersion) && <div className="ver">{cs.scriptVersion ? `Script: ${cs.scriptVersion}` : ''}{cs.scheduleVersion ? <><br />Schedule: {cs.scheduleVersion}</> : ''}</div>}
              {cs.status !== 'PUBLISHED' && <div style={{ color: '#ffd2d2', fontSize: 8, fontWeight: 800, marginTop: 3 }}>DRAFT</div>}
            </div>
            <div className="calls">
              <div className="cbox big"><div className="k">Crew Call</div><div className="v">{cs.generalCall || '—'}</div></div>
              <div className="cbox big"><div className="k">Shooting</div><div className="v">{cs.shootingCall || '—'}</div></div>
              <div className="cbox"><div className="k">Lunch</div><div className="v">{cs.lunch || '—'}</div></div>
              <div className="cbox"><div className="k">Est Wrap</div><div className="v">{cs.estWrap || '—'}</div></div>
            </div>
          </div>

          <div className="body">
            {cs.safetyNotes && <div className="banner">⚠ {cs.safetyNotes}</div>}

            {/* contacts · shuttles · hospital */}
            <div className="row r3">
              <div className="cell"><div className="lbl">Key Contacts</div>
                {contacts.length === 0 ? <div className="mut">—</div> : contacts.slice(0, 5).map((k: any, i: number) => <div className="kv" key={i}><b>{k.role} · {k.name}</b><span className="ph">{k.phone}</span></div>)}</div>
              <div className="cell gold"><div className="lbl">🚐 Hotel Shuttles — Lobby → Set</div>
                {shuttles.length === 0 ? <div className="mut">Add shuttles in the editor / Get From Schedule</div> : shuttles.map((s: any, i: number) => <div className="kv" key={i}><b>{s.hotel}</b><span style={{ fontWeight: 800, color: NAVY }}>LV {s.leave}</span></div>)}</div>
              <div className="cell red"><div className="lbl">🚑 Hospital{hospPrimary?.suggested ? ' (suggested)' : ''}</div>
                {!hospPrimary ? <div className="mut">Add coordinates to suggest nearest</div> : <>
                  <div style={{ fontWeight: 800 }}>{hospPrimary.name}</div>
                  <div style={{ color: '#555' }}>{hospPrimary.address}{hospPrimary.driveMin ? ` · ~${hospPrimary.driveMin} min` : ''}</div>
                  {hospPrimary.phone && <div style={{ color: RED, fontWeight: 800 }}>{hospPrimary.phone}</div>}
                  {hospAlt && <div style={{ fontSize: 7.6, marginTop: 2 }}><b>ALT:</b> {hospAlt.name}{hospAlt.phone ? ` · ${hospAlt.phone}` : ''}</div>}
                </>}</div>
            </div>

            {/* ===== GRAPHICS ===== */}
            <div className="gfx">
              {/* weather */}
              <div className="panel"><div className="ph"><span>Weather{loc?.area ? ` — ${loc.area}` : loc?.emirate ? ` — ${loc.emirate}` : ''}</span><span>{wx?.ok ? (wx.summary || '') : (cs.weather || '')}</span></div>
                <div className="pb">
                  {wx?.ok && wx.hours?.length ? <>
                    <div className="wx">{wx.hours.map((h: any, i: number) => <div className="h" key={i}><div className="t">{h.h}</div><div className="ic">{h.icon}</div><div className="deg">{h.temp}°</div></div>)}</div>
                    <div className="wxnote"><span>Hi {wx.tempHigh}°/Lo {wx.tempLow}°</span><span>💨 {wx.windDir} {wx.windMax}km/h</span>{wx.precipMax != null && <span>💧{wx.precipMax}%</span>}{wx.uvMax != null && <span>UV {Math.round(wx.uvMax)}</span>}</div>
                  </> : <div className="mut" style={{ padding: '6px 0' }}>{cs.weather || 'Weather —'} · Hi {cs.tempHigh || '—'}°/Lo {cs.tempLow || '—'}°</div>}
                </div></div>
              {/* sun compass */}
              <div className="panel"><div className="ph"><span>Sun Position</span><span>{sun?.dayLength || ''}</span></div>
                <div className="pb" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <svg viewBox="0 0 150 150" width="92" height="92" style={{ flex: 'none' }}>
                    <rect x="8" y="78" width="134" height="64" fill="#f3f4f7" />
                    <circle cx="75" cy="78" r="62" fill="#fff" stroke="#cfd3da" />
                    <line x1="13" y1="78" x2="137" y2="78" stroke="#cfd3da" />
                    <text x="75" y="13" textAnchor="middle" fontSize="8" fontWeight="800" fill={NAVY}>N</text>
                    <text x="143" y="81" textAnchor="middle" fontSize="8" fontWeight="800" fill="#8a93a5">E</text>
                    <text x="75" y="149" textAnchor="middle" fontSize="8" fontWeight="800" fill="#8a93a5">S</text>
                    <text x="6" y="81" textAnchor="middle" fontSize="8" fontWeight="800" fill="#8a93a5">W</text>
                    <path d={dome} fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="3 2" />
                    <circle cx={rp.x} cy={rp.y} r="4" fill={GOLD} /><circle cx={sp.x} cy={sp.y} r="4" fill={GOLD} />
                    <line x1="75" y1="78" x2={rp.x} y2={rp.y} stroke={GOLD} /><line x1="75" y1="78" x2={sp.x} y2={sp.y} stroke={GOLD} />
                    <circle cx="75" cy="14" r="5" fill="#f0a500" stroke="#fff" />
                    {noonElev != null && <text x="75" y="32" textAnchor="middle" fontSize="6" fill="#7a5a10">noon alt {noonElev}°</text>}
                  </svg>
                  <div style={{ fontSize: 7.6, lineHeight: 1.5 }}>
                    <div>🌅 Rise {sr || '—'}{riseAz ? ` · ${Math.round(riseAz)}°` : ''}</div>
                    <div>🌇 Set {ss || '—'}{setAz ? ` · ${Math.round(setAz)}°` : ''}</div>
                    <div style={{ color: '#8a6512' }}>✨ Golden {sr || '—'}–{gA || '—'}</div>
                    <div style={{ color: '#8a6512' }}>✨ Golden {gP || '—'}–{ss || '—'}</div>
                    {sun?.solarNoon && <div style={{ color: '#6c7480' }}>🕛 Noon {sun.solarNoon}</div>}
                  </div></div></div>
              {/* daylight */}
              <div className="panel"><div className="ph"><span>Daylight window</span><span>{sun?.dayLength || ''}</span></div>
                <div className="pb">
                  <div className="dl">
                    {seg ? <>
                      <span style={{ width: `${seg.blue1}%`, background: '#33406b' }} />
                      <span style={{ width: `${seg.goldA}%`, background: GOLD }} />
                      <span style={{ width: `${seg.day}%`, background: '#ffd66b' }} />
                      <span style={{ width: `${seg.goldP}%`, background: GOLD }} />
                      <span style={{ width: `${seg.night}%`, background: '#1b2236' }} />
                    </> : <span style={{ width: '100%', background: '#ffd66b' }} />}
                  </div>
                  <div className="dlax">
                    {mSr != null && <i style={{ left: `${P(mSr)}%` }}>{sr}<br />rise</i>}
                    {mSc != null && <i style={{ left: `${P(mSc)}%`, color: '#1c7a4a' }}>{cs.shootingCall}<br />shoot</i>}
                    {mNoon != null && <i style={{ left: `${P(mNoon)}%` }}>{sun.solarNoon}<br />noon</i>}
                    {mWrap != null && <i style={{ left: `${P(mWrap)}%`, color: RED }}>{cs.estWrap}<br />wrap</i>}
                  </div>
                  <div className="dlleg"><span><i className="sw" style={{ background: '#33406b' }} />blue</span><span><i className="sw" style={{ background: GOLD }} />golden</span><span><i className="sw" style={{ background: '#ffd66b' }} />day</span><span><i className="sw" style={{ background: '#1b2236' }} />night</span></div>
                </div></div>
            </div>

            {/* locations */}
            {locList.length > 0 && <>
              <h3>Locations {locList.length > 1 && <span className="sub">{locList.length} sets of place</span>}</h3>
              <div className="row r3 mb">
                <div className="cell"><div className="lbl"><span className="pill">1</span> {cs.locationName || locList[0] || '—'}</div>
                  <div style={{ color: '#444' }}>{cs.locationAddress || ''} {cs.locationMapUrl && <a href={cs.locationMapUrl} style={{ color: '#2f4fb0' }}>📍map</a>}</div>
                  {cs.parkingNotes && <div className="mut">Park: {cs.parkingNotes}</div>}</div>
                {locList[1] ? <div className="cell"><div className="lbl"><span className="pill">2</span> {locList[1]}</div><div className="mut">From schedule</div></div> : <div className="cell"><div className="lbl">Basecamp / Holding</div><div>{cs.basecampNotes || '—'}</div></div>}
                <div className="cell"><div className="lbl">Holding / Greenroom</div><div>{cs.basecampNotes || (locList[1] ? '—' : 'Base')}</div></div>
              </div>
            </>}

            {/* schedule */}
            <h3>Shooting Schedule {schedule.length > 0 && <span className="sub">{schedule.length} scenes</span>}</h3>
            <table className="grid mb">
              <thead><tr><th style={{ width: 38 }}>Time</th><th style={{ width: 36 }}>Scene</th><th>Set / Description</th><th style={{ width: 26 }}>I/E</th><th style={{ width: 34 }}>D/N</th><th style={{ width: 34 }}>Pgs</th><th style={{ width: 44 }}>Cast</th><th style={{ width: 26 }}>Loc</th></tr></thead>
              <tbody>
                {schedule.length === 0 ? <tr><td className="mut" colSpan={8}>No scenes — use Get From Schedule.</td></tr> :
                  schedule.map((r: any, i: number) => (
                    <tr key={i}><td><b>{r.time}</b></td><td>{r.scene}</td><td>{r.description}{r.set ? <span className="mut"> · {r.set}</span> : ''}</td><td>{r.intExt}</td><td>{r.dn || r.dayNight || ''}</td><td>{r.pages}</td><td>{r.cast}</td><td>{locIndex(r.location) ? <span className="pill">{locIndex(r.location)}</span> : ''}</td></tr>
                  ))}
              </tbody>
            </table>

            {/* cast */}
            <h3>Cast <span className="sub">SW Start-Work · W Work · H Hold · SWF Start-Work-Finish · Transpo PU/SH/SR</span></h3>
            <table className="grid mb">
              <thead><tr><th style={{ width: 16 }}>#</th><th>Artist / Character</th><th style={{ width: 28 }}>Status</th><th style={{ width: 32 }}>Hotel</th><th style={{ width: 30 }}>Tr</th><th style={{ width: 38 }}>P/U</th><th style={{ width: 32 }}>HMU/W</th><th style={{ width: 36 }}>On Set</th><th>Notes</th></tr></thead>
              <tbody>
                {cast.length === 0 ? <tr><td className="mut" colSpan={9}>—</td></tr> :
                  cast.map((c: any, i: number) => (
                    <tr key={i}><td>{c.num || i + 1}</td><td><b>{c.name || c.cast}</b>{c.character ? ` · ${c.character}` : ''}</td><td>{c.status || ''}</td><td>{c.hotel || '—'}</td><td>{c.transpo || ''}</td><td>{c.pickup || c.pu || c.callTime || ''}</td><td>{c.hmw || ''}</td><td><b>{c.onSet || ''}</b></td><td className="mut">{c.remarks || ''}</td></tr>
                  ))}
              </tbody>
            </table>

            {/* background + shooting elements */}
            <div className="two mb">
              <div>
                <h3>Atmosphere / Background &amp; Stand-ins</h3>
                <table className="grid">
                  <thead><tr><th style={{ width: 28 }}>Sc</th><th>Description</th><th style={{ width: 32 }}># Of</th><th style={{ width: 40 }}>RPT</th><th style={{ width: 42 }}>Ready</th></tr></thead>
                  <tbody>
                    {background.length === 0 ? <tr><td className="mut" colSpan={5}>—</td></tr> :
                      background.map((b: any, i: number) => <tr key={i}><td>{b.scene || '—'}</td><td>{b.description}</td><td>{b.count}</td><td>{b.rpt || b.callTime || ''}</td><td>{b.ready || ''}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <div>
                <h3>Shooting Elements</h3>
                <div className="cell elem">
                  {['props', 'art', 'ge', 'hmu', 'sound', 'animals', 'vehicles'].some((k) => elements[k]) ?
                    [['Props', elements.props], ['Art', elements.art], ['G&E / Camera', elements.ge], ['HMU / Costume', elements.hmu], ['Sound / VFX / SFX', elements.sound], ['Animals', elements.animals], ['Vehicles', elements.vehicles]].filter((e) => e[1]).map((e: any, i: number) => <div className="e" key={i}><b>{e[0]}:</b> {e[1]}</div>)
                    : <div className="mut">Add per-scene elements in the editor.</div>}
                </div>
              </div>
            </div>

            {/* transportation band */}
            <div className="trband">
              <div className="th"><span>🚐 Transportation</span><span>{cs.transportCaptain ? `Captain: ${cs.transportCaptain}` : ''}{cs.transportChannel ? ` · ${cs.transportChannel}` : ' · Ch 15'}</span></div>
              <div className="tb">
                <div className="shut"><div className="sh">Shuttles — Lobby → Set</div>
                  {shuttles.length === 0 ? <div className="mut">—</div> : shuttles.map((s: any, i: number) => <div className="s" key={i}><b>{s.hotel}</b><span className="lv">{s.leave}</span></div>)}</div>
                <div className="shut"><div className="sh">Pick-ups / VIP</div>
                  {pickups.length === 0 ? <div className="mut">—</div> : pickups.map((p: any, i: number) => <div className="s" key={i}><b>{p.label}</b><span className="lv">{p.leave}{p.from ? ` ${p.from}` : ''}</span></div>)}</div>
                <div className="shut"><div className="sh">Fleet on unit</div>
                  {fleet.length === 0 ? <div className="mut">From Transport Captain</div> : fleet.map((f: any, i: number) => <div className="s" key={i}><b>{f.label}</b><span className="lv">{f.qty}</span></div>)}</div>
              </div>
            </div>

            {/* advance + catering */}
            <div className="two">
              <div>
                <h3 className="gold">Advance — Next Day{cs.advanceTentCall ? <span className="sub">Tent call {cs.advanceTentCall}</span> : ''}</h3>
                <table className="grid"><tbody>
                  {advance.length === 0 ? <tr><td className="mut" colSpan={3}>—</td></tr> :
                    advance.map((r: any, i: number) => <tr key={i}><td style={{ width: 38 }}><b>{r.time}</b></td><td style={{ width: 36 }}>{r.scene}</td><td>{r.description}{r.location ? <span className="mut"> · {r.location}</span> : ''}</td></tr>)}
                </tbody></table>
              </div>
              <div>
                <h3>Catering — Ready Times</h3>
                <table className="grid"><thead><tr><th>Meal</th><th style={{ width: 36 }}>Pax</th><th style={{ width: 46 }}>Ready</th></tr></thead><tbody>
                  {cateringTimes.length === 0 ? <tr><td className="mut" colSpan={3}>Lunch {cs.lunch || '—'}</td></tr> :
                    cateringTimes.map((m: any, i: number) => <tr key={i}><td>{m.meal}</td><td>{m.pax}</td><td>{m.ready}</td></tr>)}
                </tbody></table>
              </div>
            </div>
          </div>
          <div className="footer"><div>{co?.name || 'The Film Makers FZ LLC'} · issued by Production · Page 1{crew.length > 0 ? '/2' : ''}</div><div>Generated {new Date().toLocaleString('en-GB')}</div></div>
        </section>

        {/* ===== PAGE 2 — crew roster ===== */}
        {crew.length > 0 && (
          <section className="page">
            <div className="hdr">
              <div><div className="co">{co?.name || 'The Film Makers FZ LLC'}</div><div className="ttl" style={{ fontSize: 15 }}>{cs.project?.title} — Crew List</div><div className="meta">{cs.project?.projectNumber} · Day {cs.dayNumber}{cs.totalDays ? `/${cs.totalDays}` : ''} · {fmtDay(cs.shootDate)}</div></div>
              <div className="mid"><div className="day" style={{ fontSize: 12 }}>GEN. CALL {cs.generalCall || '—'}</div><div className="dt">Shooting {cs.shootingCall || '—'} · Wrap {cs.estWrap || '—'}</div></div>
              <div className="calls"><div className="cbox"><div className="k">On unit</div><div className="v">{crew.length}</div></div><div className="cbox"><div className="k">Cast</div><div className="v">{cast.length}</div></div></div>
            </div>
            <div className="body">
              <div className="crewpg">
                {Object.entries(crewByDept).map(([dpt, list]: any) => (
                  <div className="dept" key={dpt}><div className="dh"><span>{dpt}</span>{walkie[dpt] && <span className="ch">{walkie[dpt]}</span>}</div>
                    <table><tbody>
                      {list.map((c: any, i: number) => <tr key={i}><td>{c.role ? <b>{c.role}</b> : ''} {c.name}</td><td className="h">{c.hotel || '—'}</td><td className="r">{c.callTime || ''}</td></tr>)}
                    </tbody></table></div>
                ))}
              </div>
              <div className="two">
                <div><h3>Transportation — Pickups &amp; Departures</h3>
                  <table className="grid"><tbody>
                    {shuttles.length === 0 && pickups.length === 0 ? <tr><td className="mut" colSpan={3}>—</td></tr> : <>
                      {shuttles.map((s: any, i: number) => <tr key={'s' + i}><td>{s.hotel}</td><td style={{ width: 60 }}>Lobby</td><td style={{ width: 44 }}>{s.leave}</td></tr>)}
                      {pickups.map((p: any, i: number) => <tr key={'p' + i}><td>{p.label}</td><td>{p.from || ''}</td><td>{p.leave}</td></tr>)}
                    </>}
                  </tbody></table>
                </div>
                <div><h3 className="red">Hospitals &amp; Emergency</h3>
                  <div className="cell red">
                    {hospPrimary ? <><div style={{ fontWeight: 800 }}>Primary — {hospPrimary.name}</div><div>{hospPrimary.address}</div><div style={{ color: RED, fontWeight: 800 }}>{hospPrimary.phone}{hospPrimary.driveMin ? ` · ~${hospPrimary.driveMin} min` : ''}</div></> : <div className="mut">—</div>}
                    {hospAlt && <><div style={{ fontWeight: 800, marginTop: 4 }}>Alternate — {hospAlt.name}</div><div>{hospAlt.address}{hospAlt.phone ? ` · ${hospAlt.phone}` : ''}</div></>}
                  </div>
                </div>
              </div>
            </div>
            <div className="footer"><div>{co?.name || 'The Film Makers FZ LLC'} · Crew list · Page 2/2</div><div>Confidential · cast &amp; crew</div></div>
          </section>
        )}
      </div>

      <style>{`
        body{background:#e9ebef;margin:0}
        .wrap{display:flex;flex-direction:column;align-items:center;gap:14px;padding:54px 12px 50px;font-family:"Helvetica Neue",Arial,sans-serif}
        .page{background:#fff;width:880px;max-width:100%;box-shadow:0 6px 30px rgba(0,0,0,.16);font-size:9px;line-height:1.28;color:#15171c;padding-bottom:12px}
        .page table{border-collapse:collapse;width:100%}
        .hdr{display:grid;grid-template-columns:1.55fr 1.05fr 1.15fr;background:#141d33;color:#fff;padding:11px 15px;gap:11px;align-items:stretch}
        .hdr .co{font-size:8px;color:#aeb7cc;letter-spacing:.07em;text-transform:uppercase}
        .hdr .ttl{font-size:19px;font-weight:900;line-height:1.05;margin-top:1px}
        .hdr .meta{font-size:8px;color:#b9c1d4;margin-top:2px}
        .hdr .ep{font-size:7.6px;color:#cdd4e3;margin-top:5px}
        .hdr .mid{text-align:center}
        .hdr .day{display:inline-block;background:#c2922f;color:#211807;border-radius:8px;padding:5px 14px;font-weight:900;font-size:14px}
        .hdr .dt{font-size:9px;color:#cdd4e3;margin-top:2px}
        .hdr .unit{font-size:7.4px;font-weight:800;letter-spacing:.08em;color:#c2922f;text-transform:uppercase;margin-top:2px}
        .hdr .ver{font-size:7px;color:#9aa6c2;margin-top:5px;line-height:1.5}
        .hdr .calls{display:grid;grid-template-columns:1fr 1fr;gap:4px}
        .cbox{background:#1d2947;border:1px solid #2c3a5e;border-radius:6px;padding:4px 6px;text-align:center}
        .cbox .k{font-size:6.6px;text-transform:uppercase;color:#9aa6c2;font-weight:700}
        .cbox .v{font-size:12px;font-weight:900}.cbox.big .v{color:#c2922f}
        .body{padding:10px 15px 0}
        .banner{background:#fff7d6;border:1px solid #ecd98a;color:#6e5510;font-weight:700;font-size:8px;text-align:center;padding:3px 6px;border-radius:5px;margin-bottom:9px}
        .row{display:grid;gap:8px;margin-bottom:9px}.r3{grid-template-columns:1fr 1fr 1fr}
        .cell{border:1px solid #cfd3da;border-radius:7px;padding:6px 8px}
        .cell .lbl{font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#141d33;margin-bottom:2px}
        .cell.red{border-color:#eccac8;background:#fbeeed}.cell.red .lbl{color:#b3261e}
        .cell.gold{border-color:#e6d09a;background:#f7efda}
        .kv{font-size:8.2px;display:flex;justify-content:space-between;gap:8px;padding:1px 0}.kv .ph{color:#6c7480}
        .mut{color:#9aa1ad;font-size:8px}
        .gfx{display:grid;grid-template-columns:1.3fr .95fr 1fr;gap:8px;margin-bottom:9px}
        .panel{border:1px solid #cfd3da;border-radius:7px;overflow:hidden}
        .panel .ph{background:#141d33;color:#fff;font-size:7.4px;font-weight:800;text-transform:uppercase;padding:3px 8px;display:flex;justify-content:space-between}
        .panel .pb{padding:6px 8px}
        .wx{display:flex;text-align:center}.wx .h{flex:1;border-right:1px solid #e7e9ee;padding:1px 0}.wx .h:last-child{border:none}
        .wx .t{font-size:7px;color:#6c7480}.wx .ic{font-size:12px}.wx .deg{font-size:8.4px;font-weight:800;color:#141d33}
        .wxnote{font-size:7.2px;color:#6c7480;margin-top:4px;display:flex;justify-content:space-between;gap:5px}
        .dl{height:14px;border-radius:4px;overflow:hidden;display:flex;margin-top:2px;border:1px solid #e7e9ee}.dl span{display:block;height:100%}
        .dlax{position:relative;height:20px;font-size:6.6px;color:#6c7480;margin-top:1px}
        .dlax i{position:absolute;transform:translateX(-50%);text-align:center;line-height:1.1}.dlax i::before{content:"";display:block;width:1px;height:4px;background:#141d33;margin:0 auto 1px}
        .dlleg{font-size:7px;color:#6c7480;margin-top:3px;display:flex;gap:7px;flex-wrap:wrap}.sw{display:inline-block;width:7px;height:7px;border-radius:2px;vertical-align:middle;margin-right:2px}
        h3{font-size:8px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 4px;background:#141d33;color:#fff;padding:3px 8px;border-radius:4px;display:flex;justify-content:space-between}
        h3 .sub{color:#c2922f;font-weight:700}
        h3.gold{background:#c2922f;color:#241a06}h3.gold .sub{color:#5d4607}h3.red{background:#b3261e}
        .mb{margin-bottom:9px}
        table.grid th{background:#eceef2;border:1px solid #cfd3da;padding:2px 5px;font-size:7px;text-transform:uppercase;text-align:left;color:#141d33}
        table.grid td{border:1px solid #e7e9ee;padding:2px 5px;font-size:8.4px;vertical-align:top}
        .pill{display:inline-block;width:12px;height:12px;border-radius:50%;background:#141d33;color:#fff;font-size:7px;font-weight:800;text-align:center;line-height:12px}
        .two{display:grid;grid-template-columns:1.5fr 1fr;gap:9px}
        .elem .e{font-size:8px;padding:2px 0;border-bottom:1px solid #e7e9ee}.elem .e:last-child{border:none}.elem .e b{color:#141d33}
        .trband{border:2px solid #c2922f;border-radius:8px;overflow:hidden;margin-bottom:9px}
        .trband .th{background:#c2922f;color:#241a06;font-weight:900;font-size:9px;text-transform:uppercase;letter-spacing:.06em;padding:4px 9px;display:flex;justify-content:space-between}
        .trband .tb{padding:8px 9px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px}
        .shut .sh{font-weight:800;font-size:7.6px;color:#141d33;margin-bottom:2px}
        .shut .s{display:flex;justify-content:space-between;font-size:8.2px;padding:1.5px 0;border-bottom:1px dashed #e7e9ee}.shut .s .lv{font-weight:800;color:#141d33}
        .crewpg{columns:3;column-gap:9px;margin-bottom:9px}
        .dept{break-inside:avoid;border:1px solid #cfd3da;border-radius:6px;margin-bottom:6px;overflow:hidden}
        .dept .dh{background:#141d33;color:#fff;font-size:7.2px;font-weight:800;text-transform:uppercase;padding:2px 6px;display:flex;justify-content:space-between}.dept .dh .ch{color:#c2922f}
        .dept td{font-size:7.8px;padding:1.5px 6px;border-top:1px solid #eef0f3}
        .dept td.h{color:#6c7480;width:34px}.dept td.r{font-weight:800;color:#141d33;width:42px;text-align:right}
        .footer{border-top:1px solid #cfd3da;margin:10px 15px 0;padding-top:6px;display:flex;justify-content:space-between;color:#9aa1ad;font-size:7.2px}
        @media print{@page{size:A4 portrait;margin:6mm}.noprint{display:none!important}.wrap{padding:0;gap:0}body{background:#fff}.page{box-shadow:none;width:auto;page-break-after:always}}
      `}</style>
    </>
  );
}
