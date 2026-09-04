/**
 * PERSONAL TIME — how old a character is, in a story whose scenes are not in chronological order.
 *
 * Age was never a function of era. It only looked like one because, in a story without travel, the
 * two coincide: `age = anchorAge + (era - anchorEra)` is right for every ordinary script and wrong
 * for every travelled scene. Applied to a traveller it reports a defect on every scene he appears
 * in — dozens of findings in a draft containing none, which is worse than no check at all.
 *
 * So age is computed as PROPER TIME along the character's own worldline: the time he has lived,
 * accumulated over his own appearances in `sceneOrder`, rather than read off the year of the scene
 * he is standing in. Two passes — classify every step, then integrate from each stated age.
 *
 * PURE. NEVER THROWS. For a character with no traveller flag every step is LIVED, the accumulation
 * telescopes to `era - anchorEra`, and the answer is bit-for-bit what it is today.
 */

/**
 * One appearance of one character: the scene, and that scene's era offset in days.
 *
 * `era` is `number | null` because every producer of an era (`sweepEras`, `resolveEventAnchored`,
 * `eraOffsetForEra`) returns `number | null` — null where the scene has no era, which spec §8 lists
 * as a supported state, not an error. An appearance whose era is null is not on the worldline; see
 * `classifySteps` and `ages`.
 */
export interface Appearance { scene: number; era: number | null }

export type StepKind = 'JUMP' | 'LIVED' | 'AMBIGUOUS';

export interface AgeInput {
  /** That character's appearances, in sceneOrder. */
  appearances: Appearance[];
  /** Only ages the SCRIPT STATES, by scene. An age nobody stated is never inferred. */
  stated: Record<number, number>;
  /** Declared, never derived — see `classifySteps`. */
  traveller?: boolean;
  /** Scenes the plan marks as arrival-by-travel. */
  jumpArrivals?: number[];
  /** Days of life a jump costs. 0 unless the story says otherwise. */
  travelCost?: number;
}

export type AgeFinding =
  | { code: 'ERA_AGE_DRIFT'; scene: number; predicted: number; stated: number }
  | { code: 'ERA_AGE_IMPOSSIBLE'; scene: number; lived: number; jumped: number; stated: number }
  | { code: 'ERA_SELF_REFUTING'; scene: number; predicted: number };

export interface AgeResult {
  /** Age in DAYS by scene. `null` where the worldline cannot be read — never a guess. */
  ageByScene: Record<number, number | null>;
  /**
   * The same ages keyed by APPEARANCE, parallel to `appearances`. A traveller meeting himself is
   * two appearances in one scene at two personal ages: expressible here, and collapsed in
   * `ageByScene`, which keeps the last. v1 does not CHECK an undeclared duplicate — that is the
   * natural next finding — but the shape does not have to change when it does.
   */
  ageByAppearance: (number | null)[];
  findings: AgeFinding[];
}

/** A birthday inside the year is not drift, so the tolerance is one year — in days. */
export const AGE_TOLERANCE_DAYS = 366;

/**
 * Classify every step of one worldline. One forward pass, anchor-free, so it runs once and serves
 * every anchor.
 *
 * THE TRAVELLER FLAG IS DECLARED, NEVER DERIVED, and this is the whole design. The same backwards
 * step means opposite things: for a non-traveller it is the NARRATIVE jumping — the audience is
 * shown an earlier year and the character is simply younger in it — and for a traveller it is the
 * PERSON jumping, because ordinary time does not run backwards for a person. Nothing in the era
 * sequence distinguishes those, so nothing here tries.
 */
export function classifySteps(
  appearances: Appearance[],
  jumpArrivals: number[] | null | undefined,
  traveller: boolean | null | undefined,
): StepKind[] {
  // A null entry, or one whose scene/era did not come out finite — exactly what
  // `scenes.map(s => sceneEra[s.id])` produces for a scene with no era — is not on the worldline.
  // Dropped before classification, not merely tolerated: `ages` drops the same shape of entry the
  // same way, below.
  const list = (Array.isArray(appearances) ? appearances : [])
    .filter((a) => a && Number.isFinite(a.scene) && Number.isFinite(a.era)) as (Appearance & { era: number })[];
  const marked = new Set(Array.isArray(jumpArrivals) ? jumpArrivals : []);
  const kinds: StepKind[] = [];
  let pending: number | null = null; // an era he left and is still displaced below
  for (let i = 1; i < list.length; i++) {
    const { scene, era } = list[i];
    const prev = list[i - 1].era;
    if (!traveller) { kinds.push('LIVED'); continue; }
    if (marked.has(scene) || era < prev) {
      kinds.push('JUMP');
      if (era < prev) pending = pending === null ? prev : Math.max(pending, prev);
      else if (pending !== null && era >= pending) pending = null; // home again
    } else if (pending !== null && era >= pending) {
      // Displaced, and this step reaches what he left from. He may have jumped home, or he may
      // have lived the years to get back. Both are real stories, so we refuse to pick. Either
      // way he is no longer displaced afterwards, so the steps that follow are ordinary.
      kinds.push('AMBIGUOUS');
      pending = null;
    } else {
      kinds.push('LIVED');
    }
  }
  return kinds;
}

function stepDelta(kind: StepKind, era: number, prev: number, travelCost: number): number | null {
  if (kind === 'JUMP') return travelCost;
  if (kind === 'LIVED') return era - prev;
  return null;
}

/** Age at every appearance, plus what the arithmetic falsifies. */
export function ages(input: AgeInput): AgeResult {
  const appearances = Array.isArray(input?.appearances) ? input.appearances : [];
  const stated = input?.stated || {};
  const travelCost = Number.isFinite(input?.travelCost as number) ? (input.travelCost as number) : 0;
  const ageByScene: Record<number, number | null> = {};
  const ageByAppearance: (number | null)[] = appearances.map(() => null);
  const findings: AgeFinding[] = [];
  for (const a of appearances) { if (a && Number.isFinite(a.scene)) ageByScene[a.scene] = null; }
  if (!appearances.length) return { ageByScene, ageByAppearance, findings };

  // A null entry, or one whose scene/era did not come out finite, is not on the worldline — it is
  // dropped before any integration, exactly as classifySteps drops it above. `origIndex[i]` is
  // where survivor `list[i]` sat in the ORIGINAL `appearances`, so the loop at the very end can
  // write each computed age back to its original position, leaving every dropped slot `null` —
  // ageByScene and ageByAppearance still carry one entry per ORIGINAL appearance, and a caller's
  // indices into `appearances` still line up with `ageByAppearance`.
  const origIndex: number[] = [];
  appearances.forEach((a, i) => {
    if (a && Number.isFinite(a.scene) && Number.isFinite(a.era)) origIndex.push(i);
  });
  const list = origIndex.map((i) => appearances[i]) as (Appearance & { era: number })[];
  if (!list.length) return { ageByScene, ageByAppearance, findings };

  // A scene id that appears twice with an age stated on it is unreadable input, not a defect: we
  // cannot tell which of the two selves the number belongs to. Refuse those appearances rather than
  // treat both as anchors of the same value, which reports a wrong age AND a finding nobody earned.
  const seen = new Map<number, number>();
  for (const a of list) seen.set(a.scene, (seen.get(a.scene) || 0) + 1);
  const contested = new Set<number>();
  for (const [scene, n] of seen) if (n > 1 && stated[scene] !== undefined) contested.add(scene);

  const anchors: number[] = [];
  list.forEach((a, i) => { if (stated[a.scene] !== undefined && !contested.has(a.scene)) anchors.push(i); });
  // A character nobody dated is never reported. Absence of evidence is not a defect.
  if (!anchors.length) return { ageByScene, ageByAppearance, findings };

  const kinds = classifySteps(list, input?.jumpArrivals || [], !!input?.traveller);

  /** Age at index `to` given the age at index `from`. Either direction. null if unreadable. */
  const walk = (from: number, age: number, to: number): number | null => {
    const step = to > from ? 1 : -1;
    for (let k = from; k !== to; k += step) {
      const a = step === 1 ? k : k - 1;
      const d = stepDelta(kinds[a], list[a + 1].era, list[a].era, travelCost);
      if (d === null) return null;
      age += step === 1 ? d : -d;
    }
    return age;
  };

  // Anchor k predicts anchor k+1; a mismatch is the finding, and then k+1 BECOMES the new anchor.
  // One wrong number is one finding rather than a finding on every scene after it.
  /**
   * The narrowest age range the worldline allows between two points: every non-ambiguous step
   * contributes its known delta, and every ambiguous step contributes its own cheapest and dearest
   * reading independently. Resolving all ambiguities the SAME way is wrong once travelCost sits
   * between two steps' gaps — jump one excursion and live another and the true total lies outside
   * both uniform readings, so a real script would be accused of an impossible age. Deltas are
   * additive, so summing each step's own min and max gives the true bracket at no extra cost.
   */
  const bracket = (from: number, age: number, to: number): [number, number] => {
    const step = to > from ? 1 : -1;
    let lo = age, hi = age;
    for (let k = from; k !== to; k += step) {
      const a = step === 1 ? k : k - 1;
      const gap = list[a + 1].era - list[a].era;
      const dLo = kinds[a] === 'AMBIGUOUS' ? Math.min(travelCost, gap)
        : (stepDelta(kinds[a], list[a + 1].era, list[a].era, travelCost) as number);
      const dHi = kinds[a] === 'AMBIGUOUS' ? Math.max(travelCost, gap) : dLo;
      if (step === 1) { lo += dLo; hi += dHi; } else { lo -= dHi; hi -= dLo; }
    }
    return [lo, hi];
  };

  for (let j = 0; j + 1 < anchors.length; j++) {
    const a = anchors[j], b = anchors[j + 1];
    const pred = walk(a, stated[list[a].scene], b);
    if (pred === null) {
      // We cannot say what he aged, but we CAN say what he could not have. If the stated age lies
      // outside both readings, no reading of the script supports it — and that is a real defect.
      const got = stated[list[b].scene];
      const [lo, hi] = bracket(a, stated[list[a].scene], b);
      if (got < lo - AGE_TOLERANCE_DAYS || got > hi + AGE_TOLERANCE_DAYS) {
        findings.push({ code: 'ERA_AGE_IMPOSSIBLE', scene: list[b].scene, lived: hi, jumped: lo, stated: got });
      }
      continue; // an ambiguity sits between them; refuse to accuse of DRIFT
    }
    const got = stated[list[b].scene];
    if (Math.abs(pred - got) > AGE_TOLERANCE_DAYS) {
      findings.push({ code: 'ERA_AGE_DRIFT', scene: list[b].scene, predicted: pred, stated: got });
    }
  }

  // Ages, keyed to `list`'s own index space; copied back to the ORIGINAL positions afterwards.
  const ageByAppearanceList: (number | null)[] = list.map(() => null);
  for (let i = 0; i < list.length; i++) {
    const sc = list[i].scene;
    if (contested.has(sc)) { ageByScene[sc] = null; ageByAppearanceList[i] = null; continue; }
    if (stated[sc] !== undefined) { ageByScene[sc] = stated[sc]; ageByAppearanceList[i] = stated[sc]; continue; }
    let base = anchors[0];
    for (const a of anchors) if (a < i) base = a;
    const v = walk(base, stated[list[base].scene], i);
    ageByScene[sc] = v;
    ageByAppearanceList[i] = v;
  }

  // A step we could not read, whose arrival states an age, is resolved BY that age — and an age
  // fitting neither reading is a defect the old model could not even express.
  for (let k = 1; k < list.length; k++) {
    if (kinds[k - 1] !== 'AMBIGUOUS') continue;
    const { scene, era } = list[k];
    if (stated[scene] === undefined || contested.has(scene)) continue;
    // The bounds check above may already have refuted this scene. One defect, one finding.
    if (findings.some((f) => f.code === 'ERA_AGE_IMPOSSIBLE' && f.scene === scene)) continue;
    const before = ageByAppearanceList[k - 1];
    if (before === null || before === undefined) continue;
    const lived = before + (era - list[k - 1].era);
    const jumped = before + travelCost;
    const got = stated[scene];
    if (Math.abs(got - lived) > AGE_TOLERANCE_DAYS && Math.abs(got - jumped) > AGE_TOLERANCE_DAYS) {
      findings.push({ code: 'ERA_AGE_IMPOSSIBLE', scene, lived, jumped, stated: got });
    }
  }

  // A PREDICTED age below zero falsifies the map: he is in a scene set before he was born. A
  // STATED one is the author's and is not ours to contradict.
  list.forEach(({ scene }, i) => {
    const v = ageByAppearanceList[i];
    if (v !== null && v < 0 && stated[scene] === undefined && !contested.has(scene)) {
      findings.push({ code: 'ERA_SELF_REFUTING', scene, predicted: v });
    }
  });

  // Copy the working list's ages back onto the ORIGINAL positions. Every index this loop does not
  // touch was dropped up front and stays at the `null` it was initialised to.
  for (let i = 0; i < list.length; i++) ageByAppearance[origIndex[i]] = ageByAppearanceList[i];

  return { ageByScene, ageByAppearance, findings };
}
