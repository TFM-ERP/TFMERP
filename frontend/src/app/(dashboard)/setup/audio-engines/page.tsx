'use client';

import { useEffect, useState, useCallback } from 'react';
import { scriptAudioApi } from '@/lib/api';
import { Mic2, Save, Loader2, Sparkles, Lock } from 'lucide-react';
import { SonRoot, SonShell, SonCard, SonBtn, SonChip, SonThemeToggle } from '@/components/production/scripton/Son';

const CAPS = [
  { key: 'LIVE_READ', label: 'Live reading' },
  { key: 'TTS', label: 'Voices (TTS)' },
  { key: 'SFX', label: 'Sound effects' },
  { key: 'MUSIC', label: 'Music' },
  { key: 'DUBBING', label: 'Dubbing' },
];

export default function AudioEnginesPage() {
  const [engines, setEngines] = useState<any[]>([]);
  const [routing, setRouting] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, r] = await Promise.all([scriptAudioApi.engines(), scriptAudioApi.routing('ORG')]);
      setEngines(e.data || []); setRouting(r.data || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const seed = async () => { setBusy(true); setMsg(''); try { await scriptAudioApi.seedEngines(); await load(); setMsg('Default engines seeded.'); } finally { setBusy(false); } };
  const saveEngine = async (id: string, data: any) => { await scriptAudioApi.updateEngine(id, data); load(); };
  const saveRouting = async (capability: string, data: any) => { await scriptAudioApi.setRouting(capability, { scope: 'ORG', ...data }); load(); };

  const engineById = (id: string) => engines.find((e) => e.id === id);

  return (
    <SonRoot className="p-6" >
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Mic2 className="text-[var(--son-accent)]" />
          <div className="son-grow">
            <h1 className="text-2xl font-semibold">ScriptON Audio — Engines &amp; Routing</h1>
            <p className="son-faint text-sm mt-0.5">Install/enable voice & sound engines and decide, per capability, which one is used. The free Browser engine always works.</p>
          </div>
          <SonThemeToggle />
          <SonBtn onClick={seed} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Seed defaults</SonBtn>
        </div>
        {msg && <p className="text-xs mb-3" style={{ color: 'var(--son-ok)' }}>{msg}</p>}

        {loading ? <div className="text-center py-16"><Loader2 className="animate-spin son-faint mx-auto" /></div> : (
          <>
            {/* Engines */}
            <h3 className="son-h3 mb-2">Engines</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="mb-8">
              {engines.length === 0 && <SonCard className="p-4"><p className="son-faint text-sm">No engines yet. Click “Seed defaults” to create Browser (free), ElevenLabs, and OpenAI.</p></SonCard>}
              {engines.map((e) => <EngineRow key={e.id} engine={e} onSave={saveEngine} />)}
            </div>

            {/* Routing matrix */}
            <h3 className="son-h3 mb-2">Routing &amp; defaults</h3>
            <SonCard className="overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="son-faint" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                  <th className="text-left px-3 py-2">Capability</th><th className="text-left px-3 py-2">Default engine</th>
                  <th className="text-center px-3 py-2">Project override</th><th className="text-center px-3 py-2">Per-render override</th>
                </tr></thead>
                <tbody>
                  {CAPS.map((c) => {
                    const row = routing.find((r) => r.capability === c.key) || {};
                    const eligible = engines.filter((e) => c.key === 'LIVE_READ' ? e.key === 'BROWSER' || (e.capabilities?.tts) : e.capabilities?.[c.key.toLowerCase()]);
                    return (
                      <tr key={c.key} style={{ borderTop: '1px solid var(--son-border)' }}>
                        <td className="px-3 py-2 font-medium">{c.label}</td>
                        <td className="px-3 py-2">
                          <select className="son-input" value={row.defaultEngineId || ''} onChange={(e) => saveRouting(c.key, { defaultEngineId: e.target.value || null, allowedEngineIds: row.allowedEngineIds || [], projectOverrideAllowed: row.projectOverrideAllowed, userMayOverride: row.userMayOverride })}>
                            <option value="">— (auto / Browser) —</option>
                            {eligible.map((e) => <option key={e.id} value={e.id}>{e.displayName}{!e.enabled ? ' (disabled)' : ''}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center"><input type="checkbox" checked={!!row.projectOverrideAllowed} onChange={(e) => saveRouting(c.key, { defaultEngineId: row.defaultEngineId, allowedEngineIds: row.allowedEngineIds || [], projectOverrideAllowed: e.target.checked, userMayOverride: row.userMayOverride })} /></td>
                        <td className="px-3 py-2 text-center"><input type="checkbox" checked={!!row.userMayOverride} onChange={(e) => saveRouting(c.key, { defaultEngineId: row.defaultEngineId, allowedEngineIds: row.allowedEngineIds || [], projectOverrideAllowed: row.projectOverrideAllowed, userMayOverride: e.target.checked })} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SonCard>
            <p className="son-faint text-xs mt-2 inline-flex items-center gap-1"><Lock size={11} /> Per-render override is off by default — users get the default engine (read-only). Turn it on to let Producers pick per render.</p>
          </>
        )}
      </div>
    </SonRoot>
  );
}

function EngineRow({ engine, onSave }: { engine: any; onSave: (id: string, d: any) => void }) {
  const cm = engine.costModel || {};
  const [cred, setCred] = useState(engine.credentialRef || '');
  const [model, setModel] = useState(engine.defaultModel || '');
  // Live engine health: provider credits, voice count, curated model catalog
  const [status, setStatus] = useState<any>(null);
  useEffect(() => {
    if (engine.tier === 'LIVE') return;
    scriptAudioApi.engineStatus(engine.key).then((r) => setStatus(r.data)).catch(() => {});
  }, [engine.key, engine.tier, engine.enabled]);
  const models = status?.models || [];
  const credits = status?.credits;
  // "Included" = treat as covered by the subscription → no cost shown/tracked.
  const [included, setIncluded] = useState(cm.billing === 'INCLUDED' || (cm.tts && Number(cm.tts.rate) === 0));
  const [rate1k, setRate1k] = useState(String(((Number(cm.tts?.rate) || 0.00018) * 1000).toFixed(3))); // $ per 1,000 chars
  const caps = engine.capabilities || {};

  const buildCostModel = () => included
    ? { ...cm, billing: 'INCLUDED', currency: cm.currency || 'USD', tts: { unit: 'CHAR', rate: 0 }, sfx: { unit: 'GENERATION', rate: 0 }, music: { unit: 'GENERATION', rate: 0 } }
    : { billing: 'METERED', currency: cm.currency || 'USD', tts: { unit: 'CHAR', rate: (Number(rate1k) || 0) / 1000 }, sfx: { unit: 'GENERATION', rate: cm.sfx?.rate ?? 0.08 }, music: { unit: 'GENERATION', rate: cm.music?.rate ?? 0.2 } };

  return (
    <SonCard className="p-3" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
      <div style={{ minWidth: 160 }}>
        <div style={{ fontWeight: 650, display: 'flex', alignItems: 'center', gap: 6 }}>{engine.displayName}
          <SonChip color={engine.tier === 'LIVE' ? 'var(--son-ok)' : 'var(--son-info)'}>{engine.tier}</SonChip></div>
        <div className="son-faint" style={{ fontSize: 11, fontFamily: 'monospace' }}>{engine.key}</div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['tts', 'sfx', 'music', 'dubbing'] as const).map((k) => caps[k] && <SonChip key={k}>{k}</SonChip>)}
      </div>
      {engine.tier !== 'LIVE' && <>
        <label className="son-faint" style={{ fontSize: 11 }}>API key env<input className="son-input" style={{ width: 150, marginTop: 2 }} value={cred} onChange={(e) => setCred(e.target.value)} placeholder="ELEVENLABS_API_KEY" /></label>
        <label className="son-faint" style={{ fontSize: 11 }} title={models.find((m: any) => m.id === model)?.hint || ''}>Model
          {models.length ? (
            <select className="son-input" style={{ width: 210, marginTop: 2 }} value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">(engine default)</option>
              {model && !models.some((m: any) => m.id === model) && <option value={model}>{model}</option>}
              {models.map((m: any) => <option key={m.id} value={m.id} title={m.hint}>{m.label}</option>)}
            </select>
          ) : (
            <input className="son-input" style={{ width: 130, marginTop: 2 }} value={model} onChange={(e) => setModel(e.target.value)} />
          )}
        </label>
        {model && models.find((m: any) => m.id === model) && <span className="son-faint" style={{ fontSize: 10, maxWidth: 180 }}>{models.find((m: any) => m.id === model).hint}</span>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label className="text-sm inline-flex items-center gap-1.5" title="Covered by your provider subscription — hide cost estimates & don't track spend">
            <input type="checkbox" checked={included} onChange={(e) => setIncluded(e.target.checked)} /> Included in subscription (hide cost)
          </label>
          {!included && <label className="son-faint" style={{ fontSize: 11 }}>$ / 1,000 chars<input className="son-input" style={{ width: 90, marginTop: 2 }} value={rate1k} onChange={(e) => setRate1k(e.target.value)} /></label>}
        </div>
      </>}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {credits && credits.limit > 0 && (
          <div title={`Provider credits used this cycle${status?.credits?.tier ? ` · ${status.credits.tier} plan` : ''}`} style={{ width: 130 }}>
            <div className="son-faint" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span>credits</span><span style={{ color: (credits.limit - credits.used) / credits.limit < 0.1 ? 'var(--son-danger)' : undefined }}>{(credits.limit - credits.used).toLocaleString()} left</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--son-surface-2)', overflow: 'hidden' }}>
              <i style={{ display: 'block', height: '100%', width: `${Math.min(100, (credits.used / credits.limit) * 100)}%`, background: (credits.limit - credits.used) / credits.limit < 0.1 ? 'var(--son-danger)' : 'var(--son-info)' }} />
            </div>
          </div>
        )}
        {status?.voiceCount !== undefined && <SonChip>{status.voiceCount} voices</SonChip>}
        {status?.creditsError && <span className="son-faint" style={{ fontSize: 10, color: 'var(--son-warn)' }} title={status.creditsError}>status unavailable</span>}
        <label className="text-sm inline-flex items-center gap-1.5"><input type="checkbox" checked={!!engine.enabled} onChange={(e) => onSave(engine.id, { enabled: e.target.checked })} /> Enabled</label>
        {engine.tier !== 'LIVE' && <SonBtn onClick={() => onSave(engine.id, { credentialRef: cred || null, defaultModel: model || null, costModel: buildCostModel() })}><Save size={13} /> Save</SonBtn>}
      </div>
    </SonCard>
  );
}
