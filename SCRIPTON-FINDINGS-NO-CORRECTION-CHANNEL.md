# ScripON has no channel for a writer to correct a derived artefact in place

18 Sep 2026. Observed three times in one morning, from three unrelated tasks, before the
shape was visible. Written down, not designed.

---

## The three instances

**1. A register line that is demonstrably wrong.** Line 39 requires Thomas's confession at
the Boston meeting; four independent generations — across a build change, a brief change, a
direction change, a stage change, and both canon conditions — relocate it to Nova Scotia,
all in the same direction. The rule is wrong and Qais has ruled an amendment. But the
register is not a stored list: it is transcribed from the source on every extraction, so
line 39 exists only as **line 1579 of `brief.sourceText`**. Correcting one sentence means
editing the bible, which changes the sha256, which makes the stored canon unreachable, which
costs a full re-extraction — measured at ~4m30s and ~29,000 output tokens — and starts a new
canon lineage that nothing before it can be compared against.

**2. A KEEP list the writer cannot edit.** `keep` is model-written and read-only in the UI
(`ScriptOnStudio:446`, `ScriptOnBuildScreen:209`: two display divs, no input), yet it ships
as *"KEEP (honour every item)"* in every prompt and has its own compliance check. V3.2's
TREATMENT returned two misses — a page-count instruction that should never have been in a
source-fidelity list, and a last-card reveal absent from a treatment built to compress.
Neither is a dropped beat; both are defects in the list. The list cannot be edited. The only
way to change it is to re-propose directions, which is another paid call and produces a
different list entirely.

**3. A one-character typo that cost a full extraction.** A build created with `"fåirst"` at
char 758 instead of `"first"` hashed differently, found no stored canon, and paid for a
4½-minute extraction. Correcting the typo is another edit to the source, hence another
digest, hence another extraction.

---

## The shape

**Everything that steers generation is authored by extraction, and every correction is a
re-extraction.**

The canon, the register, the KEEP list, the strata — each is derived from the source text by
a model call, stored keyed on a digest of that text, and surfaced read-only. There is no
path by which a writer says *"this one line is wrong"* and has it stay corrected. The only
edit surface is the source itself, and the source is the cache key, so every correction
invalidates everything derived from it and pays for the whole derivation again.

That is why both known-wrong artefacts above sit unfixed. Not because anyone decided they
were acceptable — because the cost of correcting a sentence is the cost of rebuilding the
canon, and the correction cannot be made without also breaking comparability with every run
that preceded it.

---

## What this does NOT say

It does not say the digest key is wrong. A whole-source digest cannot produce a false hit,
which is exactly what it replaced. It does not say extraction-authored artefacts are wrong;
they are why the register carries the author's own sentences rather than a summary.

It says there is a missing third thing: a correction layer that survives re-extraction. An
override keyed to the fact rather than to the source, so that amending line 39 does not mean
re-deriving the other eighty.

**No design here, deliberately.** The observation is what was earned today; the remedy is a
separate decision with its own evidence, and inventing it now would be the same mistake as
the stratum table's partition — building fixity on a structure nobody had measured.

---

## Evidence

- Register line 39: four generations, `cmu2dp656` v1/v2/v3 and `cmu6kobqz` BEATS v1.
- Source bible line 1579 = register line 39; register produced by `transcribeRegister` over
  `brief.sourceText`.
- Canon key: `digest + extractorVersion`, `sourceCanonFor` / `loadSourceCanon`.
- Re-extraction cost: 107,763-char prompt, 29,103 output tokens, 4m30s — measured 14 Sep on
  `cmu1ocawn`, and again 18 Sep on `cmu6lew29`.
- KEEP read-only: `ScriptOnStudio:446`, `ScriptOnBuildScreen:209`.
- V3.2 TREATMENT keep misses: *"explicit five-to-six-page length for the prologue"*,
  *"Leah named"*.
