'use client';

/**
 * Production Intel — the AI "situation room" widget for the project Overview board.
 * Fuses live weather (Open-Meteo), public holidays (Nager.Date) and web-searched local news
 * into role-targeted risk alerts for the Producer / Line Producer / UPM / PM / Location Manager /
 * 2nd Unit Director. Backed by GET /production/intel/:projectId (cached 30 min server-side).
 * Auto-refreshes every 30 minutes; the ↻ button forces a fresh analysis. Token-driven so it
 * themes across every app theme.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { productionApi } from '@/lib/api';

const SEV: Record<string, { color: string; bg: string; label: string; o: number }> = {
  CRITICAL: { color: 'var(--danger)', bg: 'var(--danger-soft)', label: 'CRITICAL', o: 0 },
  WARNING: { color: 'var(--warn)', bg: 'var(--warn-soft)', label: 'WARNING', o: 1 },
  WATCH: { color: 'var(--accent)', bg: 'var(--accent-soft)', label: 'WATCH', o: 2 },
  INFO: { color: 'var(--text-3)', bg: 'var(--surface-2)', label: 'INFO', o: 3 },
};
const CAT: Record<string, string> = { WEATHER: '🌩', HOLIDAY: '🎌', CIVIL: '⚠️', LOGISTICS: '🚧', PERMIT: '📋', EVENT: '🎪', HEALTH: '🏥', OTHER: '📌' };
const ROLE_LABEL: Record<string, string> = { PRODUCER: 'Producer', LINE_PRODUCER: 'Line Producer', UPM: 'UPM', PM: 'PM', LOCATION_MANAGER: 'Location Mgr', SECOND_UNIT_DIRECTOR: '2nd Unit' };
const ROLE_ORDER = ['PRODUCER', 'LINE_PRODUCER', 'UPM', 'PM', 'LOCATION_MANAGER', 'SECOND_UNIT_DIRECTOR'];

export default function ProductionIntelWidget({ projectId }: { projectId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [role, setRole] = useState('ALL');

  const load = useCallback(async (force: boolean) => {
    setLoading(true); setErr('');
    try { const r: any = await productionApi.intel.get(projectId, force); setData(r.data || null); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Could not reach the intel service (backend on :3001?).'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(false); const t = setInterval(() => load(false), 30 * 60 * 1000); return () => clearInterval(t); }, [load]);

  const items: any[] = data?.items || [];
  const roleCounts = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach((it) => (it.affectedRoles || []).forEach((r: string) => { m[r] = (m[r] || 0) + 1; }));
    return m;
  }, [items]);
  const shown = role === 'ALL' ? items : items.filter((it) => (it.affectedRoles || []).includes(role));
  const critical = items.filter((it) => it.severity === 'CRITICAL' || it.severity === 'WARNING').length;

  const chip = (active: boolean): React.CSSProperties => ({
    fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
    border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-1)'),
    background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--accent-soft-text, var(--accent))' : 'var(--text-3)',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 }}>
      <style>{`@keyframes intel-spin{to{transform:rotate(360deg)}} .intel-spin{display:inline-block;animation:intel-spin .9s linear infinite}`}</style>

      {/* Header: location + freshness + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📍 {data?.location?.label || 'Resolving location…'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
            {critical > 0 && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{critical} to action · </span>}
            {loading ? 'Analyzing…' : data ? `updated ${data.ageMinutes === 0 ? 'just now' : data.ageMinutes + 'm ago'} · auto every 30m` : 'not loaded'}
          </div>
        </div>
        <button title="Refresh analysis" onClick={() => load(true)} disabled={loading}
          style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, border: '1px solid var(--border-1)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: loading ? 'default' : 'pointer', fontSize: 15, lineHeight: 1, display: 'grid', placeItems: 'center' }}>
          <span className={loading ? 'intel-spin' : ''}>↻</span>
        </button>
      </div>

      {/* Headline + context */}
      {data?.summary && <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>{data.summary}</div>}
      {(data?.weather?.summary || data?.holidays?.length) && (
        <div style={{ fontSize: 10, color: 'var(--text-3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data?.weather?.summary && <span>🌤 {data.weather.summary}</span>}
          {data?.holidays?.[0] && <span>🎌 next: {data.holidays[0].name} ({data.holidays[0].date})</span>}
        </div>
      )}

      {/* Role filter */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <span style={chip(role === 'ALL')} onClick={() => setRole('ALL')}>All · {items.length}</span>
          {ROLE_ORDER.filter((r) => roleCounts[r]).map((r) => (
            <span key={r} style={chip(role === r)} onClick={() => setRole(r)}>{ROLE_LABEL[r]} · {roleCounts[r]}</span>
          ))}
        </div>
      )}

      {/* Alerts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {loading && !data && <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '10px 2px' }}><span className="intel-spin">↻</span> Reading weather, holidays &amp; world news…</div>}
        {err && !data && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</div>}
        {shown.map((it) => {
          const sv = SEV[it.severity] || SEV.WATCH;
          return (
            <div key={it.id} style={{ border: '1px solid var(--border-1)', borderInlineStart: '3px solid ' + sv.color, borderRadius: 10, padding: '9px 11px', background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <span style={{ fontSize: 13 }}>{CAT[it.category] || '📌'}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', flex: 1, minWidth: 0 }}>{it.title}</span>
                <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.04em', color: sv.color, background: sv.bg, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>{sv.label}</span>
              </div>
              {it.detail && <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>{it.detail}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {it.window && <span style={{ fontSize: 9.5, color: 'var(--text-3)', fontWeight: 600 }}>🕑 {it.window}</span>}
                {(it.affectedRoles || []).map((r: string) => (
                  <span key={r} style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', background: 'var(--surface-3, var(--surface-1))', border: '1px solid var(--border-1)', borderRadius: 999, padding: '1px 6px' }}>{ROLE_LABEL[r] || r}</span>
                ))}
              </div>
              {it.suggestion && <div style={{ fontSize: 10.5, color: 'var(--accent)', marginTop: 6, lineHeight: 1.4 }}>→ {it.suggestion}</div>}
              {it.source && <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 3 }}>source: {it.source}</div>}
            </div>
          );
        })}
        {!loading && data && shown.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No alerts for this role.</div>}
      </div>

      {data?.degraded && <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 2 }}>⚠ {data.degraded}</div>}
    </div>
  );
}
