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
            <div className="son-faint" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Engines</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="mb-10">
              {engines.length === 0 && <SonCard className="p-4"><p className="son-faint text-sm">No engines yet. Click “Seed defaults” to create Browser (free), ElevenLabs, and OpenAI.</p></SonCard>}
              {engines.map((e) => <EngineRow key={e.id} engine={e} onSave={saveEngine} />)}
            </div>

            {/* Routing matrix */}
            <div className="son-faint" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Routing &amp; defaults</div>
            <SonCard className="overflow-hidden" style={{ padding: 0 }}>
              <table className="w-full text-sm">
                <thead><tr className="son-faint" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--son-border)' }}>
                  <th className="text-left" style={{ padding: '10px 16px' }}>Capability</th><th className="text-left" style={{ padding: '10px 12px' }}>Default engine</th>
                  <th className="text-center" style={{ padding: '10px 12px' }}>Project override</th><th className="text-center" style={{ padding: '10px 16px' }}>Per-render override</th>
                </tr></thead>
                <tbody>
                  {CAPS.map((c) => {
                    const row = routing.find((r) => r.capability === c.key) || {};
                    const eligible = engines.filter((e) => c.key === 'LIVE_READ' ? e.key === 'BROWSER' || (e.capabilities?.tts) : e.capabilities?.[c.key.toLowerCase()]);
                    return (
                      <tr key={c.key} style={{ borderTop: '1px solid var(--son-border)' }}>
                        <td className="font-medium" style={{ padding: '9px 16px', whiteSpace: 'nowrap' }}>{c.label}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <select className="son-input" style={{ width: 240 }} value={row.defaultEngineId || ''} onChange={(e) => saveRouting(c.key, { defaultEngineId: e.target.value || null, allowedEngineIds: row.allowedEngineIds || [], projectOverrideAllowed: row.projectOverrideAllowed, userMayOverride: row.userMayOverride })}>
                            <option value="">— auto (Browser fallback) —</option>
                            {eligible.map((e) => <option key={e.id} value={e.id}>{e.displayName}{!e.enabled ? ' (disabled)' : ''}</option>)}
                          </select>
                        </td>
                        <td className="text-center" style={{ padding: '9px 12px' }}><input type="checkbox" checked={!!row.projectOverrideAllowed} onChange={(e) => saveRouting(c.key, { defaultEngineId: row.defaultEngineId, allowedEngineIds: row.allowedEngineIds || [], projectOverrideAllowed: e.target.checked, userMayOverride: row.userMayOverride })} /></td>
                        <td className="text-center" style={{ padding: '9px 16px' }}><input type="checkbox" checked={!!row.userMayOverride} onChange={(e) => saveRouting(c.key, { defaultEngineId: row.defaultEngineId, allowedEngineIds: row.allowedEngineIds || [], projectOverrideAllowed: row.projectOverrideAllowed, userMayOverride: e.target.checked })} /></td>
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
  const [baseUrl, setBaseUrl] = useState(engine.baseUrl || '');
  const isLocal = engine.key === 'LOCAL';
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

  const low = credits && credits.limit > 0 && (credits.limit - credits.used) / credits.limit < 0.1;
  const Field = ({ label, children, hint }: any) => (
    <div>
      <div className="son-faint" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      {children}
      {hint && <div className="son-faint" style={{ fontSize: 10, marginTop: 4, lineHeight: 1.35 }}>{hint}</div>}
    </div>
  );

  return (
    <SonCard style={{ padding: '14px 16px' }}>
      {/* Header line: identity · capabilities · health · enable */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{engine.displayName}</div>
        <SonChip color={engine.tier === 'LIVE' ? 'var(--son-ok)' : 'var(--son-info)'}>{engine.tier === 'LIVE' ? 'free · browser' : 'studio'}</SonChip>
        <span className="son-faint" style={{ fontSize: 11, fontFamily: 'monospace' }}>{engine.key}</span>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {(['tts', 'sfx', 'music', 'dubbing'] as const).map((k) => caps[k] && <SonChip key={k}>{k}</SonChip>)}
        </span>
        <span style={{ flex: 1 }} />
        {status?.voiceCount !== undefined && <SonChip>{status.voiceCount} voices</SonChip>}
        {credits && credits.limit > 0 && (
          <div title={`Provider credits this cycle${credits.tier ? ` · ${credits.tier} plan` : ''}`} style={{ width: 150 }}>
            <div className="son-faint" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>credits</span>
              <span style={{ color: low ? 'var(--son-danger)' : undefined, fontWeight: low ? 700 : 400 }}>{(credits.limit - credits.used).toLocaleString()} left</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--son-surface-2)', overflow: 'hidden' }}>
              <i style={{ display: 'block', height: '100%', width: `${Math.min(100, (credits.used / credits.limit) * 100)}%`, background: low ? 'var(--son-danger)' : 'var(--son-info)' }} />
            </div>
          </div>
        )}
        {status?.creditsError && <span className="son-faint" style={{ fontSize: 10, color: 'var(--son-warn)' }} title={status.creditsError}>status unavailable</span>}
        <label className="text-sm inline-flex items-center gap-1.5" style={{ fontWeight: 600 }}>
          <input type="checkbox" checked={!!engine.enabled} onChange={(e) => onSave(engine.id, { enabled: e.target.checked })} /> Enabled
        </label>
      </div>

      {/* Config grid: aligned columns, labels above fields */}
      {engine.tier !== 'LIVE' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 14, alignItems: 'start', borderTop: '1px solid var(--son-border)', paddingTop: 12 }}>
            {isLocal ? (
              <Field label="Server URL" hint="Your local OpenAI-compatible TTS server — free, unlimited, no key. See docs/system/15-local-audio-engines.md.">
                <input className="son-input" style={{ width: '100%' }} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:4123" />
              </Field>
            ) : (
              <Field label="API key environment variable" hint="The env var name in backend/.env — never the key itself.">
                <input className="son-input" style={{ width: '100%' }} value={cred} onChange={(e) => setCred(e.target.value)} placeholder="ELEVENLABS_API_KEY" />
              </Field>
            )}
            <Field label="Model" hint={models.find((m: any) => m.id === model)?.hint || 'Pick by intent — hover options for details.'}>
              {models.length ? (
                <select className="son-input" style={{ width: '100%' }} value={model} onChange={(e) => setModel(e.target.value)}>
                  <option value="">(engine default)</option>
                  {model && !models.some((m: any) => m.id === model) && <option value={model}>{model}</option>}
                  {models.map((m: any) => <option key={m.id} value={m.id} title={m.hint}>{m.label}</option>)}
                </select>
              ) : (
                <input className="son-input" style={{ width: '100%' }} value={model} onChange={(e) => setModel(e.target.value)} placeholder="model id" />
              )}
            </Field>
            <Field label="Billing" hint={included ? 'Subscription-covered: no cost estimates, no spend tracking.' : 'Metered: estimates + ledger use this rate.'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34 }}>
                <label className="text-sm inline-flex items-center gap-1.5" style={{ whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={included} onChange={(e) => setIncluded(e.target.checked)} /> Included in subscription
                </label>
                {!included && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span className="son-faint" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>$ / 1k chars</span>
                    <input className="son-input" style={{ width: 80 }} value={rate1k} onChange={(e) => setRate1k(e.target.value)} />
                  </span>
                )}
              </div>
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <SonBtn primary onClick={() => onSave(engine.id, { credentialRef: cred || null, baseUrl: baseUrl || null, defaultModel: model || null, costModel: buildCostModel() })}><Save size={13} /> Save engine</SonBtn>
          </div>
        </>
      )}
    </SonCard>
  );
}
