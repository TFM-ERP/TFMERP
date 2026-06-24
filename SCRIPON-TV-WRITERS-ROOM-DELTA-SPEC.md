# ScripON · TV Series AI Writers' Room — Delta Spec & Integration Plan

### A standalone "Create New TV Series" project type, built as a DELTA on the Script OS kernel — not a parallel platform
_Researched 2026-06-24. Reconciles the provided TV-Writers'-Room blueprint + Python/FastAPI template against ScripON's real stack and the Script-OS kernel. Sequenced AFTER the current Script-OS P0. For Claude Code + Superpowers (build) and Figma (UX, by Cowork)._

---

## 0. Verdict

Yes — this is the right "one-stop-shop" expansion, and **most of it already exists or is being built.** A TV series is the multi-episode case of the same primitives: the "Global State Manager / Entity States" is the **bi-temporal canon graph** (the P0 kernel — `CanonFact` triple + `detectConflicts`); the "Continuity Engine hard-error flag" is the **verify loop** scaled across episodes. So this module is a **delta**, not a new platform. The genuinely net-new pieces are: the **Series→Season→Episode→Scene hierarchy**, the **SME shadow fact-checker**, the **Season-Matrix / Resolution-Inbox UI**, and an optional **local vector sidecar**. **Sequence it after the Script-OS P0/P1 ships** — it builds directly on that kernel.

**But two things in the provided docs must be corrected before any code is written** (§1, §2). They are the difference between a clean integration and an expensive fork.

---

## 1. 🛑 CRITICAL CORRECTION #1 — stack: build it in NestJS, NOT a parallel Python/FastAPI backend

The provided Document 2 is **Python / FastAPI / SQLAlchemy**. ScripON's backend is **NestJS + Prisma + PostgreSQL**, frontend **Next.js**. Standing up a second FastAPI backend would **fork auth, budgeting, scheduling, and state into two frameworks** — the exact "duplication" the brief forbids, multiplied. Do **not** do it.

**Correct architecture (honours the brief's anti-duplication rule and the local-GPU intent):**
- **Orchestration, state, continuity, budget handoff, auth, WebSockets → all stay in the existing NestJS app.** Reuse the canon kernel, the budget/accounting module, RBAC, and `scripton.service`. NestJS already ships `@nestjs/websockets` + `@nestjs/platform-socket.io` (in `backend/package.json`) — **real-time push is native; no FastAPI needed.**
- **The ONLY justified local/Python piece is a thin "vector-memory sidecar"** — a small local service wrapping **ChromaDB** on the RTX 5080 for on-prem embeddings/RAG, exposed over a tiny internal HTTP/gRPC API that NestJS calls. This keeps script IP on local hardware (privacy/WGA-sensitivity) without forking the platform. It owns *only* embedding + similarity retrieval; it owns no business logic.
- **Hybrid routing** (local-first, escalate to Claude on low confidence) lives in a NestJS service, not a separate app. Research backs the pattern (≈60% cost reduction in one cited study) — but it's an orchestration concern, not a second backend.

> So: I am **not** producing the requested `models.py` / `routers.py` (Python). In this platform that would be the mistake. The equivalent *real* artifacts — Prisma models + a NestJS gateway/route shape — are in §7. The local Chroma sidecar can be Python; nothing else should be.

---

## 2. 🛑 CRITICAL CORRECTION #2 — the "3000 series" rule is half-right; don't hardcode the number

The brief says: route VFX/CGI/post **to the 3000 series, never the 4000 series.** Research finding: **the principle is right, the number is a simplified teaching model.**

- **Universal & rock-solid:** every film/TV budget splits into **Above-the-Line → Below-the-Line → Post-Production → Other**, and **VFX/CGI is unambiguously Post-Production** — never "Other / G&A / insurance / financing."
- **The numbers vary by chart:** in the real studio/TV master charts (Movie Magic / Showbiz, the John Wells TV cheat-sheet), the **3000s and 4000s are still below-the-line production** (camera, lighting, transport, locations, facilities, 2nd unit); **post-production is the 5000 series (VFX ≈ 5400)**, and **Other is the 6000s.** AICP (commercials) uses **letters A–W**, not numbers at all. Movie Magic's own docs say the chart-of-accounts is **user-defined per production**.

**So the correct, robust rule (do this instead of hardcoding 3000):**
> On a state change requiring VFX/CGI/post, map the cost to the **Post-Production account category of the project's active chart-of-accounts**, and **never** to the Other/G&A/financing/insurance section. Resolve the actual account *number* by looking it up in ScripON's existing budget module (it may be 3000 in a simplified chart or 5000 in a detailed one), not by a magic constant.

**Action:** confirm what chart ScripON's budget/accounting module actually uses, then bind the handoff to its Post-Production category id — a config/lookup, not `account_series = 3000`. (Sources: Media Services sample budget; Wikipedia "Film budgeting"; filmbudgeteers.com; John Wells Productions cheat-sheet; Movie Magic "Account Coding".)

---

## 3. Anti-duplication map — what we have vs. what's new

| Blueprint capability | Verdict | Lives in / becomes |
|---|---|---|
| **Global State Manager · Entity States** (chars/props/locations over time) | ♻️ **Extend the kernel** | The P0 **`CanonFact`** triple (subject·predicate·object, bi-temporal `validFrom/validTo`). Add `seriesId` + `episodeId` scoping. "CAR_01 destroyed in S01E02" = a canon fact with `validFrom` at that episode's story-order. |
| **Continuity Engine · hard-error flag** (CAR_01 pristine in S01E05) | ♻️ **Extend the kernel** | The P0 **`detectConflicts`** verify function, run cross-episode + pushed live (§5). This is exactly contd.app's "Merve's scar visible S01E02, absent S01E04" pattern. |
| **Series > Bible > Episodes > Scenes hierarchy** | 🔨 **New (thin)** | New nesting models on top of the existing build/script models (§7). Not a new editor. |
| **Dialogue Specialist · linguistic archetypes** (vocab tier, jargon, banned words) | ♻️ **Mostly reuse** | The existing dialect engine + **14 style packs** + character bible + `ScripOnRewriteSlate`. Add a small per-character linguistic-constraint JSON the style filter reads. |
| **SME Shadow Fact-Checking + Reality Integrator** | 🔨 **New** | Net-new agentic **claim → retrieve → verdict** pipeline. Lesson from research ("Face the Facts!", INLG 2025): ground it in a **curated corpus**, not open web. |
| **Strict 3000-series budget handoff** | ♻️ **Integration + rule** | The existing budget/accounting module + the corrected mapping rule (§2). Not a new ledger. |
| **Hybrid local RTX + Claude** | 🔨 **New infra (sidecar)** | Local **ChromaDB** vector sidecar + a NestJS confidence-router (§1). |
| **Continuity Dashboard** (Season Matrix · Resolution Inbox) + "Create New TV Series" | 🔨 **New UX** | New surfaces inside the **OS shell** — designed in Figma by Cowork (§8). |
| Auth, scheduling, standard script editor, budgeting UI | ♻️ **Reuse as-is** | Existing ScripON. The module only *hooks* them. |

**Bottom line: ~60% reuse/extend, ~40% net-new — and the net-new is concentrated in the SME checker, the hierarchy, the dashboard UI, and the local sidecar.**

---

## 4. Why this is the multi-episode case of the kernel (the key insight)

Research is unanimous that "entity state over time" is a **bi-temporal knowledge graph** problem (Zep/Graphiti; arXiv 2501.13956) — which is precisely what the P0 `CanonFact` model is. A TV series adds two things to that graph: **(a) an episode/season axis** (story-order becomes `season.episode.sceneOrder`), and **(b) immutable-fact locking** (a death, a destroyed car can't be un-asserted) vs. evolving facts (relationships/locations) with an audit trail. Both are small extensions of the kernel, not a rebuild. The continuity "hard error" is just `detectConflicts` reading across episodes.

---

## 5. The continuity engine, cross-episode + live (reuse + WebSockets)

- On scene save/pause, NestJS runs **extract → (local Chroma retrieve) → detectConflicts** against the season's canon. On a hit, it pushes a **typed WebSocket event** (`continuity.alert`) to the client so the alert appears in the **Resolution Inbox** *without blocking typing*. (SSE would suffice for request→response; use **WebSockets** here because the server pushes *unsolicited* alerts — research confirms that's the WebSocket case.)
- Only escalate to **Claude** for *resolution* (rewrite/inline fix), exactly as the provided template intends — but via a NestJS service, local-first.
- Event types: `continuity.alert`, `sme.flag`, `state.updated`, `budget.impact` — a structured channel the dashboard renders in different lanes.

---

## 6. The genuinely new engine — SME Shadow Fact-Checker

Net-new, and worth doing well (it's a real differentiator):
- **Pipeline:** background claim-extraction (medical/legal/historical) → retrieve evidence → verdict — the established agentic FC architecture (InFact/DEFAME, FEVER 2024).
- **Critical design lesson:** professional fact-checkers **don't use open web search** — ground it in a **curated, trusted corpus** (research: "Face the Facts!", INLG 2025). Retrieval is the hard part; budget for it.
- **Reality Integrator** = the same retrieval over a curated history/forensics corpus to *propose* grounded parallels (creative aid), kept separate from canon.
- Runs as a NestJS background job, results pushed via `sme.flag`. Guard the evidence store against poisoning (Fact2Fiction, 2025) — keep it read-only/curated.

---

## 7. Integration manifest (real-stack equivalents of the requested code)

**Prisma models (additive — drift-reconcile, staging, one migration; reuse existing `DevelopmentBuild`/`BuildVersion`/`CanonFact`):**
- `Series { id, title, projectType:'TV_SERIES', bibleId, createdAt }`
- `Season { id, seriesId, number }`
- `Episode { id, seasonId, number, title, scriptDocumentId? }` — links to the existing script model; no new editor.
- `EntityState { id, seriesId, entityId, kind, state, episodeId, validFrom, validTo, immutable:Boolean }` — or fold into `CanonFact` with `seriesId`/`episodeId` (preferred: one graph).
- `CharacterVoiceProfile { id, characterId, vocabularyTier, jargon Json, bannedWords Json, cadence }`
- `SmeFlag { id, episodeId, claim, domain, verdict, sources Json, status }`

**NestJS endpoints (namespaced under `/production/scripton/tv/...` to avoid collisions):**
- `POST /tv/series` (create TV series project type) · `GET /tv/series/:id/matrix` (Season Matrix read-model)
- `POST /tv/continuity/verify` (scene block → conflicts) · `POST /tv/state/update` (asset state change → budget impact)
- `POST /tv/sme/verify` (shadow check) · `POST /tv/dialogue/style` (reuse RewriteSlate + voice profile)
- **WebSocket gateway** `/tv/continuity` (NestJS `@WebSocketGateway`, Socket.IO) → emits `continuity.alert` / `sme.flag` / `state.updated` / `budget.impact`.

**Hooks into existing systems (the "manifest"):**
- **Budget:** call the existing budget module's "add forecast" with `{ category: <Post-Production category id from the active chart>, source: 'continuity', note }` — never a hardcoded series number (§2).
- **Scheduling:** emit a stripboard/schedule-impact event to the existing scheduling module on state changes needing reshoots/units.
- **Auth/RBAC:** reuse `JwtAuthGuard` + `@RequirePermission('production', …)`; TV series is a `production`-scoped resource. No new auth.
- **Namespace:** all tables prefixed conceptually under the canon/TV domain; all routes under `/production/scripton/tv`; the local sidecar is internal-only (not public).

---

## 8. UX / UI — the Continuity Dashboard (Cowork will design this in Figma)

Yes — I'll handle the UX so this drops into the Cinematic V.4 OS shell. The blueprint's 3-pane Continuity Dashboard becomes a **TV-series project type** using the same shell + a new workspace:
- **Left — Season navigator:** Series → Seasons → Episodes tree (replaces the flat scene rail for this project type); episode status + continuity health per episode.
- **Center — Season Matrix:** episodes × entities grid; each cell shows an entity's **state** in that episode (alive/destroyed/location), color-coded; conflicts glow red. This is the "see the whole season's continuity at a glance" surface.
- **Right — Resolution Inbox:** the live feed of `continuity.alert` + `sme.flag` pushes (non-blocking), each with the conflict, the offending episodes, and an **inline resolve** (accept Claude's fix → writes canon + a decision record, reusing the Revision-Pass commit).
- **"Create New TV Series"** entry on Home/Slate + Develop (a project-type choice that switches the hierarchy to Series>Season>Episode>Scene).

It reuses the Write canvas, Canon graph, Versions, Room, and the ⌘K palette unchanged — the TV module adds the **Season Matrix** and **Resolution Inbox** as the new surfaces. I'll build these in the existing Figma file (`dqUr3nasAkQIdefXcGDSyi`) as new frames, consistent with the six screens already there.

---

## 9. Sequencing & guardrails

- **After** the Script-OS P0 (and ideally P1) ship — this module *depends on* the canon kernel + Revision-Pass commit. Don't start before they're merged.
- **Reuse-first**, additive schema via drift-reconcile on staging, one migration per change, never prod, multi-tenancy stays separate — same guardrails as the master spec.
- **One backend (NestJS).** The only new process is the optional local Chroma sidecar.
- **Bind the budget rule to the real chart-of-accounts**, don't hardcode 3000.
- **SME corpus is curated and read-only.**

---

## 10. Sources
Accounting: Media Services sample budget https://www.mediaservices.com/pdf/sample_film_budget.pdf · Wikipedia "Film budgeting" · filmbudgeteers.com topsheet · John Wells Productions budget cheat-sheet https://johnwellsproductions.com/budget-accounts-cheat-sheet · Movie Magic "Account Coding". Continuity/SME/infra: contd.app · Zep/Graphiti temporal KG (arXiv 2501.13956) https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/ · "Face the Facts!" INLG 2025 (arXiv 2412.15189) · FEVER 2024 agentic FC (arXiv 2411.05762) · Chroma vs Milvus · WebSocket-vs-SSE (websocket.org). Full notes in the research transcripts.
