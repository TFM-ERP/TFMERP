/**
 * Canon (story-memory) graph — shared types. The contract every canon task imports.
 * Bi-temporal: when a fact is true in the story (validFrom..validTo) and when it was
 * recorded (recordedAt). predicate/object are the structured pair that powers deterministic
 * conflict detection; statement is the human-readable form.
 */
export type CanonKind = 'CHARACTER' | 'WORLD' | 'LORE' | 'TIMELINE' | 'RELATIONSHIP' | 'PLOT';

export interface CanonFactCore {
  kind: CanonKind;
  subject: string;          // canonical entity, upper-cased, e.g. "MARIAM"
  predicate: string;        // normalized relation, e.g. "status" | "alliance_with" | "location"
  object: string;           // value, e.g. "dead" | "KHALID" | "CAIRO"
  statement: string;        // human sentence, e.g. "Mariam is killed in the raid."
  validFrom: number;        // story-order index the fact becomes true
  validTo: number | null;   // null = still true at end of story
  status?: 'ACTIVE' | 'SUPERSEDED';
  recordedAt?: number;      // monotonically increasing write order (real-time tiebreak)
  sourceSceneId?: string | null;
  supersedesId?: string | null;
  id?: string;
}

export interface CanonConflict {
  a: CanonFactCore;
  b: CanonFactCore;
  reason: string;
}
