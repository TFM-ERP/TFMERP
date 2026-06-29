'use client';

/**
 * Video Engines & Routing — the render-side Unified Engine Switchboard admin page.
 * Sibling of /setup/llm-engines and /setup/audio-engines; built on the SON design
 * system so it follows the global Graphite & Gold theme. Talks to /production/video/*.
 */
import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { videoEnginesApi } from '@/lib/api';
import { SonRoot, SonCard, SonBtn, SonChip, SonTabs } from '@/components/production/scripton/Son';
import { Clapperboard, Loader2, Sparkles, Plus, X, ChevronUp, ChevronDown, Pencil, Trash2 } from 'lucide-react';

const TIER: Record<string, { label: string; color: string }> = {
  PAID: { label: 'paid', color: 'var(--son-info)' },
  LIMITED_FREE: { label: 'limited free', color: 'var(--son-warn)' },
  ULTIMATE_FREE: { label: 'local · free', color: 'var(--son-ok)' },
};
const PROVIDERS = ['local_comfy', 'runway', 'seedance', 'luma', 'kling'];
const CAPS = [
  { key: 'VIDEO_DEFAULT', label: 'Default' },
  { key: 'PREVIEW', label: 'Preview' },
  { key: 'FINAL', label: 'Final' },
];
const cap = (s: string) => (s ? s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : s);

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="son-faint" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      {children}
      {hint && <div className="son-faint" style={{ fontSize: 10, marginTop: 4, lineHeight: 1.35 }}>{hint}</div>}
    </div>
  );
}

export default function VideoEnginesPage() {
  const [engines, setEngines] = useState<any[]>([]);
  const [routing, setRouting] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('engines');
  const [drawer, setDrawer] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, r, h] = await Promise.all([
        videoEnginesApi.engines(),
        videoEnginesApi.routing('ORG'),
        videoEnginesApi.health().catch(() => ({ data: null })),
      ]);
      setEngines(e.data || []); setRouting(r.data || []); setHealth(h.data || null);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const seed = async () => { setBusy(true); setMsg(''); try { await videoEnginesApi.seedEngines(); await load(); setMsg('Default providers seeded — Local ComfyUI is enabled; Runway is ready once you add its key.'); } finally { setBusy(false); } };
  const toggleEngine = async (id: string, enabled: boolean) => { await videoEnginesApi.updateEngine(id, { enabled }); await load(); };
  const createEngine = async (data: any) => { await videoEnginesApi.createEngine(data); await load(); setDrawer(null); };
  const updateEngine = async (id: string, data: any) => { await videoEnginesApi.updateEngine(id, data); await load(); setDrawer(null); };
  const removeEngine = async (id: string) => { await videoEnginesApi.removeEngine(id); await load(); setDrawer(null); };

  return (
    <SonRoot className="p-6">
      <div className="max-w-[1180px] mx-auto">
        <div className="flex items-center gap-3 mb-1" style={{ flexWrap: 'wrap' }}>
          <Clapperboard className="text-[var(--son-accent)]" />
          <div className="son-grow">
            <h1 className="text-2xl font-semibold">Video Engines &amp; Routing</h1>
            <p className="son-faint text-sm mt-0.5">Route every render across providers — local ComfyUI first, cloud (Runway) on failover.</p>
          </div>
          <SonBtn onClick={seed} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Seed defaults</SonBtn>
          <SonBtn primary onClick={() => setDrawer({ __new: true })}><Plus size={14} /> Add engine</SonBtn>
        </div>
        {msg && <p className="text-xs mb-2" style={{ color: 'var(--son-ok)' }}>{msg}</p>}

        {health?.providers?.length > 0 && <ChainStrip providers={health.providers} />}

        <div className="mt-5">
          <SonTabs tabs={[{ key: 'engines', label: 'Engines' }, { key: 'routing', label: 'Routing & Failover' }]} active={tab} onChange={setTab} />
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="animate-spin son-faint mx-auto" /></div>
        ) : (
          <div className="mt-5">
            {tab === 'engines' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {engines.length === 0 && <EmptyState onSeed={seed} busy={busy} />}
                {engines.map((e) => (
                  <EngineRow key={e.id} engine={e} health={health}
                    onToggle={(v: boolean) => toggleEngine(e.id, v)} onEdit={() => setDrawer(e)} />
                ))}
              </div>
            ) : (
              <RoutingTab engines={engines} routing={routing} health={health}
                onSave={async (capKey: string, data: any) => { await videoEnginesApi.setRouting(capKey, { scope: 'ORG', ...data }); await load(); }} />
            )}
          </div>
        )}
      </div>

      {drawer && (
        <EngineDrawer engine={drawer.__new ? null : drawer}
          onClose={() => setDrawer(null)} onCreate={createEngine} onUpdate={updateEngine} onRemove={removeEngine} />
      )}
    </SonRoot>
  );
}

/* ── Live failover-chain strip ─────────────────────────────────────────────── */
function ChainStrip({ providers }: { providers: any[] }) {
  return (
    <SonCard style={{ padding: '14px 16px', marginTop: 16 }}>
      <div className="flex items-center justify-between mb-3" style={{ gap: 10, flexWrap: 'wrap' }}>
        <span className="inline-flex items-center gap-2" style={{ fontWeight: 600, fontSize: 14 }}>
          <span className="son-dot" style={{ background: 'var(--son-ok)' }} /> Active render chain
        </span>
        <span className="son-faint" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>Capability: VIDEO_DEFAULT</span>
      </div>
      <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
        {providers.map((p, i) => {
          const color = p.usable ? 'var(--son-ok)' : p.hasCredential ? 'var(--son-warn)' : 'var(--son-faint)';
          const state = p.usable ? 'live' : p.hasCredential ? 'paused' : 'no key';
          return (
            <span key={p.key} className="inline-flex items-center" style={{ gap: 8 }}>
              <span className="inline-flex items-center" style={{ gap: 7, padding: '7px 12px', borderRadius: 22, border: `1px solid ${p.usable ? 'var(--son-accent)' : 'var(--son-border)'}`, background: p.usable ? 'color-mix(in srgb,var(--son-accent) 12%,transparent)' : 'var(--son-surface-2)' }}>
                <span className="son-dot" style={{ background: color }} />
                <b style={{ fontSize: 12.5 }}>{i + 1} {cap(p.provider)}</b>
                <span className="son-faint" style={{ fontSize: 11 }}>{state}</span>
              </span>
              {i < providers.length - 1 && <span className="son-faint">▸</span>}
            </span>
          );
        })}
      </div>
    </SonCard>
  );
}

/* ── Engine row ────────────────────────────────────────────────────────────── */
function EngineRow({ engine, health, onToggle, onEdit }: { engine: any; health: any; onToggle: (v: boolean) => void; onEdit: () => void }) {
  const [status, setStatus] = useState<any>(null);
  useEffect(() => { videoEnginesApi.engineStatus(engine.key).then((r) => setStatus(r.data)).catch(() => {}); }, [engine.key, engine.enabled]);
  const tier = TIER[engine.tier] || TIER.PAID;
  const hp = (health?.providers || []).find((p: any) => p.key === engine.key);
  const usable = hp?.usable;
  const statusColor = !engine.enabled ? 'var(--son-faint)' : usable ? 'var(--son-ok)' : 'var(--son-warn)';
  const statusLabel = !engine.enabled ? 'Disabled' : usable ? 'Live' : 'Needs setup';
  const isLocal = engine.provider === 'local_comfy';

  return (
    <SonCard style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {/* identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 220 }}>
          <span style={{ width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: engine.enabled ? 'var(--son-accent-ink)' : 'var(--son-muted)', background: engine.enabled ? 'var(--son-accent)' : 'var(--son-surface-2)', border: '1px solid var(--son-border)' }}>{(engine.displayName || engine.key || '?')[0]}</span>
          <div>
            <div className="flex items-center" style={{ gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{engine.displayName}</span>
              <SonChip>video</SonChip>
              <SonChip color={tier.color}>{tier.label}</SonChip>
            </div>
            <div className="son-faint" style={{ fontSize: 11, marginTop: 3 }}>
              {engine.provider} · priority {engine.priority ?? 100} · model {engine.defaultModel || '—'}
            </div>
          </div>
        </div>

        <span style={{ flex: 1 }} />

        {/* status / readiness */}
        <div style={{ minWidth: 200 }}>
          {isLocal ? (
            <div>
              <SonChip color="var(--son-ok)">Local · no limits</SonChip>
              <div className="son-faint" style={{ fontSize: 10, marginTop: 4 }}>{status?.workflowConfigured ? 'workflow set ✓' : 'set COMFYUI_WORKFLOW_PATH'}</div>
            </div>
          ) : !engine.enabled && engine.credentialRef ? (
            <div className="son-faint" style={{ fontSize: 11 }}>Add <code>{engine.credentialRef}</code> to .env</div>
          ) : (
            <div className="son-faint" style={{ fontSize: 11 }}>Cloud render API · pay per clip</div>
          )}
        </div>

        {/* control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <label className="inline-flex items-center gap-1.5 text-sm" style={{ fontWeight: 600 }}>
              <input type="checkbox" checked={!!engine.enabled} onChange={(e) => onToggle(e.target.checked)} /> Enabled
            </label>
            <div className="inline-flex items-center gap-1.5" style={{ fontSize: 11, color: statusColor, fontWeight: 600, marginTop: 3 }}>
              <span className="son-dot" style={{ background: statusColor }} /> {statusLabel}
            </div>
          </div>
          <SonBtn onClick={onEdit}><Pencil size={13} /> Edit</SonBtn>
        </div>
      </div>

      {/* facts line */}
      <div className="son-faint" style={{ fontSize: 11, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--son-border)', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <span>{isLocal ? 'Server' : 'Credential'}: <code style={{ color: status?.hasCredential ? 'var(--son-ok)' : 'var(--son-faint)' }}>{isLocal ? (engine.baseUrl || 'COMFYUI_BASE_URL') : (engine.credentialRef || '—')}</code> {status?.hasCredential ? '✓' : '✗'}</span>
        {isLocal && <span>workflow: <code style={{ color: status?.workflowConfigured ? 'var(--son-ok)' : 'var(--son-faint)' }}>COMFYUI_WORKFLOW_PATH</code> {status?.workflowConfigured ? '✓' : '✗'}</span>}
      </div>
    </SonCard>
  );
}

/* ── Empty / first-run ─────────────────────────────────────────────────────── */
function EmptyState({ onSeed, busy }: { onSeed: () => void; busy: boolean }) {
  return (
    <SonCard style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ width: 54, height: 54, borderRadius: 15, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb,var(--son-accent) 14%,transparent)', border: '1px solid var(--son-accent)' }}>
        <Sparkles className="text-[var(--son-accent)]" />
      </div>
      <h3 style={{ fontWeight: 700, fontSize: 16 }}>No video engines configured yet</h3>
      <p className="son-faint text-sm" style={{ maxWidth: 460, margin: '6px auto 16px' }}>Seed the default providers to get started — Local ComfyUI is enabled (point it at your workflow), and Runway Gen-4.5 is ready the moment you add its key.</p>
      <SonBtn primary onClick={onSeed} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Seed defaults</SonBtn>
    </SonCard>
  );
}

/* ── Routing & failover tab ────────────────────────────────────────────────── */
function RoutingTab({ engines, routing, health, onSave }: { engines: any[]; routing: any[]; health: any; onSave: (cap: string, data: any) => Promise<void> }) {
  const [capKey, setCapKey] = useState('VIDEO_DEFAULT');
  const [order, setOrder] = useState<string[]>([]);
  const [incl, setIncl] = useState<Record<string, boolean>>({});
  const [def, setDef] = useState<string>('');
  const [projOverride, setProjOverride] = useState(false);
  const [userOverride, setUserOverride] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const row = routing.find((r) => r.capability === capKey) || {};
    const byPriority = [...engines].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100)).map((e) => e.id);
    const chain: string[] = Array.isArray(row.fallbackChain) && row.fallbackChain.length ? row.fallbackChain.filter((id: string) => engines.some((e) => e.id === id)) : byPriority;
    const rest = byPriority.filter((id) => !chain.includes(id));
    setOrder([...chain, ...rest]);
    const inc: Record<string, boolean> = {};
    byPriority.forEach((id) => { inc[id] = chain.length ? chain.includes(id) : true; });
    setIncl(inc);
    setDef(row.defaultEngineId || chain[0] || '');
    setProjOverride(!!row.projectOverrideAllowed);
    setUserOverride(!!row.userMayOverride);
  }, [capKey, routing, engines]);

  const move = (i: number, dir: -1 | 1) => {
    setOrder((o) => { const n = [...o]; const j = i + dir; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
  };
  const engineById = (id: string) => engines.find((e) => e.id === id);

  const save = async () => {
    setSaving(true);
    try {
      const includedInOrder = order.filter((id) => incl[id]);
      await onSave(capKey, { defaultEngineId: def || null, allowedEngineIds: includedInOrder, fallbackChain: includedInOrder, projectOverrideAllowed: projOverride, userMayOverride: userOverride });
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        {CAPS.map((c) => (
          <button key={c.key} className={`son-btn ${capKey === c.key ? 'is-primary' : ''}`} onClick={() => setCapKey(c.key)} style={{ fontSize: 12 }}>{c.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>
        {/* failover order */}
        <SonCard style={{ padding: '14px 16px' }}>
          <div className="son-h3" style={{ marginBottom: 4 }}>Failover order — {CAPS.find((c) => c.key === capKey)?.label}</div>
          <p className="son-faint" style={{ fontSize: 11, marginBottom: 12 }}>Top = tried first. Unchecked or unusable engines are skipped at render time.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {order.map((id, i) => {
              const e = engineById(id); if (!e) return null;
              const tier = TIER[e.tier] || TIER.PAID;
              return (
                <div key={id} className="flex items-center" style={{ gap: 10, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--son-border)', background: incl[id] ? 'var(--son-surface)' : 'var(--son-surface-2)', opacity: incl[id] ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <button className="son-iconbtn" style={{ width: 22, height: 18, borderRadius: 5 }} onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp size={13} /></button>
                    <button className="son-iconbtn" style={{ width: 22, height: 18, borderRadius: 5, marginTop: 2 }} onClick={() => move(i, 1)} disabled={i === order.length - 1}><ChevronDown size={13} /></button>
                  </div>
                  <span style={{ width: 22, height: 22, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: 'var(--son-surface-2)', color: 'var(--son-muted)' }}>{i + 1}</span>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{e.displayName}</span>
                  <SonChip color={tier.color}>{tier.label}</SonChip>
                  <span style={{ flex: 1 }} />
                  <label className="inline-flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={!!incl[id]} onChange={(ev) => setIncl((s) => ({ ...s, [id]: ev.target.checked }))} /> include
                  </label>
                </div>
              );
            })}
          </div>
        </SonCard>

        {/* policy */}
        <SonCard style={{ padding: '14px 16px' }}>
          <div className="son-h3" style={{ marginBottom: 10 }}>Policy</div>
          <div className="son-faint" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Default engine</div>
          <select className="son-input" style={{ width: '100%' }} value={def} onChange={(e) => setDef(e.target.value)}>
            <option value="">— first usable in order —</option>
            {order.filter((id) => incl[id]).map((id) => { const e = engineById(id); return e ? <option key={id} value={id}>{e.displayName}</option> : null; })}
          </select>
          <label className="flex items-center justify-between text-sm" style={{ marginTop: 14 }}>
            <span>Allow project override<br /><span className="son-faint" style={{ fontSize: 10 }}>Projects can set their own chain</span></span>
            <input type="checkbox" checked={projOverride} onChange={(e) => setProjOverride(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between text-sm" style={{ marginTop: 12 }}>
            <span>Allow per-render override<br /><span className="son-faint" style={{ fontSize: 10 }}>Users pick an engine per render</span></span>
            <input type="checkbox" checked={userOverride} onChange={(e) => setUserOverride(e.target.checked)} />
          </label>
          <div style={{ marginTop: 14 }}><SonBtn primary onClick={save} disabled={saving} className="w-full" style={{ justifyContent: 'center', width: '100%' }}>{saving ? <Loader2 size={14} className="animate-spin" /> : null} Save routing</SonBtn></div>

          {health?.providers?.length > 0 && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: '1px solid var(--son-border)', background: 'var(--son-bg)' }}>
              <div className="inline-flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}><span className="son-dot" style={{ background: 'var(--son-ok)' }} /> Resolved now</div>
              <div style={{ fontWeight: 700, color: 'var(--son-accent)' }}>{(health.providers.find((p: any) => p.usable) || {}).key ? cap((health.providers.find((p: any) => p.usable)).provider) : 'No usable engine'}</div>
              <div className="son-faint" style={{ fontSize: 10.5, marginTop: 2 }}>First usable engine in the chain serves the render.</div>
            </div>
          )}
        </SonCard>
      </div>
    </div>
  );
}

/* ── Add / edit engine drawer ──────────────────────────────────────────────── */
function EngineDrawer({ engine, onClose, onCreate, onUpdate, onRemove }: { engine: any; onClose: () => void; onCreate: (d: any) => void; onUpdate: (id: string, d: any) => void; onRemove: (id: string) => void }) {
  const editing = !!engine;
  const [provider, setProvider] = useState(engine?.provider || 'local_comfy');
  const [key, setKey] = useState(engine?.key || '');
  const [displayName, setDisplayName] = useState(engine?.displayName || '');
  const [tier, setTier] = useState(engine?.tier || 'PAID');
  const [model, setModel] = useState(engine?.defaultModel || '');
  const [credentialRef, setCredentialRef] = useState(engine?.credentialRef || '');
  const [baseUrl, setBaseUrl] = useState(engine?.baseUrl || '');
  const [priority, setPriority] = useState(String(engine?.priority ?? 100));
  const [notes, setNotes] = useState(engine?.notes || '');
  const [saving, setSaving] = useState(false);
  const isLocal = provider === 'local_comfy';

  const submit = async () => {
    setSaving(true);
    try {
      const data: any = {
        provider, displayName: displayName || cap(provider), tier: isLocal ? 'ULTIMATE_FREE' : tier,
        defaultModel: model || null, credentialRef: credentialRef || null, baseUrl: baseUrl || null,
        priority: Number(priority) || 100, notes: notes || null,
      };
      if (editing) await onUpdate(engine.id, data);
      else await onCreate({ ...data, key: (key || displayName || provider).toUpperCase().replace(/\s+/g, '_') });
    } finally { setSaving(false); }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <SonRoot>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 60, backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, maxWidth: '92vw', background: 'color-mix(in srgb, var(--son-surface) 80%, transparent)', backdropFilter: 'blur(22px) saturate(1.4)', WebkitBackdropFilter: 'blur(22px) saturate(1.4)', borderLeft: '1px solid var(--son-border)', boxShadow: '-24px 0 70px -28px rgba(0,0,0,.55)', zIndex: 61, padding: 22, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 17 }}>{editing ? 'Edit engine' : 'Add engine'}</h2>
            <p className="son-faint" style={{ fontSize: 11 }}>Register a render provider in the switchboard</p>
          </div>
          <button className="son-iconbtn" onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ borderTop: '1px solid var(--son-border)' }} />

        <Field label="Provider" hint="Selects the adapter used to render. local_comfy + runway have built-in adapters.">
          <select className="son-input" style={{ width: '100%' }} value={provider} onChange={(e) => setProvider(e.target.value)} disabled={editing}>
            {PROVIDERS.map((p) => <option key={p} value={p}>{cap(p)}</option>)}
          </select>
        </Field>
        {!editing && (
          <Field label="Key" hint="Unique id for this engine (e.g. RUNWAY).">
            <input className="son-input" style={{ width: '100%' }} value={key} onChange={(e) => setKey(e.target.value)} placeholder={provider.toUpperCase()} />
          </Field>
        )}
        <Field label="Display name"><input className="son-input" style={{ width: '100%' }} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Runway Gen-4.5" /></Field>
        {!isLocal && (
          <Field label="Tier">
            <select className="son-input" style={{ width: '100%' }} value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="PAID">Paid (cloud)</option>
              <option value="LIMITED_FREE">Limited free</option>
            </select>
          </Field>
        )}
        <Field label="Default model" hint="e.g. gen4.5 (Runway), or your ComfyUI workflow id.">
          <input className="son-input" style={{ width: '100%' }} value={model} onChange={(e) => setModel(e.target.value)} placeholder={isLocal ? 'comfy-workflow' : 'gen4.5'} />
        </Field>
        {isLocal ? (
          <Field label="Server base URL" hint="ComfyUI server (default http://127.0.0.1:8188). The 9:16 workflow comes from COMFYUI_WORKFLOW_PATH.">
            <input className="son-input" style={{ width: '100%' }} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://127.0.0.1:8188" />
          </Field>
        ) : (
          <Field label="Credential reference" hint="Env-var name only — the key itself never leaves .env.">
            <input className="son-input" style={{ width: '100%' }} value={credentialRef} onChange={(e) => setCredentialRef(e.target.value)} placeholder="RUNWAYML_API_SECRET" />
          </Field>
        )}
        <Field label="Priority" hint="Lower = earlier in the failover chain"><input className="son-input" style={{ width: '100%' }} value={priority} onChange={(e) => setPriority(e.target.value)} /></Field>
        <Field label="Notes"><textarea className="son-input" style={{ width: '100%', minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></Field>

        <span style={{ flex: 1 }} />
        <div className="flex items-center justify-between" style={{ gap: 10 }}>
          {editing ? <SonBtn onClick={() => onRemove(engine.id)} style={{ color: 'var(--son-danger)' }}><Trash2 size={13} /> Delete</SonBtn> : <span />}
          <div className="flex items-center gap-2">
            <SonBtn onClick={onClose}>Cancel</SonBtn>
            <SonBtn primary onClick={submit} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null} {editing ? 'Save changes' : 'Save engine'}</SonBtn>
          </div>
        </div>
      </div>
    </SonRoot>,
    document.body,
  );
}
