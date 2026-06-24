'use client';
import React, { useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

const C = { scrim: 'rgba(6,7,10,0.72)', panel: '#14161c', card: '#171a20', hair: 'rgba(255,255,255,.09)', gold: '#C6A463', gold2: '#E6D2A2', text: '#E8E6E0', mute: '#9aa1ab', faint: '#6b727d', green: '#57b368', amber: '#e0a23b', red: '#e5635f' };
const vTone = (v?: string) => { const x = String(v || '').toUpperCase(); return x === 'GO' ? C.green : x === 'HOLD' ? C.red : C.amber; };

export default function ScripOnCompsDeck({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { dir, t } = useLocale();
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r: any = await productionApi.scripton.marketForecast(projectId, {}); if (alive) setData(r.data || {}); }
      catch (e: any) { if (alive) setErr(e?.response?.data?.message || 'Market analysis needs the backend on :3001 and an AI key.'); }
    })();
    return () => { alive = false; };
  }, [projectId]);

  const comps: any[] = data?.comps || [];
  return (
    <div onClick={onClose} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 70, background: C.scrim, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--sx-body)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: '100%', maxHeight: '84vh', overflow: 'auto', background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 16, padding: 20, color: C.text, boxShadow: '0 24px 70px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.gold2 }}>{t('Market comps')}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.mute, fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: C.faint, margin: '4px 0 14px' }}>{t('Comparable titles + a probabilistic read, grounded in your scenes. Estimates only — not guarantees.')}</div>

        {!data && !err && <div style={{ color: C.mute, fontSize: 13, padding: '30px 0', textAlign: 'center' }}>{t('Analysing market and finding comparables…')}</div>}
        {err && <div style={{ color: C.amber, fontSize: 13, padding: '20px 0', textAlign: 'center', border: `1px dashed ${C.hair}`, borderRadius: 12 }}>{t(err)}</div>}

        {data && (
          <>
            {(data.verdict || data.probability != null) && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: vTone(data.verdict), border: `1px solid ${vTone(data.verdict)}66`, borderRadius: 999, padding: '4px 11px' }}>{String(data.verdict || 'CONDITIONAL').toUpperCase()}</span>
                {data.probability != null && <span style={{ fontSize: 12.5, color: C.mute }}>{t('Greenlight probability')} <b style={{ color: C.gold2 }}>{Number(data.probability) || 0}%</b></span>}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {comps.length === 0 && <div style={{ gridColumn: '1 / -1', color: C.faint, fontSize: 13, textAlign: 'center', padding: '18px 0' }}>{t('No comparables returned.')}</div>}
              {comps.map((c: any, i: number) => (
                <div key={i} style={{ background: C.card, border: `1px solid ${C.hair}`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F4EEE0' }}>{c.name || c.title || '—'}</span>
                    {c.sim != null && <span style={{ fontSize: 11, color: C.gold2 }}>{Number(c.sim) || 0}%</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3 }}>{c.gross ? t('Worldwide') + ' ' + c.gross : (c.reason || '')}</div>
                </div>
              ))}
            </div>
            {Array.isArray(data.forecast) && data.forecast.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.1, color: C.gold, marginBottom: 7 }}>{t('REVENUE FORECAST')}</div>
                {data.forecast.map((f: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '6px 0', borderTop: i ? `1px solid ${C.hair}` : 'none' }}>
                    <span style={{ color: C.mute }}>{f.window || '—'}</span>
                    <span style={{ color: C.text }}>{f.p50 || '—'} <span style={{ color: C.faint }}>({f.low || '?'}–{f.high || '?'})</span></span>
                  </div>
                ))}
              </div>
            )}
            <a href="/scripon/greenlight" style={{ display: 'block', textAlign: 'center', marginTop: 16, background: 'rgba(198,164,99,0.14)', color: C.gold, border: `1px solid ${C.gold}55`, borderRadius: 10, padding: '9px', fontSize: 12.5, textDecoration: 'none' }}>{t('Open full market & greenlight')} {dir === 'rtl' ? '←' : '→'}</a>
          </>
        )}
      </div>
    </div>
  );
}
