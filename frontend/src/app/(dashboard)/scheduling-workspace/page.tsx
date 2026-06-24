'use client';

/**
 * SYS-UX Phase 2 — Scheduling MODULE HOME (parallel route /scheduling-workspace).
 * Promoted from a thin sub-view into a full home: summary header + KPIs, and three
 * content-first views — Stripboard · Cast DOOD · Calendar — on the shared tokens/shell.
 * Wired to productionApi.scheduling (board · dood · calendar) with a sample fallback so it
 * always renders. Built with LOGICAL CSS properties so it mirrors under dir="rtl".
 * The live /scheduling pages stay untouched.
 */
import { useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import '@/styles/tokens.css';

type Strip = { id?: string; sceneNumber?: string; intExt?: string; setName?: string; dayNight?: string; pages?: string; cast?: string };
type Day = { dayNumber?: number; date?: string; location?: string; callTime?: string; pages?: string; strips?: Strip[] };
type Dood = { days: number[]; rows: { name: string; codes: Record<string, string>; workDays: number }[] };

const SAMPLE_BOARD: Day[] = [
  { dayNumber: 14, date: 'Mon 15 Jun', location: 'Wadi Rim Basecamp', callTime: '06:30', pages: '6 4/8', strips: [
    { sceneNumber: '24', intExt: 'INT', setName: 'Field Hospital Tent', dayNight: 'N', pages: '2 4/8', cast: 'Nadia, Soldier, Recruit' },
    { sceneNumber: '25', intExt: 'EXT', setName: 'Dune Ridge — convoy', dayNight: 'D', pages: '1 2/8', cast: 'Nadia, Driver, 12 BG' },
    { sceneNumber: '26', intExt: 'INT', setName: 'Command Tent', dayNight: 'N', pages: '3 1/8', cast: 'Colonel, Nadia, Aide' },
  ] },
  { dayNumber: 15, date: 'Tue 16 Jun', location: 'Checkpoint Alpha', callTime: '07:00', pages: '5 2/8', strips: [
    { sceneNumber: '27', intExt: 'EXT', setName: 'Checkpoint — standoff', dayNight: 'D', pages: '4 0/8', cast: 'Full unit · 40 BG' },
    { sceneNumber: '28', intExt: 'EXT', setName: 'Checkpoint — aftermath', dayNight: 'D', pages: '1 2/8', cast: 'weather cover' },
  ] },
];
const SAMPLE_DOOD: Dood = { days: [14, 15, 16], rows: [
  { name: 'Nadia', codes: { 14: 'SW', 15: 'W', 16: 'WF' }, workDays: 3 },
  { name: 'Colonel', codes: { 14: 'W', 16: 'W' }, workDays: 2 },
  { name: 'Soldier', codes: { 14: 'SWF' }, workDays: 1 },
] };

const intExtColor = (ie?: string) => (String(ie).toUpperCase().startsWith('EXT') ? 'var(--ok)' : 'var(--accent)');
const CODE: Record<string, [string, string]> = { W: ['W', 'var(--accent)'], H: ['H', 'var(--text-3)'], SW: ['S', 'var(--ok)'], WF: ['F', 'var(--info)'], SWF: ['SF', 'var(--ok)'] };

export default function SchedulingWorkspace() {
  const { t } = useLocale();
  const [board, setBoard] = useState<Day[]>(SAMPLE_BOARD);
  const [dood, setDood] = useState<Dood>(SAMPLE_DOOD);
  const [cal, setCal] = useState<Day[] | null>(null);
  const [project, setProject] = useState<string>('Desert Crossing');
  const [live, setLive] = useState(false);
  const [view, setView] = useState<'board' | 'dood' | 'calendar'>('board');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const p0 = projects[0];
        const pid = p0?.id;
        if (p0?.title || p0?.name) setProject(p0.title || p0.name);
        if (!pid) return;
        const [b, d, c] = await Promise.allSettled([
          productionApi.scheduling.board(pid),
          productionApi.scheduling.dood(pid),
          productionApi.scheduling.calendar(pid),
        ]);
        if (!alive) return;
        if (b.status === 'fulfilled') {
          const days = (b.value as any).data?.board ?? [];
          if (days.length) { setBoard(days); setLive(true); }
        }
        if (d.status === 'fulfilled') {
          const dd = (d.value as any).data;
          if (dd?.rows?.length) setDood(dd);
        }
        if (c.status === 'fulfilled') {
          const cc = (c.value as any).data;
          const days = cc?.days ?? (Array.isArray(cc) ? cc : null);
          if (days?.length) setCal(days);
        }
      } catch { /* keep sample */ }
    })();
    return () => { alive = false; };
  }, []);

  const scenes = board.reduce((n, d) => n + (d.strips?.length ?? 0), 0);
  const locations = new Set(board.map((d) => d.location).filter(Boolean)).size;
  const castCount = dood.rows.length;
  const calDays = cal ?? board;

  const KPIS: [string, string | number][] = [
    ['Shoot days', board.length],
    ['Scenes', scenes],
    ['Locations', locations],
    ['Cast (DOOD)', castCount],
  ];

  const Tab = (v: 'board' | 'dood' | 'calendar', label: string) => (
    <button key={v} onClick={() => setView(v)} style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '5px 13px', borderRadius: 999, background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? 'var(--accent-on)' : 'var(--text-3)' }}>{t(label)}</button>
  );

  return (
    <div data-theme="graphite" style={{ height: 'calc(100vh - 90px)', border: '1px solid var(--border-1)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-0)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border-1)', background: 'var(--surface-1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>{t('Scheduling')}</h1>
          <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{project}{live ? '' : ' · ' + t('sample')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 12 }}>
          {KPIS.map(([k, v]) => (
            <div key={k} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-1)', borderRadius: 10, padding: '9px 12px' }}>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-3)', fontWeight: 700 }}>{t(k)}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border-1)', background: 'var(--surface-1)', flexShrink: 0 }}>
        <div style={{ display: 'inline-flex', gap: 3, background: 'var(--surface-2)', padding: 3, borderRadius: 999 }}>
          {Tab('board', 'Stripboard')}
          {Tab('dood', 'Cast DOOD')}
          {Tab('calendar', 'Calendar')}
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{board.length} {t('days')} · {scenes} {t('scenes')}</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {view === 'board' && board.map((day, di) => (
          <div key={di} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
              <span>DAY {day.dayNumber ?? di + 1}{day.date ? ` — ${day.date}` : ''}{day.location ? ` · ${day.location}` : ''}{day.callTime ? ` · call ${day.callTime}` : ''}</span>
              <span style={{ flex: 1, height: 1, background: 'var(--border-2)' }} />
              {day.pages && <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>{day.pages} pp</span>}
            </div>
            {(day.strips ?? []).map((s, si) => (
              <div key={s.id ?? si} style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-1)', borderRadius: 8, overflow: 'hidden', marginBottom: 5, background: 'var(--surface-2)' }}>
                <span style={{ width: 6, alignSelf: 'stretch', background: intExtColor(s.intExt) }} />
                <span style={{ padding: '9px 11px', fontWeight: 800, color: 'var(--accent)', width: 40, fontSize: 12 }}>{s.sceneNumber}</span>
                <span style={{ padding: '9px 6px', width: 50 }}><span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--accent-soft)', color: intExtColor(s.intExt) }}>{s.intExt}</span></span>
                <span style={{ padding: '9px 11px', flex: 1, color: 'var(--text-1)', fontWeight: 600, fontSize: 12.5 }}>{s.setName}</span>
                <span style={{ padding: '9px 11px', width: 34, textAlign: 'center', color: 'var(--text-2)', fontSize: 12 }}>{s.dayNight}</span>
                <span style={{ padding: '9px 11px', width: 56, color: 'var(--text-3)', fontSize: 12 }}>{s.pages}</span>
                <span style={{ padding: '9px 11px', width: 160, color: 'var(--text-3)', fontSize: 10.5 }}>{s.cast}</span>
              </div>
            ))}
          </div>
        ))}

        {view === 'dood' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'start', padding: '7px 10px', color: 'var(--text-3)', position: 'sticky', insetInlineStart: 0, background: 'var(--surface-0)', minWidth: 110 }}>Cast</th>
                  {dood.days.map((d) => <th key={d} style={{ padding: '7px 8px', color: 'var(--text-3)', minWidth: 30, textAlign: 'center' }}>{d}</th>)}
                  <th style={{ padding: '7px 10px', color: 'var(--text-3)' }}>Σ</th>
                </tr>
              </thead>
              <tbody>
                {dood.rows.map((r) => (
                  <tr key={r.name} style={{ borderTop: '1px solid var(--border-1)' }}>
                    <td style={{ padding: '7px 10px', fontWeight: 600, position: 'sticky', insetInlineStart: 0, background: 'var(--surface-0)' }}>{r.name}</td>
                    {dood.days.map((d) => {
                      const [label, color] = CODE[r.codes?.[d]] || ['·', 'var(--text-3)'];
                      return <td key={d} style={{ padding: '7px 8px', textAlign: 'center', color, fontWeight: r.codes?.[d] ? 700 : 400 }}>{label}</td>;
                    })}
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>{r.workDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, color: 'var(--text-3)' }}>
              <span><b style={{ color: 'var(--accent)' }}>W</b> work</span><span><b style={{ color: 'var(--ok)' }}>S</b> start</span><span><b style={{ color: 'var(--info)' }}>F</b> finish</span><span><b>H</b> hold</span>
            </div>
          </div>
        )}

        {view === 'calendar' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
            {calDays.map((day, di) => (
              <div key={di} style={{ border: '1px solid var(--border-1)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 11px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-1)' }}>
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{t('Day')} {day.dayNumber ?? di + 1}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{day.date}</span>
                </div>
                <div style={{ padding: '10px 11px' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-1)' }}>{day.location || '—'}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3 }}>{day.callTime ? `Call ${day.callTime}` : ''}{day.pages ? ` · ${day.pages} pp` : ''}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--accent)', marginTop: 6, fontWeight: 700 }}>{(day.strips?.length ?? 0)} scene{(day.strips?.length ?? 0) === 1 ? '' : 's'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
