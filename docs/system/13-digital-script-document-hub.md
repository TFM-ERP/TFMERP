# SYS-13 — Digital Script & Document Hub (V1.0)

Tablet-first, offline-capable script annotation + revision-transfer + sides + script-supervisor
lining, wired into the existing ERP (IAM, breakdown, costing/payroll, crew portal). This doc is
the architecture spec + sliced build roadmap. It is grounded in what already exists in the
codebase — we extend, we don't reinvent.

---

## 1. Why

Paper scripts lose notes on every revision, silo continuity/prop data away from accounting, and
leak. This hub solves three things at once:

1. **Zero data loss on revisions** — notes re-anchor to their text in the next draft automatically.
2. **Creative → financial bridge** — a prop highlight can draft a PO; a take "wrap" feeds Hot Cost.
3. **Walled-off collaboration** — department layers gated by the existing project-role IAM.

---

## 2. What we already have (reuse map)

| Need | Existing asset | How we use it |
|---|---|---|
| Extract text from a script | `backend/.../breakdown/script-import.service.ts` → `extractText()` (pdf-parse, .fdx/.pdf/.docx/.txt) | Text per page + per scene = the anchor source for note-transfer. |
| Scene model | `ProductionStrip` (sceneNumber, intExt, dayNight, setName, location, description, pages, cast) | Outline tab + Sides scene selection + lining scene context. |
| IAM / project roles | `ProjectRoleAssignment` + `PermissionTemplate` (key/name, permissions, fieldLevelAccess) | Layer visibility walls (Feature 4). |
| Offline write queue | `frontend/src/lib/offline-db.ts` (IndexedDB) + `useOfflineSync.ts` (auto-flush on `online`) | Extend `QueueKind` with `scriptAnnotation`, `sidesRequest` (Feature 5). |
| Cost engine | `production/costing/costing.service.ts` + `hr/payroll.service.ts` | Lining out-times → Hot Cost / overtime + meal penalties (Feature 3). |
| Distribution | `production/mail/mail.service.ts` (per-project SMTP, secure-link pattern) | Push watermarked sides / export links. |
| Portal access rule | V1.2 `parentSystemUserId` portal-only rule | Crew portal surface for on-set tablet use. |
| Call sheet (today's scenes) | `CallSheet.scheduleItems` (scene list) | Sides generator pre-selects tomorrow's scenes. |

### New dependencies (prerequisites — flagged, not yet installed)
- **Frontend render:** `pdfjs-dist` — render PDF pages to an HTML5 `<canvas>`; we hand-roll the
  annotation overlay as an absolutely-positioned SVG/div layer over the canvas (no fabric/konva,
  keeps the bundle lean).
- **Backend generation:** `pdf-lib` — page pruning, drawing cross-out boxes + "Continues",
  2-up imposition, and per-recipient watermarking for Sides + secure export.
- **String distance:** hand-rolled Levenshtein (≈30 lines, no dep) for the transfer algorithm.

---

## 3. Data model (new Prisma models)

All project-scoped (`projectId`), plain-FK pattern where it avoids touching big models.

- **ScriptDocument** — one per script (e.g. "Ep 101"). `projectId`, `title`, `kind`
  (SCRIPT | SIDES | ONELINER | OTHER), `activeRevisionId`, timestamps.
- **ScriptRevision** — an uploaded draft. `documentId`, `revisionLabel` ("White/Blue/Pink…"),
  `colorCode`, `fileUrl`, `pageCount`, `uploadedById`, `createdAt`. **`pageText Json`** =
  `[{ page, text }]` and **`sceneIndex Json`** = `[{ sceneNumber, heading, page, charStart }]`
  captured at upload via `extractText()`. This is what the transfer algorithm matches against.
- **AnnotationLayer** — `revisionId?`/`documentId`, `name`, `type` (PERSONAL | DEPARTMENT |
  MEETING | SCRIPT_SUPE | EXEC), `ownerUserId`, `department?`, `color`, `visibility`
  (PRIVATE | SHARED_ROLE | PROJECT). Layers belong to the **document** (carry across revisions),
  annotations belong to a **revision** but re-anchor forward.
- **Annotation** — the decoupled note. `layerId`, `revisionId`, `page`, `tool`
  (HIGHLIGHT | PEN | TEXT | STICKY | TAG | TRAMLINE), `payload Json` (vector points / text /
  color / tag-key), **`anchorText String`** (≈50 chars captured around the mark),
  **`anchorHash`**, `anchorOffset Int`, `x`/`y`/`w`/`h Float` (normalized 0..1 of page),
  `createdById`, timestamps. On a new revision a **copy** is made with recomputed coords; the
  original stays bound to its revision (full history).
- **LayerShare** — `layerId`, `templateKey` (e.g. `DEPT_HEAD`) **or** `roleTag`/`department`,
  `access` (VIEW | EDIT). The IAM wall.
- **SidesJob** — `projectId`, `documentId`, `revisionId`, `shootDate`, `scenes Json`,
  `recipients Json`, `status`, `outputUrl`, `createdById`.
- **LiningTake** — script-supervisor take log. `projectId`, `revisionId`, `sceneNumber`,
  `slate`, `take`, `coverage` (the tramline payload: lines + on/off-screen), `inAt`/`outAt`,
  `circled Boolean`, `notes`. Day-wrap pushes `outAt` to Hot Cost.

> Dual-target note: this epic is project-scoped only (a script belongs to a production). No
> master/library variant.

---

## 4. Feature → architecture

### F1 · Text-anchoring note transfer (the heart)
Annotations are **never flattened** into the PDF. Each carries `anchorText` (the surrounding
dialogue/action string) + normalized coords. On a new `ScriptRevision` upload, the backend:
1. `extractText()` → `pageText` + `sceneIndex` for the new draft.
2. For each annotation, Levenshtein-match `anchorText` against the new draft's text (tolerant of
   typo fixes / minor rewrites; threshold ~0.85 similarity).
3. Map the matched string's position → new `page` + normalized `x/y` → write a **new** Annotation
   bound to the new revision. Unmatched notes land in an **"Orphans" tray** for manual placement.
4. "Compare Scripts" = scene-by-scene diff of the two `sceneIndex`es (added / removed / moved /
   reworded), surfaced in the version dropdown.

### F2 · Automated Sides (`pdf-lib`)
1st AD picks tomorrow's scenes (pre-filled from the Call Sheet) → backend:
1. Copy master PDF → delete pages with **no** selected scene.
2. On kept pages, draw cross-out boxes + diagonal over the regions that are **not** today's scenes
   (region bounds come from `sceneIndex` char offsets → line geometry).
3. Inject "Continues" when a scene splits a page.
4. 2-up imposition, **per-recipient name watermark** (leak tracing), push to portal + email.

### F3 · Script-supervisor lining → Hot Cost
Digital lining tool draws vertical tramlines (solid = on-screen, dashed = off-screen) tagged to a
slate/take. "Wrap Take" logs `outAt`; final camera wrap pushes the day's out-times into
`costing`/`payroll` so overtime + meal penalties compute with **no manual DPR entry**.

### F4 · Live layers + IAM walls
Layer visibility is enforced **server-side**: the annotations endpoint filters by the requester's
`ProjectRoleAssignment` → only PROJECT layers, their own PERSONAL layers, and layers shared to
their role via `LayerShare` are ever serialized. A background actor's API request for the Art
Dept payload returns nothing — the wall is at the data layer, not the UI.

### F5 · Offline-first
Extend `offline-db` `QueueKind` with `scriptAnnotation` + `sidesRequest`. On open-while-online the
PDF + annotation payloads cache to IndexedDB; offline edits queue locally; `useOfflineSync` flushes
the queue automatically on reconnect — no manual save. (Reuses the exact pattern already shipped
for Petty Cash + Locations.)

---

## 5. Build roadmap (slices)

Prereq before D2: `npm i pdfjs-dist` (frontend) + `npm i pdf-lib` (backend). Each slice ends with
`prisma db push` + `generate` + `tsc` (both ends) + smoke + commit.

- **D1 — Document spine.** `ScriptDocument` + `ScriptRevision`; upload → `extractText()` stores
  `pageText` + `sceneIndex`; viewer shell (pdfjs canvas render, page nav, thumbnails, Outline tab
  from `sceneIndex`); version dropdown. Lives in the project under a new "Script" tab.
- **D2 — Annotations + overlay (must-have).** `AnnotationLayer` + `Annotation`; tool palette
  (highlight/pen/text/sticky/tag); decoupled JSON payload with `anchorText` capture; SVG overlay
  render over the canvas; per-annotation CRUD.
- **D3 — Text-anchoring transfer (must-have).** Levenshtein matcher; on new revision, migrate
  annotations forward + Orphans tray; "Compare Scripts" scene diff.
- **D4 — Layers + IAM walls (must-have).** Layer types + `LayerShare`; server-side visibility
  filter by `ProjectRoleAssignment`; layer toggle menu scoped to the user's role.
- **D5 — Sides generation (must-have).** `SidesJob`; `pdf-lib` prune + cross-out + "Continues" +
  2-up + watermark; Sides Generator tab; push via mail/portal.
- **D6 — Lining → Hot Cost (must-have).** `LiningTake`; tramline tool + take logging; wrap-take /
  wrap-day → out-times into `costing`/`payroll`; Daily Production Report stub.
- **D7 — Offline-first.** Extend `offline-db` kinds; cache PDF + payloads; background sync; sync
  status indicator.
- **D8 — Secure export + portal polish.** Watermarked single-layer PDF export; share; crew-portal
  surface (tablet); verify pass.
- **D9 — Prop → draft budget line bridge.** TAG annotations with a budget code create/attach a
  DRAFT `BudgetLineItem` (`associatedLineItemId`); "Procurement Staging" panel in the Binder view.
- **D10 — PII reveal via email OTP.** Masked sensitive fields (IBAN/passport) reveal only after a
  6-digit OTP delivered over the **existing SMTP** (zero third-party); short-lived, rate-limited.
  (Crew-portal security; folds the deferred §7.6 item in without an SMS gateway.)

---

## 6. Open decisions / risks

- **PDF render engine** — `pdfjs-dist` (canvas) is the pragmatic choice over raw WebGL; revisit
  only if perf on large scripts demands it.
- **Coordinate model** — store normalized (0..1) per page so zoom/DPI changes don't break overlays.
- **Hot Cost reality** — confirm `costing.service` exposes an overtime/meal-penalty entry point
  before D6; if not, D6 adds a thin `hotCost` method rather than a full engine.
- **Watermark leak-tracing** — per-recipient name + a hidden job/recipient id; not DRM, but
  traceable.
- **PII in layers** — EXEC/financial layers must be in `fieldLevelAccess`-style deny by default.
- **Prop-highlight → draft PO** — deferred past V1.0 (depends on the procurement module); the TAG
  tool stores a `tag-key` now so the hook is cheap to add later.

---

## 7. V1.1 blueprint reconciliation (detailed schema + math + stack corrections)

A detailed implementation blueprint was reviewed and folded in. It sharpens the schema, the
transfer math, the lining/ERP monitor, and the offline model. Several of its assumptions target a
different stack than what TFM actually runs — those are **corrected** below so the build stays
native to the codebase.

### 7.1 Stack corrections (blueprint → TFM reality)
| Blueprint says | TFM reality | Decision |
|---|---|---|
| `@default(uuid())` | every model uses `@default(cuid())` | Use **cuid**. |
| `pdfUrl` = S3 presigned URL; "AWS backend" | uploads are **local disk via multer** (`/uploads/<file>`, served by the API, resolved with `assetUrl`); no `aws-sdk` installed | Store `pdfUrl` as the local `/uploads/...` path. S3 is a future infra swap, not a V1.0 dep. |
| React Native + WatermelonDB + SQLite | frontend is a **Next.js PWA**; offline already runs on **IndexedDB** (`offline-db.ts` + `useOfflineSync.ts`) | Reuse the existing IndexedDB queue; extend `QueueKind` with `scriptAnnotation` + `sidesRequest`. No React Native. |
| `permissionSet` maps to a `ProjectRoleEnum` like `DEPT_HEAD_ART` | IAM gates on **`PermissionTemplate.key`** (`LINE_PRODUCER`, `DEPT_HEAD`, …) + the assignment's **department** context; there is no per-dept role enum | `LayerShare` carries `templateKey` **+** optional `department` (e.g. `DEPT_HEAD` ∧ `Art`). |
| Collisions flagged in a "Notification Center" | **no Notification model** exists (the bell is frontend-only) | Collisions set the annotation's `conflict=true` and surface in a **Conflicts tray** in the hub; both versions preserved as separate annotations. |
| One-to-many relations written without `[]` / no back-relations | Prisma requires array + named back-relation | All relations get `[]` + explicit back-relations. |

### 7.2 Adopted schema deltas (refines §3)
- **`ScriptScene` becomes a real table** (not just `sceneIndex Json`): `scriptId`/`revisionId`,
  `sceneNumber`, `slugline`, `pageStart`, `pageEnd`. It's the FK target the lining/coverage rows
  need, and it's *distinct from* `ProductionStrip` (the strip is the scheduling/breakdown unit;
  `ScriptScene` is the parsed-from-PDF unit with page ranges). Optional link
  `productionStripId?` ties the two when scene numbers match.
- **`Annotation` gains** `surroundingContext String?` (≈100 chars each side, to disambiguate
  duplicate dialogue), `anchorOffset Int?`, and `associatedLineItemId String?` → plain FK to
  **`BudgetLineItem`** (the prop→budget bridge target, which exists). The PO *generation* stays
  deferred; the link field ships now.
- **`ScriptCoverage`** (tramlines) + **`TakeLog`** (slate/take, `isCircleTake`, timecode in/out,
  `wrapTimestamp`) are adopted as in the blueprint, FK'd to `ScriptScene`. `wrapTimestamp` is the
  value pushed to Hot Cost on day-wrap.

### 7.3 Transfer math (locks F1 numbers)
- Match metric = **Normalized Levenshtein** `NL(s,t) = 1 − D(s,t)/max(|s|,|t|)`; positive match at
  **NL ≥ 0.92** (blueprint value; was 0.85 in §4 — adopt 0.92). LCS is used as a fast pre-filter to
  shortlist candidate blocks before the (costlier) edit-distance pass.
- Re-map = translation vector **Δ = Q − P** where P/Q are the old/new normalized bounding boxes;
  no scaling assumed (same page geometry), only translation. Sub-0.92 matches → Orphans tray.

### 7.4 Lining → ERP monitor (sharpens F3 / D6)
The lining dashboard shows a live **Overtime/Hot-Cost monitor**: target wrap vs projected wrap,
current OT minutes, and an accrual estimate (base payroll + OT + meal penalty + forced-call count)
with a **"Push accrual to Hot Cost"** action. Backend computes from `TakeLog.wrapTimestamp` + the
project's call time + crew rate card via `costing`/`payroll`. (Confirm the `costing.service`
overtime/meal-penalty entry point at the start of D6; add a thin `hotCost()` method if absent.)

### 7.5 Offline idempotency (sharpens F5 / D7)
Each queued op carries an **`idempotencyKey`** + `timestamp` + `action` (e.g. `CREATE_ANNOTATION`)
+ `payload`; the server replays them in order and is idempotent on the key (safe re-sends). On a
concurrent-edit collision the op is **not dropped** — it lands in the Conflicts tray with both
versions retained as separate annotations (per 7.1).

### 7.6 Deferred to a separate Crew-Portal security slice (not SYS-13 core)
- **PII OTP masking** — startwork/onboarding fields (IBAN/passport) render masked
  (`AE** **** **** ***1234`) and require an OTP reveal before the vault decrypts. There is **no OTP
  service today** (only a login DTO). This is a Crew-Portal/onboarding security feature that spans
  beyond the script hub; tracked as its own item, not blocking D1–D8.
- **Expense/petty-cash OCR → multi-stage approval → ledger** (blueprint §4.2) is **already built**
  (V1.2 OCR + the workflow/approval engine + accounting controls). No SYS-13 work; referenced only
  to show how the portal's sibling flows behave.
