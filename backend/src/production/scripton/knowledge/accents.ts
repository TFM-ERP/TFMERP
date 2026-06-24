/**
 * ScripON knowledge · ACCENTS & DIGLOSSIA (beyond Arabic)
 * ------------------------------------------------------
 * Accents are written with IDIOM + GRAMMAR + a capitalized parenthetical — never phonetic
 * "eye-dialect." Two independent knobs: horizontal (where they're from) and vertical (register /
 * class / diglossia). Extends the existing Arabic dialect engine to other languages.
 * Guideline + sources: docs/knowledge-base/scripon/04-country-era-language.md
 */

/** The non-negotiable craft model — included in every accent directive. */
export const ACCENT_MODEL = [
  'Write accent through word choice, idiom and grammar — plus a capitalized parenthetical (e.g. (Cockney)) on first significant use.',
  'NEVER phonetic eye-dialect ("\'ello guv\'nor", "wha\' chu doin\'") — it is unreadable and patronising. Rhythm and vocabulary carry it.',
  'Two knobs: horizontal = regional dialect (where they\'re from); vertical = register/class/formality (the diglossia or code-switch within a scene).',
];

export interface Accent {
  id: string;
  label: string;
  language: string;
  idiom: string;
  parenthetical: string;
  cautions?: string;
}

export const ACCENTS: Accent[] = [
  { id: 'rp', label: 'Received Pronunciation', language: 'English', idiom: 'measured, understated, Latinate vocabulary', parenthetical: '(RP)' },
  { id: 'cockney', label: 'Cockney', language: 'English', idiom: 'rhyming slang sparingly, "innit", dropped articles in rhythm', parenthetical: '(Cockney)', cautions: 'rhythm, not apostrophes' },
  { id: 'glaswegian', label: 'Glaswegian', language: 'English', idiom: '"wee", "aye", "ken", Scots word order', parenthetical: '(Glaswegian)' },
  { id: 'hiberno', label: 'Hiberno-Irish', language: 'English', idiom: '"after doing" perfect, "grand", "yer man"', parenthetical: '(Irish)' },
  { id: 'us-southern', label: 'US Southern', language: 'English', idiom: '"y\'all", "fixin\' to", "might could" (double modal)', parenthetical: '(Southern US)' },
  { id: 'aave', label: 'African-American Vernacular English', language: 'English', idiom: 'rule-governed grammar, not "errors"', parenthetical: '(AAVE)', cautions: 'Habitual "be" marks RECURRING action only ("she be working" = regularly), NOT one-time. Use sparingly and accurately; never as caricature.' },
  { id: 'castilian', label: 'Castilian Spanish', language: 'Spanish', idiom: 'distinción (/θ/ for c/z), "vosotros", peninsular slang', parenthetical: '(Castilian)' },
  { id: 'rioplatense', label: 'Rioplatense Spanish', language: 'Spanish', idiom: 'voseo ("vos tenés"), "che", Italian-tinged intonation', parenthetical: '(Rioplatense)', cautions: 'voseo conjugation differs from tú: tenés/podés/querés' },
  { id: 'mexican', label: 'Mexican Spanish', language: 'Spanish', idiom: 'seseo, "ustedes" only, "órale", "ahorita", Nahuatl loans (cuate, chamba)', parenthetical: '(Mexican)', cautions: 'false friends across Spanishes (e.g. "guagua" = bus in Caribbean, baby in Andes)' },
  { id: 'kansai', label: 'Kansai-ben', language: 'Japanese', idiom: '"-hen" negation, "akan", "honma", "ookini"', parenthetical: '(Kansai)', cautions: 'reads as warm/comic vs Tokyo standard; keigo still encodes hierarchy' },
];

const lc = (v: any) => String(v == null ? '' : v).trim().toLowerCase();
const arr = (v: any): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : v ? [String(v)] : []);

/** Resolve any requested accents from the brief (accents[]/voice hints). Arabic is handled by the dedicated dialect engine. */
export function pickAccents(brief: any): Accent[] {
  const hay = lc([arr(brief && brief.accents).join(' '), brief && brief.voice, brief && brief.dialect, brief && brief.country, brief && brief.market].filter(Boolean).join(' '));
  if (!hay) return [];
  return ACCENTS.filter((a) => hay.includes(a.id) || hay.includes(lc(a.label.split(' ')[0])) || hay.includes(lc(a.parenthetical.replace(/[()]/g, ''))));
}

/** The accent steering directive — only emitted for non-Arabic builds that requested an accent. */
export function accentDirective(brief: any): string {
  if (lc(brief && brief.language) === 'arabic' || lc(brief && brief.language) === 'ar') return ''; // Arabic dialect engine owns this
  const picks = pickAccents(brief);
  if (!picks.length) return '';
  const parts: string[] = ['ACCENT & REGISTER:'];
  for (const m of ACCENT_MODEL) parts.push('· ' + m);
  for (const a of picks) parts.push('· ' + a.label + ' ' + a.parenthetical + ' — ' + a.idiom + (a.cautions ? '. Caution: ' + a.cautions : '') + '.');
  return parts.join('\n  ');
}
