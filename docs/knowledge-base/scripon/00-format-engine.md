# 00 · The Format Engine

> Project type re-wires the whole develop pipeline. Encoded in `knowledge/formats.ts`.

## The problem it solves

Before v3, every ScripON build was shaped like a feature film: one logline, one treatment, a
3-act beat sheet, one continuous draft. That is wrong for a 60-episode vertical, a 16-episode
K-drama, or a documentary that is written in the edit. The Format Engine makes the project type
(plus the market/region) decide the shape of everything downstream.

## The two-part contract

The generator (`scripton.service.ts`) consumes the engine through exactly two pure functions:

1. **`stageLadderFor(brief)` → `StageKind[]`** — which develop stages exist. Replaces the old
   fixed `STAGE_ORDER`.
2. **`formatDirective(brief)` → string** — the structural instruction (episode count, length, act
   template, arc model, terminology) appended into the creative brief via `knowledgeDirective`.

Both are pure functions of the brief and fail safe: an unknown project type resolves to the
FEATURE shape and never throws. Adding a market or format is a data edit (a new row in
`SERIES_PRESETS` / `VERTICAL_PRESETS`), not an engine change.

## Resolution

```
normalizeFamily(brief)  → FEATURE | SHORT | SERIES | VERTICAL | DOCUMENTARY   (from projectType/format)
normalizeMarket(brief)  → US_STREAMING | US_NETWORK | UK | KDRAMA | TURKISH_DIZI | TELENOVELA |
                          ANIME | RAMADAN_MUSALSAL | NORDIC_NOIR | MENA       (from country/market/language)
pickPreset(brief)       → the active FormatPreset
```

## The ladders

| Family | Stage ladder |
| --- | --- |
| Feature / Short | `LOGLINE → SYNOPSIS → TREATMENT → BEATS → SCENES → STEP_OUTLINE → DRAFT → COVERAGE` |
| Series | `… → SEASON_ARC → EPISODE_MAP → TREATMENT → BEATS → …` |
| Vertical | `PREMISE → STORY_ENGINE → EPISODE_MAP → BEAT_ENGINE → SCENES → DRAFT → COVERAGE` |
| Documentary | `THESIS → TREATMENT → RESEARCH_PLAN → RIGHTS_PLAN → INTERVIEW_OUTLINE → PAPER_EDIT → NARRATION → COVERAGE` |

Documentary deliberately has **no dialogue beats** — it is written in the edit (see
[03-documentary.md](./03-documentary.md)). Vertical front-loads a pre-conflict premise and a
story engine before its long episode map (see [01-vertical-microdrama.md](./01-vertical-microdrama.md)).

## The presets (episode / length / act / arc)

The full market matrix lives in [02-episode-formats.md](./02-episode-formats.md). The engine
carries, per preset: `episodes` (a number or a `[min,max]` range), `lengthLabel`, `actTemplate`,
`arcModel`, and a `terminology` note (e.g. UK uses "Series" not "Season"; Turkish dizi runs
120–150 min at home and is re-cut ×3 for export).

## Why data-driven

The product brief was explicit: *"make the build tool so smart, and make very sense and logic to
each genre."* Smartness here = the right structural knowledge fires automatically from the brief.
Keeping it as data (tables + pure selectors) means a producer can later tune a market norm, or we
can add a streamer's house format, without touching generation code or risking the feature path.

## Sources

Broadcaster and streamer norms (Netflix/HBO/BBC house counts), Wikipedia format/season pages, and
the regional research synthesised in June 2026. Per-claim citations are in
[02-episode-formats.md](./02-episode-formats.md).
