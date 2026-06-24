'use client';

/** SYS-mobile — Call Sheet. The full day's call sheet for the active production.
 *  Primary source is today's published CallSheet (productionApi.callsheets); if none
 *  exists yet, falls back to the auto-generated schedule (scheduling.callsheetData) so
 *  the crew still sees today's scenes. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { productionApi } from '@/lib/api';
import { Loader2, ChevronLeft, MapPin, Phone, Sun, CloudSun, Cross, Navigation, Users, ShieldAlert, CalendarClock } from 'lucide-react';

const todayISO = () => new Date().toISOString().slice(0, 10);
const dOnly = (d?: string) => (d ? String(d).slice(0, 10) : '');
const fmtDate = (d?: string) => { try { return d ? new Date(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : ''; } catch { return ''; } };
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
const mapHref = (cs: any) =>
  cs?.locationMapUrl ? cs.locationMapUrl
    : (cs?.locationAddress || cs?.locationName) ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cs.locationAddress || cs.locationName)}`
      : null;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-3)' }}>{title}</div>
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>{children}</div>
    </div>
  );
}
const sep = (i: number) => ({ borderTop: i ? '1px solid var(--border-1)' : 'none' });

export default function MobileCallSheet() {
  const [cs, setCs] = useState<any>(null);
  const [fallbackScenes, setFallbackScenes] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = typeof window !== 'undefined' ? localStorage.getItem('tfm_m_project') : null;
    if (!pid) { setLoading(false); return; }
    productionApi.projects.get(pid).then((r: any) => setTitle(r.data?.title || '')).catch(() => {});

    productionApi.callsheets.list(pid)
      .then((r: any) => {
        const list: any[] = Array.isArray(r.data) ? r.data : (r.data?.items || []);
        const today = todayISO();
        // Prefer today's sheet, then any upcoming/published sheet, then the soonest.
        const sheet = list.find((c) => dOnly(c.shootDate) === today)
          || list.find((c) => c.status === 'PUBLISHED' && dOnly(c.shootDate) >= today)
          || list.find((c) => c.status === 'PUBLISHED')
          || list[0] || null;
        setCs(sheet);
        if (!sheet) {
          // No call sheet authored — fall back to the auto-generated schedule for today's scenes.
          return productionApi.scheduling.callsheetData(pid, today)
            .then((s: any) => setFallbackScenes(arr(s.data?.scenes)))
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sched = cs ? arr(cs.scheduleItems) : fallbackScenes;
  const cast = arr(cs?.castCalls);
  const bg = arr(cs?.backgroundCalls);
  const crew = arr(cs?.crewCalls);
  const contacts = arr(cs?.keyContacts);
  const advance = arr(cs?.advanceSchedule);
  const map = mapHref(cs);

  return (
    <div className="px-4 pt-4">
      <Link href="/m" className="inline-flex items-center gap-1 text-sm mb-3" style={{ color: 'var(--text-3)' }}><ChevronLeft size={16} /> Today</Link>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div>
        : (!cs && sched.length === 0) ? <div className="text-center py-16 text-sm" style={{ color: 'var(--text-3)' }}>No call sheet for today.</div>
          : (
            <>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold flex-1">Call Sheet</h1>
                {cs?.status && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full" style={{ background: cs.status === 'PUBLISHED' ? 'var(--gold)' : 'var(--surface-2)', color: cs.status === 'PUBLISHED' ? '#161C28' : 'var(--text-3)' }}>{cs.status}</span>}
              </div>
              <div className="text-sm mb-1" style={{ color: 'var(--text-2)' }}>{title}{cs?.dayNumber ? ` · Day ${cs.dayNumber}${cs.totalDays ? `/${cs.totalDays}` : ''}` : ''}</div>
              <div className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>{fmtDate(cs?.shootDate) || fmtDate(todayISO())}{!cs && sched.length ? ' · from schedule (no call sheet published)' : ''}</div>

              {/* Calls */}
              {(cs?.generalCall || cs?.shootingCall || cs?.estWrap) && (
                <div className="flex gap-2 mb-4">
                  {[['Crew', cs.generalCall], ['Shoot', cs.shootingCall], ['Wrap', cs.estWrap]].map(([l, v]) => (
                    <div key={l as string} className="flex-1 rounded-xl px-3 py-2.5 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}>
                      <div className="text-[10px] uppercase" style={{ color: 'var(--text-3)' }}>{l}</div>
                      <div className="text-lg font-bold">{(v as string) || '—'}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Location (tap to navigate) */}
              {(cs?.locationName || cs?.locationAddress) && (
                <Section title="Location">
                  <a href={map || undefined} target="_blank" rel="noreferrer" className="px-3 py-2.5 flex items-start gap-2">
                    <MapPin size={15} style={{ color: 'var(--gold)' }} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{cs.locationName}</div>
                      {cs.locationAddress && <div className="text-xs" style={{ color: 'var(--text-3)' }}>{cs.locationAddress}</div>}
                      {cs.parkingNotes && <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>🅿 {cs.parkingNotes}</div>}
                      {cs.basecampNotes && <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>⛺ {cs.basecampNotes}</div>}
                    </div>
                    {map && <Navigation size={15} style={{ color: 'var(--gold)' }} className="mt-0.5 shrink-0" />}
                  </a>
                </Section>
              )}

              {/* Weather & light */}
              {(cs?.sunrise || cs?.sunset || cs?.weather || cs?.goldenHourAm || cs?.goldenHourPm) && (
                <Section title="Weather & light">
                  <div className="px-3 py-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--text-2)' }}>
                    {cs.weather && <span className="inline-flex items-center gap-1"><CloudSun size={14} /> {cs.weather}{cs.tempHigh ? ` · ${cs.tempHigh}°/${cs.tempLow ?? ''}°` : ''}</span>}
                    {(cs.sunrise || cs.sunset) && <span className="inline-flex items-center gap-1"><Sun size={14} /> {cs.sunrise}–{cs.sunset}</span>}
                    {(cs.goldenHourAm || cs.goldenHourPm) && <span className="text-xs" style={{ color: 'var(--text-3)' }}>golden {[cs.goldenHourAm, cs.goldenHourPm].filter(Boolean).join(' / ')}</span>}
                  </div>
                </Section>
              )}

              {/* Schedule (rich scheduleItems, or fallback scenes) */}
              {sched.length > 0 && (
                <Section title="Schedule">
                  {sched.map((s: any, i: number) => (
                    <div key={i} className="px-3 py-2.5 flex gap-3" style={sep(i)}>
                      {(s.scene || s.sceneNumber) && <span className="text-sm font-bold w-9 shrink-0" style={{ color: 'var(--gold)' }}>{s.scene || s.sceneNumber}</span>}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{[s.intExt, s.description || s.setName].filter(Boolean).join('  ')}</div>
                        <div className="text-xs" style={{ color: 'var(--text-3)' }}>{[s.pages, s.time, s.cast ? `cast ${s.cast}` : null, s.location].filter(Boolean).join(' · ')}</div>
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              {/* Cast calls */}
              {cast.length > 0 && (
                <Section title="Cast">
                  {cast.map((c: any, i: number) => (
                    <div key={i} className="px-3 py-2.5 flex items-center gap-2 text-sm" style={sep(i)}>
                      <span className="flex-1 truncate">{c.cast || c.name}{c.character ? <span style={{ color: 'var(--text-3)' }}> · {c.character}</span> : ''}</span>
                      {(c.hmw || c.pickup) && <span className="text-xs" style={{ color: 'var(--text-3)' }}>{c.pickup ? `P/U ${c.pickup}` : `HMW ${c.hmw}`}</span>}
                      <span className="text-sm font-semibold" style={{ color: 'var(--gold)' }}>{c.callTime || c.onSet || '—'}</span>
                    </div>
                  ))}
                </Section>
              )}

              {/* Background / SA */}
              {bg.length > 0 && (
                <Section title="Background">
                  {bg.map((b: any, i: number) => (
                    <div key={i} className="px-3 py-2.5 flex items-center gap-2 text-sm" style={sep(i)}>
                      <Users size={13} style={{ color: 'var(--text-3)' }} />
                      <span className="flex-1 truncate">{b.description || b.name || `${b.count || ''} background`}</span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--gold)' }}>{b.callTime || '—'}</span>
                    </div>
                  ))}
                </Section>
              )}

              {/* Crew / department calls */}
              {crew.length > 0 && (
                <Section title="Crew calls">
                  {crew.map((c: any, i: number) => (
                    <div key={i} className="px-3 py-2.5 flex items-center gap-2 text-sm" style={sep(i)}>
                      <div className="flex-1 min-w-0"><div className="truncate">{c.role || c.department || c.name}</div>{c.name && (c.role || c.department) && <div className="text-xs" style={{ color: 'var(--text-3)' }}>{c.name}</div>}</div>
                      <span className="text-sm font-semibold" style={{ color: 'var(--gold)' }}>{c.callTime || '—'}</span>
                    </div>
                  ))}
                </Section>
              )}

              {/* Key contacts (tap to call) */}
              {contacts.length > 0 && (
                <Section title="Key contacts">
                  {contacts.map((c: any, i: number) => (
                    <a key={i} href={c.phone ? `tel:${c.phone}` : undefined} className="px-3 py-2.5 flex items-center gap-2 text-sm" style={sep(i)}>
                      <div className="flex-1 min-w-0"><div className="truncate">{c.name}</div><div className="text-xs" style={{ color: 'var(--text-3)' }}>{c.role}</div></div>
                      {c.phone && <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--gold)' }}><Phone size={13} /> {c.phone}</span>}
                    </a>
                  ))}
                </Section>
              )}

              {/* Nearest hospital (tap to call) */}
              {cs?.hospitalName && (
                <Section title="Nearest hospital">
                  <a href={cs.hospitalPhone ? `tel:${cs.hospitalPhone}` : undefined} className="px-3 py-2.5 flex items-start gap-2">
                    <Cross size={15} className="mt-0.5" style={{ color: '#e24b4a' }} />
                    <div><div className="text-sm font-medium">{cs.hospitalName}</div>{cs.hospitalAddress && <div className="text-xs" style={{ color: 'var(--text-3)' }}>{cs.hospitalAddress}</div>}{cs.hospitalPhone && <div className="text-xs" style={{ color: 'var(--gold)' }}>{cs.hospitalPhone}</div>}</div>
                  </a>
                </Section>
              )}

              {/* Safety / notes */}
              {(cs?.safetyNotes || cs?.notes) && (
                <Section title="Notes">
                  {cs.safetyNotes && <div className="px-3 py-2.5 flex items-start gap-2 text-sm"><ShieldAlert size={14} className="mt-0.5" style={{ color: '#e2a23b' }} /><span style={{ color: 'var(--text-2)' }}>{cs.safetyNotes}</span></div>}
                  {cs.notes && <div className="px-3 py-2.5 text-sm" style={{ ...sep(cs.safetyNotes ? 1 : 0), color: 'var(--text-2)' }}>{cs.notes}</div>}
                </Section>
              )}

              {/* Advance schedule (next day) */}
              {advance.length > 0 && (
                <Section title="Advance schedule">
                  {advance.map((a: any, i: number) => (
                    <div key={i} className="px-3 py-2.5 flex gap-3 text-sm" style={sep(i)}>
                      <CalendarClock size={14} style={{ color: 'var(--text-3)' }} className="mt-0.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-2)' }}>{[a.scene || a.sceneNumber, a.intExt, a.description || a.setName].filter(Boolean).join('  ')}</span>
                    </div>
                  ))}
                </Section>
              )}
            </>
          )}
    </div>
  );
}
