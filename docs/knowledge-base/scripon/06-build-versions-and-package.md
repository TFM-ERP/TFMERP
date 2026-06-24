# 06 · Build Versions & the Development Package

> A build is a creative project; a version is one full attempt; the Package is the read-model over
> the active version. This doc is the **design spec** the P4–P5 implementation follows.

## Data model

A ScripON **build** (`DevelopmentBuild`) owns one or more **versions**. Each version is a complete,
frozen attempt — its own brief snapshot, develop ladder, generated script, and character
breakdown.

```
DevelopmentBuild
  └─ BuildVersion { id, buildId, n, label, briefSnapshot:Json, status, createdAt }   ← new in P5
        ├─ DevelopmentStage[]  (buildVersionId)   ← new column
        └─ ScriptDocument      (buildVersionId)   ← new column
```

Today versioning exists only **per stage** (`StageVersion`). P5 adds the **run-level** version so
you can re-run the whole brief and keep the prior attempt intact.

## Behaviour (V1 / V2 / V3)

- **Brief ↩** opens the exact brief that produced the active version, read-only. Editing it offers
  "save as a new version" rather than mutating history.
- **V1 / V2** switch the whole ladder + script + breakdown.
- **+ New version** clones the brief, re-runs, and keeps the previous version. Nothing is lost.
- **Promote** snapshots the chosen version into a production project (existing behaviour).

## The Development Package (read-model)

The Package reads top-to-bottom as the ladder that built it, scoped to the active version. Each
rung shows what it inherited from the one above. Key guarantees (P4):

- **Auto character breakdown.** Generated automatically alongside Scenes — no manual "generate"
  step — and always shown. Driven by scenes + brief; carries real-person fidelity (see
  [05-real-person-brief.md](./05-real-person-brief.md)).
- **Period · Locale always filled.** Derived from the era substrate (see
  [04-country-era-language.md](./04-country-era-language.md)) when not set explicitly.
- **Budget tier always filled.** From the brief's `budgetTier`, or derived from scope.
- **Format-adaptive spine.** A documentary Package shows its own chain
  (Thesis → Treatment → Research → Rights → Interview outline → Paper edit → Narration) instead of
  the feature spine; a vertical Package shows premise → engine → episode map → first episodes.

## Export

- **Investor-grade PDF** — a designed dossier (cover, logline, spine, characters, world, market,
  coverage) rendered via the existing Chromium pipeline. For financiers.
- **Editable Word (.docx)** — the same content, fully formatted, to work anywhere.

## Why version at the run level

A development executive iterates: same idea, three takes. Per-stage versions can't express "the
whole V2 reading of this story." Run-level versions make each attempt a first-class, comparable,
promotable artifact — which is also what the Package, coverage history, and promotion all hang off.
