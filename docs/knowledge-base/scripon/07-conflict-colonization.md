# 07 · Conflict & Colonization substrate

**Code:** `backend/src/production/scripton/knowledge/conflicts.ts`
**Composed by:** `knowledge/index.ts` → `knowledgeDirective(brief)` (only when `isConflictStory(brief)` is true)
**Pairs with:** [`04-country-era-language.md`](./04-country-era-language.md) (the era engine — language/naming/customs). Conflicts are the *political/war* axis; eras are the *cultural/linguistic* axis. They compose.

## Why this exists

A country is not just a language and a costume — for war, resistance, occupation and political stories it is also a **timeline of conflicts**. This module gives the generator the historical truth a writer needs to ground those stories: who fought, what was at stake, the theatres a film would use, and the **protagonist roles** (archetypes) the era throws up — without inventing a fake history or flattening a real one.

It deliberately encodes **roles, not real named individuals** (resistance fighter, conscript, exile, field medic, smuggler, child of war, mother searching), so the engine dramatises a conflict without putting words in a real person's mouth.

## Data model (`Conflict`)

```
{ id, label, ar?, eraKey? (→ Era.key in eras.ts), span, type, sides, stakes,
  theatres[], heroArchetypes[], sensitivity }
type:        colonization | independence | interstate | civil | insurgency | revolution
sensitivity: standard | contested | high
```

`CONFLICTS` is keyed by country (with `aliases` for matching, same scheme as `eras.ts`). Each country lists its 1–4 most cinematically-useful conflicts.

## How it activates (fail-safe, opt-in by intent)

1. `isConflictStory(brief)` — true only if the genre/tone/blend signals war/conflict/political (`war · historical · political · military · resistance · revolution · insurgency · occupation · colonial · guerrilla`) **or** an explicit opt-in field (`brief.conflict` / `politicalArc`, reserved for a future intake band). A rom-com set in Beirut gets **no** war steering.
2. `findCountryConflicts(brief)` — matches the story's setting country (setting wins over the audience market).
3. `relevantConflicts(c, brief)` — prefers the conflicts whose `eraKey`/label/span match the chosen era; else returns all for the country.
4. `conflictDirective(brief)` — emits the steering block: per-conflict sides/stakes/theatres/roles + the **sensitivity guardrail**.

## Sensitivity policy (non-negotiable)

- **high** (ongoing and/or sectarian — Syria, Yemen, Libya, Somalia, Sudan, and all four Arab–Israeli wars): strict non-partisanship; every side gets human motive; no collective guilt; civilian dignity and agency preserved; no glorifying/aestheticising violence; no sectarian/ethnic stereotyping; prefer "inspired by" over depicting real living figures.
- **contested** (disputed casualty/blame claims): keep factions factual and even-handed.
- Grave specifics flagged in-data for factual handling: chemical-weapons use / Halabja (Iran–Iraq), the disputed WMD premise (2003 Iraq), colonial atrocities (Cyrenaica camps, Sétif, the Rif gas war).

## Coverage (all 22 Arab League states)

Colonial powers (Ottoman → British/French/Italian/Spanish), independence & resistance wars, interstate wars (1948 / 1956 / 1967 / 1973; Iran–Iraq; Gulf 1990–91; 2003 Iraq), civil wars (Lebanon, Algeria's Black Decade, Sudan/Darfur, Somalia, Yemen, Syria, Libya) and the 2011 uprisings — grouped Nile Valley · Levant · Gulf/Arabia · Maghreb · Horn/Indian Ocean.

## Sources (research, June 2026)

Britannica, Wikipedia, and the U.S. State Department Office of the Historian for the wars; Crisis Group / UNHCR / Al Jazeera for ongoing conflicts. Craft & sensitivity: *Reel Bad Arabs* (Shaheen), Arab Media & Society, ICFJ conflict-reporting ethics. Full per-claim source links are recorded in the research run that produced this module.

## Extending

Add a country row or a `Conflict` to an existing one — never branch the engine. Keep `eraKey` aligned with that country's `eras.ts` keys so era-filtering works. Default new ongoing/sectarian conflicts to `sensitivity: 'high'`.
