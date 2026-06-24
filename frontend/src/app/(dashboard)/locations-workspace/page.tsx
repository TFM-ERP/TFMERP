'use client';

/**
 * SYS-UX Phase 2 — Locations Workspace (NEW route /locations-workspace; live /locations untouched).
 * Recce gallery + map + detail panel on the tokens/shell foundation (Studio Light).
 * Wired to productionApi.locations.list with a sample fallback so it always renders.
 */
import { useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';
import '@/styles/tokens.css';

type Loc = { id: string; name?: string; address?: string; status?: string; sceneCount?: number };
const SAMPLE: Loc[] = [
  { id: 'l1', name: 'Wadi Rim — Field Hospital', address: '29.5°N, 35.4°E · Aqaba', status: 'permit approved', sceneCount: 4 },
  { id: 'l2', name: 'Dune Ridge', address: 'Wadi Rim protected area', status: 'scouting', sceneCount: 2 },
  { id: 'l3', name: 'Checkpoint Alpha', address: 'Desert Highway 47', status: 'permit pending', sceneCount: 3 },
  { id: 'l4', name: 'Command Tent — Basecamp', address: 'Wadi Rim Basecamp', status: 'permit approved', sceneCount: 5 },
];
const GRAD = ['linear-gradient(135deg,#c7d2e4,#9fb0cd)', 'linear-gradient(135deg,#d9cdbf,#bfa789)', 'linear-gradient(135deg,#c7e0d6,#9fc6b3)', 'linear-gradient(135deg,#e0d3c7,#c6a99f)'];
const STC: Record<string, string> = { 'permit approved': 'var(--ok)', 'scouting': 'var(--warn)', 'permit pending': 'var(--warn)' };

export default function LocationsWorkspace() {
  const [rows, setRows] = useState<Loc[]>(SAMPLE);
  const [live, setLive] = useState(false);
  const [selId, setSelId] = useState('l1');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pr: any = await productionApi.projects.list();
        const pid = (pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []))[0]?.id;
        if (!pid) return;
        const r: any = await productionApi.locations.list(pid);
        const items = Array.isArray(r.data) ? r.data : (r.data?.items ?? []);
        if (alive && items.length) { setRows(items); setSelId(items[0].id); setLive(true); }
      } catch { /* sample */ }
    })();
    return () => { alive = false; };
  }, []);

  const sel = rows.find((l) => l.id === selId) || rows[0];

  return (
    <div data-theme="studio" style={{ height: 'calc(100vh - 90px)', border: '1px solid var(--border-1)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-0)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border-1)', background: 'var(--surface-1)' }}>
        <div style={{ display: 'inline-flex', gap: 3, background: 'var(--surface-2)', padding: 3, borderRadius: 999 }}>
          {['Locations', 'Recce', 'Permits'].map((v, i) => <span key={v} style={{ fontSize: 12, fontWeight: 700, padding: '5px 13px', borderRadius: 999, background: i === 0 ? 'var(--accent)' : 'transparent', color: i === 0 ? 'var(--accent-on)' : 'var(--text-3)' }}>{v}</span>)}
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>Locations{live ? '' : ' · sample'}</span>
        <span style={{ flex: 1 }} />
        <button style={{ border: 'none', borderRadius: 8, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, background: 'var(--accent)', color: 'var(--accent-on)', cursor: 'pointer' }}>＋ Location</button>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 12 }}>
            {rows.map((l, i) => (
              <button key={l.id} onClick={() => setSelId(l.id)} style={{ textAlign: 'start', border: `1.5px solid ${sel?.id === l.id ? 'var(--accent)' : 'var(--border-1)'}`, borderRadius: 12, overflow: 'hidden', background: 'var(--surface-1)', cursor: 'pointer', padding: 0 }}>
                <div style={{ height: 96, background: GRAD[i % GRAD.length] }} />
                <div style={{ padding: '9px 11px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{l.name || 'Location'}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {l.sceneCount != null && <span>{l.sceneCount} scenes</span>}
                    {l.status && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'var(--surface-2)', color: STC[l.status] || 'var(--text-3)' }}>{l.status}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        {sel && (
          <aside style={{ width: 290, flexShrink: 0, borderInlineStart: '1px solid var(--border-1)', background: 'var(--surface-1)', overflow: 'auto', padding: 16 }}>
            <div style={{ height: 150, borderRadius: 10, position: 'relative', marginBottom: 11, background: 'radial-gradient(circle at 40% 45%,rgba(91,91,214,.18),transparent 42%),repeating-linear-gradient(0deg,#eef1f6 0 22px,#e7ebf2 22px 23px),repeating-linear-gradient(90deg,#eef1f6 0 22px,#e7ebf2 22px 23px),#eef1f6' }}>
              <span style={{ position: 'absolute', left: '42%', top: '46%', width: 14, height: 14, borderRadius: '50%', background: 'var(--accent)', border: '2px solid #fff' }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{sel.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>{sel.address || '—'}</div>
            {[['Permit', sel.status || '—'], ['Scenes', String(sel.sceneCount ?? '—')], ['Power', 'Genny + tie-in'], ['Nearest hospital', '22 km · Aqaba']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '7px 0', borderTop: '1px solid var(--border-1)' }}>
                <span style={{ color: 'var(--text-3)' }}>{k}</span><span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <button style={{ width: '100%', marginTop: 12, border: 'none', borderRadius: 9, padding: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'var(--accent-on)', cursor: 'pointer' }}>Share recce</button>
          </aside>
        )}
      </div>
    </div>
  );
}
