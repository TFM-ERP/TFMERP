/**
 * ScripON knowledge · DOCUMENTARY
 * -------------------------------
 * Documentaries are written in the EDIT, not scripted up front. The develop ladder swaps from
 * dialogue beats to a thesis→research→rights→outline→paper-edit→narration chain. Two independent
 * axes: subgenre (subject) and Nichols mode (voice).
 * Guideline + sources: docs/knowledge-base/scripon/03-documentary.md
 */

export interface DocSubgenre { id: string; label: string; ar?: string; shape: string; artifact: string; }

/** Subgenre = what it's about; sets the default shape + the distinct blocking artifact. */
export const DOC_SUBGENRES: DocSubgenre[] = [
  { id: 'nature', label: 'Nature / wildlife', ar: 'طبيعة', shape: '6–11 × 50 min by biome; "hero animal" sequences; narration last', artifact: 'season-locked shot wish-list + field schedule' },
  { id: 'sports', label: 'Sports', ar: 'رياضة', shape: 'event/season spine; outcome-known → dramatic irony', artifact: 'archive + access agreements with leagues/athletes' },
  { id: 'true-crime', label: 'True-crime', ar: 'جريمة حقيقية', shape: '3–10 × 45–60 min; crime → investigation → trial → aftermath; per-ep cliffhanger', artifact: 'legal/defamation pack (2-source rule)' },
  { id: 'political', label: 'Political / investigative', ar: 'سياسي/استقصائي', shape: 'thesis-argument outline; expository or participatory', artifact: 'fact-check / source-verification matrix' },
  { id: 'bio', label: 'Biographical', ar: 'سيرة', shape: 'life-arc or turning-point spine; archive + interviews', artifact: 'life-rights / estate clearance' },
  { id: 'music', label: 'Music', ar: 'موسيقى', shape: 'scenes built around songs; concert vs portrait', artifact: 'sync + master-use licensing plan (budget-critical)' },
  { id: 'verite', label: 'Observational / vérité', ar: 'ملاحظة مباشرة', shape: 'shoot-as-you-go; structure found in the edit', artifact: 'long shooting ratio + consent/release tracking' },
  { id: 'essay', label: 'Essay', ar: 'مقالي', shape: 'authored argument; voice-led, associative', artifact: 'narration/voice script as the through-line' },
];

/** Nichols 6 modes = the VOICE. An independent axis from subgenre. */
export const NICHOLS_MODES = [
  { id: 'expository', label: 'Expository', note: '"Voice of God" narration argues directly to the viewer.' },
  { id: 'observational', label: 'Observational', note: 'Fly-on-the-wall; no narration or interviews.' },
  { id: 'participatory', label: 'Participatory', note: 'The filmmaker is present and interacts (interviews, on-camera).' },
  { id: 'reflexive', label: 'Reflexive', note: 'Foregrounds the act of filmmaking itself.' },
  { id: 'performative', label: 'Performative', note: 'Subjective, personal, emotionally expressive.' },
  { id: 'poetic', label: 'Poetic', note: 'Mood and association over argument or chronology.' },
];

/** The documentary stage chain — narration is written LAST. */
export const DOC_STAGE_CHAIN = [
  { kind: 'THESIS', what: 'The premise / argument the film makes (or the question it investigates).' },
  { kind: 'TREATMENT', what: 'A living treatment — characters, access, visual approach, structure (revised throughout).' },
  { kind: 'RESEARCH_PLAN', what: 'Research & archive plan — what footage, records and experts are needed.' },
  { kind: 'RIGHTS_PLAN', what: 'Rights & access plan — clearances, life-rights, music sync/master, location/archive licences.' },
  { kind: 'INTERVIEW_OUTLINE', what: 'Interview / shooting outline — questions and sequences to capture.' },
  { kind: 'PAPER_EDIT', what: 'Paper edit (string-out) — the film assembled from transcripts before/while cutting.' },
  { kind: 'NARRATION', what: 'Narration script — written LAST, to the locked picture.' },
];

const lc = (v: any) => String(v == null ? '' : v).trim().toLowerCase();

/** Resolve the chosen subgenre from the brief (genres[]/subgenre/baseGenre hints). */
function pickSubgenre(brief: any): DocSubgenre | null {
  const hay = lc([brief && brief.subgenre, brief && brief.baseGenre, Array.isArray(brief && brief.genres) ? brief.genres.join(' ') : (brief && brief.genres), brief && brief.docSubgenre].filter(Boolean).join(' '));
  for (const s of DOC_SUBGENRES) { if (hay.includes(s.id) || hay.includes(lc(s.label.split(' ')[0]))) return s; }
  if (/crime/.test(hay)) return DOC_SUBGENRES.find((s) => s.id === 'true-crime') || null;
  if (/sport/.test(hay)) return DOC_SUBGENRES.find((s) => s.id === 'sports') || null;
  if (/music|band|album/.test(hay)) return DOC_SUBGENRES.find((s) => s.id === 'music') || null;
  if (/politic|gov|election|investig/.test(hay)) return DOC_SUBGENRES.find((s) => s.id === 'political') || null;
  if (/nature|wildlife|animal|ocean|planet/.test(hay)) return DOC_SUBGENRES.find((s) => s.id === 'nature') || null;
  if (/life|biograph|portrait/.test(hay)) return DOC_SUBGENRES.find((s) => s.id === 'bio') || null;
  return null;
}

function pickMode(brief: any): string {
  const hay = lc([brief && brief.docMode, brief && brief.treatment].filter(Boolean).join(' '));
  const m = NICHOLS_MODES.find((x) => hay.includes(x.id));
  return m ? m.label + ' — ' + m.note : 'choose a Nichols mode (Expository / Observational / Participatory / Reflexive / Performative / Poetic) and hold it.';
}

/** The documentary steering directive — appended when projectType is documentary. */
export function documentaryDirective(brief: any): string {
  const sub = pickSubgenre(brief);
  const parts: string[] = [];
  parts.push('DOCUMENTARY RULES (this is written in the edit — do NOT invent dialogue or fictional scenes):');
  parts.push('· Stage chain: ' + DOC_STAGE_CHAIN.map((s) => s.kind).join(' → ') + '. Narration is written LAST, to picture.');
  parts.push('· Voice / mode: ' + pickMode(brief));
  if (sub) {
    parts.push('· Subgenre: ' + sub.label + ' — default shape: ' + sub.shape + '.');
    parts.push('· Distinct artifact to plan for: ' + sub.artifact + '.');
  }
  parts.push('· Outcome flag: if the outcome is known (sports/historical), use dramatic irony; if unknown (vérité), structure is found in the edit.');
  parts.push('· Rights & clearance are tracked items, not prose — surface them explicitly (music sync/master, life-rights, archive, locations).');
  return parts.join('\n  ');
}
