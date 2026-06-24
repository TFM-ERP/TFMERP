/**
 * ScripON knowledge · STYLE & VOICE PACKS
 * ---------------------------------------
 * The "HOW it's written" axis — craft texture, separate from WHAT the story is (genre/era/conflict/lore).
 * Each pack bundles craft directives across five dimensions: dialogue, structure, voice/tone,
 * visual grammar (as written in action), and scene construction. Steers every format.
 *
 * IP-SAFE BY DESIGN: technique-only, generically named — NO living-person or trademarked names, here
 * or in output. Style/method is not copyrightable; we encode the technique, never reproduce real text.
 * Guideline + sources: docs/knowledge-base/scripon/08-style-voice.md
 *
 * OPT-IN: returns '' unless the brief explicitly chooses styles (brief.styles[]). Off by default —
 * existing builds are unaffected. brief.styleMix[id] = strength 0..4 (subtle flavour → defining).
 */

export interface StylePack {
  id: string;
  label: string;
  ar: string;
  blurb: string;
  dialogue: string;
  structure: string;
  voice: string;
  visual: string;
  scene: string;
  bestFor: string[]; // 'any' or format families: FEATURE | SERIES | VERTICAL | DOCUMENTARY | TVC
}

export const STYLE_PACKS: StylePack[] = [
  {
    id: 'fast-ensemble', label: 'Fast Ensemble Dialogue', ar: 'حوار جماعي سريع',
    blurb: 'Overlapping, rapid-fire, walk-and-talks, idealistic institutions.',
    dialogue: 'rapid, overlapping, witty; characters cut each other off; high words-per-minute; smart professionals talking shop with conviction',
    structure: 'propulsive forward motion; walk-and-talks; scenes start late and end early; little stage rest',
    voice: 'idealistic, articulate, morally engaged; institutions worth believing in',
    visual: 'movement as staging — corridors, bullpens, motion the camera keeps pace with',
    scene: 'scenes turn on argument and persuasion — a debate won or lost, information traded at speed',
    bestFor: ['any'],
  },
  {
    id: 'slow-burn', label: 'Slow-Burn Naturalism', ar: 'واقعية بطيئة الإيقاع',
    blurb: 'Long quiet scenes, silence and subtext, real-time texture.',
    dialogue: 'sparse and naturalistic; long pauses; meaning lives in subtext and the unsaid',
    structure: 'long scenes in near real-time; few cuts; patience; let moments breathe',
    voice: 'observational, austere, unsentimental; trusts the audience',
    visual: 'intimate and still; wide holds; ambient detail; minimal coverage',
    scene: 'scenes turn on a small shift — a glance, a withheld line; the drama is interior',
    bestFor: ['any'],
  },
  {
    id: 'mythic-quest', label: 'Mythic Quest', ar: 'ملحمة أسطورية',
    blurb: 'Elevated, archetypal cadence, big emotional swings.',
    dialogue: 'elevated, declarative, a touch formal; lines that carry weight; sparing humour',
    structure: 'archetypal escalating cadence; clear thresholds and trials rising to a grand confrontation',
    voice: 'earnest, epic, emotionally large; destiny and sacrifice',
    visual: 'operatic landscapes, thresholds and iconography; the frame mythologises',
    scene: 'scenes turn on a test, an oath, or a revelation of purpose',
    bestFor: ['any'],
  },
  {
    id: 'hyperlink-mosaic', label: 'Hyperlink Mosaic', ar: 'فسيفساء متشابكة',
    blurb: 'Multiple interwoven strands, thematic resonance, non-linear.',
    dialogue: 'each storyline keeps its own register and idiom',
    structure: 'multiple interwoven storylines that rhyme thematically; non-linear cross-cutting; convergence held to late',
    voice: 'cool, patterned, thematically driven; coincidence and consequence',
    visual: 'match-cuts and recurring motifs that bridge strands',
    scene: 'scenes turn on resonance with a parallel strand; meaning accrues across the mosaic',
    bestFor: ['any'],
  },
  {
    id: 'noir-voice', label: 'Hardboiled Noir Voice', ar: 'صوت النوار القاسي',
    blurb: 'Terse, fatalistic, shadow-and-rain imagery.',
    dialogue: 'terse, clipped, loaded with menace and wit; fatalistic one-liners',
    structure: 'an investigation or a descent; selective flashbacks; a reckoning that was always coming',
    voice: 'cynical, fatalistic, morally grey; optional spare first-person narration (a few lines, never wall-to-wall)',
    visual: 'shadow, rain, neon, venetian-blind light; night cities',
    scene: 'scenes turn on a lie exposed, a deal soured, a trap closing',
    bestFor: ['any'],
  },
  {
    id: 'genre-pastiche', label: 'Genre-Pastiche Nonlinear', ar: 'مزيج أنواع غير خطي',
    blurb: 'Chaptered, tonal whiplash, stylized framing.',
    dialogue: 'pop-culture-savvy, digressive, quotable; long riffs before sudden action',
    structure: 'chaptered and out-of-order; cold opens; abrupt tonal shifts',
    voice: 'playful, referential, knowing; tension between banter and brutality',
    visual: 'stylised framing, chapter titles, implied needle-drops',
    scene: 'scenes turn on a long simmer broken by a spike — talk that detonates',
    bestFor: ['any'],
  },
  {
    id: 'maximalist-spectacle', label: 'Maximalist Spectacle', ar: 'مشهدية فخمة',
    blurb: 'Operatic set-pieces, escalating scale.',
    dialogue: 'economical and punchy, in service of motion; lines between set-pieces',
    structure: 'escalating set-pieces, each bigger than the last; momentum over rest',
    voice: 'bold, operatic, sensation-forward',
    visual: 'huge scale; kinetic action written vividly so the page feels loud',
    scene: 'scenes turn on a physical reversal — a chase, a fight, a disaster beat',
    bestFor: ['any'],
  },
  {
    id: 'deadpan-absurd', label: 'Deadpan Absurd', ar: 'عبث بوجهٍ جامد',
    blurb: 'Flat affect, symmetrical framing, dry comedy.',
    dialogue: 'flat affect, literal, formal politeness over absurd circumstances; comic understatement',
    structure: 'symmetrical, chaptered, tableau-like; deliberate pacing',
    voice: 'dry, melancholic-comic, precise',
    visual: 'composed, symmetrical, frontal framing; meticulous detail in the action lines',
    scene: 'scenes turn on a deadpan collision of order and chaos',
    bestFor: ['any'],
  },
  {
    id: 'verite-handheld', label: 'Vérité Handheld', ar: 'واقعية محمولة',
    blurb: 'Documentary feel, improvisational rhythm, immediate.',
    dialogue: 'improvisational rhythm; overlaps and unfinished thoughts; documentary immediacy',
    structure: 'loose, present-tense, follow-the-character; ellipses over neat transitions',
    voice: 'immediate, unvarnished, urgent',
    visual: 'handheld and reactive; we discover with the camera',
    scene: 'scenes turn on lived process and incident, not plot machinery',
    bestFor: ['any'],
  },
  {
    id: 'lyrical-memory', label: 'Lyrical Memory', ar: 'ذاكرة شاعرية',
    blurb: 'Poetic, time-fluid, voiceover-driven, elegiac.',
    dialogue: 'spare, poetic, elliptical; elegiac voiceover allowed but sparing',
    structure: 'time-fluid; memory and present interleaved; associative rather than causal',
    voice: 'elegiac, sensory, interior',
    visual: 'light, texture, the sensory image; time rendered as mood',
    scene: 'scenes turn on a remembered sensation or an emotional echo',
    bestFor: ['any'],
  },
  {
    id: 'chamber-intimate', label: 'Chamber Intimacy', ar: 'حميمية الغرفة المغلقة',
    blurb: 'Few characters, one space, pressure-cooker.',
    dialogue: 'dense, layered, interpersonal; pressure rising in a confined space',
    structure: 'few locations in near real-time; unity of place; a pressure-cooker',
    voice: 'intense, character-forward, theatrical-adjacent',
    visual: 'close and contained; the room itself is a character',
    scene: 'scenes turn on shifting alliances and revelations among a small group',
    bestFor: ['any'],
  },
  {
    id: 'bingeable-cliff', label: 'Bingeable Cliff-Engine', ar: 'محرّك تشويق متسلسل',
    blurb: 'Chapter-end hooks, propulsive, reveal-laden — for episodic.',
    dialogue: 'hooky, propulsive, reveal-laden',
    structure: 'every episode/chapter ends on a turn or cliffhanger; cold-open hooks; planted questions paid off late',
    voice: 'momentum-first, addictive',
    visual: 'button shots that end on a face or a turn',
    scene: 'scenes turn on a reveal or a fresh question — never let a chapter rest closed',
    bestFor: ['SERIES', 'VERTICAL'],
  },
  {
    id: 'punchy-spot', label: 'Punchy Single-Idea Spot', ar: 'إعلان بفكرة واحدة',
    blurb: 'One idea, set-up to logo — for commercials.',
    dialogue: 'minimal; one line that lands, or none',
    structure: 'a single idea: set-up → escalation → turn → logo; every second earns its place',
    voice: 'sharp, memorable, one clear feeling',
    visual: 'one strong visual idea carried to the end',
    scene: 'the whole piece turns on a single reveal or payoff',
    bestFor: ['TVC'],
  },
  {
    id: 'investigative-build', label: 'Investigative Build', ar: 'بناء استقصائي',
    blurb: 'Evidence-led, escalating revelations — for documentary.',
    dialogue: 'interview-led; the question implied by the answer; archival voice',
    structure: 'evidence-led: question → investigation → escalating revelations → reckoning; chaptered by lead',
    voice: 'rigorous; withholds then discloses; earned outrage',
    visual: 'documents, talking heads and reconstructions (implied in the writing)',
    scene: 'scenes turn on a new piece of evidence shifting the picture',
    bestFor: ['DOCUMENTARY'],
  },
];

const lc = (v: any) => String(v == null ? '' : v).trim().toLowerCase();

/** Chosen pack ids (from the intake "Style & Voice" band). Opt-in: empty → no steering. */
export function chosenStyleIds(brief: any): string[] {
  const raw = (brief && (brief.styles || brief.stylePacks)) || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((x: any) => lc(x)).filter(Boolean)
    .map((v: string) => { const p = STYLE_PACKS.find((x) => x.id === v || lc(x.label) === v); return p ? p.id : ''; })
    .filter(Boolean);
}

function strengthFor(brief: any, id: string): number {
  const mix = (brief && brief.styleMix) || {};
  const v = mix[id];
  const n = typeof v === 'number' ? v : (v && typeof v.s === 'number' ? v.s : 2);
  return Math.max(0, Math.min(4, Number.isFinite(n) ? n : 2));
}

/** The craft-style steering directive — only when styles are chosen. Shapes HOW, never WHAT. */
export function styleDirective(brief: any): string {
  const ids = chosenStyleIds(brief);
  if (!ids.length) return '';
  const bits: string[] = ['VOICE & CRAFT STYLE — shape HOW the script is written (texture, rhythm, assembly), NOT what it is about:'];
  ids.slice(0, 2).forEach((id) => {
    const p = STYLE_PACKS.find((x) => x.id === id);
    if (!p) return;
    const s = strengthFor(brief, id);
    const apply = s <= 1 ? 'apply as a subtle flavour' : s === 2 ? 'apply as a balanced, present voice' : 'apply as the DEFINING signature of the writing';
    bits.push('• ' + p.label + ' — ' + apply + '. Dialogue: ' + p.dialogue + '. Structure: ' + p.structure + '. Voice/tone: ' + p.voice + '. Visual grammar (in action lines): ' + p.visual + '. Scene construction: ' + p.scene + '.');
  });
  if (ids.length >= 2) bits.push('Blend the two voices into ONE coherent signature — do not alternate jarringly.');
  bits.push('This steers craft only. Never change the plot, characters, setting, facts, era, conflict or lore to fit the style.');
  return bits.join(' ');
}

/** Compact summary for UI/debug. */
export function styleSummary(brief: any): string {
  const ids = chosenStyleIds(brief);
  if (!ids.length) return '';
  return ids.map((id) => (STYLE_PACKS.find((x) => x.id === id) || ({} as any)).label).filter(Boolean).join(' + ');
}
