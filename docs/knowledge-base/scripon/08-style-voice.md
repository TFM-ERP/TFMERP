# 08 · Style & Voice packs

**Code:** `backend/src/production/scripton/knowledge/styles.ts`
**Composed by:** `knowledge/index.ts` → `knowledgeDirective(brief)` (only when the brief chooses styles)
**Intake:** optional "Style & Voice" band (`f.styles[]` + `f.styleMix{}`), off by default.

## What it is

The **HOW‑it's‑written** axis. Every other layer (genre, tone, era, conflict, lore) decides *what the story is*; Style & Voice decides the **craft texture** — dialogue rhythm, scene construction, prose voice in the action lines, structural assembly. It is the directorial/authorial *signature* layer.

It changes how a beat is rendered, never the beat itself.

## IP‑safe by design (non‑negotiable)

A writing **style or method is not copyrightable** (only a specific person's actual text is). So packs are **technique‑only and generically named** — there are **no living‑person or trademarked names** in the data, the UI, or the generated output, and the engine never reproduces a real script's text. This keeps clear of right‑of‑publicity / false‑endorsement and trademark exposure. (User decision: generic names only.)

## The five dimensions each pack steers

`dialogue` · `structure` · `voice` (tone) · `visual` (grammar, as written in action) · `scene` (construction).

## Data model (`StylePack`)

```
{ id, label, ar, blurb, dialogue, structure, voice, visual, scene, bestFor[] }
bestFor: ['any'] or format families FEATURE | SERIES | VERTICAL | DOCUMENTARY | TVC
```

## Activation (opt‑in, format‑agnostic)

- `chosenStyleIds(brief)` reads `brief.styles[]` (the intake band). Empty → `styleDirective` returns `''` → **existing builds unaffected**.
- `brief.styleMix[id]` = strength `0..4` (subtle flavour → defining signature).
- `styleDirective(brief)` emits the chosen pack(s)' directives + a strength instruction; up to **2** packs blend into one coherent signature. It composes with genre/era/conflict/lore and steers **every** format and **every** generation stage (treatment → beats → scenes → full script).
- Hard rule in the directive: *steer craft only — never change plot, characters, setting, facts, era, conflict or lore to fit the style.*

## The packs

Generic, technique‑named: Fast Ensemble Dialogue · Slow‑Burn Naturalism · Mythic Quest · Hyperlink Mosaic · Hardboiled Noir Voice · Genre‑Pastiche Nonlinear · Maximalist Spectacle · Deadpan Absurd · Vérité Handheld · Lyrical Memory · Chamber Intimacy · Bingeable Cliff‑Engine (series/vertical) · Punchy Single‑Idea Spot (TVC) · Investigative Build (documentary). Each carries an Arabic label + blurb.

## What it is NOT

It is a **voice family**, not a forensic clone of one named author — by design (legally safe and more flexible). Strength scales with the slider; it leans the writing, it does not lock it.

## Extending

Add a `StylePack` row — never branch the engine. Keep names technique‑descriptive (no real people / brands). Default `bestFor: ['any']` unless the voice is format‑specific.
