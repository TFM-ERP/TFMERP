'use client';

/**
 * SYS-UX Phase 2 — Casting Workspace (NEW parallel route /casting-workspace; live /casting untouched).
 * Content-first talent grid + side-panel profile on the tokens/shell foundation, in Studio Light
 * (the day/office mode). Wired to castingApi.talent with a sample fallback so it always renders.
 */
import { useEffect, useMemo, useState } from 'react';
import { castingApi } from '@/lib/api';
import '@/styles/tokens.css';

type Talent = { id: string; stageName?: string; fullName?: string; role?: string; agency?: string; availability?: string; status?: string };

const SAMPLE: Talent[] = [
  { id: 't1', stageName: 'Layla Haddad', role: 'Lead — Nadia', agency: 'Mirage Talent', availability: 'Jun 10 – Aug 2', status: 'shortlisted' },
  { id: 't2', stageName: 'Mona Saleh', role: 'Lead — Nadia', agency: 'Star MENA', availability: 'open', status: 'review' },
  { id: 't3', stageName: 'Adam Karam', role: 'Lead — Nadia', agency: 'Mirage Talent', availability: 'from Jun 20', status: 'review' },
  { id: 't4', stageName: 'Omar Mansour', role: 'Support — Soldier', agency: 'Indie', availability: 'open', status: 'cast' },
  { id: 't5', stageName: 'Nadia Fares', role: 'Support — Recruit', agency: 'Star MENA', availability: 'open', status: 'review' },
  { id: 't6', stageName: 'Rami Aziz', role: 'Support — Recruit', agency: 'Casting House', availability: 'open', status: 'review' },
];
const NAME = (t: Talent) => t.stageName || t.fullName || 'Talent';
const STATUS_COLOR: Record<string, string> = { cast: 'var(--ok)', shortlisted: 'var(--accent)', review: 'var(--text-3)' };
const GRAD = ['linear-gradient(135deg,#cfd6e6,#aeb8cf)', 'linear-gradient(135deg,#e6cfd9,#cfaeb9)', 'linear-gradient(135deg,#cfe6d9,#aecfbb)', 'linear-gradient(135deg,#e6dfcf,#cfc3ae)'];

export default function CastingWorkspace() {
  const [rows, setRows] = useState<Talent[]>(SAMPLE);
  const [live, setLive] = useState(false);
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string>('t1');

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      castingApi.talent(q ? { search: q } : {})
        .then((r: any) => { if (alive && Array.isArray(r.data) && r.data.length) { setRows(r.data); setLive(true); } })
        .catch(() => { /* keep sample */ });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const shown = useMemo(() => rows, [rows]);
  const sel = shown.find((t) => t.id === selId) || shown[0];

  return (
    <div data-theme="studio" style={{ height: 'calc(100vh - 90px)', border: '1px solid var(--border-1)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-0)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border-1)', background: 'var(--surface-1)', flexShrink: 0 }}>
        <div style={{ display: 'inline-flex', gap: 3, background: 'var(--surface-2)', padding: 3, borderRadius: 999 }}>
          {['Talent', 'Shortlists', 'Sessions'].map((v, i) => (
            <span key={v} style={{ fontSize: 12, fontWeight: 700, padding: '5px 13px', borderRadius: 999, background: i === 0 ? 'var(--accent)' : 'transparent', color: i === 0 ? 'var(--accent-on)' : 'var(--text-3)' }}>{v}</span>
          ))}
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>Talent database{live ? '' : ' · sample'}</span>
        <span style={{ flex: 1 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search talent…" style={{ fontSize: 13, padding: '7px 12px', borderRadius: 999, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-1)', minWidth: 200 }} />
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* grid */}
        <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {shown.map((t, i) => (
              <button key={t.id} onClick={() => setSelId(t.id)} style={{ textAlign: 'start', border: `1.5px solid ${sel?.id === t.id ? 'var(--accent)' : 'var(--border-1)'}`, borderRadius: 12, overflow: 'hidden', background: 'var(--surface-1)', cursor: 'pointer', padding: 0 }}>
                <div style={{ height: 88, background: GRAD[i % GRAD.length] }} />
                <div style={{ padding: '9px 10px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)' }}>{NAME(t)}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {t.role || '—'}{t.status && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'var(--surface-2)', color: STATUS_COLOR[t.status] || 'var(--text-3)' }}>{t.status}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* profile panel */}
        {sel && (
          <aside style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--border-1)', background: 'var(--surface-1)', overflow: 'auto', padding: 16 }}>
            <div style={{ height: 130, borderRadius: 10, background: GRAD[0], marginBottom: 11 }} />
            <div style={{ fontSize: 16, fontWeight: 800 }}>{NAME(sel)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>{sel.role || '—'}{sel.status ? ` · ${sel.status}` : ''}</div>
            {[['Agency', sel.agency], ['Availability', sel.availability], ['Self-tape', '▶ 2 clips']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '7px 0', borderTop: '1px solid var(--border-1)' }}>
                <span style={{ color: 'var(--text-3)' }}>{k}</span><span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{v || '—'}</span>
              </div>
            ))}
            <button style={{ width: '100%', marginTop: 13, border: 'none', borderRadius: 9, padding: '10px', fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'var(--accent-on)', cursor: 'pointer' }}>Send to producers</button>
            <button style={{ width: '100%', marginTop: 8, borderRadius: 9, padding: '9px', fontSize: 12.5, fontWeight: 700, background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-1)', cursor: 'pointer' }}>Generate actor link →</button>
          </aside>
        )}
      </div>
    </div>
  );
}
