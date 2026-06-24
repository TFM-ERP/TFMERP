'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { productionApi, settingsApi } from '@/lib/api';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const logoSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);
const NAVY = '#1a1a2e', GOLD = '#b08d57';
const CAT_LABEL: Record<string, string> = {
  CAST: 'Cast', BACKGROUND: 'Background', STUNTS: 'Stunts', VEHICLES: 'Vehicles', ANIMALS: 'Animals',
  PROPS: 'Props', SET_DRESSING: 'Set Dressing', WARDROBE: 'Wardrobe', MAKEUP_HAIR: 'Makeup & Hair',
  SFX: 'Special Effects', VFX: 'Visual Effects', SPECIAL_EQUIPMENT: 'Special Equipment',
  SOUND_MUSIC: 'Sound & Music', ART: 'Art', GREENERY: 'Greenery', SECURITY: 'Security', OTHER: 'Other',
};
const CODE_BG: Record<string, string> = {
  SW: '#bbf7d0', SWF: '#bbf7d0', W: '#f0f0f0', WF: '#bfdbfe', PU: '#99f6e4', H: '#fde68a', D: '#fecaca',
};

export default function DoodPrintPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = useState<any>(null);
  const [co, setCo] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const category = qs.get('category') || 'CAST';
    const dropAfter = Number(qs.get('dropAfter')) || 4;
    Promise.all([
      productionApi.scheduling.doodMatrix(projectId, category, dropAfter),
      productionApi.projects.get(projectId).catch(() => ({ data: null })),
      settingsApi.get().catch(() => ({ data: null })),
    ]).then(([d, p, c]) => { setData(d.data); setProject(p.data); setCo(c.data); }).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { if (!loading && data) setTimeout(() => window.print(), 500); }, [loading, data]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Preparing Day Out of Days…</div>;
  if (!data || !data.rows?.length) return <div style={{ padding: 32, color: '#888' }}>No scheduled elements for this category.</div>;

  const th: any = { padding: '4px 5px', color: '#fff', fontSize: 8, fontWeight: 700, textAlign: 'center' as const };

  return (
    <>
      <style>{`@page { size: landscape; margin: 10mm; }`}</style>
      <div className="print:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: NAVY, color: '#fff', padding: '9px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <span style={{ fontSize: 12, color: '#ddd' }}>Day Out of Days — {CAT_LABEL[data.category] || data.category}</span>
        <button onClick={() => window.print()} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🖨️ Print / Save as PDF</button>
      </div>

      <div style={{ padding: '60px 20px 30px', fontFamily: 'Arial, sans-serif', color: '#1a1a2e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2px solid ${NAVY}`, paddingBottom: 6, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {co?.logoUrl && <img src={logoSrc(co.logoUrl)} alt="" style={{ height: 30, objectFit: 'contain' }} />}
            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{project?.title || data.project?.title || 'Production'}</div>
              <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Day Out of Days · {CAT_LABEL[data.category] || data.category}</div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: '#888' }}>{data.totals.elements} rows · {data.totals.shootDays} shoot days · {data.totals.workDays} work-days</div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5 }}>
          <thead>
            <tr style={{ background: NAVY }}>
              <th style={{ ...th, textAlign: 'left', minWidth: 120 }}>{CAT_LABEL[data.category] || data.category} ({data.rows.length})</th>
              {data.days.map((d: any) => (
                <th key={d.day} style={{ ...th, minWidth: 22 }}>{d.day}{d.date && <div style={{ fontWeight: 400, fontSize: 6.5, color: '#bbb' }}>{new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}</div>}</th>
              ))}
              <th style={{ ...th }}>W</th>
              <th style={{ ...th }}>H</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r: any) => (
              <tr key={r.name} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '2px 5px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.name}{r.quantity > 1 ? ` ×${r.quantity}` : ''}</td>
                {data.days.map((d: any) => {
                  const code = r.cells[d.day] || '';
                  return <td key={d.day} style={{ textAlign: 'center', padding: '1px', background: CODE_BG[code] || 'transparent', fontWeight: code ? 700 : 400, fontSize: 7.5 }}>{code}</td>;
                })}
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.totalWorkDays}</td>
                <td style={{ textAlign: 'center', color: '#b45309' }}>{r.totalHoldDays || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 8, color: '#888', marginTop: 8 }}>
          <b>SW</b> start · <b>W</b> work · <b>WF</b> finish · <b>SWF</b> single day · <b style={{ color: '#0f766e' }}>PU</b> pick-up (after a drop) · <b>H</b> hold (paid idle) · <b>D</b> drop (gap ≥ {data.dropAfter} days)
        </p>
      </div>
    </>
  );
}
