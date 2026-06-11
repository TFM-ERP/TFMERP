'use client';

import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import {
  X, Play, Pause, Square, RotateCcw, Eye, EyeOff, Type as TypeIcon,
  Volume2, Mic, Video, ChevronDown, BookOpen,
} from 'lucide-react';
import { scriptAudioApi, assetUrl } from '@/lib/api';

/**
 * SYS-13b · P1 — Reader & Actor pack.
 * Reflows the revision's extracted page text into a clean screenplay reader, then layers on
 * Actor Highlight / Blackout, read-aloud Playback, Rehearse, and self-tape Record — all using
 * browser-native APIs (speechSynthesis, SpeechRecognition, MediaRecorder). No third-party services.
 */

type El = { type: 'scene' | 'action' | 'character' | 'paren' | 'dialogue' | 'transition'; text: string; character?: string; page?: number };

const SCENE_RE = /^(\d+[A-Z]?\s+)?(INT|EXT|INT\.?\/EXT|I\/E)[\.\s]/i;
const TRANS_RE = /(CUT TO:|FADE (IN|OUT)|DISSOLVE TO:|SMASH CUT|MATCH CUT)\s*$/i;
const isUpper = (s: string) => s.length > 0 && s === s.toUpperCase() && /[A-Z]/.test(s);
const cueName = (s: string) => s.replace(/\s*\((CONT'D|CONTD|V\.?O\.?|O\.?S\.?|O\.?C\.?|PRE-?LAP)\)\s*$/i, '').replace(/\s*\(.*\)\s*$/, '').trim();

/** Heuristic screenplay parser from joined page text (keeps each element's source page). */
function parseScript(pageText: { page: number; text: string }[]): El[] {
  const lines: { t: string; page: number }[] = [];
  for (const p of (pageText || [])) for (const ln of String(p.text || '').split('\n')) lines.push({ t: ln.replace(/\s+$/, ''), page: p.page });
  const els: El[] = [];
  let inDialogue = false; let cur = '';
  for (let i = 0; i < lines.length; i++) {
    const { t: raw, page } = lines[i];
    const t = raw.trim();
    if (!t) { inDialogue = false; continue; }
    if (SCENE_RE.test(t)) { els.push({ type: 'scene', text: t.toUpperCase(), page }); inDialogue = false; continue; }
    if (TRANS_RE.test(t) && isUpper(t)) { els.push({ type: 'transition', text: t, page }); inDialogue = false; continue; }
    if (t.startsWith('(') && inDialogue) { els.push({ type: 'paren', text: t, character: cur, page }); continue; }
    // Character cue: short UPPERCASE line, not a scene/transition, with dialogue likely following.
    const next = (lines[i + 1]?.t || '').trim();
    if (isUpper(t) && t.length <= 38 && /^[A-Z0-9 .,'()\-/&]+$/.test(t) && next && !SCENE_RE.test(next)) {
      cur = cueName(t); els.push({ type: 'character', text: t, character: cur, page }); inDialogue = true; continue;
    }
    if (inDialogue) { els.push({ type: 'dialogue', text: t, character: cur, page }); continue; }
    els.push({ type: 'action', text: t, page });
  }
  return els;
}

const speak = typeof window !== 'undefined' ? window.speechSynthesis : null;

// Browser-voice emotion tweaks: emotion → [rate multiplier, pitch]
const EMO_TWEAK: Record<string, [number, number]> = {
  excited: [1.15, 1.2], happy: [1.05, 1.15], angry: [1.1, 0.9], shouting: [1.15, 1.05],
  shocked: [1.1, 1.25], sad: [0.9, 0.9], bored: [0.85, 0.9], tired: [0.85, 0.85],
  whispering: [0.95, 0.8], nervous: [1.1, 1.1], hesitant: [0.88, 1], calm: [0.95, 1],
};

/**
 * All highlight / info-layer / actor styling is CLASS-driven, keyed off classes on the
 * page container — so toggling a toolbar option changes one container attribute and
 * re-renders zero rows. Inline styles on rows never change after mount.
 */
const RDR_CSS = `
.rdr .rdr-sceneno,.rdr .rdr-8ths,.rdr .rdr-dlgno{display:none}
.rdr.rdr-info-sceneno .rdr-sceneno{display:inline}
.rdr.rdr-info-8ths .rdr-8ths{display:inline}
.rdr.rdr-info-dlgno .rdr-dlgno{display:inline}
.rdr.rdr-info-div .rdr-scene:not(:first-child){border-top:1px solid #cbd5e1;padding-top:12px}
.rdr.rdr-hl-scene .rdr-scene{background:#fef9c3;border-radius:4px;padding:1px 4px}
.rdr.rdr-hl-action .rdr-action{background:#dbeafe;border-radius:4px;padding:1px 4px}
.rdr.rdr-hl-character .rdr-character{background:#ede9fe;border-radius:4px;padding:1px 4px}
.rdr.rdr-hl-dialogue .rdr-dialogue{background:#dcfce7;border-radius:4px;padding:1px 4px}
.rdr.rdr-am-name .rdr-mine.rdr-character,.rdr.rdr-am-both .rdr-mine.rdr-character{background:#bbf7d0;border-radius:4px;padding:1px 4px}
.rdr.rdr-am-dialogue .rdr-mine.rdr-dialogue,.rdr.rdr-am-both .rdr-mine.rdr-dialogue{background:#bbf7d0;border-radius:4px;padding:1px 4px}
.rdr .rdr-active{background:#fde68a !important;border-radius:4px;padding:1px 4px}
.rdr{color:#1f1f1f}
.rdr-scene{font-weight:700;text-transform:uppercase;margin-top:18px;color:#1f1f1f}
.rdr-transition{text-align:right;font-weight:600;color:#1f1f1f}
.rdr-character{text-align:center;font-weight:600;margin-top:10px;color:#1f1f1f}
.rdr-paren{text-align:center;font-style:italic;color:#666}
.rdr-dialogue{max-width:62%;margin:0 auto;color:#1f1f1f}
.rdr-action{margin-top:8px;color:#3c3c3c}
.rdr-sceneno{color:#8a8a82;font-weight:700;margin-right:8px}
.rdr-8ths{color:#8a8a82;font-weight:400;margin-left:8px;font-size:.78em}
.rdr-dlgno{color:#8a8a82;margin-left:4px;font-size:.66em}
`;

/** One script line, memoized — its props only change for cursor moves, actor change, or blackout. */
const Row = memo(function Row({ e, idx, mine, active, sceneNo, eighthsLabel, dlgNo, hidden, onReveal }: {
  e: El; idx: number; mine: boolean; active: boolean; sceneNo: number | null;
  eighthsLabel: string | null; dlgNo: number | null; hidden: boolean; onReveal: (idx: number) => void;
}) {
  return (
    <div data-el={idx} className={`rdr-${e.type}${mine ? ' rdr-mine' : ''}${active ? ' rdr-active' : ''}`}>
      {sceneNo != null && <span className="rdr-sceneno">#{sceneNo}</span>}
      {hidden
        ? <button onClick={() => onReveal(idx)} className="inline-block bg-slate-900 text-slate-900 rounded select-none" style={{ minWidth: 120 }}>{e.text}</button>
        : e.text}
      {eighthsLabel && <span className="rdr-8ths">{eighthsLabel} pg</span>}
      {dlgNo != null && <sup className="rdr-dlgno">{dlgNo}</sup>}
    </div>
  );
});

export default function ScriptReader({ revision, onClose, inline }: { revision: any; onClose: () => void; inline?: boolean }) {
  const els = useMemo(() => parseScript(revision?.pageText || []), [revision]);
  const characters = useMemo(() => {
    const seen = new Set<string>();
    for (const e of els) if (e.type === 'character' && e.character) seen.add(e.character);
    return [...seen].sort();
  }, [els]);

  // View controls
  const [sonDark, setSonDark] = useState(false); // SON-DS theme for the reader surface
  const [font, setFont] = useState(16);
  const [serif, setSerif] = useState(true);
  const [hl, setHl] = useState<{ scene: boolean; action: boolean; character: boolean; dialogue: boolean }>({ scene: true, action: false, character: false, dialogue: false });

  // Actor controls
  const [actor, setActor] = useState('');               // highlighted/your character
  const [actorMode, setActorMode] = useState<'name' | 'dialogue' | 'both'>('both');
  const [blackout, setBlackout] = useState(false);       // hide actor's dialogue for off-book
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  // Info layers (auto-generated overlays — no drawing)
  const [info, setInfo] = useState({ sceneNo: true, dividers: true, dialogueNo: false, eighths: false, tint: false });
  const meta = useMemo(() => {
    let sceneNo = 0, dlg = 0;
    const sceneOf: number[] = []; const dlgOf: (number | null)[] = [];
    els.forEach((e, i) => {
      if (e.type === 'scene') sceneNo++;
      sceneOf[i] = sceneNo;
      if (e.type === 'dialogue') { dlg++; dlgOf[i] = dlg; } else dlgOf[i] = null;
    });
    const counts: Record<number, number> = {};
    els.forEach((_, i) => { counts[sceneOf[i]] = (counts[sceneOf[i]] || 0) + 1; });
    return { sceneOf, dlgOf, counts };
  }, [els]);
  const eighths = (lineCount: number) => `~${Math.min(64, Math.max(1, Math.round((lineCount || 0) * 8 / 42)))}/8`;
  const scenesList = useMemo(() => els.reduce<{ n: number; label: string }[]>((acc, e, i2) => {
    if (e.type === 'scene') acc.push({ n: meta.sceneOf[i2], label: e.text.slice(0, 36) });
    return acc;
  }, []), [els, meta]);
  const pageCount = useMemo(() => els.reduce((m, e) => Math.max(m, e.page || 1), 1), [els]);
  const tintFor = (code?: string | null): string => {
    if (!code) return '#ffffff';
    if (/^#[0-9a-f]{6}$/i.test(code)) return code + '14';
    const m: Record<string, string> = { WHITE: '#ffffff', BLUE: '#eff6ff', PINK: '#fdf2f8', YELLOW: '#fefce8', GREEN: '#f0fdf4', GOLDENROD: '#fffbeb', BUFF: '#fefce8', SALMON: '#fff1f2', CHERRY: '#fef2f2' };
    return m[code.toUpperCase()] || '#ffffff';
  };

  // Playback / rehearse
  const [mode, setMode] = useState<'read' | 'rehearse'>('read');
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(-1);              // index in els currently spoken
  const [rate, setRate] = useState(1);
  const [gap, setGap] = useState(2);                     // rehearse pause (seconds) on your line
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceMap, setVoiceMap] = useState<Record<string, string>>({}); // character|'_narrator' → voiceURI
  const [showVoices, setShowVoices] = useState(false);
  const playRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Live studio voices (ElevenLabs/OpenAI via the cast voices from Audio Studio → Voices)
  const [studio, setStudio] = useState(false);
  const [studioMsg, setStudioMsg] = useState('');
  const [sessionCost, setSessionCost] = useState(0);
  const [cachedLines, setCachedLines] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthRef = useRef<Map<number, Promise<any>>>(new Map());

  // What gets read aloud (applies to Browser and Studio modes alike)
  const [readSet, setReadSet] = useState({ scene: true, action: true, character: false, dialogue: true });

  // Play scope: whole script, one scene (optionally carrying into the next), or from a page
  const [scope, setScope] = useState<'script' | 'scene' | 'page'>('script');
  const [sceneSel, setSceneSel] = useState(1);
  const [carryOn, setCarryOn] = useState(false);
  const [fromPage, setFromPage] = useState(1);
  const endRef = useRef<number | null>(null); // last element index to speak (null = to the end)

  /**
   * Delivery hint for a dialogue line: the parenthetical above it — (bored), (excited),
   * (dumb joke)… — else punctuation cues: "?!" shocked, "!" excited, "…" hesitant,
   * ALL-CAPS shouting. The engine turns this into voice settings (or browser rate/pitch).
   */
  const emotionFor = useCallback((idx: number): string | undefined => {
    const e = els[idx];
    if (e.type !== 'dialogue') return undefined;
    for (let j = idx - 1; j >= 0; j--) {
      const p = els[j];
      if (p.type === 'paren' && p.character === e.character) {
        const t = p.text.replace(/[()]/g, '').trim();
        if (t && t.length <= 40) return t;
        break;
      }
      if (p.type === 'dialogue' && p.character === e.character) continue;
      break;
    }
    const t = e.text;
    if (/(\?!|!\?)\s*$/.test(t)) return 'shocked';
    if (/!\s*$/.test(t)) return 'excited';
    if (/(\.\.\.|…)\s*$/.test(t)) return 'hesitant';
    const caps = t.split(/\s+/).filter((w) => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
    if (caps.length >= 2) return 'shouting';
    return undefined;
  }, [els]);

  /** Fetch (and memoize) the synthesized audio for one element — used for play + prefetch. */
  const synthFor = useCallback((idx: number) => {
    const e = els[idx];
    let p = synthRef.current.get(idx);
    if (!p) {
      p = scriptAudioApi.speak(revision.id, {
        text: e.text,
        character: e.type === 'dialogue' ? e.character : undefined,
        kind: e.type === 'dialogue' ? 'dialogue' : 'narration',
        emotion: emotionFor(idx),
      }).then((r) => r.data);
      synthRef.current.set(idx, p);
      p.catch(() => synthRef.current.delete(idx)); // handled: prefetch failures must not crash the app
    }
    return p;
  }, [els, revision?.id, emotionFor]);

  // Record
  const [recOpen, setRecOpen] = useState(false);

  useEffect(() => {
    if (!speak) return;
    const load = () => setVoices(speak.getVoices());
    load(); speak.onvoiceschanged = load;
    return () => { try { speak.cancel(); } catch {} };
  }, []);

  const voiceFor = useCallback((character?: string) => {
    const key = character || '_narrator';
    const uri = voiceMap[key];
    return uri ? voices.find((v) => v.voiceURI === uri) : undefined;
  }, [voiceMap, voices]);

  const scrollTo = (idx: number) => {
    const node = bodyRef.current?.querySelector(`[data-el="${idx}"]`) as HTMLElement | null;
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  // Speak from a starting element index, advancing through els.
  // Browser path: speechSynthesis. Studio path: live per-line ElevenLabs/OpenAI synthesis
  // (cast voices), with the next lines prefetched while the current one plays.
  const run = useCallback((startAt: number) => {
    if (!speak && !studio) return;
    playRef.current = true; setPlaying(true);
    let i = startAt;
    let useStudio = studio; // local: drops to browser voices mid-run if the engine fails

    const advance = (delayMs = 0) => {
      i++;
      if (delayMs) setTimeout(() => { if (playRef.current) step(); }, delayMs);
      else if (playRef.current) step();
    };
    // Honour the "Read:" toggles — same filter for Browser and Studio.
    const canSpeak = (x: El) => !!x.text && (
      (x.type === 'scene' && readSet.scene) || (x.type === 'action' && readSet.action) ||
      (x.type === 'character' && readSet.character) || (x.type === 'dialogue' && readSet.dialogue));

    const speakBrowser = (e: El, emotion?: string) => {
      if (!speak) { advance(); return; }
      const u = new SpeechSynthesisUtterance(e.type === 'character' ? `${e.text}.` : e.text);
      const tw = emotion ? (EMO_TWEAK[emotion] || Object.entries(EMO_TWEAK).find(([k]) => emotion.includes(k))?.[1]) : undefined;
      u.rate = rate * (tw?.[0] ?? 1); u.pitch = tw?.[1] ?? 1;
      const v = voiceFor(e.type === 'dialogue' || e.type === 'character' ? e.character : '_narrator');
      if (v) u.voice = v;
      u.onend = () => advance(); u.onerror = () => advance();
      speak.speak(u);
    };

    const step = () => {
      if (!playRef.current) return;
      if (i >= els.length || (endRef.current != null && i > endRef.current)) { setPlaying(false); setCursor(-1); return; }
      const e = els[i];
      setCursor(i); scrollTo(i);
      const isMine = mode === 'rehearse' && actor && e.character === actor && (e.type === 'dialogue' || e.type === 'character');
      if (isMine) {
        // Your line — stay silent, hold for the gap so you can deliver it, then continue.
        advance(Math.max(0.5, gap) * 1000);
        return;
      }
      if (!canSpeak(e)) { advance(); return; }
      if (!useStudio) { speakBrowser(e, e.type === 'dialogue' ? emotionFor(i) : undefined); return; }

      const cur = i;
      synthFor(cur).then((r: any) => {
        if (!playRef.current) return;
        // prefetch the next two speakable lines while this one plays
        for (let j = cur + 1, found = 0; j < els.length && found < 2; j++) {
          const n = els[j];
          const nMine = mode === 'rehearse' && actor && n.character === actor && (n.type === 'dialogue' || n.type === 'character');
          if (!nMine && canSpeak(n)) { synthFor(j); found++; }
        }
        if (r.cached) setCachedLines((c) => c + 1); else setSessionCost((c) => c + Number(r.cost || 0));
        const a = new Audio(assetUrl(r.url));
        a.playbackRate = rate; audioRef.current = a;
        a.onended = () => advance(); a.onerror = () => advance();
        a.play().catch(() => advance());
      }).catch((err: any) => {
        synthRef.current.delete(cur);
        setStudioMsg(err?.response?.data?.message || 'Live studio voices unavailable — continuing with browser voices.');
        useStudio = false; setStudio(false);
        speakBrowser(e); // finish this line with the browser voice so playback never stalls
      });
    };
    step();
  }, [els, mode, actor, gap, rate, voiceFor, studio, synthFor, readSet, emotionFor]);

  // Pause keeps the cursor (resume continues from the same line); Stop resets it.
  const pause = () => {
    playRef.current = false;
    try { speak?.cancel(); } catch {}
    try { audioRef.current?.pause(); } catch {}
    setPlaying(false);
  };
  const stop = () => { pause(); setCursor(-1); endRef.current = null; };
  const togglePlay = () => {
    if (playing) { pause(); return; }
    if (cursor >= 0) { run(cursor); return; } // resume where we paused
    let start = 0; endRef.current = null;
    if (scope === 'scene') {
      const n = sceneSel || 1;
      const s = meta.sceneOf.findIndex((x) => x === n);
      start = s >= 0 ? s : 0;
      if (!carryOn) endRef.current = meta.sceneOf.lastIndexOf(n); // stop at the scene's last line
    } else if (scope === 'page') {
      const s = els.findIndex((e) => (e.page || 1) >= fromPage);
      start = s >= 0 ? s : 0;
    }
    run(start);
  };
  const handleClose = () => { stop(); onClose(); };

  // Kill ALL audio if the reader unmounts for any reason (close, navigation, hot reload).
  useEffect(() => () => {
    playRef.current = false;
    try { speak?.cancel(); } catch {}
    try { audioRef.current?.pause(); audioRef.current = null; } catch {}
  }, []);

  // Highlight styling is class-driven (see RDR_CSS) — only blackout needs per-row logic.
  const isHidden = (e: El, idx: number) => blackout && actor && e.character === actor && e.type === 'dialogue' && !revealed.has(idx);
  const onReveal = useCallback((idx: number) => setRevealed((r) => new Set(r).add(idx)), []);

  // Pages-style left rail: scene cards with page + reading-time estimate
  const [railTab, setRailTab] = useState<'scenes' | 'pages'>('scenes');
  const sceneCards = useMemo(() => {
    const out: any[] = [];
    let cur: any = null;
    els.forEach((e, i) => {
      const sn = meta.sceneOf[i];
      if (e.type === 'scene') { cur = { n: sn, label: e.text.replace(/^\d+[A-Z]?\.?\s+/, '').slice(0, 34), page: e.page || 1, chars: 0 }; out.push(cur); }
      else if (cur && sn === cur.n) cur.chars += e.text.length;
    });
    return out.map((s: any) => ({ ...s, durSec: Math.max(5, Math.round(s.chars / 14)) }));
  }, [els, meta]);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const readingSceneN = playing && cursor >= 0 ? meta.sceneOf[cursor] : null;
  const scopeDesc = scope === 'scene' ? `Sc ${sceneSel}${carryOn ? ' →' : ''}` : scope === 'page' ? `from p.${fromPage}` : 'Whole script';
  const chip = (on: boolean, accent = 'slate') => `px-2 py-0.5 rounded-full border text-[10.5px] capitalize ${on ? (accent === 'emerald' ? 'border-emerald-600 bg-emerald-600 text-white' : accent === 'sky' ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-900 bg-slate-900 text-white') : 'border-slate-200 text-slate-500'}`;

  return (
    <div className={inline ? 'absolute inset-0 flex items-stretch' : 'fixed inset-0 z-[80] bg-slate-900/50 flex items-stretch'} onClick={inline ? undefined : handleClose}>
      <div className={`son ${sonDark ? 'son-dark' : ''} h-full w-full bg-slate-50 flex flex-col ${inline ? 'rounded-2xl border border-slate-200' : 'ml-auto max-w-5xl shadow-2xl'}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-12 bg-white border-b border-slate-200 shrink-0">
          <BookOpen size={16} className="text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-800">Reader — {revision?.revisionLabel}</h3>
          <span className="text-[11px] text-slate-400">{characters.length} characters · {els.length} lines</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setSonDark(d => !d)} title={sonDark ? 'Light' : 'Dark'} className="son-iconbtn">{sonDark
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>}</button>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-700 p-1"><X size={18} /></button>
          </div>
        </div>

        {/* SYS-14: Pages-skeleton body — left rail · centered paper · right tool rail */}
        <style>{RDR_CSS}</style>
        <div className="flex-1 flex gap-3 min-h-0 p-3">

          {/* LEFT RAIL — identical to Pages: Scenes / Pages */}
          <div className="w-52 shrink-0 rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
            <div className="flex border-b border-slate-100 text-xs">
              <button onClick={() => setRailTab('scenes')} className={`flex-1 py-2 ${railTab === 'scenes' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Scenes</button>
              <button onClick={() => setRailTab('pages')} className={`flex-1 py-2 ${railTab === 'pages' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Pages</button>
            </div>
            <div className="overflow-y-auto p-2 flex-1">
              {railTab === 'scenes' ? (
                <>
                  <button onClick={() => { stop(); setScope('script'); setCursor(-1); }}
                    className={`block w-full text-left px-2 py-1.5 rounded-lg text-xs mb-1 ${scope === 'script' ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
                    ▶ Whole script <span className="block text-[10px] text-slate-400">{pageCount} pages · {scenesList.length} scenes</span>
                  </button>
                  {sceneCards.map((s) => (
                    <button key={s.n} onClick={() => { stop(); setScope('scene'); setSceneSel(s.n); setCursor(-1); }}
                      className={`block w-full text-left px-2 py-1.5 rounded-lg text-xs mb-0.5 ${scope === 'scene' && sceneSel === s.n ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
                      <span className="text-slate-400">{s.n}</span> {s.label}
                      <span className="block text-[10px] text-slate-400">p.{s.page} · {mmss(s.durSec)}{readingSceneN === s.n ? ' · reading…' : ''}</span>
                    </button>
                  ))}
                  {sceneCards.length === 0 && <p className="text-[11px] text-slate-400 p-2">No scenes parsed.</p>}
                </>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                    <button key={n} onClick={() => { stop(); setScope('page'); setFromPage(n); setCursor(-1); }}
                      className={`aspect-[3/4] rounded-md border text-xs flex items-center justify-center ${scope === 'page' && fromPage === n ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>{n}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CENTER — transport mini-bar + the paper, same position as the Pages canvas */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-1.5 mb-2 text-xs flex-wrap">
              <button onClick={togglePlay} disabled={!speak && !studio} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-3 py-1.5 disabled:opacity-50">
                {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? 'Pause' : 'Read'}
              </button>
              <button onClick={stop} title="Stop" className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-900"><Square size={13} /></button>
              <button onClick={() => { stop(); setCursor(-1); }} title="Restart" className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-900"><RotateCcw size={13} /></button>
              <span className="text-slate-600 font-medium px-1">{scopeDesc}</span>
              {studioMsg ? <span className="text-amber-600 truncate">{studioMsg}</span>
                : studio && (sessionCost > 0 || cachedLines > 0) ? <span className="text-indigo-600">≈ ${sessionCost.toFixed(2)}{cachedLines ? ` · ${cachedLines} cached` : ''}</span>
                : <span className="text-slate-400">space = play · click a scene to scope</span>}
              <span className="flex-1" />
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white" title="Studio = live ElevenLabs/OpenAI with the cast voices from Audio Studio">
                <button onClick={() => setStudio(false)} className={`px-2.5 py-1 ${!studio ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Browser</button>
                <button onClick={() => { setStudio(true); setStudioMsg(''); }} className={`px-2.5 py-1 ${studio ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>Studio ✨</button>
              </div>
            </div>
            <div ref={bodyRef} className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-200/60 px-4 py-6">
              <div className={[
                  'rdr mx-auto rounded-md px-8 sm:px-14 py-10 max-w-3xl',
                  hl.scene ? 'rdr-hl-scene' : '', hl.action ? 'rdr-hl-action' : '',
                  hl.character ? 'rdr-hl-character' : '', hl.dialogue ? 'rdr-hl-dialogue' : '',
                  info.sceneNo ? 'rdr-info-sceneno' : '', info.dividers ? 'rdr-info-div' : '',
                  info.dialogueNo ? 'rdr-info-dlgno' : '', info.eighths ? 'rdr-info-8ths' : '',
                  actor ? `rdr-am-${actorMode}` : '',
                ].filter(Boolean).join(' ')}
                style={{ fontFamily: serif ? 'Georgia, serif' : '"Courier New", Courier, monospace', fontSize: font, lineHeight: 1.6,
                  background: info.tint ? tintFor(revision?.colorCode) : '#fdfdf9', color: '#1f1f1f',
                  border: '1px solid rgba(0,0,0,.07)', boxShadow: '0 2px 5px rgba(0,0,0,.16), 0 14px 34px rgba(0,0,0,.12)' }}>
                {els.length === 0 && <p className="text-slate-400 text-sm">No extractable text in this revision. (Scanned PDFs have no text layer.)</p>}
                {els.map((e, idx) => (
                  <Row key={idx} e={e} idx={idx}
                    mine={!!actor && e.character === actor && (e.type === 'character' || e.type === 'dialogue')}
                    active={cursor === idx}
                    sceneNo={e.type === 'scene' ? meta.sceneOf[idx] : null}
                    eighthsLabel={e.type === 'scene' ? eighths(meta.counts[meta.sceneOf[idx]]) : null}
                    dlgNo={e.type === 'dialogue' ? meta.dlgOf[idx] : null}
                    hidden={!!isHidden(e, idx)}
                    onReveal={onReveal} />
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT RAIL — every Reader control as a tool card, where Pages keeps its tools */}
          <div className="w-48 shrink-0 overflow-y-auto space-y-2.5 text-xs">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Playback</p>
              <div className="flex gap-1 mb-2">
                <button onClick={() => setMode('read')} className={chip(mode === 'read')}>Read aloud</button>
                <button onClick={() => setMode('rehearse')} className={chip(mode === 'rehearse')}>Rehearse</button>
              </div>
              <label className="block text-slate-500 mb-1.5">Speed {rate.toFixed(1)}×
                <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full" />
              </label>
              {mode === 'rehearse' && (
                <label className="block text-slate-500 mb-1.5">Your-line gap {gap}s
                  <input type="range" min={0.5} max={8} step={0.5} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="w-full" />
                </label>
              )}
              {scope === 'scene' && (
                <label className="inline-flex items-center gap-1.5 text-slate-500" title="Keep reading into the following scenes instead of stopping at the scene end">
                  <input type="checkbox" checked={carryOn} onChange={(e) => { stop(); setCarryOn(e.target.checked); }} /> continue past scene
                </label>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Read aloud</p>
              <div className="flex flex-wrap gap-1">
                {([['scene', 'Scenes'], ['action', 'Action'], ['character', 'Names'], ['dialogue', 'Dialogue']] as const).map(([k, lbl]) => (
                  <button key={k} onClick={() => setReadSet((s) => ({ ...s, [k]: !s[k] }))} title={`Read ${lbl.toLowerCase()} aloud`} className={chip(readSet[k], 'emerald')}>{lbl}</button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Highlight</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {(['scene', 'action', 'character', 'dialogue'] as const).map((k) => (
                  <button key={k} onClick={() => setHl((h) => ({ ...h, [k]: !h[k] }))} className={chip(hl[k])}>{k}</button>
                ))}
              </div>
              <select value={actor} onChange={(e) => { setActor(e.target.value); setRevealed(new Set()); }} className="w-full rounded-lg border border-slate-200 px-2 py-1 mb-1.5">
                <option value="">My character…</option>
                {characters.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {actor && (
                <div className="flex flex-wrap gap-1">
                  {(['name', 'dialogue', 'both'] as const).map((m) => (
                    <button key={m} onClick={() => setActorMode(m)} className={chip(actorMode === m)}>{m}</button>
                  ))}
                  <button onClick={() => { setBlackout((b) => !b); setRevealed(new Set()); }} className={chip(blackout)}>
                    {blackout ? <EyeOff size={10} className="inline mr-0.5" /> : <Eye size={10} className="inline mr-0.5" />}Off-book
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Info layers</p>
              <div className="flex flex-wrap gap-1">
                {([['sceneNo', 'Scene #'], ['dividers', 'Dividers'], ['dialogueNo', 'Dlg #'], ['eighths', '8ths'], ['tint', 'Tint']] as const).map(([k, lbl]) => (
                  <button key={k} onClick={() => setInfo((s) => ({ ...s, [k]: !s[k as keyof typeof s] }))} className={chip(!!info[k as keyof typeof info], 'sky')}>{lbl}</button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Voices</p>
              <button onClick={() => setShowVoices((s) => !s)} className="w-full inline-flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1 text-slate-600">
                <span className="inline-flex items-center gap-1"><Volume2 size={12} /> Browser voices</span><ChevronDown size={12} style={{ transform: showVoices ? 'rotate(180deg)' : 'none' }} />
              </button>
              {showVoices && (
                <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                  {studio && <p className="text-[10px] text-indigo-600">Studio mode uses the cast voices from Audio Studio — these picks apply to Browser mode only.</p>}
                  {['_narrator', ...characters].map((c) => (
                    <div key={c}>
                      <span className="text-[10px] text-slate-500 block truncate">{c === '_narrator' ? 'Narrator' : c}</span>
                      <select value={voiceMap[c] || ''} onChange={(e) => setVoiceMap((m) => ({ ...m, [c]: e.target.value }))}
                        className="w-full text-[10.5px] rounded border border-slate-200 px-1 py-0.5">
                        <option value="">Default</option>
                        {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                      </select>
                    </div>
                  ))}
                  {voices.length === 0 && <p className="text-[10px] text-slate-400">No system voices in this browser.</p>}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Type · capture</p>
              <div className="flex items-center gap-1 mb-2">
                <TypeIcon size={12} className="text-slate-400" />
                <button onClick={() => setFont((f) => Math.max(12, f - 1))} className="px-1.5 rounded border border-slate-200">A-</button>
                <button onClick={() => setFont((f) => Math.min(28, f + 1))} className="px-1.5 rounded border border-slate-200">A+</button>
                <button onClick={() => setSerif((s) => !s)} className="px-1.5 rounded border border-slate-200">{serif ? 'Serif' : 'Courier'}</button>
              </div>
              <button onClick={() => setRecOpen(true)} className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-slate-600 hover:border-slate-900"><Video size={13} /> Self-tape</button>
            </div>
          </div>
        </div>
      </div>

      {recOpen && <SelfTape onClose={() => setRecOpen(false)} body={<ReaderTeleprompter els={els} font={font} serif={serif} />} />}
    </div>
  );
}

/** Teleprompter view reused inside the self-tape recorder. */
function ReaderTeleprompter({ els, font, serif }: { els: El[]; font: number; serif: boolean }) {
  return (
    <div className="text-white" style={{ fontFamily: serif ? 'Georgia, serif' : 'ui-monospace, monospace', fontSize: font, lineHeight: 1.6 }}>
      {els.map((e, i) => (
        <div key={i} style={{ textAlign: e.type === 'character' ? 'center' : e.type === 'dialogue' ? 'center' : 'left', fontWeight: e.type === 'scene' || e.type === 'character' ? 700 : 400, marginTop: e.type === 'scene' ? 16 : 4, opacity: e.type === 'action' ? 0.8 : 1 }}>
          {e.text}
        </div>
      ))}
    </div>
  );
}

/** Self-tape recorder — MediaRecorder + countdown + teleprompter auto-scroll. Browser-native. */
function SelfTape({ onClose, body }: { onClose: () => void; body: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const scrollTimer = useRef<any>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [count, setCount] = useState(0);
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState('');
  const [speed, setSpeed] = useState(40);     // px/sec teleprompter
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(s); if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.muted = true; videoRef.current.play().catch(() => {}); }
      } catch (e: any) { setErr('Camera/mic permission denied or unavailable.'); }
    })();
    return () => { stream?.getTracks().forEach((t) => t.stop()); clearInterval(scrollTimer.current); };
  }, []); // eslint-disable-line

  const startScroll = () => {
    clearInterval(scrollTimer.current);
    scrollTimer.current = setInterval(() => { if (promptRef.current) promptRef.current.scrollTop += speed / 20; }, 50);
  };
  const stopScroll = () => clearInterval(scrollTimer.current);

  const begin = () => {
    if (!stream) return;
    setUrl(''); chunks.current = [];
    let c = 3; setCount(c);
    const cd = setInterval(() => {
      c -= 1; setCount(c);
      if (c <= 0) {
        clearInterval(cd); setCount(0);
        const mr = new MediaRecorder(stream);
        recRef.current = mr;
        mr.ondataavailable = (ev) => { if (ev.data.size) chunks.current.push(ev.data); };
        mr.onstop = () => { const blob = new Blob(chunks.current, { type: 'video/webm' }); setUrl(URL.createObjectURL(blob)); stopScroll(); };
        mr.start(); setRecording(true); if (promptRef.current) promptRef.current.scrollTop = 0; startScroll();
      }
    }, 1000);
  };
  const end = () => { recRef.current?.stop(); setRecording(false); };

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl w-full max-w-4xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-11 border-b border-slate-700">
          <span className="text-sm font-semibold text-white inline-flex items-center gap-1.5"><Video size={15} /> Self-tape</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="grid md:grid-cols-2 gap-3 p-3">
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline />
            {count > 0 && <div className="absolute inset-0 flex items-center justify-center text-white text-7xl font-bold bg-black/40">{count}</div>}
            {recording && <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[11px] text-white bg-red-600 px-2 py-0.5 rounded-full"><Mic size={11} /> REC</span>}
            {err && <div className="absolute inset-0 flex items-center justify-center text-rose-300 text-sm p-4 text-center">{err}</div>}
          </div>
          <div ref={promptRef} className="bg-slate-950 rounded-xl p-5 h-[300px] overflow-y-auto">{body}</div>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-700 text-xs">
          {!recording
            ? <button onClick={begin} disabled={!stream} className="inline-flex items-center gap-1 rounded-lg bg-red-600 text-white px-3 py-1.5 disabled:opacity-50"><Play size={13} /> Record (3s slate)</button>
            : <button onClick={end} className="inline-flex items-center gap-1 rounded-lg bg-white text-slate-900 px-3 py-1.5"><Square size={13} /> Stop</button>}
          <label className="inline-flex items-center gap-1 text-slate-300">Scroll
            <input type="range" min={10} max={120} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-24" />
          </label>
          {url && <a href={url} download="self-tape.webm" className="ml-auto inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1.5">Download .webm</a>}
        </div>
      </div>
    </div>
  );
}
