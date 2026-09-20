# Three findings from V3.2's ladder — for the document, not for tonight

Measured 18 Sep 2026 on `cmu6kobqz0000knltrfa0n1jx` / V3.2, FAITHFUL direction
("Every Name He Has Worn"), ladder LOGLINE → BEATS, four calls.

---

## 1. Register line 39 is wrong, and four independent generations say so

**The rule:** *"After the MacRae murders, Thomas privately admits his role to Nora shortly
before his Boston meeting with Jason. Her brief silence lasts only until that imminent
meeting, not across several story days."*

**What every draft does instead:** has Jason learn it in Nova Scotia, before he travels
south.

| generation | build | canon | direction | stage |
|---|---|---|---|---|
| 1 | `cmu2dp656` SCENES v1 | absent | — | SCENES |
| 2 | `cmu2dp656` SCENES v2 (Arm A) | present | — | SCENES |
| 3 | `cmu2dp656` SCENES v3 (Arm B) | suppressed | — | SCENES |
| 4 | `cmu6kobqz` BEATS v1 | present | FAITHFUL, picked | BEATS |

Four generations across a build change, a brief change, a direction change, a stage change
and **both canon conditions**. Nothing in the generation path moves it.

**The decisive detail is the direction of the disagreement.** The rule constrains WHERE
Jason learns it, not whether — and all four drafts relocate it the same way. Drafts that
were drifting would disagree with the register in four different directions; these agree
with each other and disagree with the register identically every time. That is the
register being wrong, not the generation being unreliable.

**Recommendation** (Qais's ruling, not the system's): amend line 39 to permit the Nova
Scotia placement, or state why the Boston placement is load-bearing. Leaving it stands a
1-of-81 contradiction on every future run of every build, which teaches readers to discount
the register's one red line.

---

## 2. The KEEP list carries items that are not keeps, and the check cannot tell

V3.2's TREATMENT returned `KEEP MISSES 2` against a 1,432-char list of 7 items:

1. *"explicit five-to-six-page length for the prologue"*
2. *"Leah named"*

**Neither is a dropped beat.** The prologue is present; Hale's reveal is present.

**(a) Wrong kind of item.** "Explicit five-to-six-page length" is a FORMAT instruction
sitting in a field whose stated purpose is what survives from the SOURCE. It is there
because the model wrote the list — `keep` is model-generated and read-only in the UI
(`ScriptOnStudio:446`, `ScriptOnBuildScreen:209`: two display divs, no input). So the check
correctly reports a miss against an entry that should never have been in the list, part of
the miss count is noise, and a writer reading "KEEP MISSES 2" goes hunting for dropped
beats that were never dropped.

This is the read-only-KEEP gap made concrete: the strongest instruction in the direction
block — *"KEEP (honour every item)"*, carried into every prompt and audited by its own
compliance check — is the one field the writer cannot edit. The writer note is the only
authoring channel, and it ships under a softer instruction.

**(b) The list is stage-blind.** "Leah named" is the last-card reveal. Not naming her in an
8,371-character TREATMENT is compression working exactly as intended, not an omission. The
same list is checked against a treatment and against a screenplay with no stage scoping, so
it manufactures false misses at precisely the stages built to compress.

**Consequence for the check's own reputation.** The keep check was built to report
named-and-absent without a score, deliberately, because presence is not correctness. Both
defects above push it the other way: they inflate absence. A check that reports two misses
where nothing was missed spends the credibility it needs for the run where something is.

Neither is fixed. Both are recorded.

---

## 3. F5 visible on its first full ladder

All four stages carry `data.ceiling` with `first` and `last` identical and `passes: 0` —
which is what a clean ladder should look like, and is exactly what the stage row could not
have shown the day before.

| stage | body | ceiling |
|---|---|---|
| LOGLINE | 265 | 88 / 8,000 · `end_turn` · p0 |
| SYNOPSIS | 5,625 | 2,127 / 8,000 · `end_turn` · p0 |
| TREATMENT | 8,371 | 2,925 / 25,000 · `end_turn` · p0 |
| BEATS | 11,996 | 5,658 / 25,000 · `end_turn` · p0 |

Register: 0, 0, 0, 1 of 81. Era check: NO FINDINGS on all four, with LOGLINE's single
unresolved expression again `"Seven years after"` — the eleventh body across five builds
with no absolute year.
