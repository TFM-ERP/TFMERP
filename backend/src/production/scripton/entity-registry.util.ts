/**
 * MECHANISM D · THE ENTITY REGISTRY AND THE STATE LEDGER
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * WHY THE CANON GRAPH COULD NOT CATCH ANY OF THIS.
 *
 * `CanonFactCore.subject` is a STRING — "canonical entity, upper-cased". So the subject *is* the
 * name, and `detectConflicts` compares subjects with `e.subject !== c.subject`. The moment a name
 * drifts, the graph sees two unrelated entities and reports, correctly and uselessly, no conflict.
 *
 * Every identity defect in the 1 Sep Jason Quick draft is that one line:
 *
 *   ALEXANDER QUICK / RICHARD QUICK   one father, two names, three sluglines
 *   ELIOT PARR / NEIL PRYOR           one rescued witness, two people
 *   RENATA OKONJO / REYES             one prosecutor, two names — and REYES is also a
 *                                     Quincy branch manager, so one name is two people
 *   VALE / GIDEON / GIDEON VALE       one antagonist, three speaking cues, 29 speeches split
 *   PRYOR / NEIL PRYOR                same person, two cues
 *   BRANN / BRANNIGAN                 same person, two cues
 *
 * And the contradiction none of them could ever reach, because it needs two scenes at once:
 *
 *   scene 83   "Alexander asked me to dinner. Sunday."      ALIVE
 *   scene 89   "He's ash in a Boston cemetery."             DEAD
 *   scene 127  "Alexander walks. You know that."            ALIVE
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FIX, AND WHY THE ID NEVER CHANGES EVEN WHEN THE NAME DOES
 *
 * The question this has to answer is the writer's: *the name has to be free to change, because
 * changing it is a creative decision, not a defect.* The resolution comes from bi-temporal graph
 * practice (Graphiti's model, and StableID's persistent-identifier work): **temporal validity lives
 * on the edges, not on the node.** A node carries only its creation. Everything else about it —
 * including what it is called — is a fact with a validity window.
 *
 * So renaming Alexander to Richard is not an identity change. It closes the alias
 * `ALEXANDER QUICK` at the scene where the rename takes effect and opens `RICHARD QUICK` from
 * there. The id `p1` is untouched, every scene that referenced it still references it, and both
 * names resolve to the same person forever after. Nothing downstream breaks, and the history of
 * what the character was called in draft three survives into draft nine.
 *
 * A merge works the same way and never deletes: the losing id is TOMBSTONED with `mergedInto`, so
 * a stale reference from an old revision still resolves to the surviving entity rather than
 * dangling. Ids are never reused.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THE RESEARCH SAYS IS WORTH LOCKING
 *
 * The ConStory taxonomy (Findings of ACL 2026) annotates 19 consistency-bug subtypes across five
 * dimensions and reports that **Factual & Detail Consistency and Timeline & Plot Logic are the
 * dominant failure modes** — which is exactly the shape of our audit. Two of its numbers decide
 * this module's design:
 *
 *   * Geographical contradictions have the LARGEST positional gap between the two contradicting
 *     statements — 31.0% of the document — and absolute-time errors 29.7%. Perspective errors
 *     cluster locally at 4.7%.
 *
 * A defect whose two halves sit a third of a screenplay apart cannot be caught by anything that
 * reads one scene, which is every check we had before this one. That is the entire argument for a
 * ledger: not that it is cleverer, but that it is the only thing in the pipeline holding both ends.
 *
 * The dimensions below are chosen to cover the subtypes that are DETERMINISTICALLY checkable once
 * identity is stable — life state, place, physical condition, knowledge, possession — and to leave
 * tone, style and social norms alone, because those need a reader.
 *
 * Pure functions. No Nest, no Prisma, no model. Detection contains no AI; repair is the only call.
 */

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY
// ─────────────────────────────────────────────────────────────────────────────

export type EntityKind = 'PERSON' | 'PLACE' | 'ORG' | 'VESSEL' | 'OBJECT' | 'TIME_ANCHOR';

/** How a surface form came to belong to an entity — kept for the audit trail, never for matching. */
export type AliasReason = 'INITIAL' | 'REGISTERED' | 'RENAME' | 'MERGE' | 'OBSERVED';

export interface EntityAlias {
  /** Normalised surface form. Matching is always on this, never on the raw text. */
  form: string;
  /** Story-order index from which this name is in force. 0 = from the opening. */
  validFrom: number;
  /** Story-order index at which it stops being in force. null = still current. */
  validTo: number | null;
  reason: AliasReason;
}

export interface Entity {
  /** IMMUTABLE. Assigned once, never rewritten, never reused — not even after a merge. */
  id: string;
  kind: EntityKind;
  aliases: EntityAlias[];
  /** Tombstone. Set when this entity was merged into another; it still resolves, forever. */
  mergedInto: string | null;
  /** Monotonic write order, for a deterministic tiebreak between two same-form registrations. */
  createdAt: number;
}

export interface EntityRegistry {
  entities: Map<string, Entity>;
  /** form -> entity ids that have ever carried it. A form may be ambiguous; resolution decides. */
  index: Map<string, string[]>;
  seq: number;
}

/**
 * The one normalisation every lookup passes through.
 *
 * Upper-cases, collapses whitespace, strips a possessive, strips cue suffixes and honorifics, and
 * drops surrounding punctuation. `Mr. Halloran?` and `HALLORAN (CONT'D)` and `Halloran's` all
 * become `HALLORAN` — which is how the registry noticed that Jason's cover name in scene 54 is the
 * surname of the security chief he fights in scene 128.
 */
export function normaliseForm(raw: any): string {
  let s = String(raw == null ? '' : raw);
  s = s.replace(/\((?:CONT'D|CONTD|O\.S\.|OS|V\.O\.|VO|OFF|PRE-?LAP)\)/gi, ' ');
  s = s.replace(/[""'']/g, "'");
  s = s.replace(/'S\b/gi, '');
  s = s.replace(/^\s*(MR|MRS|MS|MISS|DR|PROF|SGT|LT|CAPT|COL|GEN|DET|OFFICER|JUDGE|AUSA|SIR|MADAM)\.?\s+/i, '');
  s = s.replace(/[^\p{L}\p{N}\s\-]/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim().toUpperCase();
  return s;
}

export function createRegistry(): EntityRegistry {
  return { entities: new Map(), index: new Map(), seq: 0 };
}

function indexForm(reg: EntityRegistry, form: string, id: string): void {
  const cur = reg.index.get(form);
  if (!cur) reg.index.set(form, [id]);
  else if (cur.indexOf(id) < 0) cur.push(id);
}

/**
 * Register an entity, or return the one that already owns this name.
 *
 * `idHint` lets a caller supply a stable id from the database so a registry rebuilt on the next
 * run keeps the same identifiers. Without it ids are `<kindLetter><n>`, assigned in order.
 */
export function registerEntity(
  reg: EntityRegistry,
  kind: EntityKind,
  name: any,
  opts?: { at?: number; idHint?: string; reason?: AliasReason },
): string {
  const form = normaliseForm(name);
  if (!form) return '';
  const at = Math.max(0, Number(opts?.at) || 0);
  const existing = resolveEntity(reg, form, at, kind);
  if (existing) return existing;
  const n = ++reg.seq;
  const id = opts?.idHint || (kind.charAt(0).toLowerCase() + n);
  if (reg.entities.has(id)) {
    // An idHint collision must never silently merge two different people.
    return registerEntity(reg, kind, name, { ...opts, idHint: undefined });
  }
  reg.entities.set(id, {
    id,
    kind,
    aliases: [{ form, validFrom: at, validTo: null, reason: opts?.reason || 'INITIAL' }],
    mergedInto: null,
    createdAt: n,
  });
  indexForm(reg, form, id);
  return id;
}

/** Attach another surface form to an existing entity, in force from `at`. */
export function addAlias(reg: EntityRegistry, id: string, name: any, at = 0, reason: AliasReason = 'REGISTERED'): boolean {
  const e = reg.entities.get(id);
  const form = normaliseForm(name);
  if (!e || !form) return false;
  if (e.aliases.some((a) => a.form === form && a.validFrom <= at && (a.validTo == null || a.validTo > at))) return true;
  e.aliases.push({ form, validFrom: Math.max(0, at), validTo: null, reason });
  indexForm(reg, form, id);
  return true;
}

/**
 * A CREATIVE RENAME. The id does not move.
 *
 * The old name is closed at `at` and the new one opened there, so a scene before the rename still
 * resolves the old form and a scene after it resolves the new one — which is what makes a rename
 * mid-draft safe rather than a rewrite of history. Pass `at = 0` for "this character was always
 * called this; we were writing it wrong", which retires the old form entirely.
 */
export function renameEntity(reg: EntityRegistry, id: string, newName: any, at = 0): boolean {
  const e = reg.entities.get(id);
  const form = normaliseForm(newName);
  if (!e || !form) return false;
  const from = Math.max(0, at);
  for (const a of e.aliases) {
    if (a.form === form) continue;
    if (a.validTo == null || a.validTo > from) a.validTo = from;
  }
  e.aliases.push({ form, validFrom: from, validTo: null, reason: 'RENAME' });
  indexForm(reg, form, id);
  return true;
}

/**
 * Two names turned out to be one person. Nothing is deleted.
 *
 * The loser is tombstoned with `mergedInto`, and its every alias is copied onto the winner, so a
 * reference from any earlier revision still resolves. This is the operation that repairs
 * Parr/Pryor and Okonjo/Reyes without invalidating a single stored scene.
 */
export function mergeEntities(reg: EntityRegistry, loserId: string, winnerId: string): boolean {
  const loser = reg.entities.get(loserId);
  const winner = reg.entities.get(winnerId);
  if (!loser || !winner || loserId === winnerId) return false;
  if (loser.kind !== winner.kind) return false;
  for (const a of loser.aliases) {
    if (!winner.aliases.some((w) => w.form === a.form)) {
      winner.aliases.push({ ...a, reason: 'MERGE' });
    }
    indexForm(reg, a.form, winnerId);
  }
  loser.mergedInto = winnerId;
  return true;
}

/** Follow tombstones to the surviving entity. Loop-safe. */
export function livingId(reg: EntityRegistry, id: string): string {
  let cur = id;
  for (let hops = 0; hops < 16; hops++) {
    const e = reg.entities.get(cur);
    if (!e || !e.mergedInto) return cur;
    cur = e.mergedInto;
  }
  return cur;
}

/**
 * Which entity does this surface form mean at this point in the story?
 *
 * Exact form first. If the form is ambiguous — one name, several entities, which is the Reyes case
 * — the one whose alias window covers `at` wins; if several still qualify, resolution FAILS rather
 * than guessing, because guessing is how "Vale Man" happened.
 */
export function resolveEntity(reg: EntityRegistry, name: any, at = 0, kind?: EntityKind): string {
  const form = normaliseForm(name);
  if (!form) return '';
  const ids = reg.index.get(form);
  if (!ids || !ids.length) return '';
  const live = ids
    .map((id) => livingId(reg, id))
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .map((id) => reg.entities.get(id))
    .filter((e): e is Entity => !!e && (!kind || e.kind === kind))
    .filter((e) => e.aliases.some((a) => a.form === form && a.validFrom <= at && (a.validTo == null || a.validTo > at)));
  if (live.length === 1) return live[0].id;
  if (live.length > 1) return '';   // ambiguous — the caller must disambiguate, never the resolver
  return '';
}

/** The name this entity carries at this point in the story. */
export function nameAt(reg: EntityRegistry, id: string, at = 0): string {
  const e = reg.entities.get(livingId(reg, id));
  if (!e) return '';
  const live = e.aliases.filter((a) => a.validFrom <= at && (a.validTo == null || a.validTo > at));
  if (live.length) return live.sort((a, b) => b.validFrom - a.validFrom)[0].form;
  const any = e.aliases.slice().sort((a, b) => b.validFrom - a.validFrom)[0];
  return any ? any.form : '';
}

/** Every form that has ever belonged to this entity — what a cue-normalisation pass substitutes. */
export function allForms(reg: EntityRegistry, id: string): string[] {
  const e = reg.entities.get(livingId(reg, id));
  return e ? Array.from(new Set(e.aliases.map((a) => a.form))) : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// THE STATE LEDGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The dimensions that are deterministically checkable once identity is stable.
 *
 *   life      ALIVE | PRESUMED_DEAD | DEAD | UNKNOWN — a state machine with illegal transitions
 *   place     where the entity is; catches a continent crossed between adjacent scenes
 *   physical  a wound, a scar, a tremor, a broken arm — persists until a healing fact closes it
 *   knows     what a character has been told; catches a discovery made twice
 *   holds     possession of an object; catches a prop in two places
 *   open      an unresolved constraint: a named vessel, a stated deadline, a promise to discharge
 *
 * Tone, style, social norms and world rules are deliberately absent. They are real bug classes in
 * the ConStory taxonomy and they need a reader, not a comparison.
 */
export type StateDimension = 'life' | 'place' | 'physical' | 'knows' | 'holds' | 'open';

export type LifeState = 'ALIVE' | 'PRESUMED_DEAD' | 'DEAD' | 'UNKNOWN';

export interface StateFact {
  entityId: string;
  dimension: StateDimension;
  /** For `life` one of LifeState; otherwise a normalised value or an entity id. */
  value: string;
  /** Story-order index from which this is true. */
  validFrom: number;
  /** Story-order index at which it stops being true. null = still true at FADE OUT. */
  validTo: number | null;
  /** Monotonic write order — the tiebreak when two facts share a validFrom. */
  recordedAt?: number;
  /** The scene that asserted it, for the finding message. */
  sourceScene?: number;
  /** The line as written, so a finding can quote the script rather than paraphrase it. */
  statement?: string;
  /**
   * True for a property that CANNOT change: the year stamped on a manifest die, a date of birth,
   * the year a company was incorporated. Scene 76 photographs the stamp as 1997 and scene 79 reads
   * the same stamp as 1994 — three pages apart, and the whole proof that the father predates Vale
   * rests on it. A mutable fact would treat that as a state change and close the first window; an
   * immutable one is a contradiction at any distance, which is what it is.
   */
  immutable?: boolean;
}

/**
 * WHICH LIFE TRANSITIONS ARE LEGAL.
 *
 * `DEAD` is terminal. `PRESUMED_DEAD -> ALIVE` is not only legal, it is this film's entire premise
 * — Jason is thrown off a trawler in scene 23, recovered in scene 25, and legally dead until scene
 * 118. A checker that forbade it would reject the story it exists to protect.
 *
 * What is illegal is coming back from `DEAD`, which is what "he's ash in a Boston cemetery" at
 * scene 89 followed by "Alexander walks" at scene 127 asserts.
 */
const LIFE_TRANSITIONS: Record<LifeState, LifeState[]> = {
  UNKNOWN: ['UNKNOWN', 'ALIVE', 'PRESUMED_DEAD', 'DEAD'],
  ALIVE: ['ALIVE', 'PRESUMED_DEAD', 'DEAD', 'UNKNOWN'],
  PRESUMED_DEAD: ['PRESUMED_DEAD', 'ALIVE', 'DEAD', 'UNKNOWN'],
  DEAD: ['DEAD'],
};

export function isLegalLifeTransition(from: LifeState, to: LifeState): boolean {
  const allowed = LIFE_TRANSITIONS[from];
  return !!allowed && allowed.indexOf(to) >= 0;
}

export type LedgerFindingKind =
  | 'LIFE_TRANSITION'      // came back from the dead without a declared exception
  | 'STATE_CONTRADICTION'  // two values of one dimension true at the same story point
  | 'PLACE_JUMP'           // somewhere else in the next scene with no travel between
  | 'REDISCOVERY'          // learned something already known
  | 'UNRESOLVED'           // a constraint established and never discharged
  | 'AMBIGUOUS_NAME'       // one surface form, two entities
  | 'SPLIT_IDENTITY';      // one entity, several cues — cosmetic on the page, fatal downstream

export interface LedgerFinding {
  kind: LedgerFindingKind;
  entityId: string;
  /** Scene ordinals involved, ascending. */
  scenes: number[];
  detail: string;
}

/**
 * Close a fact's window when a later fact supersedes it on the same (entity, dimension).
 *
 * This is the P2 refinement `canon-verify.util.ts` asks for in its own header, and without it
 * nothing else in this file works: facts stored open-ended always overlap, so every legitimate
 * state change reads as a contradiction and the detector "cannot distinguish death from
 * resurrection". Closing the window is what turns an overlap test into a transition test.
 */
export function closeSupersededFacts(facts: StateFact[]): StateFact[] {
  const out = (Array.isArray(facts) ? facts : []).filter((f) => f && f.entityId && f.dimension).map((f) => ({ ...f }));
  const byKey = new Map<string, StateFact[]>();
  for (const f of out) {
    const k = f.entityId + '|' + f.dimension;
    const arr = byKey.get(k);
    if (arr) arr.push(f); else byKey.set(k, [f]);
  }
  for (const arr of byKey.values()) {
    arr.sort((a, b) => (a.validFrom - b.validFrom) || ((a.recordedAt ?? 0) - (b.recordedAt ?? 0)));
    for (let i = 0; i < arr.length - 1; i++) {
      const next = arr[i + 1];
      // Never close an immutable property, and never close on an EQUAL validFrom: two values
      // asserted at the same story point are simultaneous, and closing one to a zero-width window
      // is exactly how the contradiction would disappear instead of being reported.
      if (arr[i].immutable || next.immutable) continue;
      if (next.validFrom <= arr[i].validFrom) continue;
      if (arr[i].validTo == null || (arr[i].validTo as number) > next.validFrom) {
        // Identical values are one continuous state, not two — do not fragment it.
        if (arr[i].value !== next.value) arr[i].validTo = next.validFrom;
      }
    }
  }
  return out;
}

/** Facts true at a story point, one winner per (entity, dimension). Half-open [validFrom, validTo). */
export function stateAt(facts: StateFact[], at: number): StateFact[] {
  const live = (Array.isArray(facts) ? facts : []).filter(
    (f) => f && f.validFrom <= at && (f.validTo == null || f.validTo > at),
  );
  const winner = new Map<string, StateFact>();
  for (const f of live) {
    const k = f.entityId + '|' + f.dimension;
    const prev = winner.get(k);
    if (!prev || f.validFrom > prev.validFrom || ((f.validFrom === prev.validFrom) && (f.recordedAt ?? 0) >= (prev.recordedAt ?? 0))) {
      winner.set(k, f);
    }
  }
  return Array.from(winner.values());
}

/**
 * THE FATHER CHECK.
 *
 * Walk each entity's life facts in story order and test every step against the transition table.
 * A resurrection is reported with both scenes and both quoted lines, because the useful output is
 * not "there is a contradiction" but "these two lines cannot both be true".
 */
export function checkLifeTransitions(facts: StateFact[], reg?: EntityRegistry): LedgerFinding[] {
  const out: LedgerFinding[] = [];
  const byEntity = new Map<string, StateFact[]>();
  for (const f of (Array.isArray(facts) ? facts : [])) {
    if (!f || f.dimension !== 'life') continue;
    const arr = byEntity.get(f.entityId);
    if (arr) arr.push(f); else byEntity.set(f.entityId, [f]);
  }
  for (const [entityId, arr] of byEntity) {
    arr.sort((a, b) => (a.validFrom - b.validFrom) || ((a.recordedAt ?? 0) - (b.recordedAt ?? 0)));
    for (let i = 0; i < arr.length - 1; i++) {
      const from = String(arr[i].value || 'UNKNOWN').toUpperCase() as LifeState;
      const to = String(arr[i + 1].value || 'UNKNOWN').toUpperCase() as LifeState;
      if (from === to) continue;
      if (isLegalLifeTransition(from, to)) continue;
      const who = reg ? nameAt(reg, entityId, arr[i + 1].validFrom) : entityId;
      out.push({
        kind: 'LIFE_TRANSITION',
        entityId,
        scenes: [arr[i].sourceScene ?? arr[i].validFrom, arr[i + 1].sourceScene ?? arr[i + 1].validFrom],
        detail: who + ' is ' + from + ' at scene ' + (arr[i].sourceScene ?? arr[i].validFrom)
          + (arr[i].statement ? ' ("' + arr[i].statement + '")' : '')
          + ' and ' + to + ' at scene ' + (arr[i + 1].sourceScene ?? arr[i + 1].validFrom)
          + (arr[i + 1].statement ? ' ("' + arr[i + 1].statement + '")' : '')
          + '. ' + from + ' to ' + to + ' is not a transition this story has declared.',
      });
    }
  }
  return out.sort((a, b) => (a.scenes[0] || 0) - (b.scenes[0] || 0));
}

/**
 * Two values of one dimension asserted true at the same story point.
 *
 * Distinct from a transition: this is not a state changing, it is two scenes disagreeing about
 * what is true simultaneously — the 1997/1994 manifest stamp, an object in two places, a character
 * in two cities. Runs on the CLOSED facts, so a legitimate later change is not caught here.
 */
export function checkStateContradictions(facts: StateFact[], reg?: EntityRegistry): LedgerFinding[] {
  const out: LedgerFinding[] = [];
  const closed = closeSupersededFacts(facts);
  for (let i = 0; i < closed.length; i++) {
    for (let j = i + 1; j < closed.length; j++) {
      const a = closed[i], b = closed[j];
      if (a.entityId !== b.entityId || a.dimension !== b.dimension) continue;
      if (a.dimension === 'life' || a.dimension === 'knows' || a.dimension === 'open') continue;
      if (a.value === b.value) continue;
      const bothImmutable = !!(a.immutable && b.immutable);
      if (!bothImmutable) {
        const aTo = a.validTo ?? Number.POSITIVE_INFINITY;
        const bTo = b.validTo ?? Number.POSITIVE_INFINITY;
        if (!(a.validFrom < bTo && b.validFrom < aTo)) continue;
      }
      const who = reg ? nameAt(reg, a.entityId, a.validFrom) : a.entityId;
      out.push({
        kind: 'STATE_CONTRADICTION',
        entityId: a.entityId,
        scenes: [a.sourceScene ?? a.validFrom, b.sourceScene ?? b.validFrom].sort((x, y) => x - y),
        detail: who + '.' + a.dimension + ' is "' + a.value + '" at scene ' + (a.sourceScene ?? a.validFrom)
          + ' and "' + b.value + '" at scene ' + (b.sourceScene ?? b.validFrom)
          + (bothImmutable ? ', and it cannot be both — this property does not change.'
                           : ', and both windows are open at once.')
          + (a.statement && b.statement ? ' ("' + a.statement + '" / "' + b.statement + '")' : ''),
      });
    }
  }
  return out;
}

/**
 * A DISCOVERY MADE TWICE.
 *
 * `knows` facts are monotonic: once a character has been told something they cannot un-know it, so
 * a second scene dramatising the same first-time discovery is a defect rather than a state change.
 * This is the Sophie beat from the previous draft, and it is the one ConStory calls a knowledge
 * inconsistency.
 */
export function checkRediscovery(facts: StateFact[], reg?: EntityRegistry): LedgerFinding[] {
  const out: LedgerFinding[] = [];
  const seen = new Map<string, StateFact>();
  const ordered = (Array.isArray(facts) ? facts : [])
    .filter((f) => f && f.dimension === 'knows')
    .slice()
    .sort((a, b) => (a.validFrom - b.validFrom) || ((a.recordedAt ?? 0) - (b.recordedAt ?? 0)));
  for (const f of ordered) {
    const k = f.entityId + '|' + f.value;
    const first = seen.get(k);
    if (!first) { seen.set(k, f); continue; }
    const who = reg ? nameAt(reg, f.entityId, f.validFrom) : f.entityId;
    out.push({
      kind: 'REDISCOVERY',
      entityId: f.entityId,
      scenes: [first.sourceScene ?? first.validFrom, f.sourceScene ?? f.validFrom],
      detail: who + ' already learned "' + f.value + '" at scene ' + (first.sourceScene ?? first.validFrom)
        + ', so scene ' + (f.sourceScene ?? f.validFrom) + ' cannot dramatise it as a discovery.',
    });
  }
  return out;
}

/**
 * A CONSTRAINT ESTABLISHED AND NEVER DISCHARGED — ConStory's "abandoned plot elements".
 *
 * The Mercy is named once, in scene 83, with a sailing day: "The Mercy sails Thursday." It never
 * appears again in 103 pages. A named vessel with a stated deadline is a promise, and an `open`
 * fact left with `validTo: null` at FADE OUT is that promise unpaid.
 *
 * `carriedToSequel` is how a writer says "this is deliberate" — the check must be silenceable, or
 * it becomes noise the moment a film ends on a deliberate open question.
 */
export function checkUnresolved(
  facts: StateFact[],
  lastScene: number,
  reg?: EntityRegistry,
  carriedToSequel?: Iterable<string>,
): LedgerFinding[] {
  const carried = new Set(Array.from(carriedToSequel || []).map((x) => String(x)));
  const out: LedgerFinding[] = [];
  for (const f of (Array.isArray(facts) ? facts : [])) {
    if (!f || f.dimension !== 'open') continue;
    if (f.validTo != null) continue;
    if (carried.has(f.entityId) || carried.has(f.value)) continue;
    const what = reg ? (nameAt(reg, f.entityId, f.validFrom) || f.value) : f.value;
    out.push({
      kind: 'UNRESOLVED',
      entityId: f.entityId,
      scenes: [f.sourceScene ?? f.validFrom, lastScene],
      detail: what + ' is established at scene ' + (f.sourceScene ?? f.validFrom)
        + (f.statement ? ' ("' + f.statement + '")' : '')
        + ' and never discharged, transformed or explicitly carried to a sequel by scene ' + lastScene + '.',
    });
  }
  return out;
}

/**
 * ONE ENTITY WEARING SEVERAL CUES, AND ONE CUE WORN BY SEVERAL ENTITIES.
 *
 * `VALE` / `GIDEON` / `GIDEON VALE` is one man's 29 speeches split three ways: invisible to a
 * reader, fatal to a cast report, a scheduling import or a dialogue-share measurement. And `REYES`
 * is a federal prosecutor in six scenes and a Quincy branch manager in two, which is the same
 * defect inverted.
 *
 * Both are read straight off the registry, so neither needs the script.
 */
export function checkIdentityHygiene(reg: EntityRegistry, cueCounts?: Map<string, number>): LedgerFinding[] {
  const out: LedgerFinding[] = [];
  for (const e of reg.entities.values()) {
    if (e.mergedInto) continue;
    const forms = Array.from(new Set(e.aliases.filter((a) => a.reason !== 'RENAME').map((a) => a.form)));
    if (forms.length > 1 && cueCounts) {
      const used = forms.filter((f) => (cueCounts.get(f) || 0) > 0);
      if (used.length > 1) {
        out.push({
          kind: 'SPLIT_IDENTITY',
          entityId: e.id,
          scenes: [],
          detail: used.map((f) => f + ' (' + (cueCounts.get(f) || 0) + ')').join(', ')
            + ' are one ' + e.kind.toLowerCase() + ' speaking under ' + used.length
            + ' different cues. Pick one and alias the rest.',
        });
      }
    }
  }
  for (const [form, ids] of reg.index) {
    const living = Array.from(new Set(ids.map((id) => livingId(reg, id))));
    if (living.length < 2) continue;
    out.push({
      kind: 'AMBIGUOUS_NAME',
      entityId: living[0],
      scenes: [],
      detail: '"' + form + '" resolves to ' + living.length + ' different entities ('
        + living.map((id) => id + ':' + (reg.entities.get(id)?.kind || '?')).join(', ')
        + '). One name for two people reads as a mistake even when it is not.',
    });
  }
  return out;
}

/** One line a writer or a repair pass can act on. */
export function ledgerFindingInstruction(f: LedgerFinding): string {
  switch (f.kind) {
    case 'LIFE_TRANSITION':
      return 'Life-state contradiction. ' + f.detail
        + ' Decide which is true and rewrite the other; if the character is meant to survive, the earlier state is PRESUMED_DEAD, not DEAD.';
    case 'STATE_CONTRADICTION':
      return 'Two facts cannot both hold. ' + f.detail + ' Fix one of the two scenes.';
    case 'REDISCOVERY':
      return 'Repeated discovery. ' + f.detail + ' Rewrite the later scene so it acts on the knowledge rather than acquiring it.';
    case 'UNRESOLVED':
      return 'Unpaid promise. ' + f.detail + ' Discharge it, transform it, or mark it as carried to a sequel.';
    case 'PLACE_JUMP':
      return 'Geography. ' + f.detail + ' Add the travel, or move the scene.';
    case 'SPLIT_IDENTITY':
      return 'One character, several cues. ' + f.detail;
    case 'AMBIGUOUS_NAME':
      return 'Name collision. ' + f.detail;
    default:
      return f.detail;
  }
}

/** Everything, in one call, ordered by where the writer will find it. */
export function auditLedger(
  reg: EntityRegistry,
  facts: StateFact[],
  lastScene: number,
  opts?: {
    cueCounts?: Map<string, number>;
    carriedToSequel?: Iterable<string>;
    places?: PlaceObservation[];
    transitScenes?: Iterable<number>;
    maxPlaceGap?: number;
  },
): LedgerFinding[] {
  const closed = closeSupersededFacts(facts);
  return [
    ...checkLifeTransitions(closed, reg),
    ...checkStateContradictions(closed, reg),
    ...checkRediscovery(closed, reg),
    ...checkUnresolved(closed, lastScene, reg, opts?.carriedToSequel),
    ...checkPlaceJumps(opts?.places || [], opts?.transitScenes, { reg, maxGap: opts?.maxPlaceGap }),
    ...checkIdentityHygiene(reg, opts?.cueCounts),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOGRAPHY · PLACE_JUMP AND THE TRAVEL BEAT
//
// ConStory measures geographical contradictions as the bug class whose two halves sit FURTHEST
// apart — 31.0% of the document — which is why nothing that reads one scene has ever caught one.
// But the Jason Quick case is the opposite shape and just as invisible: two ADJACENT scenes, a
// container terminal in Baltimore and a rain-slick street in Boston, with nothing between them.
//
// The division of labour matters here and it is the same one this whole architecture runs on.
// Deciding that "ATLANTIC WATERS OFF SKERRY ISLAND, NOVA SCOTIA" and "EXT. FERRY SLIP, SKERRY
// ISLAND" are the same region, and that "he unties Bev's skiff and leaves" is a departure, is a
// judgement — so a model makes it, once, at plan time. Deciding whether a character crossed a
// continent without one is arithmetic, so the check does that, deterministically, and never asks
// a model anything.
//
// A lexical fallback exists but is deliberately NARROW. "Terminal", "harbour" and "gate" all read
// as travel and none of them is: a container terminal is a workplace, and treating scene 39's
// TERMINAL GATE as a travel beat would suppress the one real finding in the draft.
// ─────────────────────────────────────────────────────────────────────────────

/** Unambiguous transit locations. Anything arguable is left to the model's `travel` flag. */
const TRANSIT_RE = new RegExp(
  '\\b(FERRY|FERRIES|AIRPORT|AIRFIELD|RUNWAY|JETWAY|DEPARTURES?|ARRIVALS?|BOARDING|CHECK-?IN'
  + '|TRAIN STATION|RAILWAY STATION|BUS STATION|COACH STATION|PLATFORM \\d|HIGHWAY|MOTORWAY'
  + '|INTERSTATE|TURNPIKE|FREEWAY|IN TRANSIT|EN ROUTE|MID-?FLIGHT|CABIN OF A|AIRLINER)\\b',
  'i',
);

/** A location that is unambiguously a way of getting somewhere. Conservative by design. */
export function isTransitPlace(location: any): boolean {
  const s = String(location == null ? '' : location);
  if (!s) return false;
  if (TRANSIT_RE.test(s)) return true;
  // "INT. CAR - MOVING" / "INT. TRUCK — DRIVING" — a vehicle interior in motion.
  return /\b(CAR|TRUCK|VAN|TAXI|CAB|TRAIN|BUS|PLANE|BOAT|SKIFF|LAUNCH)\b[^\n]*\b(MOVING|DRIVING|UNDER ?WAY|AT SEA|IN MOTION|TRAVELL?ING)\b/i.test(s);
}

/** Where one character is, at one scene. Regions come from the plan-time pass. */
export interface PlaceObservation {
  entityId: string;
  /** 1-based scene number. */
  scene: number;
  /** Normalised region — a city, an island, a country. Not a room. */
  region: string;
  /**
   * How this scene sits in time against the one before it. CONTINUOUS is the only value that makes
   * a change of region physically impossible; everything else is a cut, and a cut may cover a
   * journey the film simply did not dramatise.
   */
  elapsed?: 'CONTINUOUS' | 'SAME_DAY' | 'LATER' | 'UNKNOWN';
  /** True for a flashback, dream, memory or news footage — the character is not there now. */
  recalled?: boolean;
}

/** A slug's own time-of-day, when it declares continuity outright. */
export function slugSaysContinuous(heading: any): boolean {
  return /\b(CONTINUOUS|MOMENTS LATER|SAME (TIME|MOMENT)|LATER THAT (SECOND|MINUTE))\b/i.test(String(heading || ''));
}

/**
 * A character somewhere else with no way of having got there.
 *
 * THIS RULE WAS REWRITTEN AFTER MEASURING IT, and the first version is worth recording because the
 * failure was mine and it was the interesting kind.
 *
 * The first version fired on any region change between two nearby scenes with no travel beat.
 * Run against the delivered 139-scene draft it produced twenty-seven findings; exempting recalled
 * time brought that to nine. All nine were legitimate. Six were the Boston/Portsmouth intercut of
 * scenes 74-79 — a shipyard thread and a city thread cross-cutting over days, which is ordinary
 * screenwriting. Two were the closing montage. One was Baltimore to Boston at scenes 38-40, which
 * a coverage read had called "unexplained movement" — but that complaint is that the ROUTE HAS NO
 * PURPOSE, not that the man teleported. There is nothing physically wrong with it.
 *
 * A check that reports nine defects in a draft containing none is worse than no check, because it
 * teaches the writer to skip the whole report. So the rule now fires only on the genuinely
 * impossible: two regions in scenes the script itself declares CONTINUOUS, with nothing between
 * them. It will rarely fire. On the 1 Sep draft it fires zero times, which is the correct answer.
 *
 * Adjacency is not evidence. A cut is allowed to cover a journey; only continuity forbids it.
 */
export function checkPlaceJumps(
  obs: PlaceObservation[],
  transitScenes?: Iterable<number>,
  opts?: { maxGap?: number; reg?: EntityRegistry },
): LedgerFinding[] {
  const list = (Array.isArray(obs) ? obs : [])
    .filter((o) => o && o.entityId && o.region && Number.isFinite(o.scene) && !o.recalled);
  if (!list.length) return [];
  const maxGap = Math.max(1, Number(opts?.maxGap) || 3);
  const transit = new Set<number>(Array.from(transitScenes || []).map((n) => Number(n)).filter((n) => Number.isFinite(n)));
  const norm = (r: any) => String(r || '').replace(/\s+/g, ' ').trim().toUpperCase();

  const byEntity = new Map<string, PlaceObservation[]>();
  for (const o of list) {
    const arr = byEntity.get(o.entityId);
    if (arr) arr.push(o); else byEntity.set(o.entityId, [o]);
  }

  const out: LedgerFinding[] = [];
  for (const [entityId, arr] of byEntity) {
    arr.sort((a, b) => a.scene - b.scene);
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[i], b = arr[i + 1];
      if (norm(a.region) === norm(b.region)) continue;
      // The only signal that makes this impossible rather than merely undramatised.
      if (b.elapsed !== 'CONTINUOUS') continue;
      if (b.scene - a.scene > maxGap) continue;
      let covered = false;
      for (let s = a.scene; s <= b.scene && !covered; s++) if (transit.has(s)) covered = true;
      if (covered) continue;
      const who = opts?.reg ? nameAt(opts.reg, entityId, b.scene) : entityId;
      out.push({
        kind: 'PLACE_JUMP',
        entityId,
        scenes: [a.scene, b.scene],
        detail: who + ' is in ' + norm(a.region) + ' at scene ' + a.scene + ' and in ' + norm(b.region)
          + ' at scene ' + b.scene + ', which the script marks CONTINUOUS. There is no journey between them,'
          + ' and continuous time does not allow one.',
      });
    }
  }
  return out.sort((a, b) => (a.scenes[0] || 0) - (b.scenes[0] || 0));
}
