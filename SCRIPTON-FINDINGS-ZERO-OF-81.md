# "0 of 81" reports three different worlds with one number

18 Sep 2026. The first time this conflation produced a wrong ruling — from both readers,
independently, in the same direction.

---

## The three worlds

A register check reports **contradictions**. So `contradicted: 0` is returned when:

1. **the draft obeyed the rule** — staged the beat where the rule requires;
2. **the draft never staged the beat at all** — nothing to contradict;
3. **the draft contradicted it in a way the check could not see** — wrong stage, compressed
   past recognition, or expressed in a form the checker did not match.

These are not degrees of one outcome. For a rule about **WHERE** something happens, (1) and
(2) are **opposite results rendered identically**: one is compliance, the other is absence.

**A check that reports contradictions cannot report compliance, and its silence is not
evidence either way.**

---

## What it cost

Register line 39 requires Thomas's confession at the Boston meeting, with Nora's silence
lasting only until then.

- Four generations (`cmu2dp656` SCENES v1/v2/v3, `cmu6kobqz` BEATS) contradicted it, all
  relocating to Nova Scotia, all in the same direction.
- On that evidence an amendment was ruled: the rule was wrong, the drafts agreed with each
  other, the register should change.
- `cmu6ryrgo` / V3.3 then produced a **five-stage ladder at 0 of 81**. This was read two
  ways, both wrong: *"line 39 is not reliably reachable"* and *"nine clean results dilute the
  vote"*.
- **Neither. V3.3 obeyed.** SCENES card 16 stages the confession at a dockside café near
  Fish Pier — Boston — with card 15 setting Nora's window to end at "a meeting already set in
  Boston", and card 17 continuing at Fort Point Channel.

The amendment was withdrawn. The rule is followable; a draft followed it; the other
placements were departures.

**Both readers inferred a property of the RULE from the silence of an instrument that cannot
speak to it.** The tally of 4-fired against 9-clean was never the right instrument, and
neither was a narrower reading of the same tally.

---

## Same family as the three-state checks

The keep check was built to distinguish FINDINGS / NO FINDINGS / NOT RUN precisely because a
single number cannot carry "checked and clean" and "never ran". The era check states its own
blindness in the NO FINDINGS branch for the same reason. The register check has no such
distinction: it emits a count, and the count's zero is overloaded.

What would separate the worlds, in ascending cost:

- **report what was CHECKABLE** — which rules the draft gave the checker something to test
  against, so `0 of 81` becomes `0 contradicted, 34 testable, 47 not staged in this material`;
- **report per-rule status** rather than a total, so a rule that has never once been testable
  is visible as such;
- **name the rules a stage was expected to reach**, which needs stage scoping the checks do
  not have (see the KEEP stage-blindness finding — the same missing dimension).

Not designed here. The observation is what was earned.

---

## Method note

Two cards of the body settled what nine check results could not. Counts locate; bodies
decide. Before any ruling on a register line, read the staged beat rather than the tally.

Recorded because it is the third time in one day that a claim built on a count had to be
narrowed or withdrawn: the six structural checks (narrowed once the baseline was same-build),
the stratum reading (narrowed from "one-stratum film" to "labelling collapsed at SCENES"),
and this one (withdrawn outright).

---

# Appendix — "ALL SIX COMPLETE" on one of six

Same family, same day, and self-inflicted after finding the defect four times elsewhere.

The six-run control harness wrapped each run in `|| true`, so that `set -e` would not abort
the loop. That also swallowed every failure. When the key ran out of credit after run 1, runs
2–6 each threw in 1–2 seconds; the script printed a per-run banner for all six, then
**"ALL SIX COMPLETE" and exit code 0**.

Nothing in the output distinguished a 347-second generation that produced 40 cards from a
2-second failure that produced nothing. The distinguishing evidence existed — the stage
version count did not move — but the instrument reporting on the experiment said it had
succeeded.

**This is the negative-control rule turned on its author.** Written that morning: *a negative
control has to be seen to fail; if applying the break does not turn a green test red in the
same run, the break did not happen.* Then a sequence was built whose failure mode is a green
banner, by the same hand, hours later.

Fixed: a failing run prints the provider's own message, aborts the sequence, and exits
non-zero; each run's captures are written as it completes, so a sequence that dies at run 4
leaves runs 1–3 intact and labelled; and a pre-flight call confirms the key has credit before
six are committed, because discovering the balance by burning run 2 is a measurement nobody
should pay for.

The general shape, for the file: **an instrument that reports on an experiment is part of the
experiment.** Its failure modes need the same scepticism as the thing being measured, and
"the run completed" is a claim, not an observation.
