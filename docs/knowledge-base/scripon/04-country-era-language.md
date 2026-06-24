# 04 · Country, Era & Language

> A country is a timeline of civilisations, each with its own way of speaking. Encoded in
> `knowledge/eras.ts` (substrate) and `knowledge/accents.ts` (the accent craft model).

Selecting a country should not just stamp a label on the script — it should change how characters
speak, are named, what they wear, and what is sacred. The engine models a country as an **ordered
timeline of eras**, and the era a story sits in drives the language register and texture.

## The era substrate (`COUNTRY_ERAS`)

Each era row carries: a high (literary/formal) register and a low (everyday) register, the script,
a `diglossia` flag, accent/dialect notes, naming conventions, dress/texture cues, and a sacred
sensitivity level. Worked timelines shipped: **Egypt, Iraq, Greece, Britain, Mexico, Japan**.

Example — Egypt:

| Era | Span | High register | Low register | Sacred |
| --- | --- | --- | --- | --- |
| Pharaonic | c.3100–664 BC | Middle Egyptian | Late Egyptian | aware |
| Ptolemaic | 305 BC–395 AD | Koine Greek | Demotic | aware |
| Arab-Islamic | 639 AD → | Classical/MSA Arabic (فصحى) | Egyptian Cairene | high |
| Modern | 1952 → | MSA | Egyptian Arabic (pan-Arab prestige) | high |

Hard date anchors are baked into notes so the engine never drifts across a civilisational break:
**1066** (Norman conquest → French-above-English diglossia in Britain), **1519–1521** (conquest of
Mexico → Spanish over Nahuatl), and others.

When a country isn't in the table, `eraDirective` returns nothing rather than guessing. Add a row
to extend coverage — never branch the generator.

## The accent craft model (`accents.ts`)

The non-negotiable rule, applied to every language: **write accent through idiom + grammar + a
capitalized parenthetical** (e.g. `(Cockney)` on first significant use). **Never phonetic
eye-dialect** ("'ello guv'nor") — it is unreadable and patronising; rhythm and vocabulary carry it.

Two independent knobs:

- **Horizontal** — regional dialect (where they're from): RP, Cockney, Glaswegian, Hiberno-Irish,
  US Southern, AAVE, Castilian, Rioplatense, Mexican, Kansai-ben…
- **Vertical** — register / class / formality: the diglossia or the dramatic code-switch within a
  scene (a character shifting from street to boardroom).

Rule-safe details the engine encodes:

- **AAVE** is rule-governed grammar, not "errors." Habitual *be* marks **recurring** action only
  ("she be working" = regularly), never one-time. Used sparingly and accurately.
- **Spanish** axes: voseo (Rioplatense `tenés/podés`) vs tuteo; distinción (Castilian /θ/) vs
  seseo; `vosotros` (Spain) vs `ustedes`-only (Latin America). False-friend warnings
  (e.g. *guagua* = bus in the Caribbean, baby in the Andes).

## Relationship to the Arabic dialect engine

Arabic is already handled deeply by the existing dialect-fidelity engine (`AR_CARD`, exemplars,
`dialectFidelity`/`dialectRepair`). `accentDirective` deliberately **returns empty for Arabic** so
the two never collide — the era substrate still supplies the Arabic high/low register, and the
dialect engine owns the colloquial fidelity. This file extends the *same philosophy* to other
world languages.

## Sources

Britannica and Wikipedia language histories; the Yale Grammatical Diversity Project (AAVE,
double-modals); the Real Academia Española (voseo/distinción); Ferguson (1959) on diglossia;
cross-checked June 2026.
