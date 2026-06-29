/**
 * ScripON knowledge · COMPOSER
 * ----------------------------
 * One import surface for the generator. The two consumption entry points the service uses:
 *   - stageLadderFor(brief)      → which develop stages exist (replaces the fixed STAGE_ORDER)
 *   - knowledgeDirective(brief)  → plain-text steering appended inside intakeSteer()
 *
 * Both are pure functions of the brief and fail safe. Guideline index:
 * docs/knowledge-base/scripon/README.md
 */

import { formatDirective, pickPreset, normalizeFamily } from './formats';
import { verticalDirective } from './vertical';
import { documentaryDirective } from './documentary';
import { eraDirective } from './eras';
import { accentDirective } from './accents';
import { conflictDirective } from './conflicts';
import { styleDirective } from './styles';

export * from './formats';
export * from './vertical';
export * from './documentary';
export * from './eras';
export * from './accents';
export * from './genres';
export * from './conflicts';
export * from './styles';

const lc = (v: any) => String(v == null ? '' : v).trim().toLowerCase();

/** Based-on-reality fidelity → guidance for the character build. Guideline: 05-real-person-brief.md */
export function realPersonDirective(brief: any): string {
  if (!brief || !brief.realBased) return '';
  const level = String(brief.realityLevel || 'INSPIRED').toUpperCase();
  const map: Record<string, string> = {
    FAITHFUL: 'FAITHFUL — stay true to the documented record; invent only to bridge gaps, never to contradict known facts.',
    INSPIRED: 'INSPIRED-BY — keep the essence, themes and key turning points; freely dramatise specifics, names and scenes.',
    LOOSE: 'LOOSELY based — use the real story only as a springboard; the work is fiction.',
  };
  const amt = brief.researchAmount != null ? Number(brief.researchAmount) : 50;
  const detail = amt >= 70 ? 'Lean on documented detail (dates, places, real relationships).' : amt <= 30 ? 'Keep only the essence; minimal documented detail.' : 'Balance documented truth with dramatic invention.';
  const bits = ['REAL-PERSON / TRUE-STORY fidelity: ' + (map[level] || map.INSPIRED), detail];
  if (brief.researchSubject) bits.push('Research the real subject to ground the character build (kept separate from the dramatised story).');
  if (brief.realPersonNote) bits.push('About the real subject/story (honour these specifics): ' + String(brief.realPersonNote).slice(0, 1200) + '.');
  bits.push('Carry the chosen fidelity into the character breakdown so the real person is honoured at this level.');
  return bits.join(' ');
}

/** Catalog of AI-video visual styles offered before generation (market-standard, 2026). The chosen
 *  style is woven into every shot's prompt + color_style so the whole series renders in one look. */
export const VIDEO_STYLES: { id: string; label: string; look: string }[] = [
  { id: 'cinematic', label: 'Cinematic (photoreal)', look: 'hyper-realistic live-action cinema; natural skin, real-world physics, anamorphic lensing, filmic colour grade and fine grain' },
  { id: 'anime', label: 'Anime', look: '2D Japanese anime; cel-shaded, expressive eyes and heightened emotion, clean line art, vibrant flat colour with dramatic lighting' },
  { id: 'pixar3d', label: '3D / Pixar', look: 'stylised 3D CGI animation (Pixar/DreamWorks look); soft global illumination, rounded appealing character design, subsurface skin' },
  { id: 'comic', label: 'Motion comic', look: 'motion-comic / graphic-novel look; bold ink outlines, halftone shading, high-contrast cel colour' },
  { id: 'claymation', label: 'Claymation', look: 'stop-motion claymation; tactile fingerprinted clay surfaces, handmade sets, slightly stepped motion' },
  { id: 'watercolor', label: 'Watercolour', look: 'painterly watercolour animation; soft bleeding edges, paper texture, muted washes' },
  { id: 'cyberpunk', label: 'Cyberpunk neon', look: 'cyberpunk neon-noir; rain-slick reflections, saturated magenta/cyan neon, volumetric haze, high contrast' },
  { id: 'inkwash', label: 'Ink wash', look: 'East-Asian ink-wash (sumi-e); monochrome brushwork, generous negative space, flowing calligraphic motion' },
];

export function videoStyleDirective(styleId: string): string {
  const s = VIDEO_STYLES.find((x) => x.id === String(styleId || '').toLowerCase()) || VIDEO_STYLES[0];
  return `VISUAL STYLE — render EVERY scene consistently in: ${s.label} — ${s.look}. Put this look in each shot's color_style and weave it into the prompt; keep it identical across all episodes and scenes.`;
}

/** AI-video pipeline rules — strict, model-facing steering for the vertical text-to-video build. */
export function videoDirective(brief: any): string {
  const dur = brief && brief.durationSec ? Number(brief.durationSec) : 5;
  const ratio = (brief && brief.aspectRatio) || '9:16';
  const neg = (brief && brief.negativePrompt) || 'blurry, deformed, text';
  return [
    `FORMAT CRITICAL: vertical AI video — each SCENE is at most ${dur} seconds. ASPECT RATIO: ${ratio}. NEGATIVE PROMPTS: Avoid: ${neg}.`,
    videoStyleDirective((brief && (brief.videoStyle || brief.style)) || 'cinematic'),
    'RULE 1: No abstract concepts. Describe observable, physical motion only.',
    'RULE 2: Strict character consistency. Use exact physical tags for characters across all shots.',
    'RULE 3: Each shot must contain only ONE primary action.',
  ].join(' ');
}

/**
 * THE composed steering block. Adds the structural/format depth, the vertical/documentary
 * engines, the era language substrate, accents and real-person fidelity. Intentionally does
 * NOT re-emit the plain genre/target lines that intakeSteer already produces (no duplication).
 */
export function knowledgeDirective(brief: any): string {
  if (!brief) return '';
  const fam = normalizeFamily(brief);
  const parts: string[] = [];
  parts.push(formatDirective(brief));
  if (fam === 'VERTICAL_AI_VIDEO') parts.push(videoDirective(brief));
  if (fam === 'VERTICAL') parts.push(verticalDirective(brief));
  if (fam === 'DOCUMENTARY') parts.push(documentaryDirective(brief));
  const era = eraDirective(brief); if (era) parts.push(era);
  const acc = accentDirective(brief); if (acc) parts.push(acc);
  const real = realPersonDirective(brief); if (real) parts.push(real);
  const conf = conflictDirective(brief); if (conf) parts.push(conf);
  const sty = styleDirective(brief); if (sty) parts.push(sty);
  return parts.filter(Boolean).join('\n');
}

/** Convenience for callers/UX: a one-line human summary of the resolved format. */
export function formatSummary(brief: any): string {
  const p = pickPreset(brief);
  const ep = p.episodes == null ? '' : (Array.isArray(p.episodes) ? p.episodes[0] + '–' + p.episodes[1] + ' eps · ' : (p.episodes === 1 ? '' : p.episodes + ' eps · '));
  return p.label + ' · ' + ep + p.lengthLabel;
}
