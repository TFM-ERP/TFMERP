'use client';

/**
 * SYS-13c · ScriptON Audio — Voices / Render / Library / Layers, wired to the backend.
 * Free Browser tier plays a table read live via window.speechSynthesis; Studio tier queues a
 * metered render. Adaptive (container queries), light/dark, persistent transport.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Play, Pause, Search, Download, Archive, Sparkles, ChevronLeft, Loader2, Trash2, Upload, Share2, Link2, Copy, Mail } from 'lucide-react';
import { scriptAudioApi, assetUrl } from '@/lib/api';
import { SonRoot, SonShell, SonTabs, SonCard, SonChip, SonBtn, SonThemeToggle } from './Son';

const TABS = [{ key: 'voices', label: 'Voices' }, { key: 'pronounce', label: 'Pronounce' }, { key: 'render', label: 'Render' }, { key: 'library', label: 'Library' }, { key: 'layers', label: 'Sound Layers' }];
const TITLES: Record<string, string> = { voices: 'Voice Casting', pronounce: 'Pronunciation', render: 'Studio Render', library: 'Audio Library', layers: 'Sound Layers' };
const COLORS = ['#0ea5e9', '#f97316', '#a855f7', '#22c55e', '#ef4444', '#eab308', '#14b8a6', '#ec4899'];

export default function ScriptOnAudioPanel({ revision, projectId, onClose }: { revision: any; projectId?: string; onClose: () => void }) {
  const [tab, setTab] = useState('voices');
  const [playing, setPlaying] = useState(false);
  const [nowPlaying, setNowPlaying] = useState('Nothing playing');
  const planRef = useRef<any>(null); const idxRef = useRef(0);

  // ── Browser-tier live playback (speechSynthesis) ──────────────────────────────
  const stop = useCallback(() => { try { window.speechSynthesis?.cancel(); } catch {} setPlaying(false); }, []);
  const playPlan = useCallback((plan: any) => {
    if (!plan?.segments?.length || !window.speechSynthesis) return;
    planRef.current = plan; idxRef.current = 0; setPlaying(true);
    const voices = window.speechSynthesis.getVoices();
    const speakNext = () => {
      const segs = planRef.current?.segments || [];
      if (idxRef.current >= segs.length) { setPlaying(false); setNowPlaying('Finished'); return; }
      const s = segs[idxRef.current++];
      setNowPlaying(`${s.character || 'Narrator'} — ${s.text.slice(0, 60)}`);
      const u = new SpeechSynthesisUtterance(s.text);
      u.rate = Number(s.voice?.rate || 1); u.pitch = Number(s.voice?.pitch || 1);
      if (voices.length) u.voice = voices[(s.character || 'N').charCodeAt(0) % voices.length];
      u.onend = speakNext; window.speechSynthesis.speak(u);
    };
    speakNext();
  }, []);
  useEffect(() => () => stop(), [stop]);

  const togglePlay = async () => {
    if (playing) { stop(); return; }
    if (planRef.current) { playPlan(planRef.current); return; }
    try { const r = await scriptAudioApi.renderPlan(revision.id); playPlan(r.data); } catch { setNowPlaying('Could not load playback.'); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center" style={{ background: 'rgba(2,6,23,.55)' }} onClick={() => { stop(); onClose(); }}>
      <SonRoot className="w-full">
        <div style={{ height: '100%' }} onClick={(e) => e.stopPropagation()}>
          <SonShell className="h-full">
            <div className="son-topbar">
              <button className="son-iconbtn" onClick={() => { stop(); onClose(); }}><ChevronLeft size={16} /></button>
              <div className="son-grow">
                <div className="son-crumb">{revision?.revisionLabel} · ScriptON Audio</div>
                <div className="son-title">{TITLES[tab]}</div>
              </div>
              <SonThemeToggle />
              <button className="son-iconbtn" onClick={() => { stop(); onClose(); }}><X size={16} /></button>
            </div>

            <SonTabs tabs={TABS} active={tab} onChange={setTab} />

            <div className="son-content" style={{ position: 'relative' }}>
              {tab === 'voices' && <Voices revision={revision} projectId={projectId} />}
              {tab === 'pronounce' && <Pronounce revision={revision} projectId={projectId} />}
              {tab === 'render' && <Render revision={revision} projectId={projectId} onPlayPlan={playPlan} />}
              {tab === 'library' && <Library projectId={projectId} />}
              {tab === 'layers' && <Layers revision={revision} />}
            </div>

            <div className="son-transport">
              <button className="son-tbtn is-play" onClick={togglePlay}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
              <div className="son-tinfo"><div className="t1">{nowPlaying}</div><div className="t2">{playing ? 'Playing (browser voices)' : 'Paused'}</div></div>
              <span className="son-pill son-hide-compact">Browser · $0</span>
            </div>
            <nav className="son-bottomnav">{TABS.map(t => <button key={t.key} className={`son-bn ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>{t.label.split(' ')[0]}</button>)}</nav>
          </SonShell>
        </div>
      </SonRoot>
    </div>
  );
}

/* ---------------- Voices ---------------- */
function Voices({ revision, projectId }: any) {
  const [data, setData] = useState<any>(null); const [busy, setBusy] = useState(false);
  const [engines, setEngines] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null); // characterName being edited
  const [castMsg, setCastMsg] = useState('');
  const load = useCallback(() => { scriptAudioApi.detect(revision.id).then(r => setData(r.data)).catch(() => setData({ characters: [] })); }, [revision.id]);
  useEffect(() => { load(); scriptAudioApi.engines().then(r => setEngines((r.data || []).filter((e: any) => e.enabled))).catch(() => {}); }, [load]);
  const autoCast = async () => {
    setBusy(true); setCastMsg('');
    try {
      const r = await scriptAudioApi.autoCast(revision.id, projectId);
      const d = r.data || {};
      setCastMsg(d.created === 0 ? 'Everyone is already cast.'
        : `Cast ${d.created} character${d.created === 1 ? '' : 's'}${d.ai ? ' — AI suggested gender/age/accent per role' : ''}${d.engineKey && d.engineKey !== 'BROWSER' ? ` and matched ${d.engineKey} voices` : ' (browser voices)'}.`);
      load();
    } catch (e: any) { setCastMsg(e?.response?.data?.message || 'Auto-cast failed.'); }
    finally { setBusy(false); }
  };
  const audition = (c: any) => {
    if (c?.voice?.sampleUrl) { new Audio(c.voice.sampleUrl).play().catch(() => {}); return; } // engine preview (e.g. ElevenLabs)
    try { window.speechSynthesis?.cancel(); const u = new SpeechSynthesisUtterance(`This is the voice for ${c.characterName}.`); window.speechSynthesis?.speak(u); } catch {}
  };

  if (!data) return <Loading />;
  return (
    <div className="son-pane son-voices">
      <div className="son-vgrid">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SonChip>{data.characters.length} speaking roles</SonChip>
          <span style={{ flex: 1 }} />
          <SonBtn primary onClick={autoCast} disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Auto-cast</SonBtn>
        </div>
        {castMsg && <p style={{ fontSize: 11, color: 'var(--son-info)' }}>{castMsg}</p>}
        {data.characters.length === 0 && <p className="son-faint" style={{ fontSize: 13 }}>No speaking characters detected on this revision.</p>}
        {data.characters.map((c: any, i: number) => (
          <div key={c.characterName}>
            <SonCard className="son-row" style={{ alignItems: 'center' }}>
              <div className="son-avatar" style={{ background: COLORS[i % COLORS.length] }}>{c.characterName[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>{c.characterName}
                  <SonChip color={c.cast ? 'var(--son-ok)' : 'var(--son-warn)'}>{c.cast ? 'Cast' : 'Uncast'}</SonChip></div>
                <div className="son-faint" style={{ fontSize: 11, marginTop: 2 }}>{c.lines} line{c.lines === 1 ? '' : 's'}{c.voice ? ` · ${c.voice.name} · ${c.voice.engineKey}${c.voice.accent ? ' · ' + c.voice.accent : ''}` : ' · no voice yet'}</div>
              </div>
              <SonBtn onClick={() => audition(c)}><Play size={13} /> Audition</SonBtn>
              <SonBtn primary={!c.cast} onClick={() => setEditing(editing === c.characterName ? null : c.characterName)}>{c.cast ? 'Edit voice' : 'Cast'}</SonBtn>
            </SonCard>
            {editing === c.characterName && <VoiceEditor revision={revision} projectId={projectId} character={c} engines={engines} onSaved={() => { setEditing(null); load(); }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

const GENDERS = ['male', 'female', 'neutral'];
const AGE_RANGES = ['child', 'teen', '20s', '30s', '40s', '50s', '60s+', 'elderly'];
const STYLES = ['calm', 'warm', 'intense', 'authoritative', 'playful', 'sarcastic', 'soft', 'energetic'];

function VoiceEditor({ revision, projectId, character, engines, onSaved }: any) {
  const v = character.voice || {};
  const [f, setF] = useState<any>({
    engineKey: v.engineKey || (engines[0]?.key || 'BROWSER'), externalVoiceId: v.externalVoiceId || '',
    gender: v.gender || '', ageRange: v.ageRange || '', nationality: v.nationality || '', nativeLanguage: v.nativeLanguage || '',
    accent: v.accent || '', style: v.style || '', defaultRate: v.defaultRate ?? 1,
  });
  const [voices, setVoices] = useState<any[]>([]);           // engine voice library
  const [voicesMsg, setVoicesMsg] = useState('');            // load state / error
  const [manualId, setManualId] = useState(false);           // fall back to free-text id
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const set = (k: string, val: any) => setF((p: any) => ({ ...p, [k]: val }));

  // Load the voice library whenever the engine changes
  useEffect(() => {
    setVoices([]); setVoicesMsg('');
    if (f.engineKey === 'BROWSER') {
      const grab = () => setVoices((window.speechSynthesis?.getVoices() || []).map((bv) => ({ id: bv.name, name: bv.name, language: bv.lang })));
      grab(); if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = grab;
      return;
    }
    setVoicesMsg('Loading voices…');
    scriptAudioApi.engineVoices(f.engineKey)
      .then((r) => { setVoices(r.data || []); setVoicesMsg((r.data || []).length ? '' : 'No voices in this engine’s library.'); })
      .catch((e) => setVoicesMsg(e?.response?.data?.message || 'Could not load voices — enter the id manually.'));
  }, [f.engineKey]);

  // Selecting a library voice fills the id and back-fills empty trait fields from its labels
  const pickVoice = (id: string) => {
    if (id === '__manual__') { setManualId(true); return; }
    const vo = voices.find((x) => x.id === id);
    setF((p: any) => ({ ...p, externalVoiceId: id,
      gender: p.gender || vo?.gender || '', ageRange: p.ageRange || vo?.age || '', accent: p.accent || vo?.accent || '' }));
  };
  const selected = voices.find((x) => x.id === f.externalVoiceId);
  const preview = () => {
    if (!selected?.previewUrl) return;
    previewRef.current?.pause();
    previewRef.current = new Audio(selected.previewUrl); previewRef.current.play().catch(() => {});
  };

  const save = async () => {
    let profileId = character.voice?.id;
    const payload = { ...f, scope: 'PROJECT', projectId, name: `${character.characterName} — ${selected?.name || f.engineKey}` };
    if (profileId) await scriptAudioApi.updateProfile(profileId, payload);
    else { const r = await scriptAudioApi.createProfile(payload); profileId = r.data.id; }
    await scriptAudioApi.assign(revision.id, character.characterName, { voiceProfileId: profileId });
    onSaved();
  };

  const F = ({ label, k, ph }: any) => (<label className="son-faint" style={{ fontSize: 11 }}>{label}<input className="son-input" style={{ width: '100%', marginTop: 2 }} value={f[k]} placeholder={ph} onChange={(e) => set(k, e.target.value)} /></label>);
  // Dropdown that still shows a saved value not in the canned list
  const Sel = ({ label, k, options }: any) => (
    <label className="son-faint" style={{ fontSize: 11 }}>{label}
      <select className="son-input" style={{ width: '100%', marginTop: 2 }} value={f[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">—</option>
        {f[k] && !options.includes(f[k]) && <option value={f[k]}>{f[k]}</option>}
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
  const voiceLabel = (vo: any) => [vo.name, [vo.gender, vo.age, vo.accent].filter(Boolean).join(', ')].filter(Boolean).join(' — ');

  return (
    <SonCard style={{ padding: 12, marginTop: -4, marginBottom: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <label className="son-faint" style={{ fontSize: 11 }}>Engine<select className="son-input" style={{ width: '100%', marginTop: 2 }} value={f.engineKey} onChange={(e) => { setManualId(false); set('engineKey', e.target.value); }}>{engines.map((e: any) => <option key={e.key} value={e.key}>{e.displayName}</option>)}{!engines.length && <option value="BROWSER">Browser (free)</option>}</select></label>
        {voices.length && !manualId ? (
          <label className="son-faint" style={{ fontSize: 11 }}>Voice
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              <select className="son-input" style={{ flex: 1, minWidth: 0 }} value={f.externalVoiceId} onChange={(e) => pickVoice(e.target.value)}>
                <option value="">— pick a voice —</option>
                {f.externalVoiceId && !selected && <option value={f.externalVoiceId}>{f.externalVoiceId} (current)</option>}
                {voices.map((vo: any) => <option key={vo.id} value={vo.id}>{voiceLabel(vo)}</option>)}
                <option value="__manual__">Custom voice id…</option>
              </select>
              {selected?.previewUrl && <button className="son-iconbtn" title="Preview voice" onClick={preview}><Play size={13} /></button>}
            </div>
          </label>
        ) : (
          <F label="Voice ID / name" k="externalVoiceId" ph="ElevenLabs voice id" />
        )}
        <Sel label="Gender" k="gender" options={GENDERS} />
        <Sel label="Age range" k="ageRange" options={AGE_RANGES} />
        <F label="Nationality" k="nationality" ph="French" />
        <F label="Native language" k="nativeLanguage" ph="French" />
        <F label="Accent" k="accent" ph="French-English" />
        <Sel label="Style" k="style" options={STYLES} />
        <label className="son-faint" style={{ fontSize: 11 }}>Speed<input className="son-input" type="number" step="0.05" style={{ width: '100%', marginTop: 2 }} value={f.defaultRate} onChange={(e) => set('defaultRate', Number(e.target.value))} /></label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        {manualId && <SonBtn onClick={() => setManualId(false)}>Back to voice list</SonBtn>}
        <SonBtn primary onClick={save}>Save voice</SonBtn>
      </div>
      {voicesMsg && <p className="son-faint" style={{ fontSize: 11, marginTop: 8 }}>{voicesMsg}</p>}
      <p className="son-faint" style={{ fontSize: 11, marginTop: 8 }}>Voices load straight from the engine&apos;s library (e.g. your ElevenLabs account). Accent/native-language drive how non-native lines are spoken.</p>
    </SonCard>
  );
}

/* ---------------- Pronounce ---------------- */
function Pronounce({ revision, projectId }: any) {
  const [list, setList] = useState<any[] | null>(null);
  const [add, setAdd] = useState<any>({ term: '', alias: '', category: 'NAME' });
  const load = useCallback(() => { scriptAudioApi.pronunciation({ projectId, revisionId: revision.id }).then(r => setList(r.data || [])).catch(() => setList([])); }, [projectId, revision.id]);
  useEffect(() => { load(); }, [load]);
  const create = async () => { if (!add.term.trim() || !add.alias.trim()) return; await scriptAudioApi.addPronunciation({ ...add, scope: 'PROJECT', projectId }); setAdd({ term: '', alias: '', category: 'NAME' }); load(); };
  const remove = async (id: string) => { await scriptAudioApi.removePronunciation(id); load(); };
  const CATS = ['NAME', 'LOCATION', 'BRAND', 'COMPANY', 'FANTASY', 'FOREIGN', 'HISTORICAL', 'OTHER'];
  if (!list) return <Loading />;
  return (
    <div className="son-pane">
      <div className="son-sec">
        <p className="son-faint" style={{ fontSize: 12, marginTop: -2, marginBottom: 12 }}>Tell the voices how to say tricky words — names, places, brands, foreign terms. Applied automatically to every render. Most-specific scope wins (script → project → global).</p>
        <SonCard className="son-row" style={{ alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <input className="son-input" style={{ width: 150 }} placeholder="Term (e.g. Qais)" value={add.term} onChange={(e) => setAdd({ ...add, term: e.target.value })} />
          <span className="son-faint">→</span>
          <input className="son-input" style={{ flex: 1, minWidth: 140 }} placeholder="Say it like (e.g. Kais)" value={add.alias} onChange={(e) => setAdd({ ...add, alias: e.target.value })} />
          <select className="son-input" style={{ width: 130 }} value={add.category} onChange={(e) => setAdd({ ...add, category: e.target.value })}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
          <SonBtn primary onClick={create}>+ Add</SonBtn>
        </SonCard>
        {list.length === 0 && <p className="son-faint" style={{ fontSize: 13 }}>No pronunciation entries yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map((p: any) => (
            <SonCard key={p.id} className="son-row" style={{ alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{p.term}</span>
              <span className="son-faint">→ {p.alias || p.ipa || p.ssmlPhoneme}</span>
              <SonChip>{p.category}</SonChip>
              <SonChip>{p.scope}</SonChip>
              <span style={{ flex: 1 }} />
              <button className="son-iconbtn" onClick={() => remove(p.id)}><Trash2 size={14} /></button>
            </SonCard>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Render ---------------- */
function Render({ revision, projectId, onPlayPlan }: any) {
  const scenes = revision?.scenes || [];
  const [scope, setScope] = useState('TABLE_READ');
  const [format, setFormat] = useState('MP3');
  const [selScenes, setSelScenes] = useState<string[]>([]);
  const [pages, setPages] = useState('');
  const [est, setEst] = useState<any>(null); const [routing, setRouting] = useState<any>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');

  const parsePages = (s: string) => { const out: number[] = []; for (const part of String(s).split(',')) { const m = part.trim().match(/^(\d+)\s*-\s*(\d+)$/); if (m) { for (let n = +m[1]; n <= +m[2]; n++) out.push(n); } else if (/^\d+$/.test(part.trim())) out.push(+part.trim()); } return out; };
  const selection = scope === 'SELECTED_SCENES' ? { scenes: selScenes } : scope === 'PAGES' ? { pages: parsePages(pages) } : undefined;
  const toggleScene = (n: string) => setSelScenes((p) => p.includes(n) ? p.filter((x) => x !== n) : [...p, n]);

  const refresh = useCallback(() => {
    scriptAudioApi.estimate(revision.id, { scope, format, selection }).then(r => setEst(r.data)).catch(() => setEst(null));
    scriptAudioApi.routingResolved(projectId).then(r => setRouting(r.data)).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision.id, scope, format, projectId, JSON.stringify(selScenes), pages]);
  useEffect(() => { refresh(); }, [refresh]);

  const queue = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await scriptAudioApi.render(revision.id, { scope, format, selection });
      if (r.data?.tier === 'BROWSER' && r.data?.plan) { onPlayPlan(r.data.plan); setMsg('Browser table read started — playing live ($0).'); }
      else {
        const jobId = r.data?.job?.id; setMsg('Studio render queued…');
        if (jobId) {
          const poll = setInterval(async () => {
            try {
              const j = await scriptAudioApi.job(jobId); const st = j.data?.status;
              if (st === 'DONE') { clearInterval(poll); setMsg('Render complete — open the Library tab.'); }
              else if (st === 'FAILED') { clearInterval(poll); setMsg(`Render failed: ${j.data?.error || ''}`); }
              else setMsg(`Studio render: ${String(st || 'queued').toLowerCase()}…`);
            } catch { clearInterval(poll); }
          }, 2000);
        }
      }
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Render failed.'); }
    finally { setBusy(false); }
  };
  const Tog = ({ on, onClick, children }: any) => <button className={`son-togbtn ${on ? 'is-on' : ''}`} onClick={onClick}>{children}</button>;

  return (
    <div className="son-pane son-render">
      <div>
        <div className="son-sec" style={{ padding: '0 0 14px' }}><h3 className="son-h3">Scope</h3><div className="son-chips">
          {[['ENTIRE', 'Entire script'], ['TABLE_READ', 'Table read'], ['SELECTED_SCENES', 'Selected scenes'], ['PAGES', 'Pages'], ['DIALOGUE_ONLY', 'Dialogue only'], ['NARRATOR_ONLY', 'Narrator only']].map(([v, l]) => <Tog key={v} on={scope === v} onClick={() => setScope(v)}>{l}</Tog>)}
        </div></div>
        {scope === 'SELECTED_SCENES' && (
          <div className="son-sec" style={{ padding: '0 0 14px' }}><h3 className="son-h3">Scenes ({selScenes.length} selected)</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 170, overflow: 'auto' }}>
              {scenes.length === 0 && <span className="son-faint" style={{ fontSize: 12 }}>No parsed scenes on this revision — upload a PDF so scenes are detected.</span>}
              {scenes.map((s: any) => <button key={s.id} title={s.slugline} className={`son-togbtn ${selScenes.includes(String(s.sceneNumber)) ? 'is-on' : ''}`} onClick={() => toggleScene(String(s.sceneNumber))}>{s.sceneNumber || '•'}</button>)}
            </div>
          </div>
        )}
        {scope === 'PAGES' && (
          <div className="son-sec" style={{ padding: '0 0 14px' }}><h3 className="son-h3">Pages</h3>
            <input className="son-input" style={{ width: 220 }} placeholder="e.g. 1,3,5-8" value={pages} onChange={(e) => setPages(e.target.value)} />
            <p className="son-faint" style={{ fontSize: 11, marginTop: 4 }}>{revision?.pageCount || 0} pages total.</p>
          </div>
        )}
        <div className="son-sec" style={{ padding: 0 }}><h3 className="son-h3">Format</h3><div className="son-chips">
          {['MP3', 'WAV', 'AAC', 'M4A'].map(f => <Tog key={f} on={format === f} onClick={() => setFormat(f)}>{f}</Tog>)}
        </div></div>
      </div>
      <SonCard className="son-cost">
        <h3 className="son-h3" style={{ marginBottom: 4 }}>Cost preview</h3>
        {!est ? <Loading /> : <>
          <div style={{ fontSize: 26, fontWeight: 750, margin: '6px 0' }}>{est.engine?.key === 'BROWSER' ? 'Free' : `≈ ${est.currency} ${est.estimate}`}</div>
          {est.cacheSavings > 0 && <div style={{ fontSize: 11, color: 'var(--son-ok)', marginBottom: 8 }}>▼ {est.currency} {est.cacheSavings} saved — {est.cachedChars} cached chars reused</div>}
          <div className="son-route"><span>Engine</span><span>{est.engine?.displayName || '—'} {est.locked ? '🔒' : ''}</span></div>
          <div className="son-route"><span>Segments</span><span>{est.segments}</span></div>
          <div className="son-route"><span>Billable chars</span><span>{est.billableChars.toLocaleString()}</span></div>
          <div className="son-route"><span>Est. length</span><span>~{Math.round((est.durationSec || 0) / 60)} min</span></div>
          {est.quota?.costLimit != null && <>
            <div className="son-faint" style={{ fontSize: 11, marginTop: 12 }}>Project quota</div>
            <div className="son-quota"><i style={{ width: `${Math.min(100, (Number(est.quota.usedCost) / Number(est.quota.costLimit)) * 100)}%` }} /></div>
            <div className="son-faint" style={{ fontSize: 11 }}>{est.currency} {Number(est.quota.usedCost).toFixed(2)} of {est.quota.costLimit} used{est.overQuota ? ' · over budget' : ''}</div>
          </>}
          <SonBtn primary onClick={queue} disabled={busy || (est.overQuota && est.quota?.hardStop)} style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : est.engine?.key === 'BROWSER' ? <Play size={13} /> : <Download size={13} />} {est.engine?.key === 'BROWSER' ? 'Play table read' : 'Queue render'}
          </SonBtn>
          {est.locked && <p className="son-faint" style={{ fontSize: 11, marginTop: 8 }}>🔒 Engine set by admin routing policy.</p>}
          {msg && <p style={{ fontSize: 11, color: 'var(--son-info)', marginTop: 8 }}>{msg}</p>}
        </>}
      </SonCard>
    </div>
  );
}

/* ---------------- Library ---------------- */
function Library({ projectId }: any) {
  const [assets, setAssets] = useState<any[] | null>(null);
  const [shareFor, setShareFor] = useState<any>(null);
  const load = useCallback(() => { if (!projectId) { setAssets([]); return; } scriptAudioApi.library(projectId).then(r => setAssets(r.data || [])).catch(() => setAssets([])); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const archive = async (id: string) => { await scriptAudioApi.archiveAsset(id); load(); };
  if (!assets) return <Loading />;
  return (
    <div className="son-pane">
      <div className="son-libbar"><div className="son-search"><Search size={15} className="son-faint" /><input placeholder="Search audio…" /></div></div>
      {assets.length === 0 ? <p className="son-faint" style={{ padding: 16, fontSize: 13 }}>No rendered audio yet. Queue a render to populate the library.</p> : (
        <div className="son-libgrid">
          {assets.map(a => (
            <SonCard key={a.id} className="son-asset">
              <div style={{ fontWeight: 650, fontSize: 13 }}>{a.title}</div>
              <div className="son-faint" style={{ fontSize: 11 }}>{a.scriptVersionLabel || ''} · {a.format} · {a.durationSec ? `${Math.round(a.durationSec / 60)}m` : ''} · {a.engineKey}</div>
              <audio controls src={assetUrl(a.url)} style={{ width: '100%', height: 32 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <a className="son-iconbtn" href={assetUrl(a.url)} download><Download size={15} /></a>
                <button className="son-iconbtn" title="Share a secure listen link" onClick={() => setShareFor(a)}><Share2 size={15} /></button>
                <button className="son-iconbtn" title="Archive" onClick={() => archive(a.id)}><Archive size={15} /></button>
              </div>
            </SonCard>
          ))}
        </div>
      )}
      {shareFor && <ShareModal asset={shareFor} onClose={() => setShareFor(null)} />}
    </div>
  );
}

/* ---------------- Share & deliver ---------------- */
function ShareModal({ asset, onClose }: any) {
  const [links, setLinks] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ passcode: '', expiresAt: '', allowDownload: false, maxViews: '' });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const load = useCallback(() => { scriptAudioApi.shareLinks(asset.id).then(r => setLinks(r.data || [])).catch(() => setLinks([])); }, [asset.id]);
  useEffect(() => { load(); }, [load]);
  const create = async () => {
    setBusy(true); setMsg('');
    try {
      await scriptAudioApi.createShare({ assetId: asset.id, title: asset.title,
        passcode: form.passcode || undefined, expiresAt: form.expiresAt || undefined,
        allowDownload: form.allowDownload, maxViews: form.maxViews || undefined });
      setForm({ passcode: '', expiresAt: '', allowDownload: false, maxViews: '' }); load();
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Could not create link.'); }
    finally { setBusy(false); }
  };
  const revoke = async (id: string) => { await scriptAudioApi.revokeShare(id); load(); };
  const copy = (token: string) => { navigator.clipboard?.writeText(`${origin}/listen/${token}`); setMsg('Link copied.'); };
  const email = async (id: string) => {
    const to = window.prompt('Send the listen link to (comma-separated emails):'); if (!to) return;
    try { await scriptAudioApi.emailShare(id, { recipients: to.split(',').map(s => s.trim()).filter(Boolean) }); setMsg('Email sent.'); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Email failed.'); }
  };
  return (
    <div className="son-modal-scrim" onClick={onClose}>
      <SonCard className="son-modal" style={{ maxWidth: 520, width: '100%' }} onClick={(e: any) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Share2 size={16} /><h3 className="son-h3" style={{ margin: 0, flex: 1 }}>Share “{asset.title}”</h3>
          <button className="son-iconbtn" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="son-faint" style={{ fontSize: 12, marginBottom: 12 }}>Creates a secure, in-browser listen link. No TFM login needed. Optional passcode, expiry, and view cap.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <label className="son-faint" style={{ fontSize: 11 }}>Passcode (optional)<input className="son-input" value={form.passcode} onChange={(e) => setForm({ ...form, passcode: e.target.value })} placeholder="e.g. 4821" /></label>
          <label className="son-faint" style={{ fontSize: 11 }}>Expires<input className="son-input" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label>
          <label className="son-faint" style={{ fontSize: 11 }}>Max views (optional)<input className="son-input" type="number" min="1" value={form.maxViews} onChange={(e) => setForm({ ...form, maxViews: e.target.value })} /></label>
          <label className="son-faint" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, paddingTop: 18 }}><input type="checkbox" checked={form.allowDownload} onChange={(e) => setForm({ ...form, allowDownload: e.target.checked })} /> Allow download</label>
        </div>
        <SonBtn primary onClick={create} disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} Create link</SonBtn>
        {msg && <p style={{ fontSize: 11, color: 'var(--son-info)', marginTop: 8 }}>{msg}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {links.length === 0 && <p className="son-faint" style={{ fontSize: 12 }}>No links yet.</p>}
          {links.map(l => (
            <SonCard key={l.id} className="son-row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8, opacity: l.revoked ? 0.5 : 1 }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 12, fontWeight: 600, wordBreak: 'break-all' }}>{origin}/listen/{l.token}</div>
                <div className="son-faint" style={{ fontSize: 11 }}>
                  {l.revoked ? 'revoked' : 'active'} · {l.views} view{l.views === 1 ? '' : 's'}{l.maxViews ? ` / ${l.maxViews}` : ''}
                  {l.passcode ? ' · 🔒 passcode' : ''}{l.allowDownload ? ' · ⬇ download' : ''}{l.expiresAt ? ` · expires ${new Date(l.expiresAt).toLocaleDateString()}` : ''}
                </div>
              </div>
              {!l.revoked && <>
                <button className="son-iconbtn" title="Copy link" onClick={() => copy(l.token)}><Copy size={14} /></button>
                <button className="son-iconbtn" title="Email link" onClick={() => email(l.id)}><Mail size={14} /></button>
                <button className="son-iconbtn" title="Revoke" onClick={() => revoke(l.id)}><Trash2 size={14} /></button>
              </>}
            </SonCard>
          ))}
        </div>
      </SonCard>
    </div>
  );
}

/* ---------------- Layers ---------------- */
function Layers({ revision }: any) {
  const scenes = revision?.scenes || [];
  const [cues, setCues] = useState<any[] | null>(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const [adding, setAdding] = useState<any>({ layerType: 'SFX', sceneNumber: '', genPrompt: '' });
  const load = useCallback(() => { scriptAudioApi.cues(revision.id).then(r => setCues(r.data || [])).catch(() => setCues([])); }, [revision.id]);
  useEffect(() => { load(); }, [load]);
  const suggest = async () => {
    setBusy(true); setMsg('');
    try { const r = await scriptAudioApi.suggestCues(revision.id); const n = r.data?.created ?? 0; setMsg(n > 0 ? `Suggested ${n} cue(s).` : (scenes.length ? 'No new cues matched the scene text.' : 'No parsed scenes on this revision — upload a PDF so scenes are detected, then auto-suggest.')); load(); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Auto-suggest failed.'); }
    finally { setBusy(false); }
  };
  const addCue = async () => {
    if (!adding.genPrompt.trim()) { setMsg('Enter what the sound is (e.g. "rain ambience").'); return; }
    await scriptAudioApi.upsertCue({ revisionId: revision.id, layerType: adding.layerType, sceneNumber: adding.sceneNumber || null, genPrompt: adding.genPrompt.trim(), status: 'APPROVED' });
    setAdding({ layerType: 'SFX', sceneNumber: '', genPrompt: '' }); setMsg(''); load();
  };
  const approveAll = async () => { await scriptAudioApi.approveAllCues(revision.id); load(); };
  const setStatus = async (id: string, status: string) => { await scriptAudioApi.cueStatus(id, status); load(); };
  const saveCue = async (c: any, patch: any) => { await scriptAudioApi.upsertCue({ id: c.id, ...patch }); load(); };
  const remove = async (id: string) => { await scriptAudioApi.removeCue(id); load(); };
  const uploadToCue = async (cueId: string, file: File | null) => {
    if (!file) return; setMsg('Uploading sound…');
    try { await scriptAudioApi.uploadCueAudio(cueId, file); setMsg('Sound attached to cue.'); load(); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Upload failed.'); }
  };
  const TONE: Record<string, string> = { AMBIENCE: '#10b981', ROOMTONE: '#64748b', SFX: '#f59e0b', FOLEY: '#7c3aed', MUSIC: '#db2777' };
  const LTYPES = ['AMBIENCE', 'ROOMTONE', 'SFX', 'FOLEY', 'MUSIC'];

  if (!cues) return <Loading />;
  return (
    <div className="son-pane">
      <div className="son-sec">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <h3 className="son-h3" style={{ margin: 0 }}>Layer cues</h3><SonChip>{cues.length}</SonChip>
          <span style={{ flex: 1 }} />
          <SonBtn onClick={approveAll}>✓ Approve all</SonBtn>
          <SonBtn primary onClick={suggest} disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Auto-suggest</SonBtn>
        </div>

        {/* Manual add a cue (works even if auto-suggest finds nothing) */}
        <SonCard className="son-row" style={{ alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <select className="son-input" style={{ width: 120 }} value={adding.layerType} onChange={(e) => setAdding({ ...adding, layerType: e.target.value })}>{LTYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
          <select className="son-input" style={{ width: 130 }} value={adding.sceneNumber} onChange={(e) => setAdding({ ...adding, sceneNumber: e.target.value })}>
            <option value="">(whole script)</option>
            {scenes.map((s: any) => <option key={s.id} value={String(s.sceneNumber)}>Sc {s.sceneNumber || '•'}</option>)}
          </select>
          <input className="son-input" style={{ flex: 1, minWidth: 160 }} placeholder='Sound, e.g. "rain ambience with thunder"' value={adding.genPrompt} onChange={(e) => setAdding({ ...adding, genPrompt: e.target.value })} />
          <SonBtn primary onClick={addCue}>+ Add cue</SonBtn>
        </SonCard>
        {msg && <p style={{ fontSize: 11, color: 'var(--son-info)', marginBottom: 8 }}>{msg}</p>}

        {cues.length === 0 && <p className="son-faint" style={{ fontSize: 13 }}>No cues yet. Use Auto-suggest (scans each scene for ambience/SFX/music) or add one above.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cues.map(c => (
            <SonCard key={c.id} className="son-row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="son-dot" style={{ background: TONE[c.layerType] || '#94a3b8', width: 12, height: 12 }} />
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.layerType} {c.sceneNumber ? <span className="son-faint">· Sc {c.sceneNumber}</span> : ''}</div>
                <div className="son-faint" style={{ fontSize: 11 }}>{c.uploadUrl ? '📎 uploaded sound' : c.genPrompt || 'cue'}{c.source === 'AUTO' ? ' · suggested' : ''}</div>
                {c.uploadUrl && <audio controls src={assetUrl(c.uploadUrl)} style={{ width: '100%', height: 28, marginTop: 4 }} />}
              </div>
              <label className="son-faint" style={{ fontSize: 10 }}>Start s<input className="son-input" type="number" step="0.5" style={{ width: 64, marginTop: 2 }} defaultValue={(c.startMs || 0) / 1000} onBlur={(e) => saveCue(c, { startMs: Math.round(Number(e.target.value) * 1000) })} /></label>
              <label className="son-faint" style={{ fontSize: 10 }}>Vol dB<input className="son-input" type="number" step="1" style={{ width: 60, marginTop: 2 }} defaultValue={c.volumeDb ?? 0} onBlur={(e) => saveCue(c, { volumeDb: Number(e.target.value) })} /></label>
              <label className="son-faint" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Lower this layer under dialogue"><input type="checkbox" checked={!!c.duckDialogue} onChange={(e) => saveCue(c, { duckDialogue: e.target.checked })} /> duck</label>
              <SonChip color={c.status === 'APPROVED' ? 'var(--son-ok)' : c.status === 'SUGGESTED' ? 'var(--son-warn)' : '#94a3b8'}>{c.status}</SonChip>
              {c.status !== 'APPROVED' && <button className="son-iconbtn" title="Approve" onClick={() => setStatus(c.id, 'APPROVED')}>✓</button>}
              <label className="son-iconbtn" title="Upload your own sound for this cue" style={{ cursor: 'pointer' }}>
                <Upload size={14} /><input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" hidden onChange={(e) => uploadToCue(c.id, e.target.files?.[0] || null)} />
              </label>
              <button className="son-iconbtn" title="Remove" onClick={() => remove(c.id)}><Trash2 size={14} /></button>
            </SonCard>
          ))}
        </div>
        <p className="son-faint" style={{ fontSize: 11, marginTop: 10 }}>Approved cues are mixed under the dialogue (with ducking + loudness normalization) when a Studio render runs and ffmpeg is available. Ambient/SFX/music audio is generated by the engine (e.g. ElevenLabs) at render time.</p>
      </div>
    </div>
  );
}

function Loading() { return <div style={{ padding: 24, textAlign: 'center' }}><Loader2 className="animate-spin son-faint" /></div>; }
