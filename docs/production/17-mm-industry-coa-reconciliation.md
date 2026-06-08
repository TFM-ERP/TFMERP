# 17 — Industry MM Numbering ⇄ TFM Master CoA Reconciliation

> **UPDATE (decision):** the Master CoA seed now uses the industry numbering **natively** for
> all NEW projects (1400 = Cast, 3300 = Camera, 5100 = Editing, 6700 = Insurance…). Existing
> projects keep their original codes. Consequences implemented: tier fallback is now
> 1=ATL / 2–4=BTL / 5=POST / 6+=OTHER (stored section tiers always win); the optional
> distribution ledger moved to **7000 P&A / 7510 Revenue / 8100 COGS / 9100 Corporate**;
> fringe GL codes moved to the 6600 series; identity mappings (`MOVIE_MAGIC`) follow the new
> codes; `seed-mm-mapping.js` now loads **TFM_LEGACY** (old TFM code → new industry code)
> for re-importing pre-switch exports, and deactivates the obsolete MM_INDUSTRY rows.
> The collision table below is retained for historical context.

Source: **"Master cost numbers.docx"** (22 standard Movie Magic Scheduling categories + AICP-style 4-digit MMB topsheet). Reconciled June 2026.

## Key finding — the two numbering systems COLLIDE

| Code | Industry doc | TFM Master CoA |
|---|---|---|
| 1400 | Cast | Director |
| 2100 | Extra Talent | Production Staff |
| 2200 | Set Design (Art) | Camera Department |
| 2500 | Set Operations (Grips) | Production Sound |
| 3300 | Camera Operations | Music |
| 4100 | Animals | Insurance |

Therefore the industry numbering is loaded as a **separate `CoaMappingTable` source `MM_INDUSTRY`** (seed: `prisma/seed-mm-mapping.js`), never merged into the `MOVIE_MAGIC` identity rows used to round-trip our own exports. `DynamicContextService` feeds both sets (tagged `src`) to the AI mapper, which resolves by code + description — no hardcoding, exactly as the document's Part 3 intends.

## Category coverage (22 MMS categories)

| MMS Category | Status in TFM |
|---|---|
| Cast Members, Background Actors, Stunts, Vehicles, Props, Set Dressing, Greenery, Special Equipment, Security, Special Effects, Wardrobe, Makeup/Hair, Animals, Visual Effects, Sound/Music, Art Department, Miscellaneous | Already in `BreakdownCategory` |
| **Cameras** | **ADDED** as `CAMERA` |
| **Additional Labor** | **ADDED** as `ADDITIONAL_LABOR` |
| **Mechanical Effects** | **ADDED** as `MECHANICAL_FX` (was folded into SFX) |
| **Animal Wrangler** | **ADDED** as `ANIMAL_WRANGLER` (was folded into ANIMALS) |
| Notes / Scene Notes | Non-budgetary by design — maps to OTHER if ever tagged |

All four new values are wired through: MM import/export category maps, AI script-import category list, breakdown→budget keyword map + default rate card, and the dynamic DOOD (category-driven, picks them up automatically).

## Accounts ADDED to the Master CoA (new projects only — existing budgets untouched)

| New TFM account | From doc |
|---|---|
| 1800 ATL Travel & Living (1801–1804) | 1800 |
| 2655 Set Strike (2656–2657) | 2400 Set Striking |
| 2955 Animals & Wranglers (2956–2959) | 4100 Animals + Animal Wrangler sub-accounts |
| 2975 Picture Vehicles (2976–2978) | 3000 Picture Vehicles |
| 2985 Travel & Living BTL (2986–2988) | 3800 BTL T&L (also nearest match for 5800 Post T&L) |
| 3050 Post Staff & Facilities (3051–3053) | 5000 |
| 3700 Stock Footage & Deliverables (3701–3702) | 5700 |
| 4600 Second Unit (4601–4602) | 4200 |
| 4650 Aerial & Marine Units (4651–4654) | 4400 + 4500 |
| 4700 Re-shoots / Pickups (4701) | 4800 |
| 4750 Tests & Screenings (4751) | 6300 |

## Already matching (translation only, nothing missing)

Story/Rights 1100↔1100 · Producers 1200→1300 · Directors 1300→1400 · Cast 1400→1500 · Stunts 1500→1700 · Production Staff 2000→2100 · Extras 2100→2150 · Art 2200→2600 · Construction 2300→2650 · Grips 2500→2300 · SFX 2600→2920 · Set Dressing 2700↔2700 · Props 2800→2750 · Wardrobe 2900→2800 · Makeup 3100→2900 · Electric 3200→2400 · Camera 3300→2200 · Sound 3400→2500 · Transport 3500→2960 · Locations 3600→2940 · Editing 5100→3100 · Music 5200→3300 · Post Sound 5300→3200 · VFX 5400→3400 · DI 5500→3500 · Titles 5600→3600 · Publicity 6500→4300 · Insurance 6700→4100 · General 6800→4400 · Contingency 6900→4500.

**Partial equivalents (flagged, not added):** 3700 Film & Lab/Digital → Camera lines 2205/2211 · 4000 Production Facilities → 4400 Office & Admin · 6400 Studio Expenses → 4400 (or 9100 with the distribution ledger).

## How to apply

```bash
cd backend
npx prisma db push        # new BreakdownCategory enum values
npx prisma generate
node prisma/seed-mm-mapping.js
npm run start:dev
```
