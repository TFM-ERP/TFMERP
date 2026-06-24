'use client';
import React, { useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

const C = { scrim: 'rgba(6,7,10,0.72)', panel: '#14161c', hair: 'rgba(255,255,255,.09)', gold: '#C6A463', gold2: '#E6D2A2', text: '#E8E6E0', mute: '#9aa1ab', faint: '#6b727d', green: '#57b368', amber: '#e0a23b', red: '#e5635f' };
const recTone = (r?: string) => { const x = String(r || '').toUpperCase(); return x === 'RECOMMEND' ? C.green : x === 'CONSIDER' ? C.amber : x === 'PASS' ? C.red : C.faint; };
const fdate = (s?: string) => { try { return new Date(s as string).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return ''; } };

export default function ScripOnCoverageHistory({ projectId, onOpen, onClose }: { projectId: string; onOpen: (r: any) => void; onClose: () => void }) {
  const { dir, t } = useLocale();
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r: any = await productionApi.scripton.coverageHistory(projectId); if (alive) setRows(Array.isArray(r.data) ? r.data : []); }
      catch (e: any) { if (alive) { setErr(e?.response?.data?.message || t('Could not load history — is the backend on :3001?')); setRows([]); } }
    })();
    return () => { alive = false; };
  }, [projectId]);

  return (
    <div onClick={onClose} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 70, background: C.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--sx-body)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '100%', maxHeight: '82vh', overflow: 'auto', background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 16, padding: 20, color: C.text, boxShadow: '0 24px 70px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.gold2 }}>{t('Coverage history')}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.mute, fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 12 }}>{t('Every coverage run is saved. Open one to view it.')}</div>
        {rows === null && <div style={{ color: C.mute, fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{t('Loading…')}</div>}
        {rows && rows.length === 0 && <div style={{ color: C.faint, fontSize: 13, padding: '24px 0', textAlign: 'center', border: `1px dashed ${C.hair}`, borderRadius: 12 }}>{err || t('No coverage runs yet. Generate coverage to start the history.')}</div>}
        {rows && rows.map((r: any) => (
          <button key={r.id || r.createdAt} onClick={() => onOpen(r)} style={{ width: '100%', textAlign: 'left', background: '#171a20', border: `1px solid ${C.hair}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', color: C.text }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#F4EEE0' }}>{r.title || r.genre || t('Coverage')}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, color: recTone(r.recommendation), border: `1px solid ${recTone(r.recommendation)}55`, borderRadius: 999, padding: '3px 9px' }}>{String(r.recommendation || '—').toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>{fdate(r.createdAt)}{r.facts?.scenes ? ' · ' + r.facts.scenes + ' ' + t('scenes') : ''}{r.facts?.pages ? ' · ' + r.facts.pages + ' ' + t('pp') : ''}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
