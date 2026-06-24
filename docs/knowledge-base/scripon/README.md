# ScripON — Adapt / Build Knowledge

The know-how behind the ScripON v3 "Adapt / Build" engine: how a creative **brief** becomes a
format-correct development pipeline, and the industry/craft rules that make each genre and
market "make sense." This folder is the human-readable half; the machine-readable half lives in
`backend/src/production/scripton/knowledge/` and is consumed by `scripton.service.ts`.

## The core idea — the Format Engine

A ScripON build is driven by a **brief** (persisted as `IntakeProfile` + `DevelopmentBuild.brief`).
The single most important fact about a build is its **project type**, because the type re-wires
everything downstream: which develop stages exist, how many episodes and how long, which act
template and arc model, and even whether dialogue is written at all.

```
brief.projectType ─┬─ FEATURE      → Logline → Synopsis → Treatment → Beats → Scenes → Step → Draft
   (+ market/       ├─ SERIES       → + Season arc → Episode map (count×len by market) → per-ep
    region)         ├─ VERTICAL     → Premise → Story engine → Episode map 40–100 → Beat Engine/ep
                    └─ DOCUMENTARY  → Thesis → Treatment → Research/Archive → Rights → Interview
                                      outline → Paper edit → Narration (last)
```

Everything in this folder exists to make that switch correct and deep.

## Index

| Doc | What it covers | Encoded in |
| --- | --- | --- |
| [00-format-engine.md](./00-format-engine.md) | Project type → stage ladder; episode/length/act presets by market; the consumption contract | `knowledge/formats.ts` |
| [01-vertical-microdrama.md](./01-vertical-microdrama.md) | Vertical micro-drama craft — global engine + MENA model | `knowledge/vertical.ts` |
| [02-episode-formats.md](./02-episode-formats.md) | Regional & streamer episode/season structures (US, UK, K-drama, dizi, telenovela, anime, Ramadan…) | `knowledge/formats.ts` |
| [03-documentary.md](./03-documentary.md) | Documentary stage-chain swap, subgenres, Nichols modes, rights/clearance | `knowledge/documentary.ts` |
| [04-country-era-language.md](./04-country-era-language.md) | Country→era civilisation timeline; language register, accents, diglossia beyond Arabic | `knowledge/eras.ts`, `knowledge/accents.ts` |
| [05-real-person-brief.md](./05-real-person-brief.md) | Based-on-reality fidelity (Faithful / Inspired / Loosely), detail level, clearance | consumed in `intakeSteer` + character build |
| [06-build-versions-and-package.md](./06-build-versions-and-package.md) | Build versions (V1/V2/V3) + Development Package data flow & export | `BuildVersion` model + package aggregator |

## How the engine consumes this (the contract)

`scripton.service.ts` touches the knowledge in exactly two places:

1. **Stage ladder** — `stageLadderFor(brief)` returns the ordered list of stage `kind`s for the
   build. The service uses it where it previously used the fixed `STAGE_ORDER` constant. Feature
   keeps the classic ladder; vertical, series, and documentary return their own.

2. **Steering directive** — inside `intakeSteer(projectId)`, the service appends
   `knowledgeDirective(brief)`. That composer pulls in only the relevant pieces:
   `formatDirective` always, plus `verticalDirective` / `documentaryDirective` /
   `eraDirective` / `accentDirective` when the brief warrants them. The result is plain text in
   the existing "CREATIVE BRIEF (honour throughout)" channel, so every stage prompt inherits it
   with no prompt-plumbing changes.

Both entry points are **pure functions of the brief** and fail safe (unknown → feature shape /
empty directive). Adding a market, era, or format is a data edit, not an engine change.

## Sources

Each doc carries its own citations. The research backing this knowledge base was gathered and
cross-verified in June 2026 from: the MENA Verticals guide; ReelShort /
DramaBox / Filmustage / Vitrina / Variety / Deadline (vertical craft + economics); broadcaster
and streamer norms plus Wikipedia format pages (regional episode structures); Documentary Film
Academy / PBS Frontline / IDA / No Film School (documentary practice + Nichols modes); and
Britannica / Wikipedia language histories / the Yale Grammatical Diversity Project / RAE /
Ferguson 1959 (country-era language and accent). Claims were checked across multiple
independent sources.
