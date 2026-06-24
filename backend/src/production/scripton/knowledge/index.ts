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
