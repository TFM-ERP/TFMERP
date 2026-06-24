/**
 * ScripON knowledge · GENRE TAXONOMY
 * ----------------------------------
 * Single source of truth for the creative-DNA vocabulary used by both the Adapt/Build intake
 * UI and the generation steering. Guideline: docs/knowledge-base/scripon/00-format-engine.md
 *
 * Design: base genre is a single noun; everything else (subgenre, blend, tone, mood, treatment)
 * layers on top. Keep these lists curated — they drive what the writer is told to honour.
 */

export interface GenreDef { id: string; label: string; ar?: string; subgenres: string[]; }

/** The base genre — pick ONE. The noun the story is. */
export const BASE_GENRES: GenreDef[] = [
  { id: 'action', label: 'Action', ar: 'أكشن', subgenres: ['Spy', 'Heist', 'Martial arts', 'Disaster', 'Survival', 'Military'] },
  { id: 'adventure', label: 'Adventure', ar: 'مغامرة', subgenres: ['Quest', 'Swashbuckler', 'Lost world', 'Treasure hunt'] },
  { id: 'comedy', label: 'Comedy', ar: 'كوميديا', subgenres: ['Rom-com', 'Satire', 'Farce', 'Black comedy', 'Buddy', 'Mockumentary', 'Sitcom'] },
  { id: 'crime', label: 'Crime', ar: 'جريمة', subgenres: ['Heist', 'Mob/organised', 'Procedural', 'Caper', 'Noir', 'Courtroom'] },
  { id: 'drama', label: 'Drama', ar: 'دراما', subgenres: ['Family', 'Social-realist', 'Coming-of-age', 'Melodrama', 'Legal', 'Medical', 'Political'] },
  { id: 'fantasy', label: 'Fantasy', ar: 'فانتازيا', subgenres: ['High/epic', 'Urban', 'Fairy-tale', 'Sword & sorcery', 'Mythic', 'Portal'] },
  { id: 'historical', label: 'Historical', ar: 'تاريخي', subgenres: ['Epic/period', 'Biopic', 'War', 'Costume', 'Alt-history'] },
  { id: 'horror', label: 'Horror', ar: 'رعب', subgenres: ['Supernatural', 'Slasher', 'Psychological', 'Folk', 'Body', 'Found-footage'] },
  { id: 'musical', label: 'Musical', ar: 'موسيقي', subgenres: ['Book musical', 'Jukebox', 'Backstage', 'Dance'] },
  { id: 'mystery', label: 'Mystery', ar: 'غموض', subgenres: ['Whodunit', 'Cozy', 'Hardboiled', 'Conspiracy', 'Cold-case'] },
  { id: 'romance', label: 'Romance', ar: 'رومانسي', subgenres: ['Rom-com', 'Period romance', 'Forbidden', 'Second-chance', 'Tragic'] },
  { id: 'scifi', label: 'Sci-Fi', ar: 'خيال علمي', subgenres: ['Space opera', 'Cyberpunk', 'Dystopian', 'Time travel', 'First contact', 'Hard SF'] },
  { id: 'thriller', label: 'Thriller', ar: 'إثارة', subgenres: ['Psychological', 'Techno', 'Political', 'Legal', 'Espionage', 'Domestic'] },
  { id: 'war', label: 'War', ar: 'حرب', subgenres: ['Combat', 'Home-front', 'Resistance', 'POW', 'Anti-war'] },
  { id: 'western', label: 'Western', ar: 'غربي', subgenres: ['Classic', 'Revisionist', 'Spaghetti', 'Acid', 'Neo-western'] },
];

/** Optional layers stacked on the base — pick any. The "and also…" of the genre. */
export const BLEND_LAYERS: { id: string; label: string; ar?: string }[] = [
  { id: 'war', label: 'War', ar: 'حرب' },
  { id: 'romance', label: 'Romance', ar: 'رومانسي' },
  { id: 'fantasy', label: 'Fantasy', ar: 'فانتازيا' },
  { id: 'noir', label: 'Noir', ar: 'نوار' },
  { id: 'satire', label: 'Satire', ar: 'سخرية' },
  { id: 'mystery', label: 'Mystery', ar: 'غموض' },
  { id: 'coming-of-age', label: 'Coming-of-age', ar: 'بلوغ' },
  { id: 'political', label: 'Political', ar: 'سياسي' },
  { id: 'supernatural', label: 'Supernatural', ar: 'خارق' },
  { id: 'survival', label: 'Survival', ar: 'نجاة' },
];

/** Tone = the authorial attitude. Pick a few. */
export const TONES: { id: string; label: string; ar?: string }[] = [
  { id: 'epic', label: 'Epic', ar: 'ملحمي' },
  { id: 'grounded', label: 'Grounded', ar: 'واقعي' },
  { id: 'tragic', label: 'Tragic', ar: 'مأساوي' },
  { id: 'ironic', label: 'Ironic', ar: 'ساخر' },
  { id: 'comic', label: 'Comic', ar: 'كوميدي' },
  { id: 'romantic', label: 'Romantic', ar: 'رومانسي' },
  { id: 'satirical', label: 'Satirical', ar: 'تهكمي' },
  { id: 'pulpy', label: 'Pulpy', ar: 'مثير' },
  { id: 'lyrical', label: 'Lyrical', ar: 'شاعري' },
];

/** Mood = the felt atmosphere the audience sits in. */
export const MOODS: { id: string; label: string; ar?: string }[] = [
  { id: 'foreboding', label: 'Foreboding', ar: 'منذر' },
  { id: 'bittersweet', label: 'Bittersweet', ar: 'حلو مرّ' },
  { id: 'hopeful', label: 'Hopeful', ar: 'مفعم بالأمل' },
  { id: 'tense', label: 'Tense', ar: 'متوتر' },
  { id: 'melancholic', label: 'Melancholic', ar: 'كئيب' },
  { id: 'whimsical', label: 'Whimsical', ar: 'غريب الأطوار' },
  { id: 'dread', label: 'Dread', ar: 'رهبة' },
  { id: 'warm', label: 'Warm', ar: 'دافئ' },
];

/** Treatment = the narrative method / form. */
export const TREATMENTS: { id: string; label: string; ar?: string }[] = [
  { id: 'linear', label: 'Linear', ar: 'خطي' },
  { id: 'nonlinear', label: 'Non-linear', ar: 'غير خطي' },
  { id: 'multi-pov', label: 'Multi-POV', ar: 'وجهات نظر متعددة' },
  { id: 'frame', label: 'Frame / story-within', ar: 'إطار قصصي' },
  { id: 'anthology', label: 'Anthology', ar: 'مجموعة قصص' },
  { id: 'real-time', label: 'Real-time', ar: 'زمن حقيقي' },
  { id: 'epistolary', label: 'Epistolary / found', ar: 'وثائقي/مكتوب' },
  { id: 'unreliable', label: 'Unreliable narrator', ar: 'راوٍ غير موثوق' },
];

const lc = (v: any) => String(v == null ? '' : v).trim().toLowerCase();
const arr = (v: any): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : v ? [String(v)] : []);

/** Resolve the chosen base genre's subgenre list (for the intake UI's dependent dropdown). */
export function subgenresFor(baseId: string): string[] {
  const g = BASE_GENRES.find((x) => x.id === lc(baseId) || lc(x.label) === lc(baseId));
  return g ? g.subgenres : [];
}

/**
 * A compact, plain-text statement of the creative DNA for the steering channel.
 * Reads from several possible brief shapes (dedicated fields or the legacy genres[] array).
 */
export function genreDirective(brief: any): string {
  if (!brief) return '';
  const base = brief.baseGenre || (arr(brief.genres)[0] || '');
  const sub = brief.subgenre || '';
  const blends = arr(brief.blendLayers).length ? arr(brief.blendLayers) : arr(brief.genres).slice(1);
  const tones = arr(brief.tones).length ? arr(brief.tones) : (brief.tone ? [brief.tone] : []);
  const moods = arr(brief.moods).length ? arr(brief.moods) : (brief.mood ? [brief.mood] : []);
  const treat = brief.treatment || '';
  const bits: string[] = [];
  if (base) bits.push('Base genre: ' + base + (sub ? ' (' + sub + ')' : ''));
  if (blends.length) bits.push('blended with ' + blends.join(', '));
  if (tones.length) bits.push('tone ' + tones.join('/'));
  if (moods.length) bits.push('mood ' + moods.join('/'));
  if (treat) bits.push('treatment ' + treat);
  return bits.length ? 'Creative DNA: ' + bits.join('; ') + '. Honour this blend consistently across every stage.' : '';
}
