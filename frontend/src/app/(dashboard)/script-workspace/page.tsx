'use client';

/**
 * SYS-UX Phase 2 — Script Workspace (NEW parallel route /script-workspace; /scripts untouched).
 * The north-star: content-first reader on the tokens + reading-mode foundation.
 * Reader / Pages / Audio toolbar · Ink & Paper reading mode · scene navigator (Panel) ·
 * A− / A+ · true full-screen. Wired to productionApi.script with a sample fallback so it
 * always renders. This is the template every heavy module follows.
 */
import { useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';
import '@/styles/tokens.css';

type Scene = { id: string; sceneNumber?: string; slugline?: string; intExt?: string; dayNight?: string; description?: string };

const SAMPLE: Scene[] = [
  { id: 's1', sceneNumber: '24', slugline: 'INT. FIELD HOSPITAL TENT — NIGHT', intExt: 'INT', dayNight: 'NIGHT', description: 'Rain hammers the canvas. NADIA (30s), a field medic with steady hands, presses a blood-soaked cloth to a young soldier’s shoulder.' },
  { id: 's2', sceneNumber: '25', slugline: 'EXT. DUNE RIDGE — DAY', intExt: 'EXT', dayNight: 'DAY', description: 'Heat shimmer. The convoy is a thin black seam stitched across an ocean of sand.' },
  { id: 's3', sceneNumber: '26', slugline: 'INT. COMMAND TENT — NIGHT', intExt: 'INT', dayNight: 'NIGHT', description: 'Maps and radios. The COLONEL traces a route with one finger, jaw tight.' },
];

const fmtSlug = (s: Scene) => s.slugline || [s.intExt, s.description].filter(Boolean).join('. ').toUpperCase() || 'SCENE';

export default function ScriptWorkspace() {
  const [scenes, setScenes] = useState<Scene[]>(SAMPLE);
  const [docTitle, setDocTitle] = useState('Desert Crossing');
  const [live, setLive] = useState(false);
  const [view, setView] = useState<'reader' | 'pages' | 'audio'>('reader');
  const [navOpen, setNavOpen] = useState(true);
  const [font, setFont] = useState(13);
  const [full, setFull] = useState(false);
  const [readingInk, setReadingInk] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const pid = projects[0]?.id;
        if (!pid) return;
        const dr: any = await productionApi.script.list(pid);
        const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
        const doc = docs[0];
        if (!doc) return;
        const revId = doc.activeRevisionId || doc.revisions?.[0]?.id;
        if (!revId) return;
        const rv: any = await productionApi.script.getRevision(revId);
        const sc: Scene[] = rv.data?.scenes ?? [];
        if (alive && sc.length) { setScenes(sc); setDocTitle(doc.title || 'Script'); setLive(true); }
      } catch { /* keep sample */ }
    })();
    return () => { alive = false; };
  }, []);

  const appTone = 'graphite';
  const sheetTone = readingInk ? 'ink' : appTone;

  const Toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border-1)', background: 'var(--surface-1)', flexShrink: 0 }}>
      <div style={{ display: 'inline-flex', gap: 3, background: 'var(--surface-2)', padding: 3, borderRadius: 999 }}>
        {(['reader', 'pages', 'audio'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '5px 13px', borderRadius: 999, textTransform: 'capitalize', background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? 'var(--accent-on)' : 'var(--text-3)' }}>{v}</button>
        ))}
      </div>
      <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>{docTitle}{live ? '' : ' · sample'}</span>
      <span style={{ flex: 1 }} />
      <Tbtn label="☰" title="Scenes" on={navOpen} onClick={() => setNavOpen((v) => !v)} />
      <Tbtn label="Aa" title="Reading mode (Ink)" on={readingInk} onClick={() => setReadingInk((v) => !v)} />
      <Tbtn label="A−" title="Smaller" onClick={() => setFont((f) => Math.max(10, f - 1))} />
      <Tbtn label="A+" title="Larger" onClick={() => setFont((f) => Math.min(20, f + 1))} />
      <Tbtn label="⤢" title="Full screen" on={full} onClick={() => setFull((v) => !v)} />
    </div>
  );

  const Navigator = navOpen && (
    <aside style={{ width: 230, flexShrink: 0, borderRight: '1px solid var(--border-1)', background: 'var(--surface-1)', overflow: 'auto' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-3)', fontWeight: 700, padding: '12px 14px 8px' }}>Scenes · {scenes.length}</div>
      {scenes.map((s) => (
        <a key={s.id} href={`#sc-${s.id}`} style={{ display: 'flex', gap: 9, padding: '8px 12px', textDecoration: 'none', borderTop: '1px solid var(--border-1)' }}>
          <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 12, width: 22, flexShrink: 0 }}>{s.sceneNumber || '•'}</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.3 }}>{fmtSlug(s)}<br /><span style={{ color: 'var(--text-3)', fontSize: 10 }}>{[s.intExt, s.dayNight].filter(Boolean).join(' · ')}</span></span>
        </a>
      ))}
    </aside>
  );

  // canvas content per view
  const Sheet = (
    <div data-theme={sheetTone} style={{ flex: 1, overflow: 'auto', padding: '26px 20px', background: 'color-mix(in srgb, var(--surface-0) 60%, var(--surface-2))', minHeight: 0 }}>
      <div style={{ width: 'min(680px, 100%)', margin: '0 auto', background: 'var(--surface-1)', color: 'var(--text-1)', borderRadius: 3, padding: '54px 72px 48px 92px', fontFamily: 'var(--font-mono)', fontSize: font, lineHeight: 1.5, boxShadow: '0 2px 4px rgba(0,0,0,.25), 0 16px 40px rgba(0,0,0,.18)' }}>
        {scenes.map((s, i) => (
          <div key={s.id} id={`sc-${s.id}`} style={{ marginBottom: 18 }}>
            <p style={{ fontWeight: 700, textTransform: 'uppercase', position: 'relative', marginBottom: 10 }}>
              <span style={{ position: 'absolute', left: -58, opacity: .55 }}>{s.sceneNumber || i + 1}</span>{fmtSlug(s)}
            </p>
            {s.description && <p style={{ marginBottom: 12, color: 'var(--text-2)' }}>{s.description}</p>}
            {view === 'reader' && i === 0 && (
              <>
                <p style={{ paddingInlineStart: '36%', fontWeight: 700 }}>NADIA</p>
                <p style={{ margin: '0 16% 12px 21%' }}>Stay with me. Look at my eyes — not the wound. The eyes.</p>
              </>
            )}
          </div>
        ))}
        {view === 'pages' && <div style={{ borderTop: '1px dashed var(--border-2)', marginTop: 8, paddingTop: 8, fontSize: 10, color: 'var(--text-3)', display: 'flex', justifyContent: 'space-between' }}><span>{docTitle} — Rev. Blue</span><span>sides</span></div>}
      </div>
    </div>
  );

  const Audio = (
    <div style={{ flex: 1, overflow: 'auto', padding: 22 }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>ScriptON · table-read — per-scene audio</div>
      {scenes.map((s) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 10, background: 'var(--surface-1)', border: '1px solid var(--border-1)', marginBottom: 8 }}>
          <button style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--accent)', color: 'var(--accent-on)', cursor: 'pointer', fontWeight: 800 }}>▶</button>
          <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 12, width: 24 }}>{s.sceneNumber || '•'}</span>
          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{fmtSlug(s)}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{[s.intExt, s.dayNight].filter(Boolean).join(' · ')}</span>
        </div>
      ))}
    </div>
  );

  const shell = (
    <div style={{ display: 'flex', flexDirection: 'column', height: full ? '100vh' : '100%', background: 'var(--surface-0)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)', ...(full ? { position: 'fixed' as const, inset: 0, zIndex: 60 } : {}) }}>
      {Toolbar}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {view !== 'audio' && Navigator}
        {view === 'audio' ? Audio : Sheet}
      </div>
    </div>
  );

  // page wrapper provides height inside the dashboard content area; full-screen escapes it
  return (
    <div data-theme={appTone} style={{ height: 'calc(100vh - 90px)', border: '1px solid var(--border-1)', borderRadius: 12, overflow: 'hidden' }}>
      {shell}
    </div>
  );
}

function Tbtn({ label, title, on, onClick }: { label: string; title: string; on?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      style={{ minWidth: 32, height: 32, padding: '0 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
        border: '1px solid var(--border-1)', background: on ? 'var(--accent-soft)' : 'var(--surface-2)', color: on ? 'var(--accent)' : 'var(--text-2)' }}>
      {label}
    </button>
  );
}
