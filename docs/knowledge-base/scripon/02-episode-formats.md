# 02 · Episode & Season Formats

> Market decides the count, length, act template and arc. Encoded in `knowledge/formats.ts`
> (`SERIES_PRESETS`, `VERTICAL_PRESETS`).

The same "make it a series" intent means very different things in Seoul, Istanbul, London, Mexico
City and during Ramadan. The engine resolves a market from the brief's country/market/language and
applies the right preset.

## The matrix

| Market preset | Episodes | Length | Act template / arc | Terminology / note |
| --- | --- | --- | --- | --- |
| Feature | 1 | ~110 pp | 3-act, single arc | not episodic |
| `US_STREAMING` | 6–13 | 45–75 min | continuous, serialized | "Season" |
| `US_NETWORK` | 22 | ~44 min | Teaser + 5 acts (ABC = 6) | act-outs before breaks |
| `UK` | 3–8 | ~58 min | continuous, tight serialized | **"Series"**, not "Season" |
| `KDRAMA` | 12–16 | 60–70 min | per-ep arc + mid-ep hook | live-shoot (mutable) vs pre-produced (locked) |
| `TURKISH_DIZI` | ~36 | **120–150 min** | novelistic, multi-strand | export re-cut ×3 @ ~45 min |
| `TELENOVELA` | 80–200 | ~45 min daily | daily cliffhanger | finite, definite END |
| `ANIME` | 12–13 (24–26) | ~24 min | OP/ED + eyecatch (A/B) | "cour" |
| `RAMADAN_MUSALSAL` | 30 | 30–45 min nightly | nightly closed beat + hook | airs nightly in Ramadan |
| `NORDIC_NOIR` | 8–10 | ~58 min | continuous slow-burn | single investigation |
| `VERTICAL` (global) | 60–100 | 60–90 s | Beat Engine | see [01](./01-vertical-microdrama.md) |
| `VERTICAL` (MENA) | 40–80 | 60–90 s | Addiction Loop | Arabic-first |

## Two flags the engine always carries

- **Terminology.** UK/EU productions say "Series 2" where the US says "Season 2." The engine
  carries this so generated copy and the UI don't mislabel.
- **Production model (K-drama).** Live-shoot dramas keep later episodes mutable (they react to
  ratings); pre-produced dramas lock the whole season for a global drop. This changes whether the
  episode map should be treated as fixed or provisional.

## How to extend

A new streamer house format or national broadcaster is a **new row** in `SERIES_PRESETS` plus a
match clause in `normalizeMarket`. Do not branch the generator.

## Sources

Wikipedia season/format pages and broadcaster norms for each market (BBC, network US, tvN/SBS
K-drama, Turkish dizi runtime reporting, telenovela structure, anime cour conventions, Ramadan
musalsal scheduling), cross-checked June 2026.
