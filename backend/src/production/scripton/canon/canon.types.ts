/** Canon type: subject categories (CHARACTER, LOCATION, OBJECT, CONCEPT, etc.) */
export type CanonKind = 'CHARACTER' | 'LOCATION' | 'OBJECT' | 'CONCEPT' | 'EVENT';

/** Canon conflict reason: why two facts can't coexist in the same validity window */
export type CanonConflict = 'TEMPORAL' | 'RETCON' | 'AMBIGUOUS' | 'CORRECTED';

/** Core fact in the canon (story-memory graph).
 *  Bi-temporal: what is true (validFrom..validTo) and when we learned it (recordedAt).
 */
export interface CanonFactCore {
  /** Type of entity being described */
  kind: CanonKind;

  /** What is being described (e.g., "MARIAM") */
  subject: string;

  /** Property being asserted (e.g., "status") */
  predicate: string;

  /** The value (e.g., "alive") */
  object: string;

  /** Human-readable narrative (for author reference) */
  statement: string;

  /** Story order: when this fact begins to be true */
  validFrom: number;

  /** Story order: when this fact stops being true (null = forever) */
  validTo: number | null;

  /** ACTIVE or SUPERSEDED — marks whether this fact is in the current canon */
  status: 'ACTIVE' | 'SUPERSEDED';

  /** When (in real time / event order) this fact was recorded/amended */
  recordedAt: number;
}
