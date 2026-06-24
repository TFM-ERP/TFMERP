/**
 * ScripON knowledge · VERTICAL MICRO-DRAMA
 * ----------------------------------------
 * The craft of 60–90s vertical episodes. Global engine + the MENA Verticals model.
 * Guideline + sources: docs/knowledge-base/scripon/01-vertical-microdrama.md
 */

/** Per-episode Beat Engine — the spine every vertical episode is built on. */
export const BEAT_ENGINE = [
  { id: 'hook', at: '0:00–0:15', name: 'Hook', rule: 'Detonate in the first 15 seconds — the "explosion point." Open after the problem has already begun.' },
  { id: 'friction', at: '0:15–1:00', name: 'Friction', rule: 'A filmable, external conflict — not subtext. Something the camera can see.' },
  { id: 'spike', at: '~1:00', name: 'Spike', rule: 'The jolt that re-prices everything before it (a reveal, a reversal, a betrayal).' },
  { id: 'button', at: '~0:55–1:08', name: 'Button', rule: 'Cut on the question, not the answer. Mandatory cliffhanger — never resolve the episode.' },
];

/** Reversal engine — concrete, public, escalating. */
export const REVERSAL_ENGINE = {
  shock: 'Concrete evidence — a text, a bank transfer, a second name on a will. Not a feeling.',
  hurt: 'The artifacts of the shock land on the protagonist.',
  release: 'The payoff happens in PUBLIC — a witnessed confrontation, not a private cry.',
};

/** Paywall economics — write backwards from the wall. */
export const PAYWALL = {
  freeBlock: 'Episodes 1–~10 must form one complete emotional argument that earns the unlock.',
  rule: 'Map the series BACKWARDS from the paywall; land a major reveal 1–2 episodes AFTER it.',
  peaks: 'Cliffhanger by end of E1; re-price the premise around E5; collide two secrets around E10.',
};

/** 9:16 craft rules. */
export const NINE_SIXTEEN = [
  'Face-first framing — auto-expand reaction beats; the phone screen is a close-up medium.',
  'Props carry emotion (a phone, a ring, a document) more than wide set design.',
  'Avoid large ensembles and complex action blocking — they read as noise on a vertical phone screen.',
];

/** MENA — the 8 episode templates (MENA verticals). */
export const MENA_EPISODE_TEMPLATES = [
  { id: 'confrontation', en: 'Confrontation', ar: 'مواجهة' },
  { id: 'broken-confession', en: 'Broken confession', ar: 'اعتراف منكسر' },
  { id: 'secret-revealed', en: 'Secret revealed', ar: 'سرّ مكشوف' },
  { id: 'public-humiliation', en: 'Public humiliation', ar: 'إذلال علني' },
  { id: 'power-struggle', en: 'Power struggle', ar: 'صراع نفوذ' },
  { id: 'dangerous-arrival', en: 'Dangerous arrival', ar: 'وصول خطير' },
  { id: 'family-dinner-explosion', en: 'Family-dinner explosion', ar: 'انفجار مائدة العائلة' },
  { id: 'wedding-interruption', en: 'Wedding interruption', ar: 'مقاطعة زفاف' },
];

/** MENA — the 8 story engines (season-driving premises). */
export const MENA_STORY_ENGINES = [
  { id: 'contractual-surveillance', en: 'Contractual relationship under surveillance', ar: 'علاقة تعاقدية تحت المراقبة' },
  { id: 'reputation-collapse', en: 'Reputation collapse and rebuilding', ar: 'انهيار سمعة وإعادة بناء' },
  { id: 'institutional-subversion', en: 'Institutional subversion', ar: 'تقويض مؤسسة' },
  { id: 'women-vs-gatekeepers', en: 'Rise of women against gatekeepers', ar: 'صعود المرأة ضد الحُرّاس' },
  { id: 'inheritance-war', en: 'Inheritance war with a suspicious document', ar: 'حرب ميراث بوثيقة مشبوهة' },
  { id: 'forbidden-love-class', en: 'Forbidden love across class boundaries', ar: 'حب ممنوع عبر الطبقات' },
  { id: 'return-of-the-erased', en: 'Return of the erased person', ar: 'عودة الشخص المُمحى' },
  { id: 'social-ecosystem', en: 'Social ecosystem (ensemble)', ar: 'منظومة اجتماعية' },
];

/** The Addiction Loop — the retention rule that defines the format. */
export const ADDICTION_LOOP =
  'Every episode closes one small loop and opens another. Alternate "yes, but" and "no, also" turns every 2–3 episodes, each paying a REAL reward (a clue, a confession, an ally exposed, a tactical win) — never an empty tease.';

/** Golden production rules (MENA Verticals guide) — behaviour over set design. */
export const MENA_GOLDEN_RULES = [
  'Behaviour > set design — character action carries the world, not production value.',
  'Natural local dialogue — never stiff MSA in intimate scenes (see the dialect engine).',
  'Romance lives within real social constraints, not despite them.',
  'Honour the public/private distinction in MENA social space.',
  'Small specific details (a phone, a manner of speaking) anchor a specific social environment.',
];

const lc = (v: any) => String(v == null ? '' : v).trim().toLowerCase();

/** True when the brief is Arabic / MENA-targeted. */
function mena(brief: any): boolean {
  const hay = lc([brief && brief.market, brief && brief.country, brief && brief.language, brief && brief.region].filter(Boolean).join(' '));
  return /mena|gcc|ksa|saudi|uae|emirat|gulf|khaleej|arab|egypt|عرب|عربي/.test(hay) || lc(brief && brief.language) === 'arabic' || lc(brief && brief.language) === 'ar';
}

/** The vertical steering directive — appended when projectType is vertical. */
export function verticalDirective(brief: any): string {
  const parts: string[] = [];
  parts.push('VERTICAL MICRO-DRAMA RULES (honour every episode):');
  parts.push('· Beat Engine per episode — ' + BEAT_ENGINE.map((b) => b.name + ' (' + b.at + '): ' + b.rule).join('  '));
  parts.push('· Mandatory cliffhanger: cut on the question around 0:55–1:08; NEVER resolve an episode.');
  parts.push('· ' + ADDICTION_LOOP);
  parts.push('· Reversal engine — Shock (' + REVERSAL_ENGINE.shock + ') → Hurt → Release IN PUBLIC.');
  parts.push('· Paywall: ' + PAYWALL.rule + ' ' + PAYWALL.peaks);
  parts.push('· 9:16 framing — ' + NINE_SIXTEEN.join(' '));
  if (mena(brief)) {
    parts.push('MENA Verticals model (this build is Arabic/Gulf-targeted):');
    parts.push('· Arabic-first; dialogue colloquial and natural (action/narration in فصحى — see the dialect engine).');
    parts.push('· Each episode: a scenic objective + a power/info shift + emotional escalation + a final hook.');
    parts.push('· Draw the season engine from: ' + MENA_STORY_ENGINES.map((e) => e.en).join('; ') + '.');
    parts.push('· Vary episode shapes across the 8 templates: ' + MENA_EPISODE_TEMPLATES.map((t) => t.en).join(', ') + '.');
    parts.push('· ' + MENA_GOLDEN_RULES.join(' '));
    parts.push('· A structural transformation every 8–12 episodes; resolve the core promise before any ending.');
  } else {
    parts.push('· Tag-stack characters with an instantly readable trope (CEO, revenge, secret-heir) then complicate.');
  }
  return parts.join('\n  ');
}
