/**
 * Canon (story-memory) graph — shared types. The contract every canon task imports.
 * Bi-temporal: when a fact is true in the story (validFrom..validTo) and when it was
 * recorded (recordedAt). predicate/object are the structured pair that powers deterministic
 * conflict detection; statement is the human-readable form.
 */
/**
 * WHY THERE ARE TWO GROUPS HERE.
 *
 * The first six are BIOGRAPHY: who someone is, what they are called, when things happened. Measured
 * on a real extraction, 28 of 30 slots came back biography — because that is all the prompt asked
 * for — and four sentences the source states outright reached nothing at all:
 *
 *   "Gideon is the operational antagonist. Alexander is the deepest personal betrayal."
 *   "Alexander permitted the exceptional routes... Gideon expanded the operation."
 *   "Gideon runs a concealed labor-trafficking operation."
 *   "Resolve the major father-son confrontation before the terminal climax."
 *
 * None of them is a fact about a person. They are structure, and the schema had no slot for
 * structure, so raising the fact cap only ever bought more ages.
 *
 * PROHIBITION is the one that changes shape rather than adding a row. "Do not rename the hero" is
 * not a fact about the story at all — it is a rule about the output — so it must never render in a
 * list of things that are true. See prohibitionDirective().
 */
export type CanonKind =
  // Biography — who and what and when.
  | 'CHARACTER' | 'WORLD' | 'LORE' | 'TIMELINE' | 'RELATIONSHIP' | 'PLOT'
  // Structure — the shape of the story, which biography cannot express.
  | 'ROLE'        // narrative FUNCTION, not job title: antagonist, betrayer, protagonist.
  | 'CRIME'       // what the crime IS, versus what merely serves it.
  | 'CAUSATION'   // authorised / permitted / expanded / executed — deliberately different verbs.
  | 'OUTCOME'     // who lives, who dies, who is delivered to whom.
  | 'ORDERING'    // what must occur before what.
  | 'PROHIBITION' // an explicit "do not" / "never" — a CONSTRAINT, not a fact.
  // Transcribed, not extracted — a line of the source's own rule register, verbatim. Only
  // transcribeRegister() mints one; it is deliberately absent from the model's kind whitelist, so a
  // model fact claiming to be REGISTER collapses to PLOT rather than passing as the author's words.
  | 'REGISTER';

/** The structural kinds, which get guaranteed slots so biography cannot crowd them out. */
export const STRUCTURAL_KINDS: CanonKind[] = ['ROLE', 'CRIME', 'CAUSATION', 'OUTCOME', 'ORDERING', 'PROHIBITION'];

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
  /**
   * WHERE IN THE SOURCE THIS FACT WAS FOUND — provenance, not a gate.
   *
   * The prohibition count read 23, then 20, then 22 across identical runs of the same bible, so it
   * could never answer whether the sections beyond the old 60,000-character slice were reaching the
   * canon. The offset and section answer it per build, without a script and without a model call.
   *
   * null means NOT LOCATED, never "not in the source": a paraphrase leaves nothing to find, and a
   * fact that could not be located is a finding to read, not one to drop.
   */
  sourceOffset?: number | null;
  sourceSection?: string | null;
  /** 'located' | 'synthesis' | 'unlocated'. A synthesis has no single offset and is NOT a miss. */
  sourceProvenance?: 'located' | 'synthesis' | 'unlocated';

  id?: string;
}

export interface CanonConflict {
  a: CanonFactCore;
  b: CanonFactCore;
  reason: string;
}
