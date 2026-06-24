# TFM / FilmOS — Knowledge Base

> Encode the know-how **once**. Consume it in code, read it as guidelines.

This directory is the durable **domain knowledge** behind FilmOS. It is not API docs and not
a changelog — it is the *reasoning* a senior practitioner would bring to each module: the
industry conventions, the regional/market rules, the craft logic, and the sources that back
them. We capture it here so that every future module and feature can stand on the same
foundation instead of re-deriving it.

## Why this exists

FilmOS modules are "smart" only to the degree that real production know-how is written down
somewhere a machine and a developer can both use. When that knowledge lives only in a prompt
string or one engineer's head, it rots and it can't be reused. So we keep it in two mirrored
layers:

| Layer | Audience | Lives in | Form |
| --- | --- | --- | --- |
| **Guidelines** (this folder) | humans — devs, PMs, future Claude sessions | `docs/knowledge-base/**` | Markdown, with sources |
| **Knowledge module** | the running system (generation, validation, defaults) | `backend/src/**/knowledge/**` | typed data + pure selector functions |

The two layers describe the **same facts**. The guideline doc explains *why* and cites
sources; the code module is the machine-readable encoding the product actually executes.
A change to one should be reflected in the other. Each guideline doc names the code file
that encodes it, and each code file's header points back to the guideline doc.

## How to use it

- **Building a new feature in an existing module?** Read that module's knowledge folder first.
  The conventions are already decided and sourced — don't re-litigate them in a prompt.
- **Standing up a new module?** Create `docs/knowledge-base/<module>/` and a matching
  `backend/src/<area>/knowledge/` module, and follow the ScripON pattern below.
- **The product made a "wrong" creative/industry choice?** Fix the knowledge module (data),
  not the call site. The behaviour is data-driven on purpose.

## The pattern (ScripON is the reference implementation)

ScripON's "Adapt / Build" engine is the first module built this way and is the template to copy:

```
docs/knowledge-base/scripon/            # guidelines (human-readable, sourced)
  README.md                             # index + how the engine consumes the knowledge
  00-format-engine.md                   # project type re-wires the whole develop pipeline
  01-vertical-microdrama.md             # vertical craft (global + MENA)
  02-episode-formats.md                 # regional / streamer episode + season structures
  03-documentary.md                     # documentary stage-chain, subgenres, modes
  04-country-era-language.md            # country→era substrate; accents & diglossia
  05-real-person-brief.md               # based-on-reality fidelity model
  06-build-versions-and-package.md      # versioning + Development Package data flow

backend/src/production/scripton/knowledge/   # the machine-readable encoding
  formats.ts        # FORMAT_PRESETS, stageLadderFor(brief), formatDirective(brief)
  vertical.ts       # Beat Engine, MENA templates/engines, verticalDirective(brief)
  documentary.ts    # subgenre × Nichols mode, stage-swap, documentaryDirective(brief)
  eras.ts           # country→era timelines, eraDirective(brief)
  accents.ts        # idiom+parenthetical accent model, diglossia, accentDirective(brief)
  genres.ts         # genre / subgenre / tone / mood / treatment taxonomy
  index.ts          # knowledgeDirective(brief) — composes the above for the generator
```

**Consumption contract.** The generator (`scripton.service.ts`) consumes the knowledge in
exactly two ways, so additions are low-risk:

1. `stageLadderFor(brief)` decides *which* develop stages exist for this project (replacing
   the old fixed `STAGE_ORDER`).
2. `knowledgeDirective(brief)` returns a plain-text brief appended inside `intakeSteer()` —
   the same channel the creative brief already uses — so every stage prompt inherits the
   format/era/accent/guardrail rules.

Selectors are **pure and defensive**: unknown inputs return safe defaults (feature shape,
empty directive), never throw. That is what lets us add markets, eras, and formats without
touching the call sites.

## House rules for knowledge

- **Source everything.** A claim about a market norm, era, or craft rule carries a citation
  in the guideline doc. If we can't source it, we mark it as a working assumption.
- **Data, not branches.** Prefer a row in a table over an `if` in the engine. New country?
  New row. New streamer format? New preset.
- **Bilingual where user-facing.** Anything that surfaces in the UI ships an Arabic string too
  (see the i18n convention in the frontend). Knowledge *data* (era names, etc.) carries both
  where relevant.
- **Guardrails are first-class.** Sacred-content and represent-with-care rules live in the
  knowledge layer and are never silently dropped.

_Maintained as system IP. First authored June 2026 alongside the ScripON v3 Adapt/Build engine._
