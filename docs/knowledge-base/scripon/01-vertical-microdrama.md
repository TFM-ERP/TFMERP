# 01 · Vertical Micro-Drama

> 60–90s episodes, written to the second. Encoded in `knowledge/vertical.ts`.

Vertical micro-drama (ReelShort, DramaBox, ShortMax, and the MENA wave) is its **own format**,
not a short film and not a chopped-up soap. It has its own arc engine, retention mechanics, and
framing rules. ScripON treats it as a first-class family with the `VERTICAL_LADDER`.

## The per-episode Beat Engine

Every episode is a self-contained micro-arc on a strict clock:

| Beat | Window | Rule |
| --- | --- | --- |
| **Hook** | 0:00–0:15 | Detonate in the first 15s — the "explosion point." Open *after* the problem has begun. |
| **Friction** | 0:15–1:00 | A filmable, external conflict — not subtext. The camera must see it. |
| **Spike** | ~1:00 | The jolt that re-prices everything before it (reveal / reversal / betrayal). |
| **Button** | ~0:55–1:08 | Cut on the **question**, not the answer. Mandatory cliffhanger. Never resolve. |

The generator produces this as a timestamped skeleton before any dialogue; a lint rule should
fail any episode that resolves instead of cutting on a question.

## Retention mechanics

- **The Addiction Loop.** Each episode closes one small loop and opens another. Alternate
  "yes, but" and "no, also" turns every 2–3 episodes, each paying a **real** reward (a clue, a
  confession, an ally exposed, a tactical win) — never an empty tease.
- **Reversal engine.** Shock → Hurt → **Release in public**. The Shock must be concrete evidence
  (a text, a bank transfer, a second name on a will), not a feeling. The Release is witnessed.
- **Paywall economics.** Free episodes 1–~10 must form one complete emotional argument that earns
  the unlock. Map the series **backwards** from the paywall and land a major reveal 1–2 episodes
  *after* it. Peaks: cliffhanger by end of E1; re-price the premise ~E5; collide two secrets ~E10.
- **9:16 framing.** Face-first; props carry emotion more than wide set design; avoid large
  ensembles and complex action blocking (they read as noise on a phone screen).

## The MENA model

When the brief is Arabic / Gulf-targeted, the engine layers the MENA Verticals model on top of
the global rules:

- **Arabic-first**, dialogue colloquial and natural; action/narration in فصحى (the dialect engine
  owns the colloquial register).
- **Per episode:** a scenic objective + a power/info shift + emotional escalation + a final hook.
- **8 story engines** (season-driving premises): contractual relationship under surveillance;
  reputation collapse & rebuilding; institutional subversion; rise of women against gatekeepers;
  inheritance war with a suspicious document; forbidden love across class; return of the erased
  person; social ecosystem.
- **8 episode templates** (vary the shapes): confrontation; broken confession; secret revealed;
  public humiliation; power struggle; dangerous arrival; family-dinner explosion; wedding
  interruption.
- **Golden rules:** behaviour > set design; natural local dialogue; romance within real social
  constraints; honour the public/private distinction; small specific details anchor a specific
  social environment.
- **Season shape:** a structural transformation every 8–12 episodes; resolve the core promise
  before any ending. MENA episode counts run **40–80** (vs **60–100** global).

## Deliverable

The vertical build's output is a **series bible + the first 10–15 episode scripts** (the free
block), not a single screenplay. The Development Package reflects this (see
[06-build-versions-and-package.md](./06-build-versions-and-package.md)).

## Sources

The MENA Verticals guide (June 2026); ReelShort / DramaBox / ShortMax craft and
economics coverage; Filmustage, Vitrina, Variety and Deadline analyses of the vertical boom;
cross-verified across multiple independent sources.
