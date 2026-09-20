# 0201a23 is validated in production, both branches

18 Sep 2026. The one thing today that closed.

---

## The defect it fixed

`extendStageArray`'s truncation predicate read `used >= cap * 0.9` alone. On 12 Sep that cost
V2.6 its scene cap: SCENES asked for 24–40 cards, the model returned 40 and stopped of its own
accord — `stop_reason: end_turn` at 24,593 of 25,000 — and the predicate called that truncated
because it had crossed 90% of the ceiling. The continuation appended three more scenes, so a
stage that had obeyed the brief exactly was filed with 43.

The fix asks the provider instead of guessing from the meter:

```js
const sr = String(r.stopReason || '');
return sr ? sr === 'max_tokens' : used >= cap * 0.9;
```

The proportion survives only where a provider reports no stop reason at all.

---

## Both branches, on live runs, on real material

**DECLINED to fire — 17 Sep, `cmu2dp656` SCENES v2**

```
outputTokens  24,494 / 25,000  = 98.0%
stopReason    end_turn
continuations 0
cards         40   (cap 40)
```

98.0% is inside the zone where the two rules disagree. The old predicate would have called
this truncated and appended cards past the cap — the V2.6 defect exactly. The new one read
`end_turn` and correctly did nothing.

**FIRED — 18 Sep, `cmu6kobqz` SCENES v3**

```
first  { stopReason: "max_tokens", outputTokens: 25,000 }
last   { stopReason: "end_turn",   outputTokens: … }
passes 1
cards  40
```

The model genuinely hit the ceiling. Both rules agree here, the backstop ran one continuation
pass, and the stage was completed to 40 cards rather than persisted as a partial.

Two more live runs sit inside the disagreement zone and behaved correctly: 90.9% `end_turn`
with 0 continuations (Arm B), and 87.5% `end_turn` with 0 continuations. The live spread is
now **62.0 / 87.5 / 90.9 / 98.0 / 100%**, so §69's earlier property — that the zone might be
unreachable in production — is retired by measurement rather than argument.

---

## And it is the first row where F5's split pays

The 18 Sep row carries `first.stopReason = max_tokens` and `last.stopReason = end_turn`.

Before F5 the stage row recorded only the tail, so this run would have read *"end_turn,
comfortable"* — describing a stage whose first call hit the ceiling, with the fact that
explains the continuation absent. The `{ first, last, maxTokens, passes }` shape is what makes
the row self-explaining: `passes: 1` says a continuation ran, and `first` says why.

That defect was itself found on the first real row the field produced, and the spec that
shipped it asserted only the tail's values — it never checked that the seed survived.

---

## What is NOT claimed

This validates the predicate and the backstop. It says nothing about whether 25,000 is the
right ceiling for SCENES, nor about the quality of a continued stage versus an uncontinued
one. The 18 Sep run's own register check never completed — the key ran out of credit — so that
row has no line-number data.
