'use client';

/**
 * SYS-13c · ScriptON Audio — Voices / Render / Library / Layers, wired to the backend.
 * Free Browser tier plays a table read live via window.speechSynthesis; Studio tier queues a
 * metered render. Adaptive (container queries), light/dark, persistent transport.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Play, Pause, Search, Download, Archive, Sparkles, ChevronLeft, Loader2, Trash2, Upload, Share2, Link2, Copy, Mail } from 'lucide-react';
import { scriptAudioApi, assetUrl } from '@/lib/api';
import { SonRoot, SonShell, SonTabs, SonCard, SonChip, SonBtn, SonThemeToggle } from './Son';

const TABS = [
  { key: 'reader', label: 'Reader' }, { key: 'voices', label: 'Voices' }, { key: 'pronounce', label: 'Pronounce' },
  { key: 'render', label: 'Performance' }, { key: 'layers', label: 'Layers' }, { key: 'library', label: 'Library' },
];
const TITLES: Record<string, string> = { reader: 'Studio Reader', voices: 'Voice Casting', pronounce: 'Pronunciation', render: 'Performance & Render', library: 'Audio Library', layers: 'Sound Layers' };
const COLORS = ['#0ea5e9', '#f97316', '#a855f7', '#22c55e', '#ef4444', '#eab308', '#14b8a6', '#ec4899'];

export default function ScriptOnAudioPanel({ revision, projectId, onClose }: { revision: any; projectId?: string; onClose: () => void }) {
  const [tab, setTab] = useState('reader');
  const [castEdit, setCastEdit] = useState<string | null>(null); // "Edit voice" jump from the Reader inspector
  const [playing, setPlaying] = useState(false);
  const [nowPlaying, setNowPlaying] = useState('Nothing playing');
  const planRef = useRef<any>(null); const idxRef = useRef(0);

  // ── Live playback: Browser ($0, speechSynthesis) or Studio (per-line ElevenLabs/OpenAI) ──
  const [liveStudio, setLiveStudio] = useState(false);   // transport voice source
  const [liveCost, setLiveCost] = useState(0);           // session spend (cache hits are free)
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const synthCacheRef = useRef<Map<string, Promise<any>>>(new Map());

  const stop = useCallback(() => {
    try { window.speechSynthesis?.cancel(); } catch {}
    try { audioElRef.current?.pause(); } catch {}
    setPlaying(false);
  }, []);

  const synthSeg = useCallback((s: any) => {
    const key = s.id || `${s.character || ''}|${s.text}`;
    let p = synthCacheRef.current.get(key);
    if (!p) {
      p = scriptAudioApi.speak(revision.id, { text: s.text, character: s.character, kind: s.kind }).then((r) => r.data);
      synthCacheRef.current.set(key, p);
    }
    return p;
  }, [revision.id]);

  const playPlan = useCallback((plan: any) => {
    if (!plan?.segments?.length) return;
    planRef.current = plan; idxRef.current = 0; setPlaying(true);
    let useLive = liveStudio; // drops to browser voices mid-run if the engine fails
    const voices = window.speechSynthesis?.getVoices() || [];
    const speakBrowser = (s: any, next: () => void) => {
      if (!window.speechSynthesis) { next(); return; }
      const u = new SpeechSynthesisUtterance(s.text);
      u.rate = Number(s.voice?.rate || 1); u.pitch = Number(s.voice?.pitch || 1);
      if (voices.length) u.voice = voices[(s.character || 'N').charCodeAt(0) % voices.length];
      u.onend = next; u.onerror = next; window.speechSynthesis.speak(u);
    };
    const speakNext = () => {
      const segs = planRef.current?.segments || [];
      if (idxRef.current >= segs.length) { setPlaying(false); setNowPlaying('Finished'); return; }
      const s = segs[idxRef.current++];
      setNowPlaying(`${s.character || 'Narrator'} — ${s.text.slice(0, 60)}`);
      if (!useLive) { speakBrowser(s, speakNext); return; }
      synthSeg(s).then((r: any) => {
        const nxt = segs[idxRef.current]; if (nxt) synthSeg(nxt); // prefetch while this line plays
        if (!r.cached) setLiveCost((c) => c + Number(r.cost || 0));
        const a = new Audio(assetUrl(r.url));
        a.playbackRate = Number(s.voice?.rate || 1); audioElRef.current = a;
        a.onended = speakNext; a.onerror = speakNext;
        a.play().catch(speakNext);
      }).catch(() => { useLive = false; setNowPlaying('Studio voices unavailable — continuing with browser voices.'); speakBrowser(s, speakNext); });
    };
    speakNext();
  }, [liveStudio, synthSeg]);
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
              {tab === 'reader' && <StudioReader revision={revision} projectId={projectId} onEditVoice={(name: string) => { setCastEdit(name); setTab('voices'); }} />}
              {tab === 'voices' && <Voices revision={revision} projectId={projectId} initialEditing={castEdit} onEditingConsumed={() => setCastEdit(null)} onCastingChanged={() => { planRef.current = null; }} />}
              {tab === 'pronounce' && <Pronounce revision={revision} projectId={projectId} />}
              {tab === 'render' && <Render revision={revision} projectId={projectId} onPlayPlan={playPlan} />}
              {tab === 'library' && <Library projectId={projectId} revision={revision} />}
              {tab === 'layers' && <Layers revision={revision} />}
            </div>

            <div className="son-transport">
              <button className="son-tbtn is-play" onClick={togglePlay}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
              <div className="son-tinfo"><div className="t1">{nowPlaying}</div><div className="t2">{playing ? (liveStudio ? 'Playing live (studio voices)' : 'Playing (browser voices)') : 'Paused'}</div></div>
              <button className="son-pill son-hide-compact" style={liveStudio ? { borderColor: 'var(--son-info)', color: 'var(--son-info)' } : undefined}
                title="Toggle the live voice source: free browser voices, or the cast ElevenLabs/OpenAI voices spoken live (per-line, cached)"
                onClick={() => { stop(); setLiveStudio((v) => !v); }}>
                {liveStudio ? `✨ Studio live${liveCost > 0 ? ` · ≈$${liveCost.toFixed(2)}` : ''}` : 'Browser · $0'}
              </button>
            </div>
            <nav className="son-bottomnav">{TABS.map(t => <button key={t.key} className={`son-bn ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>{t.label.split(' ')[0]}</button>)}</nav>
          </SonShell>
        </div>
      </SonRoot>
    </div>
  );
}

/* ---------------- Studio Reader (3-pane: scenes · karaoke reader · now-casting) ---------------- */
const RDR_SLUG = /^\s*(\d+[A-Z]?\.?\s+)?(INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)[\.\s]/i;
const RDR_CUE = /^\s*([A-Z][A-Z0-9 .'\-]{1,30})(\s*\((?:V\.?O\.?|O\.?S\.?|CONT'?D)\.?\))?\s*$/;
type RdrSeg = { kind: 'action' | 'cue' | 'paren' | 'dialogue'; character?: string; text: string; hint?: string };
type RdrScene = { n: string; slug: string; segs: RdrSeg[]; chars: string[]; durationSec: number };

/** Bucket the revision's page text into scenes of typed segments (parentheticals → delivery hints). */
function parseStudioScenes(revision: any): RdrScene[] {
  const scenes: RdrScene[] = [];
  let cur: RdrScene | null = null; let speaker: string | null = null; let pendingHint: string | null = null; let seq = 0;
  for (const pg of (revision?.pageText || [])) {
    for (const raw of String(pg.text || '').split('\n')) {
      const line = raw.trim();
      if (!line) { speaker = null; pendingHint = null; continue; }
      if (RDR_SLUG.test(line)) {
        seq += 1;
        cur = { n: String(seq), slug: line.toUpperCase().slice(0, 60), segs: [], chars: [], durationSec: 0 };
        scenes.push(cur); speaker = null; pendingHint = null; continue;
      }
      if (!cur) continue;
      const cue = line.match(RDR_CUE);
      if (cue && line.split(' ').length <= 4 && !RDR_SLUG.test(line)) {
        speaker = cue[1].trim().replace(/\s+/g, ' ');
        if (!cur.chars.includes(speaker)) cur.chars.push(speaker);
        cur.segs.push({ kind: 'cue', character: speaker, text: speaker }); pendingHint = null; continue;
      }
      if (speaker) {
        const par = line.match(/^\((.{1,60})\)$/);
        if (par) { pendingHint = par[1].trim(); cur.segs.push({ kind: 'paren', character: speaker, text: line }); continue; }
        cur.segs.push({ kind: 'dialogue', character: speaker, text: line, hint: pendingHint || undefined }); pendingHint = null;
      } else {
        cur.segs.push({ kind: 'action', text: line });
      }
    }
    speaker = null; pendingHint = null;
  }
  for (const s of scenes) s.durationSec = Math.max(5, Math.round(s.segs.reduce((t, x) => t + (x.kind === 'cue' ? 0 : x.text.length), 0) / 14));
  return scenes;
}
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function StudioReader({ revision, projectId, onEditVoice }: any) {
  const scenes = useMemo(() => parseStudioScenes(revision), [revision]);
  const [sel, setSel] = useState(0);
  const [cast, setCast] = useState<any>(null);            // detect() — characters + profiles
  const [cursor, setCursor] = useState(-1);               // playing segment index
  const [playing, setPlaying] = useState(false);
  const [cost, setCost] = useState(0); const [cached, setCached] = useState(0);
  const [msg, setMsg] = useState('');
  const playRef = useRef(false); const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthRef = useRef<Map<string, Promise<any>>>(new Map());
  const bodyRef = useRef<HTMLDivElement>(null);
  const scene = scenes[sel];

  useEffect(() => { scriptAudioApi.detect(revision.id).then(r => setCast(r.data)).catch(() => setCast({ characters: [] })); }, [revision.id]);
  useEffect(() => () => { playRef.current = false; try { audioRef.current?.pause(); } catch {} }, []);

  const charInfo = (name?: string) => cast?.characters?.find((c: any) => c.characterName === name);

  const synth = (seg: RdrSeg) => {
    const key = `${sel}|${seg.character || ''}|${seg.text}|${seg.hint || ''}`;
    let p = synthRef.current.get(key);
    if (!p) {
      p = scriptAudioApi.speak(revision.id, {
        text: seg.text, character: seg.kind === 'dialogue' ? seg.character : undefined,
        kind: seg.kind === 'dialogue' ? 'dialogue' : 'narration', emotion: seg.hint,
      }).then(r => r.data);
      synthRef.current.set(key, p);
    }
    return p;
  };
  const speakable = (x: RdrSeg) => x.kind === 'action' || x.kind === 'dialogue';

  const stop = () => { playRef.current = false; try { audioRef.current?.pause(); } catch {} setPlaying(false); };
  const play = (startAt = 0) => {
    if (!scene) return;
    playRef.current = true; setPlaying(true); setMsg('');
    let i = startAt;
    const step = () => {
      if (!playRef.current) return;
      if (i >= scene.segs.length) { setPlaying(false); setCursor(-1); return; }
      const seg = scene.segs[i];
      setCursor(i);
      bodyRef.current?.querySelector(`[data-seg="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (!speakable(seg)) { i++; step(); return; }
      synth(seg).then((r: any) => {
        if (!playRef.current) return;
        for (let j = i + 1, found = 0; j < scene.segs.length && found < 2; j++) if (speakable(scene.segs[j])) { synth(scene.segs[j]); found++; }
        if (r.cached) setCached(c => c + 1); else setCost(c => c + Number(r.cost || 0));
        const a = new Audio(assetUrl(r.url)); audioRef.current = a;
        a.onended = () => { i++; if (playRef.current) step(); };
        a.onerror = () => { i++; if (playRef.current) step(); };
        a.play().catch(() => { i++; step(); });
      }).catch((e: any) => { setMsg(e?.response?.data?.message || 'Studio voices unavailable.'); stop(); });
    };
    step();
  };

  const curChar = scene?.segs[cursor]?.character || scene?.chars[0];
  const info = charInfo(curChar);
  const er = { pace: 5, confidence: 5, tension: 5, ...(info?.voice?.emotionalRange || {}) };
  const saveSlider = async (k: string, val: number) => {
    if (!info?.voice?.id) return;
    await scriptAudioApi.updateProfile(info.voice.id, { emotionalRange: { ...er, [k]: val } }).catch(() => {});
    scriptAudioApi.detect(revision.id).then(r => setCast(r.data)).catch(() => {});
  };

  if (!scenes.length) return <div className="son-pane"><p className="son-faint" style={{ padding: 16, fontSize: 13 }}>No parsed scenes — upload a script with extractable text.</p></div>;
  return (
    <div className="son-pane" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,240px) minmax(0,1fr) minmax(200px,260px)', gap: 0, minHeight: 0 }}>
      {/* Scenes rail */}
      <div style={{ borderRight: '1px solid var(--son-border)', overflow: 'auto' }}>
        <div className="son-faint" style={{ fontSize: 10, letterSpacing: '.06em', padding: '12px 12px 6px' }}>SCENES · {scenes.length}</div>
        {scenes.map((s, i) => (
          <button key={i} onClick={() => { stop(); setSel(i); setCursor(-1); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: i === sel ? 'var(--son-surface-2)' : 'transparent', border: 'none', borderLeft: i === sel ? '2px solid var(--son-accent)' : '2px solid transparent', cursor: 'pointer', color: 'var(--son-text)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.n} · {s.slug.replace(/^\d+[A-Z]?\.?\s+/, '')}</span>
              <span className="son-faint" style={{ fontWeight: 400 }}>{fmtDur(s.durationSec)}</span>
            </div>
            <div className="son-faint" style={{ fontSize: 10, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.chars.join(', ') || '—'}</div>
          </button>
        ))}
      </div>

      {/* Karaoke reader */}
      <div ref={bodyRef} style={{ overflow: 'auto', padding: '16px 22px', background: 'var(--son-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <SonBtn primary onClick={() => playing ? stop() : play(cursor >= 0 ? cursor : 0)}>{playing ? <Pause size={13} /> : <Play size={13} />} {playing ? 'Pause' : 'Read scene'}</SonBtn>
          <SonChip>{scene.slug}</SonChip><SonChip>{fmtDur(scene.durationSec)}</SonChip>
          {(cost > 0 || cached > 0) && <span className="son-faint" style={{ fontSize: 11 }}>≈ ${cost.toFixed(2)}{cached ? ` · ${cached} cached` : ''}</span>}
          {msg && <span style={{ fontSize: 11, color: 'var(--son-danger)' }}>{msg}</span>}
        </div>
        <div style={{ maxWidth: 620, margin: '0 auto', fontSize: 'var(--son-fs-body)', lineHeight: 1.65 }}>
          {scene.segs.map((seg, i) => {
            const on = cursor === i;
            const base: React.CSSProperties = { padding: '1px 6px', borderRadius: 6, background: on ? 'var(--son-hi)' : 'transparent' };
            if (seg.kind === 'cue') return <div key={i} data-seg={i} style={{ ...base, textAlign: 'center', fontWeight: 700, marginTop: 14 }}>{seg.text}</div>;
            if (seg.kind === 'paren') return <div key={i} data-seg={i} style={{ ...base, textAlign: 'center', fontStyle: 'italic', color: 'var(--son-muted)' }}>{seg.text}</div>;
            if (seg.kind === 'dialogue') return <div key={i} data-seg={i} style={{ ...base, textAlign: 'center', maxWidth: '70%', margin: '0 auto' }}>{seg.text}</div>;
            return <div key={i} data-seg={i} style={{ ...base, color: 'var(--son-muted)', marginTop: 10 }}>{seg.text}</div>;
          })}
        </div>
      </div>

      {/* Now casting */}
      <div style={{ borderLeft: '1px solid var(--son-border)', overflow: 'auto', padding: 12 }}>
        <div className="son-faint" style={{ fontSize: 10, letterSpacing: '.06em', marginBottom: 8 }}>NOW CASTING</div>
        {!curChar ? <p className="son-faint" style={{ fontSize: 12 }}>No speaking characters in this scene.</p> : (
          <SonCard style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div className="son-avatar" style={{ background: '#f97316' }}>{curChar[0]}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{curChar}</div>
                <div className="son-faint" style={{ fontSize: 11 }}>{info?.voice ? `ElevenLabs · “${info.voice.name?.split('—')[1]?.trim() || info.voice.name}”` : 'Uncast — default voice'}</div>
              </div>
            </div>
            {([['Nationality', info?.voice?.nationality], ['Native', info?.voice?.nativeLanguage], ['Accent', info?.voice?.accent], ['Style', info?.voice?.style]] as const)
              .filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderTop: '1px dashed var(--son-border)' }}>
                  <span className="son-faint">{k}</span><span>{v}</span>
                </div>
              ))}
            <div style={{ marginTop: 8 }}>
              {([['pace', 'Pace'], ['confidence', 'Confidence'], ['tension', 'Tension']] as const).map(([k, label]) => (
                <label key={k} className="son-faint" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}>{label}<b>{er[k]}</b></span>
                  <input type="range" min={0} max={10} step={1} defaultValue={er[k]} style={{ width: '100%' }}
                    onMouseUp={(e) => saveSlider(k, Number((e.target as HTMLInputElement).value))}
                    onTouchEnd={(e) => saveSlider(k, Number((e.target as HTMLInputElement).value))} />
                </label>
              ))}
            </div>
            <SonBtn style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => onEditVoice(curChar)}>Edit voice</SonBtn>
          </SonCard>
        )}
        <p className="son-faint" style={{ fontSize: 10, marginTop: 10 }}>Sliders are the character&apos;s standing delivery (v3 audio tags). Parentheticals in the script always override per line.</p>
      </div>
    </div>
  );
}

/* ---------------- Voices ---------------- */
function Voices({ revision, projectId, onCastingChanged, initialEditing, onEditingConsumed }: any) {
  const [data, setData] = useState<any>(null); const [busy, setBusy] = useState(false);
  const [engines, setEngines] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null); // characterName being edited
  const [castMsg, setCastMsg] = useState('');
  const load = useCallback(() => { onCastingChanged?.(); scriptAudioApi.detect(revision.id).then(r => setData(r.data)).catch(() => setData({ characters: [] })); }, [revision.id, onCastingChanged]);
  useEffect(() => { load(); scriptAudioApi.engines().then(r => setEngines((r.data || []).filter((e: any) => e.enabled))).catch(() => {}); }, [load]);
  // "Edit voice" jump from the Reader inspector
  useEffect(() => { if (initialEditing) { setEditing(initialEditing); onEditingConsumed?.(); } }, [initialEditing, onEditingConsumed]);
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

// Generic fallbacks, used only when the engine's library carries no labels of its own
const GENDERS = ['male', 'female', 'neutral'];
const AGE_RANGES = ['young', 'middle_aged', 'old'];
const STYLES = ['calm', 'warm', 'intense', 'authoritative', 'playful', 'sarcastic', 'soft', 'energetic'];

// Module-level field components: stable types so inputs keep focus across re-renders
const FieldText = ({ label, value, ph, onChange }: any) => (
  <label className="son-faint" style={{ fontSize: 11 }}>{label}
    <input className="son-input" style={{ width: '100%', marginTop: 2 }} value={value} placeholder={ph} onChange={(e) => onChange(e.target.value)} />
  </label>
);
const FieldSel = ({ label, value, options, onChange }: any) => (
  <label className="son-faint" style={{ fontSize: 11 }}>{label}
    <select className="son-input" style={{ width: '100%', marginTop: 2 }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">any</option>
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
    </select>
  </label>
);

function VoiceEditor({ revision, projectId, character, engines, onSaved }: any) {
  const v = character.voice || {};
  const [f, setF] = useState<any>({
    engineKey: v.engineKey || (engines[0]?.key || 'BROWSER'), externalVoiceId: v.externalVoiceId || '',
    gender: v.gender || '', ageRange: v.ageRange || '', nationality: v.nationality || '', nativeLanguage: v.nativeLanguage || '',
    accent: v.accent || '', style: v.style || '', defaultRate: v.defaultRate ?? 1,
    emotionalRange: { pace: 5, confidence: 5, tension: 5, ...(v.emotionalRange || {}) },
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

  // Dropdown options = the distinct label values the engine's library actually uses
  const uniq = (k: string) => [...new Set(voices.map((x: any) => String(x[k] || '')).filter(Boolean))].sort();
  const or = (a: string[], b: string[]) => (a.length ? a : b);
  const opts = {
    gender: or(uniq('gender'), GENDERS),
    age: or(uniq('age'), AGE_RANGES),
    accent: uniq('accent'),
    language: uniq('language'),
    style: or(uniq('description').filter((s) => s.length <= 24), STYLES),
  };

  // Trait dropdowns filter the voice list (only when the value is one of the library's own labels)
  const match = (val: string, voiceVal: string | undefined, options: string[]) => !val || !options.includes(val) || voiceVal === val;
  const filtered = voices.filter((vo: any) =>
    match(f.gender, vo.gender, opts.gender) && match(f.ageRange, vo.age, opts.age) &&
    match(f.accent, vo.accent, opts.accent) && match(f.nativeLanguage, vo.language, opts.language));

  // Selecting a library voice sets the id and syncs the trait fields to that voice's labels
  const pickVoice = (id: string) => {
    if (id === '__manual__') { setManualId(true); return; }
    const vo = voices.find((x) => x.id === id);
    setF((p: any) => ({ ...p, externalVoiceId: id,
      gender: vo?.gender || p.gender, ageRange: vo?.age || p.ageRange,
      accent: vo?.accent || p.accent, nativeLanguage: vo?.language || p.nativeLanguage }));
  };
  const selected = voices.find((x) => x.id === f.externalVoiceId);
  const preview = () => {
    if (!selected?.previewUrl) return;
    previewRef.current?.pause();
    previewRef.current = new Audio(selected.previewUrl); previewRef.current.play().catch(() => {});
  };

  const save = async () => {
    let profileId = character.voice?.id;
    const payload = { ...f, scope: 'PROJECT', projectId,
      name: `${character.characterName} — ${selected?.name || f.engineKey}`,
      sampleUrl: selected?.previewUrl || null }; // keep Audition in sync with the chosen voice
    if (profileId) await scriptAudioApi.updateProfile(profileId, payload);
    else { const r = await scriptAudioApi.createProfile(payload); profileId = r.data.id; }
    await scriptAudioApi.assign(revision.id, character.characterName, { voiceProfileId: profileId });
    onSaved();
  };

  const voiceLabel = (vo: any) => [vo.name, [vo.gender, vo.age, vo.accent].filter(Boolean).join(', ')].filter(Boolean).join(' — ');
  const hasLib = voices.length > 0;

  return (
    <SonCard style={{ padding: 12, marginTop: -4, marginBottom: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <label className="son-faint" style={{ fontSize: 11 }}>Engine<select className="son-input" style={{ width: '100%', marginTop: 2 }} value={f.engineKey} onChange={(e) => { setManualId(false); set('engineKey', e.target.value); }}>{engines.map((e: any) => <option key={e.key} value={e.key}>{e.displayName}</option>)}{!engines.length && <option value="BROWSER">Browser (free)</option>}</select></label>
        {hasLib && !manualId ? (
          <label className="son-faint" style={{ fontSize: 11 }}>Voice ({filtered.length}{filtered.length !== voices.length ? ` of ${voices.length}` : ''})
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              <select className="son-input" style={{ flex: 1, minWidth: 0 }} value={f.externalVoiceId} onChange={(e) => pickVoice(e.target.value)}>
                <option value="">— pick a voice —</option>
                {f.externalVoiceId && !selected && <option value={f.externalVoiceId}>{f.externalVoiceId} (current)</option>}
                {selected && !filtered.includes(selected) && <option value={selected.id}>{voiceLabel(selected)} (current)</option>}
                {filtered.map((vo: any) => <option key={vo.id} value={vo.id}>{voiceLabel(vo)}</option>)}
                <option value="__manual__">Custom voice id…</option>
              </select>
              {selected?.previewUrl && <button className="son-iconbtn" title="Preview voice" onClick={preview}><Play size={13} /></button>}
            </div>
          </label>
        ) : (
          <FieldText label="Voice ID / name" value={f.externalVoiceId} ph="ElevenLabs voice id" onChange={(val: string) => set('externalVoiceId', val)} />
        )}
        <FieldSel label="Gender" value={f.gender} options={opts.gender} onChange={(val: string) => set('gender', val)} />
        <FieldSel label="Age" value={f.ageRange} options={opts.age} onChange={(val: string) => set('ageRange', val)} />
        {opts.accent.length
          ? <FieldSel label="Accent" value={f.accent} options={opts.accent} onChange={(val: string) => set('accent', val)} />
          : <FieldText label="Accent" value={f.accent} ph="French-English" onChange={(val: string) => set('accent', val)} />}
        {opts.language.length
          ? <FieldSel label="Language" value={f.nativeLanguage} options={opts.language} onChange={(val: string) => set('nativeLanguage', val)} />
          : <FieldText label="Native language" value={f.nativeLanguage} ph="French" onChange={(val: string) => set('nativeLanguage', val)} />}
        {!hasLib && <FieldText label="Nationality" value={f.nationality} ph="French" onChange={(val: string) => set('nationality', val)} />}
        <FieldSel label="Style" value={f.style} options={opts.style} onChange={(val: string) => set('style', val)} />
        <label className="son-faint" style={{ fontSize: 11 }}>Speed<input className="son-input" type="number" step="0.05" style={{ width: '100%', marginTop: 2 }} value={f.defaultRate} onChange={(e) => set('defaultRate', Number(e.target.value))} /></label>
      </div>
      {/* Performance sliders — the character's standing delivery, expressed as v3 audio tags */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 10 }}>
        {([['pace', 'Pace'], ['confidence', 'Confidence'], ['tension', 'Tension']] as const).map(([k, label]) => (
          <label key={k} className="son-faint" style={{ fontSize: 11 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>{label}<b>{f.emotionalRange[k]}</b></span>
            <input type="range" min={0} max={10} step={1} value={f.emotionalRange[k]} style={{ width: '100%', marginTop: 4 }}
              onChange={(e) => set('emotionalRange', { ...f.emotionalRange, [k]: Number(e.target.value) })} />
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        {manualId && <SonBtn onClick={() => setManualId(false)}>Back to voice list</SonBtn>}
        <SonBtn primary onClick={save}>Save voice</SonBtn>
      </div>
      {voicesMsg && <p className="son-faint" style={{ fontSize: 11, marginTop: 8 }}>{voicesMsg}</p>}
      <p className="son-faint" style={{ fontSize: 11, marginTop: 8 }}>Gender/age/accent come from the engine&apos;s own voice labels and filter the voice list — pick traits first, then choose from the matching voices.</p>
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

/* ---------------- Performance & Render ---------------- */
const RENDER_PROFILES: { key: string; name: string; desc: string; scope: string; layers: boolean }[] = [
  { key: 'tableread', name: 'Table read', desc: 'Voices + narrator · no music/SFX', scope: 'TABLE_READ', layers: false },
  { key: 'fullmix', name: 'Full mix', desc: 'Everything — dialogue, ambience, SFX, music', scope: 'ENTIRE', layers: true },
  { key: 'dialogue', name: 'Dialogue only', desc: 'Cast voices, no narration or layers', scope: 'DIALOGUE_ONLY', layers: false },
  { key: 'narration', name: 'Narration only', desc: 'Scene description track', scope: 'NARRATOR_ONLY', layers: false },
];
function Render({ revision, projectId, onPlayPlan }: any) {
  const scenes = revision?.scenes || [];
  const [scope, setScope] = useState('TABLE_READ');
  const [format, setFormat] = useState('MP3');
  const [profile, setProfile] = useState('tableread');
  const [withLayers, setWithLayers] = useState(false);
  const pickProfile = (p: typeof RENDER_PROFILES[number]) => { setProfile(p.key); setScope(p.scope); setWithLayers(p.layers); };
  const [selScenes, setSelScenes] = useState<string[]>([]);
  const [pages, setPages] = useState('');
  const [est, setEst] = useState<any>(null); const [routing, setRouting] = useState<any>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');

  const parsePages = (s: string) => { const out: number[] = []; for (const part of String(s).split(',')) { const m = part.trim().match(/^(\d+)\s*-\s*(\d+)$/); if (m) { for (let n = +m[1]; n <= +m[2]; n++) out.push(n); } else if (/^\d+$/.test(part.trim())) out.push(+part.trim()); } return out; };
  const selection = scope === 'SELECTED_SCENES' ? { scenes: selScenes } : scope === 'PAGES' ? { pages: parsePages(pages) } : undefined;
  const toggleScene = (n: string) => setSelScenes((p) => p.includes(n) ? p.filter((x) => x !== n) : [...p, n]);

  const [jobs, setJobs] = useState<any[]>([]);
  const loadJobs = useCallback(() => { scriptAudioApi.jobsForRevision(revision.id).then(r => setJobs(r.data || [])).catch(() => {}); }, [revision.id]);
  const refresh = useCallback(() => {
    scriptAudioApi.estimate(revision.id, { scope, format, selection, options: { layers: withLayers } }).then(r => setEst(r.data)).catch(() => setEst(null));
    scriptAudioApi.routingResolved(projectId).then(r => setRouting(r.data)).catch(() => {});
    loadJobs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision.id, scope, format, projectId, JSON.stringify(selScenes), pages, withLayers, loadJobs]);
  useEffect(() => { refresh(); }, [refresh]);

  const queue = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await scriptAudioApi.render(revision.id, { scope, format, selection, options: { layers: withLayers } });
      if (r.data?.tier === 'BROWSER' && r.data?.plan) { onPlayPlan(r.data.plan); setMsg('Browser table read started — playing live ($0).'); }
      else {
        const jobId = r.data?.job?.id; setMsg('Studio render queued…');
        if (jobId) {
          const poll = setInterval(async () => {
            try {
              const j = await scriptAudioApi.job(jobId); const st = j.data?.status;
              if (st === 'DONE') { clearInterval(poll); setMsg('Render complete — play it below or in the Library tab.'); loadJobs(); }
              else if (st === 'FAILED') { clearInterval(poll); setMsg(`Render failed: ${j.data?.error || ''}`); loadJobs(); }
              else setMsg(`Studio render: ${String(st || 'queued').toLowerCase()}… ${j.data?.progress ? `${j.data.progress}%` : ''}`);
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
        <div className="son-sec" style={{ padding: '0 0 14px' }}><h3 className="son-h3">Performance profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
            {RENDER_PROFILES.map(p => (
              <button key={p.key} onClick={() => pickProfile(p)}
                style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', font: 'inherit', color: 'var(--son-text)',
                  background: profile === p.key ? 'var(--son-surface)' : 'transparent',
                  border: profile === p.key ? '2px solid var(--son-accent)' : '1px solid var(--son-border)' }}>
                <div style={{ fontSize: 13, fontWeight: 650 }}>{p.name}</div>
                <div className="son-faint" style={{ fontSize: 11 }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="son-sec" style={{ padding: '0 0 14px' }}><h3 className="son-h3">Scope</h3><div className="son-chips">
          {[['ENTIRE', 'Entire script'], ['TABLE_READ', 'Table read'], ['SELECTED_SCENES', 'Selected scenes'], ['PAGES', 'Pages'], ['DIALOGUE_ONLY', 'Dialogue only'], ['NARRATOR_ONLY', 'Narrator only']].map(([v, l]) => <Tog key={v} on={scope === v} onClick={() => { setScope(v); setProfile(''); }}>{l}</Tog>)}
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

          {/* Recent renders — straight from the job records, so results can never go missing */}
          {jobs.length > 0 && <>
            <div className="son-faint" style={{ fontSize: 11, marginTop: 14, marginBottom: 6 }}>Recent renders (this revision)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflow: 'auto' }}>
              {jobs.map((j: any) => (
                <div key={j.id} style={{ border: '1px solid var(--son-border)', borderRadius: 10, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <SonChip color={j.status === 'DONE' ? 'var(--son-ok)' : j.status === 'FAILED' ? 'var(--son-danger)' : 'var(--son-warn)'}>{j.status}{j.status !== 'DONE' && j.status !== 'FAILED' && j.progress ? ` ${j.progress}%` : ''}</SonChip>
                    <span className="son-faint">{j.scope} · {new Date(j.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    {j.asset?.url && <a className="son-iconbtn" style={{ marginLeft: 'auto' }} href={assetUrl(j.asset.url)} download title="Download"><Download size={13} /></a>}
                  </div>
                  {j.asset?.url && <audio controls src={assetUrl(j.asset.url)} style={{ width: '100%', height: 28, marginTop: 4 }} />}
                  {j.status === 'FAILED' && j.error && <div style={{ fontSize: 10, color: 'var(--son-danger)', marginTop: 2 }}>{String(j.error).slice(0, 160)}</div>}
                  {j.status === 'DONE' && !j.asset && <div style={{ fontSize: 10, color: 'var(--son-warn)', marginTop: 2 }}>Done but no asset attached — tell the developer (job {j.id.slice(0, 8)})</div>}
                </div>
              ))}
            </div>
          </>}
        </>}
      </SonCard>
    </div>
  );
}

/* ---------------- Library ---------------- */
function Library({ projectId, revision }: any) {
  const [assets, setAssets] = useState<any[] | null>(null);
  const [shareFor, setShareFor] = useState<any>(null);
  // Match by project OR this revision — renders always show up even if the job
  // couldn't resolve a project at queue time.
  const load = useCallback(() => {
    scriptAudioApi.library(projectId || '', revision?.id).then(r => setAssets(r.data || [])).catch(() => setAssets([]));
  }, [projectId, revision?.id]);
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

        {/* ── Scene timeline (mockup view): lanes with positioned cues; drag to move ── */}
        <LayerTimeline revision={revision} scenes={scenes} cues={cues} onMove={(c: any, startMs: number) => saveCue(c, { startMs })} onSelectStatus={setStatus} />

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

/* ---------------- Layer timeline (mockup lanes view) ---------------- */
const LANES: { key: string; label: string; color: string }[] = [
  { key: 'AMBIENCE', label: 'Ambience', color: '#10b981' },
  { key: 'SFX', label: 'SFX', color: '#f59e0b' },
  { key: 'FOLEY', label: 'Foley', color: '#7c3aed' },
  { key: 'MUSIC', label: 'Music', color: '#db2777' },
];
function LayerTimeline({ revision, scenes, cues, onMove, onSelectStatus }: any) {
  const [selScene, setSelScene] = useState<string>('');
  const drag = useRef<{ cue: any; startX: number; origMs: number; widthPx: number; durMs: number } | null>(null);
  const [liveMs, setLiveMs] = useState<Record<string, number>>({});
  const trackRef = useRef<HTMLDivElement>(null);

  // Rough scene duration: characters on its pages / 14 per second
  const durFor = (sceneNumber: string): number => {
    const sc = scenes.find((s: any) => String(s.sceneNumber) === String(sceneNumber));
    if (!sc) return 120;
    const chars = (revision?.pageText || []).filter((p: any) => p.page >= sc.pageStart && p.page <= sc.pageEnd)
      .reduce((t: number, p: any) => t + String(p.text || '').length, 0);
    return Math.max(20, Math.round(chars / 14 / Math.max(1, sc.pageEnd - sc.pageStart + 1)));
  };
  const durMs = (selScene ? durFor(selScene) : 180) * 1000;
  const laneCues = (lane: string) => cues.filter((c: any) =>
    (c.layerType === lane || (lane === 'AMBIENCE' && c.layerType === 'ROOMTONE')) &&
    String(c.sceneNumber || '') === selScene);

  useEffect(() => {
    const mv = (e: MouseEvent) => {
      const g = drag.current; if (!g) return;
      const ms = Math.max(0, Math.min(g.durMs, g.origMs + ((e.clientX - g.startX) / g.widthPx) * g.durMs));
      setLiveMs((m) => ({ ...m, [g.cue.id]: Math.round(ms) }));
    };
    const up = () => {
      const g = drag.current; if (!g) return;
      drag.current = null;
      setLiveMs((m) => {
        const ms = m[g.cue.id];
        if (ms !== undefined && Math.abs(ms - g.origMs) > 250) onMove(g.cue, ms);
        return m;
      });
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, [onMove]);

  return (
    <SonCard style={{ padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <span className="son-faint" style={{ fontSize: 11 }}>Timeline:</span>
        <button className={`son-togbtn ${selScene === '' ? 'is-on' : ''}`} onClick={() => setSelScene('')}>Whole script</button>
        {scenes.slice(0, 30).map((s: any) => (
          <button key={s.id} title={s.slugline} className={`son-togbtn ${selScene === String(s.sceneNumber) ? 'is-on' : ''}`} onClick={() => setSelScene(String(s.sceneNumber))}>Sc {s.sceneNumber || '•'}</button>
        ))}
        <span style={{ flex: 1 }} />
        <SonChip>{fmtDur(Math.round(durMs / 1000))}</SonChip>
      </div>
      <div ref={trackRef}>
        {LANES.map((lane) => (
          <div key={lane.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 76, fontSize: 11, color: 'var(--son-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: lane.color, display: 'inline-block' }} />{lane.label}
            </div>
            <div style={{ flex: 1, position: 'relative', height: 38, background: 'var(--son-surface-2)', borderRadius: 8, overflow: 'hidden',
              backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), var(--son-border) calc(10% - 1px) 10%)' }}>
              {laneCues(lane.key).map((c: any) => {
                const ms = liveMs[c.id] ?? (c.startMs || 0);
                const left = Math.min(92, (ms / durMs) * 100);
                const sugg = c.status === 'SUGGESTED';
                return (
                  <div key={c.id} title={`${c.genPrompt || c.layerType} — drag to move${sugg ? ' · suggested (click ✓ in the list to approve)' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const w = (e.currentTarget.parentElement as HTMLElement).clientWidth;
                      drag.current = { cue: c, startX: e.clientX, origMs: ms, widthPx: w, durMs };
                    }}
                    style={{ position: 'absolute', top: 4, left: `${left}%`, height: 30, maxWidth: '46%', padding: '0 9px',
                      display: 'flex', alignItems: 'center', borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#fff',
                      whiteSpace: 'nowrap', overflow: 'hidden', cursor: 'grab', userSelect: 'none',
                      background: sugg ? '#b8860b' : lane.color, border: sugg ? '2px dashed #ffd76e' : 'none' }}>
                    {c.uploadUrl ? '📎 ' : ''}{c.genPrompt || c.layerType}{sugg ? ' ✦' : ''}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="son-faint" style={{ fontSize: 10, marginTop: 4 }}>Drag a cue to set when it starts in the scene. ✦ dashed cues are auto-suggested — approve them in the list below. Duck-under-dialogue is per cue (the “duck” checkbox).</p>
    </SonCard>
  );
}

function Loading() { return <div style={{ padding: 24, textAlign: 'center' }}><Loader2 className="animate-spin son-faint" /></div>; }
