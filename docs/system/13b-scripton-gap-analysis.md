# SYS-13b — scriptON: Gap Analysis & Enhancement Roadmap

A deep map of **Scriptation / scriptON** (the iPad script app in the reference screenshots) against the
**TFM Script & Document Hub (SYS-13, slices D1–D10)**, plus a build plan to close the gaps and turn the
module into a **standalone Script Library master** that links to projects individually.

Guiding constraint (unchanged): **zero paid third-party APIs**. Everything below is achievable with the
libraries already in the repo (`pdfjs-dist`, `pdf-lib`) plus **browser-native** Web APIs
(SpeechSynthesis, SpeechRecognition, MediaRecorder) — all free.

---

## 1. Where we already match (and beat) scriptON

| scriptON feature | TFM today | Where |
| --- | --- | --- |
| **Note Transfer** (move notes old→new draft) | ✅ Levenshtein re-anchor `transfer/:src/:tgt` + Orphans tray | `script-transfer.service` (D3) |
| **Compare Scripts** (scene-by-scene diff) | ✅ `compare/:revA/:revB` | D3 |
| **Markup** (highlight/pen/text/sticky/shapes) | ✅ tools HIGHLIGHT·PEN·TEXT·STICKY·TAG·TRAMLINE | `AnnotationOverlay` (D2) |
| **Layers** + show/hide + share | ✅ AnnotationLayer (PRIVATE·SHARED_ROLE·PROJECT) + IAM role/dept shares | D2/D4 |
| **Tagging → breakdown** | ✅ **and beyond** — tags stage a draft `BudgetLineItem` (SCRIPT_TAG) | D9 |
| **Lining** (coverage / takes) | ✅ coverage + takes per scene + Hot-Cost accrual | `lining.service` (D6) |
| **Sides Creator** | ✅ scene picker → pruned, crossed-out, 2-up, watermarked PDF + email | `sides.service` (D5) |
| **Instant Recognition** (scene headings) | ✅ slugline parse → `ScriptScene` on import | D1 |
| **Revision colours** | ✅ `ScriptRevision.colorCode` chip | D1 |
| **Export / share** | ✅ flatten accessible layers + **server watermark** | `script-export.service` (D8) |
| **Offline** | ✅ IndexedDB cache + write queue | `script-offline.ts` (D7) |
| **Security** | ✅ **OTP-gated PII reveal**, per-layer IAM, watermark burn-in (scriptON has none of this) | D10 |

**Takeaway:** the engine is built. The gaps are mostly *reading/acting surfaces* and *convenience layers*,
not core plumbing.

---

## 2. Gaps — what's genuinely new, grouped & prioritised

Legend: 🟢 small (build on existing) · 🟡 medium · 🔴 large.

### A. Reader & Actor tools — the biggest missing category (all browser-native, $0)
- 🟡 **Reader mode** — reflow the PDF text into a clean, font/size-adjustable reading view (we already extract `pageText` per page on import).
- 🟢 **Actor Highlight** — one-tap highlight of a chosen character's name / dialogue / both across the script (we already parse character + dialogue lines).
- 🟢 **Blackout mode** — hide a character's dialogue for off-book memorisation.
- 🟡 **Playback ("Hear your script")** — read aloud with **`window.speechSynthesis`** (free OS voices); assign a voice per character; speed/pitch.
- 🟡 **Rehearse mode** — mute the actor's lines; advance on a timed gap **or** via **`SpeechRecognition`** (browser) when they finish their line.
- 🔴 **Record / self-tape** — teleprompter scroll + **`MediaRecorder`** camera capture with slate countdown.
- 🟢 **Auto-Highlight elements** — colour scene headings / action / character / dialogue automatically.

### B. "Info Layers" — auto-generated overlays (no user drawing)
- 🟢 **Large scene numbers & dividers** in the margin (bird's-eye nav).
- 🟢 **Revision-colour page tint** from the header colour.
- 🟡 **8th-page counts** per scene (eighths math we already do for strips).
- 🟡 **Dialogue line numbering**.

### C. Lining depth (script supervisor)
- 🟡 **Auto-tramlines** — generate straight (on-camera) / squiggle (off-camera) coverage lines per character per scene from the parsed dialogue.
- 🟡 **Multi-camera slates** — up to 26 cameras, per-camera colour, slate formats (alpha/numeric/decimal).
- 🟡 **Split / dirty lines** — partial-coverage segments.
- 🟢 **Lining export PDF** to editorial.

### D. Tagging / breakdown depth
- 🟢 **Auto-Tag Cast** — tag every speaking character in every scene in one pass.
- 🟡 **Custom tag categories** — today `BreakdownCategory` is a fixed enum; add a per-project/master `TagCategory` table (name, colour, order, hidden) so users add/rename/recolour.
- 🟢 **Element / Category reports** (PDF + CSV) straight from script tags (we have the breakdown summary; add the report formats).
- 🟢 **Special tags** — Scene Description, Story Day, Scene Note.

### E. Page Maker / Sides depth
- 🟡 **Facing pages** — insert blank (lined/dot/grid) note pages opposite each script page.
- 🟡 **Custom pages** — insert set plans / images / templates (pdf-lib page insert).
- 🟢 **Page management hub** — bird's-eye grid, filter All / Annotated / Bookmarked.
- 🟢 **Multi-episode / multi-doc sides** — pull scenes from several documents into one sides file.

### F. Markup library
- 🟢 **Custom stamps** (APPROVED / DRAFT / FINAL + user stamps), **Saved Annotations** library, **attached private note** on any annotation.
- 🟡 **Audio notes** (MediaRecorder → uploads).

### G. Version-control polish
- 🟢 **Bookmarks** (+ transfer them forward) — new `ScriptBookmark` model.
- 🟢 **Collate pages** — insert a revised page packet (blue/pink) without a full master, re-anchoring notes.
- 🟢 **Transfer summary** — "X imported · Y changed · Z deleted" + a **Deleted Annotations** tray (notes on cut text).

### H. Live Layers (real-time team sharing)
- 🔴 Optional later: WebSocket layer broadcast. Heavy; defer unless needed.

### I. AI Analyze
- 🟡 Plain-language scene-by-scene change summary. We already wire **Anthropic** for budget CoA mapping, so this reuses an existing in-house integration — but it *is* an LLM call, so it's opt-in per project, not default.

---

## 3. Standalone "Script Library" master (your idea) — architecture

Mirror the proven **MasterLocation → Location** dual-target pattern (SYS-07).

```
MasterScript            (library record: title, logline, type, writer, status, tags palette)
  └─ MasterScriptRevision   (the canonical PDFs/drafts that live in the library)

ScriptDocument.masterScriptId?   ← optional link
  • A project can LINK a library script (read-through to master revisions), or
  • keep a project-local script (today's behaviour) — unchanged, fully backward-compatible.
```

What the master unlocks:
- **One script, many projects** — a development title scouted across slates; link it into a greenlit project without re-uploading.
- **Reusable palettes** — tag categories, saved stamps, saved annotation library, and **assigned character voices** stored on the master and inherited by every linked project.
- **Promote / pull** — like locations: draft a script in the library, then "use in project"; or promote a project script up to the library.
- **Standalone module** — a left-rail **"Scripts"** master entry (Creative & planning group) with its own library page, exactly like the Locations Library — while the in-project **Script** tab stays as-is.

Backward-compatible: every new field is nullable; existing project scripts keep working untouched.

---

## 4. Phased roadmap (each phase is a shippable slice)

**P1 — Reader & Actor pack (highest visible value, all $0 browser APIs)**
Reader reflow · Actor Highlight · Blackout · Playback (TTS) · Rehearse · Record · Auto-Highlight elements.

**P2 — Info Layers + Bookmarks + Transfer summary**
Scene-number/divider/revision-tint/eighths/dialogue-number overlays · Bookmarks (+ transfer) · Deleted/Changed annotation trays + transfer counts.

**P3 — Tagging & reports depth**
Auto-Tag Cast · custom `TagCategory` table · Element/Category reports (PDF+CSV) · special tags.

**P4 — Lining & Page Maker depth**
Auto-tramlines · multi-camera slates · split/dirty lines · facing pages · custom pages · page hub · lining export.

**P5 — Standalone Script Library master**
`MasterScript`(+revision) schema · library module + nav · link/promote/pull · master-level palettes & saved voices.

**P6 (optional)** — AI Analyze (opt-in) · Live Layers (WebSocket) · audio notes.

---

## 5. Notes on the "zero third-party" promise
- **Read-aloud / Rehearse / Record** use the browser's own `speechSynthesis`, `SpeechRecognition`, and
  `MediaRecorder` — no cloud TTS, no API keys, works offline-ish.
- **Page Maker / facing pages / collate** use `pdf-lib` (already installed).
- **Reports** render via the existing print routes + a CSV builder (no new deps).
- The only LLM touch (AI Analyze) reuses the Anthropic key you already configure for budget mapping, and is
  strictly opt-in.
