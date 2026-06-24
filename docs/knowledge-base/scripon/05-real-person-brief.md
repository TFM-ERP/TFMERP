# 05 · Real-Person / Based-on-Reality

> Fidelity is a dial, not a switch. Encoded in `realPersonDirective` (`knowledge/index.ts`),
> consumed in `intakeSteer` and the character build.

When a story is based on real events or a real protagonist, the writer needs to know **how
faithful** to be. ScripON models this explicitly so the same true story can become a rigorous
biopic or a loose inspiration.

## The three fidelity levels (`IntakeProfile.realityLevel`)

| Level | Directive to the writer |
| --- | --- |
| **Faithful** | Stay true to the documented record; invent only to bridge gaps, never to contradict known facts. |
| **Inspired-by** | Keep the essence, themes and key turning points; freely dramatise specifics, names and scenes. |
| **Loosely** | Use the real story only as a springboard; the work is fiction. |

## The detail dial (`IntakeProfile.researchAmount`, 0–100)

Independent of fidelity: *how much documented detail* to surface. ≥70 leans on dates, places and
real relationships; ≤30 keeps only the essence; the middle balances documented truth with dramatic
invention.

## Research the subject (`IntakeProfile.researchSubject`)

When on, the build researches the real person/events to ground the **character build** — kept
separate from the dramatised story so facts inform character without leaking unverified claims into
the screenplay.

## The brief flows into the character breakdown

The fidelity level + detail dial + the user's free-text brief about the person all flow into the
auto-generated character breakdown, so the real person is honoured at the chosen level (see
[06-build-versions-and-package.md](./06-build-versions-and-package.md)).

## Clearance tie-in

Real-person intent connects to the clearance flag. Biopic and true-crime work should surface a
**life-rights / defamation pack** as a tracked item — the same discipline the documentary engine
applies (see [03-documentary.md](./03-documentary.md)). The engine flags it; legal sign-off remains
a human responsibility.

## Why a dial and not a rule

The product needs to serve both the financier who wants a defensible, documented biopic and the
writer who wants a true story as a launchpad. Encoding fidelity as data lets the **same** pipeline
produce both, steered only by the brief.
