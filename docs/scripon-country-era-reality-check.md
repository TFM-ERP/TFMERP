# ScripON · "Country + Era" — Design vs. Ground Reality

_Reality-check generated 2026-06-24. Compares the design doc `design-tmp/scripon-adapt-build-redesign.html` (§4 "Country + Era", the `#country` section) against what is actually in the codebase._

## Verdict

The **country → era → language/accent substrate is real and live** — it exists as machine-readable knowledge modules, is paired with human-readable guideline docs, and is genuinely injected into script generation. It even goes **beyond** the design doc (a whole conflict/colonization layer). The remaining gaps are mostly **front-end** (the redesigned intake/package UI), the **live "research-online"** deepening, and **Word** (vs PDF) export.

This matches the "durable system IP" framing exactly: a knowledge module the generator consumes + guideline docs future modules reference.

## What §4 proposed

Selecting a country reveals an ordered timeline of civilisations; each era carries language (high/low register / diglossia), script, accent/dialect, naming, dress/customs, and a sacred-sensitivity flag — feeding the actual writing. Plus "beyond Arabic" accents with two knobs (horizontal dialect + vertical register), rule-safe handling, and live research-online that cites sources.

## What's actually in the code

| Design element | Status | Evidence |
| --- | --- | --- |
| Country → civilisation-timeline substrate | ✅ **Built** | `backend/src/production/scripton/knowledge/eras.ts` — **26** country entries; **6 fully-worked** timelines (Egypt, Iraq, Greece, Britain, Mexico, Japan). Each era row carries high/low register, script, `diglossia` flag, accent notes, naming, dress/texture, sacred-sensitivity. Hard date anchors baked in (1066 Norman, 1519–21 Mexico). |
| Era → language register / diglossia | ✅ **Built** | `eras.ts` high/low registers; `eraDirective(brief)` reads `settingCountry / cultureEra / settingEra / country / market`, and **returns nothing when the country isn't in the table** (never guesses). |
| Beyond-Arabic accents, two knobs, no eye-dialect, rule-safe | ✅ **Built** | `knowledge/accents.ts` — **10** accents (RP, Cockney, Glaswegian, Hiberno, US Southern, AAVE, Castilian, Rioplatense, Mexican, Kansai-ben). Encodes AAVE habitual *be*, Spanish voseo/distinción, false-friend warnings. Rule: idiom + grammar + parenthetical, never phonetic. |
| Arabic integration (no collision) | ✅ **Built** | `accentDirective` returns empty for Arabic — defers to the existing Arabic dialect-fidelity engine; the era substrate still supplies Arabic high/low register. |
| **Consumed by the generator** | ✅ **Wired** | `scripton.service.ts` imports `knowledgeDirective` + `stageLadderFor` from `./knowledge`. `knowledgeDirective()` composes era + accent + conflict + format + style + real-person steering and is injected into generation at multiple call sites (lines ~669, 1057, 1131, 1170, 1223). `stageLadderFor()` replaces the fixed `STAGE_ORDER` (line 328). |
| Paired human-readable guideline docs | ✅ **Built** | `docs/knowledge-base/scripon/` — `04-country-era-language.md`, `07-conflict-colonization.md`, plus 00–08 + README, each tied to a knowledge module, sources cited. |
| Build versions (run-level) | ✅ **In schema** | `prisma/schema.prisma` has `model IntakeProfile`, `model BuildVersion`, and `buildVersionId` on the script + stage models. (The design framed this as a future `db:push`; it already exists.) |
| **Bonus — beyond the design doc:** conflict & colonization substrate | ✅ **Built (exceeds design)** | `knowledge/conflicts.ts` (~31 KB) — per-country war/colonial/resistance history, era-linked via `eraKey`, with sides, stakes, theatres, hero archetypes, and sensitivity flags (Egypt, Sudan, Syria, Lebanon, …). |
| PDF export of the Development Package | ✅ **Built** | `scripton/protected-export.service.ts` uses `PDFDocument` (pdfkit) extensively. |
| ScripON UI surface | ✅ **Exists (broad)** | `frontend/src/app/(dashboard)/scripon/` — `intake`, `builds`, `package`, `breakdown`, `dialect`, `coverage`, `reader`, `doctor`, `greenlight`, `library`, `notes`, `revisions`, `approvals`. |

## Gaps — where the design is ahead of reality

| Design claim | Reality | Note |
| --- | --- | --- |
| Redesigned Brief UI (6-step rail, country civilisation-timeline picker, research-online toggle, V1/V2/V3 run switcher, Package "spine" view, Word button) | ⚠️ **Unconfirmed** | The `scripon/` pages exist, but I could not confirm they match the new mockup — they may still be the older UI. Verify per page. |
| "Research-online (ON by default) deepens the selected era **live** and cites sources" | ⚠️ **Likely not live** | Real-person research fields exist (`researchSubject`, `researchAmount`), but no evidence of a live web-research call that deepens an *era* at generation time. Probably aspirational for the era path. |
| Editable **Word / .docx** export of the Package | ⚠️ **Thin** | PDF export is solid; "word" appears once in the export service — Word export looks like a stub/label vs the doc's "fully formatted, editable Word." |
| "Auto character breakdown always shown" · "Period·Locale & Budget always filled" guarantees | ❔ **Not verified** | Not checked in this pass; would need deeper reading of `scripton.service.ts`. |

## Bottom line

The §4 "country + era" intellectual property is the **most real** part of the redesign: the substrate, the accent-craft model, the generator wiring, and the guideline docs are all in the codebase, MENA-deep with 6 fully-worked global timelines, and it genuinely steers generation. To fully match the mockup, the outstanding work is **front-end** (the redesigned intake/package screens) plus **live research-online** and **Word export** — not the knowledge engine, which is done.

## How to extend it (the codebase's own rule)

From `docs/knowledge-base/scripon/04-country-era-language.md`:

> "When a country isn't in the table, `eraDirective` returns nothing rather than guessing. Add a row to extend coverage — never branch the generator."

So extending coverage = **add country/era rows** to `eras.ts` (and matching entries in `conflicts.ts`), not new code paths. Cheapest high-value next step: complete the era depth for the ~20 MENA countries that are listed but not yet fully worked.
