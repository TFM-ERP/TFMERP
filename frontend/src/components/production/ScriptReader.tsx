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
@import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap');
:root,html.daylight{--sheet:#FFFFFF;--ink:#1B2230;--sheet-edge:rgba(16,24,40,.12)}
html.dark{--sheet:#191F2B;--ink:#ECEFF4;--sheet-edge:rgba(0,0,0,.5)}
html[data-theme="ink"]{--sheet:#FCFAF4;--ink:#16120C;--sheet-edge:rgba(60,40,20,.16)}
html[data-theme="slate"]{--sheet:#0F1726;--ink:#E7EEF8;--sheet-edge:rgba(0,0,0,.5)}
html[data-theme="aurora"]{--sheet:#14122A;--ink:#EFEBFF;--sheet-edge:rgba(0,0,0,.45)}
html[data-theme="midnight"]{--sheet:#0A0D12;--ink:#FFFFFF;--sheet-edge:rgba(0,0,0,.7)}
.rdr-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;background:var(--surface-1);border-bottom:1px solid var(--border-1)}
.rdr-tabs{display:flex;gap:4px;background:var(--surface-2);padding:3px;border-radius:999px}
.rdr-tab{font-size:12px;font-weight:600;color:var(--text-3);padding:6px 13px;border-radius:999px;cursor:pointer;border:none;background:none}
.rdr-tab.on{background:var(--accent);color:var(--accent-on)}
.rdr-play{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--accent-on);background:var(--accent);border:none;border-radius:8px;padding:7px 13px;cursor:pointer}
.rdr-play:disabled{opacity:.5;cursor:default}
.rdr-tbtn{border:1px solid var(--border-1);background:var(--surface-2);color:var(--text-2);min-width:32px;height:32px;padding:0 8px;border-radius:8px;display:inline-grid;place-items:center;cursor:pointer;font-size:12px;font-weight:700}
.rdr-tbtn:hover{color:var(--text-1);border-color:var(--accent)}
.rdr-revchip{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;color:var(--text-2);background:var(--surface-2);border:1px solid var(--border-1);padding:6px 11px;border-radius:999px}
.rdr-revchip .sw{width:11px;height:11px;border-radius:3px;flex-shrink:0}
.rdr-scope{font-size:11.5px;font-weight:600;color:var(--text-2)}
.rdr-msg{font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rdr-sp{flex:1}
.rdr-engine{display:inline-flex;border:1px solid var(--border-1);border-radius:8px;overflow:hidden}
.rdr-engine button{font-size:11px;font-weight:600;padding:6px 10px;background:var(--surface-1);color:var(--text-3);border:none;cursor:pointer}
.rdr-engine button.on{background:var(--accent);color:var(--accent-on)}
.rdr-work{flex:1;display:grid;grid-template-columns:212px 1fr 240px;min-height:0;overflow:hidden}
.rdr-rail{border-right:1px solid var(--border-1);padding:12px 10px;background:var(--surface-1);overflow:auto}
.rdr-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);font-weight:700;margin:4px 6px 8px}
.rdr-scenecard{display:flex;gap:9px;padding:8px 9px;border-radius:8px;cursor:pointer;margin-bottom:2px}
.rdr-scenecard:hover{background:var(--surface-2)}
.rdr-scenecard.on{background:var(--accent-soft)}
.rdr-scenecard .no{font-weight:800;color:var(--accent);font-size:12px;min-width:18px;flex-shrink:0}
.rdr-scenecard .tx{font-size:11.5px;color:var(--text-2);line-height:1.3}
.rdr-scenecard.on .tx{color:var(--text-1)}
.rdr-scenecard .tx small{display:block;color:var(--text-3);font-size:10px;margin-top:1px}
.rdr-scenecard.reading .no{color:var(--ok)}
.rdr-empty{font-size:11px;color:var(--text-3);padding:8px}
.rdr-sheetwrap{padding:28px 20px;display:flex;justify-content:center;overflow:auto;background:color-mix(in srgb,var(--bg) 55%,var(--surface-2))}
.rdr.sheet{width:640px;max-width:100%;flex-shrink:0;background:var(--sheet);color:var(--ink);border-radius:3px;padding:54px 76px 54px 92px;position:relative;box-shadow:0 2px 4px var(--sheet-edge),0 16px 40px var(--sheet-edge);font-family:'Courier Prime','Courier New',monospace;line-height:1.5;transition:background .3s,color .3s}
.rdr.sheet .pageno{position:absolute;top:22px;right:42px;font-size:.95em;opacity:.55}
.rdr.sheet .punch{position:absolute;left:30px;top:56px;display:flex;flex-direction:column;gap:96px;pointer-events:none}
.rdr.sheet .punch span{width:13px;height:13px;border-radius:50%;background:color-mix(in srgb,var(--ink) 12%,transparent);box-shadow:inset 0 1px 2px var(--sheet-edge)}
.rdr-scene{font-weight:700;text-transform:uppercase;letter-spacing:.01em;margin:18px 0 12px;position:relative}
.rdr-scene:first-of-type{margin-top:0}
.rdr-action{margin:0 0 13px}
.rdr-character{margin:0 0 1px;padding-left:36%;font-weight:700;text-transform:uppercase}
.rdr-paren{margin:0 0 1px;padding-left:28%;font-style:italic;opacity:.85}
.rdr-dialogue{margin:0 0 13px;padding-left:21%;padding-right:14%}
.rdr-transition{text-align:right;text-transform:uppercase;margin:0 0 13px}
.rdr-sceneno{position:absolute;left:-58px;font-weight:700;opacity:.5;display:none}
.rdr-sceneno.r{left:auto;right:-46px}
.rdr.rdr-info-sceneno .rdr-sceneno{display:inline}
.rdr-8ths{opacity:.5;font-weight:400;margin-left:10px;font-size:.8em;display:none}
.rdr.rdr-info-8ths .rdr-8ths{display:inline}
.rdr-dlgno{opacity:.5;margin-left:3px;font-size:.7em;display:none}
.rdr.rdr-info-dlgno .rdr-dlgno{display:inline}
.rdr.rdr-info-div .rdr-scene:not(:first-of-type){border-top:1px solid var(--sheet-edge);padding-top:14px}
.rdr.rdr-hl-scene .rdr-scene{background:var(--warn-soft);border-radius:4px;padding:1px 4px}
.rdr.rdr-hl-action .rdr-action{background:var(--accent-soft);border-radius:4px;padding:1px 4px}
.rdr.rdr-hl-character .rdr-character{background:var(--accent-soft);border-radius:4px}
.rdr.rdr-hl-dialogue .rdr-dialogue{background:var(--ok-soft);border-radius:4px}
.rdr.rdr-am-name .rdr-mine.rdr-character,.rdr.rdr-am-both .rdr-mine.rdr-character{background:var(--ok-soft);border-radius:4px}
.rdr.rdr-am-dialogue .rdr-mine.rdr-dialogue,.rdr.rdr-am-both .rdr-mine.rdr-dialogue{background:var(--ok-soft);border-radius:4px}
.rdr .rdr-active{background:var(--warn-soft) !important;border-radius:4px}
.rdr-tags{border-left:1px solid var(--border-1);padding:14px 13px;background:var(--surface-1);overflow:auto}
.rdr-tags .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);font-weight:700;margin:0 0 8px}
.rdr-group{margin-bottom:15px}
.rdr-tag{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:4px 9px;border-radius:7px;margin:0 5px 5px 0;background:var(--surface-2);color:var(--text-2);border:1px solid var(--border-1);cursor:pointer;text-transform:capitalize}
.rdr-tag.on{background:var(--accent);color:var(--accent-on);border-color:var(--accent)}
.rdr-tag.ok.on{background:var(--ok);color:#fff;border-color:var(--ok)}
.rdr-tag .d{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.rdr-sel{width:100%;font-size:11.5px;border:1px solid var(--border-1);background:var(--surface-2);color:var(--text-1);border-radius:7px;padding:5px 7px;margin-bottom:8px}
.rdr-range{width:100%;accent-color:var(--accent)}
.rdr-note{font-size:11px;color:var(--text-3);margin:2px 0 0}
@media(max-width:900px){.rdr-work{grid-template-columns:1fr}.rdr-rail,.rdr-tags{display:none}.rdr.sheet{width:100%;padding:36px 26px 36px 46px}.rdr.sheet .punch{display:none}.rdr-sceneno{left:-30px}.rdr-sceneno.r{display:none}}
`;

/** One script line, memoized — its props only change for cursor moves, actor change, or blackout. */
const Row = memo(function Row({ e, idx, mine, active, sceneNo, eighthsLabel, dlgNo, hidden, onReveal }: {
  e: El; idx: number; mine: boolean; active: boolean; sceneNo: number | null;
  eighthsLabel: string | null; dlgNo: number | null; hidden: boolean; onReveal: (idx: number) => void;
}) {
  return (
    <div data-el={idx} className={`rdr-${e.type}${mine ? ' rdr-mine' : ''}${active ? ' rdr-active' : ''}`}>
      {sceneNo != null && <span className="rdr-sceneno">{sceneNo}</span>}
      {hidden
        ? <button onClick={() => onReveal(idx)} className="rounded select-none" style={{ minWidth: 120, background: 'var(--ink)', color: 'var(--ink)' }}>{e.text}</button>
        : e.text}
      {eighthsLabel && <span className="rdr-8ths">{eighthsLabel} pg</span>}
      {dlgNo != null && <sup className="rdr-dlgno">{dlgNo}</sup>}
      {sceneNo != null && <span className="rdr-sceneno r">{sceneNo}</span>}
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
  // SON-DS theme follows the global system setting (html.dark) — no dedicated toggle.
  const [sonDark, setSonDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setSonDark(root.classList.contains('dark'));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  const [font, setFont] = useState(13);
  const [serif, setSerif] = useState(false);
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
      }).catch(() => {
        // One retry after a short breather — local CPU engines hiccup transiently
        // (model reload, queue pressure); a single failure shouldn't demote the session.
        synthRef.current.delete(cur);
        setStudioMsg('Synthesis hiccup — retrying line…');
        setTimeout(() => {
          if (!playRef.current) return;
          synthFor(cur).then((r: any) => {
            if (!playRef.current) return;
            setStudioMsg('');
            if (r.cached) setCachedLines((c) => c + 1); else setSessionCost((c) => c + Number(r.cost || 0));
            const a = new Audio(assetUrl(r.url));
            a.playbackRate = rate; audioRef.current = a;
            a.onended = () => advance(); a.onerror = () => advance();
            a.play().catch(() => advance());
          }).catch((err2: any) => {
            synthRef.current.delete(cur);
            setStudioMsg(err2?.response?.data?.message || 'Live studio voices unavailable — continuing with browser voices.');
            useStudio = false; setStudio(false);
            speakBrowser(e); // finish this line with the browser voice so playback never stalls
          });
        }, 3000);
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
      // Stop at the end of this page unless carry-on is checked.
      if (!carryOn) { let last = start; for (let k = start; k < els.length; k++) { if ((els[k].page || 1) === fromPage) last = k; else if ((els[k].page || 1) > fromPage) break; } endRef.current = last; }
    }
    run(start);
  };

  // ── Warm scene: pre-generate every speakable line in the current scope into the cache,
  //    one at a time (kind to local CPU engines). After warming, Read plays instantly. ──
  const [warm, setWarm] = useState<{ done: number; total: number } | null>(null);
  const warmRef = useRef(false);
  const warmScene = async () => {
    if (warmRef.current) { warmRef.current = false; setWarm(null); return; } // click again = cancel
    let start = 0; let end = els.length - 1;
    if (scope === 'scene') {
      const n = sceneSel || 1;
      const s = meta.sceneOf.findIndex((x) => x === n);
      start = s >= 0 ? s : 0;
      if (!carryOn) { const e = meta.sceneOf.lastIndexOf(n); if (e >= 0) end = e; }
    } else if (scope === 'page') {
      const s = els.findIndex((e) => (e.page || 1) >= fromPage);
      start = s >= 0 ? s : 0;
    }
    const ok = (x: El) => !!x.text && (
      (x.type === 'scene' && readSet.scene) || (x.type === 'action' && readSet.action) ||
      (x.type === 'character' && readSet.character) || (x.type === 'dialogue' && readSet.dialogue));
    const idxs: number[] = [];
    for (let j = start; j <= end && j < els.length; j++) {
      const n = els[j];
      const mine = mode === 'rehearse' && actor && n.character === actor && (n.type === 'dialogue' || n.type === 'character');
      if (!mine && ok(n)) idxs.push(j);
    }
    warmRef.current = true; setWarm({ done: 0, total: idxs.length });
    let done = 0;
    for (const j of idxs) {
      if (!warmRef.current) break;
      try {
        const r: any = await synthFor(j);
        if (r?.cached) setCachedLines((c) => c + 1); else setSessionCost((c) => c + Number(r?.cost || 0));
      } catch {
        // one retry per line after a breather; a stubborn line is skipped, not fatal
        synthRef.current.delete(j);
        await new Promise((res) => setTimeout(res, 3000));
        try { await synthFor(j); } catch { synthRef.current.delete(j); }
      }
      done += 1; setWarm({ done, total: idxs.length });
    }
    warmRef.current = false;
    setTimeout(() => setWarm((w) => (w && w.done >= w.total ? null : w)), 5000);
  };

  // Space = play/pause (kept in a ref so the listener never goes stale)
  const togglePlayRef = useRef<() => void>(() => {});
  togglePlayRef.current = togglePlay;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || t?.isContentEditable) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlayRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
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
  return (
    <div className={inline ? 'absolute inset-0 flex' : 'fixed inset-0 z-[80] flex'} style={inline ? undefined : { background: 'rgba(0,0,0,.5)' }} onClick={inline ? undefined : handleClose}>
      <div className={`flex flex-col h-full w-full ${inline ? '' : 'ms-auto max-w-6xl shadow-2xl'}`} style={{ background: 'var(--bg)', backgroundImage: 'var(--bg-image, none)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)' }} onClick={(e) => e.stopPropagation()}>
        <style>{RDR_CSS}</style>

        {/* Toolbar */}
        <div className="rdr-toolbar">
          <div className="rdr-tabs">
            <button className={`rdr-tab ${mode === 'read' ? 'on' : ''}`} onClick={() => setMode('read')}>Reader</button>
            <button className={`rdr-tab ${mode === 'rehearse' ? 'on' : ''}`} onClick={() => setMode('rehearse')}>Rehearse</button>
          </div>
          <button className="rdr-play" onClick={togglePlay} disabled={!speak && !studio}>{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? 'Pause' : 'Read'}</button>
          <button className="rdr-tbtn" onClick={stop} title="Stop"><Square size={12} /></button>
          <button className="rdr-tbtn" onClick={() => { stop(); setCursor(-1); }} title="Restart"><RotateCcw size={12} /></button>
          {studio && <button className="rdr-tbtn" style={warm ? { borderColor: 'var(--warn)', color: 'var(--warn)' } : undefined} onClick={warmScene} title="Warm cache">{warm ? `${warm.done}/${warm.total}` : '⚡'}</button>}
          <span className="rdr-revchip"><span className="sw" style={{ background: ((): string => { const c = (revision?.colorCode || '') as string; if (/^#[0-9a-fA-F]{6}$/.test(c)) return c; const m: Record<string, string> = { BLUE: '#5b8def', PINK: '#ec4899', YELLOW: '#eab308', GREEN: '#22c55e', GOLDENROD: '#d4a017', BUFF: '#e0c068', SALMON: '#fb7185', CHERRY: '#ef4444' }; return m[c.toUpperCase()] || 'var(--accent)'; })() }} />{revision?.revisionLabel || 'Reader'}</span>
          <span className="rdr-scope">{scopeDesc}</span>
          <span className="rdr-sp" />
          {studioMsg ? <span className="rdr-msg" style={{ color: 'var(--warn)' }}>{studioMsg}</span>
            : studio && (sessionCost > 0 || cachedLines > 0) ? <span className="rdr-msg" style={{ color: 'var(--accent)' }}>{`≈ $${sessionCost.toFixed(2)}${cachedLines ? ` · ${cachedLines} cached` : ''}`}</span>
            : null}
          <div className="rdr-engine" title="Studio = live ElevenLabs/OpenAI cast voices">
            <button className={!studio ? 'on' : ''} onClick={() => setStudio(false)}>Browser</button>
            <button className={studio ? 'on' : ''} onClick={() => { setStudio(true); setStudioMsg(''); }}>Studio ✨</button>
          </div>
          <button className="rdr-tbtn" onClick={() => setFont((f) => Math.max(11, f - 1))} title="Smaller">A−</button>
          <button className="rdr-tbtn" onClick={() => setFont((f) => Math.min(22, f + 1))} title="Larger">A+</button>
          <button className="rdr-tbtn" onClick={() => setSerif((s) => !s)} title="Serif / Courier">{serif ? 'Aa' : 'A'}</button>
          <button className="rdr-tbtn" onClick={() => setRecOpen(true)} title="Self-tape"><Video size={13} /></button>
          {!inline && <button className="rdr-tbtn" onClick={handleClose} title="Close"><X size={14} /></button>}
        </div>

        {/* Work grid: scene navigator | screenplay sheet | breakdown rail */}
        <div className="rdr-work">
          <aside className="rdr-rail">
            <div className="rdr-lbl">Scenes · {scenesList.length}</div>
            <div className={`rdr-scenecard ${scope === 'script' ? 'on' : ''}`} onClick={() => { stop(); setScope('script'); setCursor(-1); }}>
              <span className="no">▶</span><span className="tx">Whole script<small>{pageCount} pages · {scenesList.length} scenes</small></span>
            </div>
            {sceneCards.map((s) => (
              <div key={s.n} className={`rdr-scenecard ${scope === 'scene' && sceneSel === s.n ? 'on' : ''} ${readingSceneN === s.n ? 'reading' : ''}`} onClick={() => { stop(); setScope('scene'); setSceneSel(s.n); setCursor(-1); }}>
                <span className="no">{s.n}</span><span className="tx">{s.label}<small>p.{s.page} · {mmss(s.durSec)}{readingSceneN === s.n ? ' · reading…' : ''}</small></span>
              </div>
            ))}
            {sceneCards.length === 0 && <p className="rdr-empty">No scenes parsed.</p>}
          </aside>

          <div className="rdr-sheetwrap">
            <div ref={bodyRef} className={[
                'rdr sheet',
                hl.scene ? 'rdr-hl-scene' : '', hl.action ? 'rdr-hl-action' : '',
                hl.character ? 'rdr-hl-character' : '', hl.dialogue ? 'rdr-hl-dialogue' : '',
                info.sceneNo ? 'rdr-info-sceneno' : '', info.dividers ? 'rdr-info-div' : '',
                info.dialogueNo ? 'rdr-info-dlgno' : '', info.eighths ? 'rdr-info-8ths' : '',
                actor ? `rdr-am-${actorMode}` : '',
              ].filter(Boolean).join(' ')}
              style={{ fontFamily: serif ? "'Fraunces', Georgia, serif" : "'Courier Prime', 'Courier New', monospace", fontSize: font, ...(info.tint ? { background: tintFor(revision?.colorCode) } : {}) }}>
              <div className="pageno">{els[0]?.page || 1}.</div>
              <div className="punch"><span /><span /><span /></div>
              {els.length === 0 && <p className="rdr-empty">No extractable text in this revision. (Scanned PDFs have no text layer.)</p>}
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

          <aside className="rdr-tags">
            <div className="rdr-group">
              <div className="lbl">My role</div>
              <select className="rdr-sel" value={actor} onChange={(e) => { setActor(e.target.value); setRevealed(new Set()); }}>
                <option value="">My character…</option>
                {characters.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div>
                {characters.slice(0, 14).map((c) => (
                  <span key={c} className={`rdr-tag ${actor === c ? 'on' : ''}`} onClick={() => { setActor(actor === c ? '' : c); setRevealed(new Set()); }}>
                    <span className="d" style={{ background: 'var(--accent)' }} />{c}
                  </span>
                ))}
                {characters.length === 0 && <p className="rdr-note">No characters parsed.</p>}
              </div>
              {actor && (
                <div style={{ marginTop: 6 }}>
                  {(['name', 'dialogue', 'both'] as const).map((m) => (
                    <span key={m} className={`rdr-tag ${actorMode === m ? 'on' : ''}`} onClick={() => setActorMode(m)}>{m}</span>
                  ))}
                  <span className={`rdr-tag ${blackout ? 'on' : ''}`} onClick={() => { setBlackout((b) => !b); setRevealed(new Set()); }}>
                    {blackout ? <EyeOff size={10} /> : <Eye size={10} />} Off-book
                  </span>
                </div>
              )}
            </div>

            <div className="rdr-group">
              <div className="lbl">Read aloud</div>
              {([['scene', 'Scenes'], ['action', 'Action'], ['character', 'Names'], ['dialogue', 'Dialogue']] as const).map(([k, lbl]) => (
                <span key={k} className={`rdr-tag ok ${readSet[k] ? 'on' : ''}`} onClick={() => setReadSet((s) => ({ ...s, [k]: !s[k] }))}>{lbl}</span>
              ))}
              <label className="rdr-note" style={{ display: 'block', marginTop: 6 }}>Speed {rate.toFixed(1)}×
                <input className="rdr-range" type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
              </label>
              {mode === 'rehearse' && (
                <label className="rdr-note" style={{ display: 'block' }}>Your-line gap {gap}s
                  <input className="rdr-range" type="range" min={0.5} max={8} step={0.5} value={gap} onChange={(e) => setGap(Number(e.target.value))} />
                </label>
              )}
              {(scope === 'scene' || scope === 'page') && (
                <label className="rdr-note" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', marginTop: 4 }}>
                  <input type="checkbox" checked={carryOn} onChange={(e) => { stop(); setCarryOn(e.target.checked); }} /> continue past {scope}
                </label>
              )}
            </div>

            <div className="rdr-group">
              <div className="lbl">Highlight</div>
              {(['scene', 'action', 'character', 'dialogue'] as const).map((k) => (
                <span key={k} className={`rdr-tag ${hl[k] ? 'on' : ''}`} onClick={() => setHl((h) => ({ ...h, [k]: !h[k] }))}>{k}</span>
              ))}
            </div>

            <div className="rdr-group">
              <div className="lbl">Info layers</div>
              {([['sceneNo', 'Scene #'], ['dividers', 'Dividers'], ['dialogueNo', 'Dlg #'], ['eighths', '8ths'], ['tint', 'Tint']] as const).map(([k, lbl]) => (
                <span key={k} className={`rdr-tag ${info[k as keyof typeof info] ? 'on' : ''}`} onClick={() => setInfo((s) => ({ ...s, [k]: !s[k as keyof typeof s] }))}>{lbl}</span>
              ))}
            </div>

            <div className="rdr-group">
              <div className="lbl">Voices</div>
              <span className="rdr-tag" onClick={() => setShowVoices((s) => !s)}><Volume2 size={11} /> Browser voices <ChevronDown size={11} style={{ transform: showVoices ? 'rotate(180deg)' : 'none' }} /></span>
              {showVoices && (
                <div style={{ marginTop: 6 }}>
                  {['_narrator', ...characters].map((c) => (
                    <div key={c} style={{ marginBottom: 4 }}>
                      <span className="rdr-note" style={{ display: 'block' }}>{c === '_narrator' ? 'Narrator' : c}</span>
                      <select className="rdr-sel" style={{ marginBottom: 0 }} value={voiceMap[c] || ''} onChange={(e) => setVoiceMap((m) => ({ ...m, [c]: e.target.value }))}>
                        <option value="">Default</option>
                        {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                      </select>
                    </div>
                  ))}
                  {voices.length === 0 && <p className="rdr-note">No system voices in this browser.</p>}
                </div>
              )}
            </div>
          </aside>
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
            {recording && <span className="absolute top-2 start-2 inline-flex items-center gap-1 text-[11px] text-white bg-red-600 px-2 py-0.5 rounded-full"><Mic size={11} /> REC</span>}
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
          {url && <a href={url} download="self-tape.webm" className="ms-auto inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1.5">Download .webm</a>}
        </div>
      </div>
    </div>
  );
}
