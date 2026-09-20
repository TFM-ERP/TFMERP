# ScripON — the correction channel (C1–C5)

C-numbers deliberately. `SCRIPTON-FIX-PLAN-RANKED.md` has its own F-sequence and the 17–20 Sep audit
grew a second one. **Do not merge them.**

This file is versioned with the code it specifies. C1 landed with it.

---

## Why this exists

On 20 September the register check ran on `STEP_OUTLINE`, found that step 13 placed Thomas's
admission in Cape Breton where the source places it in Boston, named it **line 39**, and stored the
finding on the version. Then **79 scenes were written on top of it** — because there is no way to
change one step of a forty-step outline without regenerating the whole outline.

Confirmed from stored text, no model call:

| where | what it says |
|---|---|
| source `:1579` | *"After the MacRae murders, Thomas privately admits his role to Nora shortly before his **Boston** meeting with Jason."* — the register line, verbatim |
| source `:665`, `:1135` | Boston again, independently |
| TREATMENT, BEATS | the same beat, **no place named at all** |
| `STEP_OUTLINE` steps 12–13 | *THOMAS BELL'S FISH SHED, **CAPE BRETON*** / *BELL KITCHEN, **CAPE BRETON*** |

The ladder diverged at the first stage that assigns locations. Three generations followed that one
wrong input identically — not sampling noise, a fixed upstream defect. Every instrument worked: the
checker caught it, named the right line, and stored it. The film was written anyway.

**Report-only is half a loop. Nothing here can act on what it knows.**

---

## C1 — Stamp the upstream versions a stage consumed

Prerequisite for everything else. No UI, no model call. **Landed.**

### Problem

No stage version recorded which upstream versions built it. On 20 Sep the only way to establish that
`STEP_OUTLINE` consumed `SCENES v6` was to capture the composed prompt at run time and compare forty
sluglines by hand. A day later it would have been unanswerable: `currentVersionId` is mutable and the
row reads identically whichever way it points.

### Design

On every `StageVersion` write, record

```
data.consumed = { KIND: versionId, ... }
```

for each upstream stage whose body **actually reached the prompt**. Take it from the resolution at
`scripton.service.ts:781` that the prompt builder itself used — **not re-derived afterwards**. The
feature writer does the same on its `ScriptRevision`.

```ts
current: versions.find(v => v.id === s.currentVersionId) || versions[versions.length - 1] || null
```

The fallback is the reason. With `currentVersionId` NULL the consumed version is the **last**
version, not null, so a stamp re-derived from `currentVersionId` names the wrong row precisely where
the question is hardest to answer later.

Only what was carried is stamped. `developmentSoFar` returns `parts` (carried) and `omitted`
separately; a stage the budget named as omitted did not reach the prompt and must not appear, or the
stamp becomes a claim about what was *available* rather than a record of what was *read*.

### Acceptance

1. Generate any stage. `data.consumed` names every upstream kind whose body appeared in the composed
   prompt, and no others.
2. **The fallback case.** With `currentVersionId` NULL, `consumed` must name the version `:781` fell
   back to.
3. **Negative control.** Point `currentVersionId` at a different version, regenerate, and `consumed`
   must change. *A stamp that does not move when the input moves is not a stamp.*

---

## C2 — The pre-spend gate

Small, and the item that would have caught line 39. **Not yet landed.**

### Problem

The check results already exist on the row before the expensive stage runs. Nothing reads them.

### Design

Before `DRAFT` and before the feature writer, read the stored checks on the versions about to be
consumed and stop for a decision — **amend / waive / proceed**. Show contradicted line numbers and
the offending text; `data.registerCheck.items[]` already carries `line`, `rule`, `draft`, `why`.

**Read each check's own state, never a merged verdict.** `registerCheck`'s zero already conflates
"clean" with "nothing testable", and `keepCheck` is simply ABSENT on five of seven stages. **An
absent field is NOT RUN. It is never a pass.**

### Acceptance — three fixtures, three different outputs

| fixture | required output |
|---|---|
| (a) stored check **with** items | the gate stops and names the line numbers |
| (b) stored check with **zero** items | the gate says clean and does not interrupt |
| (c) **no** stored check at all | the gate says NOT RUN, *in different words from (b)* |

If (b) and (c) render the same, C2 has reproduced the defect it exists to end.

**Negative control.** Delete the stored `registerCheck` from the consumed version and confirm the
gate's output changes from (b) to (c) in the same run.

### Scope

C2 does not fix anything and does not regenerate anything. It reads what is already stored and
stops. **Amending is C3.**

---

## C3, C4, C5

Specified elsewhere and **not authorised**. Nothing in this file implements them.
