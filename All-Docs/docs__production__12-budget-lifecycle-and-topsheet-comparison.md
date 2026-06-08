# 12 — Budget Lifecycle & Dual-Column Topsheet Comparison

Sequential lifecycle versioning, role-gated status transitions with a deep audit trail, and a real-time dual-column topsheet (Locked Baseline vs Current Working). Backend: `budget.service.ts` / `budget.controller.ts`. Frontend: `TopsheetComparisonPanel` (the project **Top Sheet** tab).

---

## 12.1 Schema (implemented)

```prisma
enum BudgetVersionStatus { DRAFT REVIEW APPROVED LOCKED WORKING }

model BudgetVersion {
  // …existing fields…
  status          BudgetVersionStatus @default(DRAFT)
  versionSequence Int     @default(0)   // assigned on submission to REVIEW (V1, V2 …)
  parentVersionId String?               // which locked baseline a WORKING copy branched from
  parentVersion   BudgetVersion?  @relation("VersionBranching", …)
  childVersions   BudgetVersion[] @relation("VersionBranching")
  lifecycleLogs   BudgetLifecycleLog[]
}

model BudgetLifecycleLog {
  id, projectId →, budgetVersionId →,
  fromStatus, toStatus  BudgetVersionStatus,
  versionNameSnap       String,   // what it was called at that moment ("Budget V3")
  changedById  String?, changedByRole String?,  // crew/system role at time of change
  notes String?, createdAt
}
```

> `changedByRole` is a `String` (not the crew enum) so privileged system actors (`SYSTEM_ADMIN`, `FINANCE_MANAGER`, `DIRECT_LOCK`, `BRANCH`) can be recorded alongside crew roles.

## 12.2 State machine

```
DRAFT ──► REVIEW (V1…Vn) ──► APPROVED ──► LOCKED ──► WORKING (branch via clone)
            ▲    │ send back      │ reopen              │ resubmit as next V
            └────┴────────────────┘                     ▼
                                                      REVIEW
```

Implemented transition map (`BudgetService.TRANSITIONS`):
`DRAFT→REVIEW` · `REVIEW→APPROVED|DRAFT` · `APPROVED→LOCKED|REVIEW` · `LOCKED→∅` (branch only) · `WORKING→REVIEW|LOCKED` (the LOCKED arc keeps the legacy direct-lock button working).

Hooks on transition (`executeStatusTransition`):
- **→ REVIEW**: queries `max(versionSequence)` on the project, assigns `seq+1`, renames to `Budget V{seq}`.
- **→ LOCKED**: stamps `lockedAt`; the existing `assertVersionEditable()` guard then makes every line/section/account/global/fringe mutation throw.
- **Every transition** writes a `BudgetLifecycleLog` (from/to, name snapshot, actor, role, notes).
- `cloneVersion` now records `parentVersionId` and logs a `BRANCH` entry; `lockVersion` (legacy button) logs `DIRECT_LOCK`.
- New projects and new manual versions start as **DRAFT** (schema default changed); working copies and Movie Magic imports are **WORKING**.

## 12.3 RBAC

`PATCH /production/budget/versions/:versionId/status` requires `production` **level 2** plus a per-project authority check inside the service:
- the caller's `ProductionCrew` assignment on that project must be `EXECUTIVE_PRODUCER`, `PRODUCER` or `LINE_PRODUCER`, **or**
- their system role is `SYSTEM_ADMIN` / `FINANCE_MANAGER`.
Anyone else gets `403 — Administrative authority required…`. Coordinators/assistants can view comparisons but cannot transition states.

## 12.4 Dual-column topsheet engine

`GET /production/budget/topsheet-comparison/:projectId?baselineId&workingId` →
- **Baseline default**: most recently locked version (fallback: an APPROVED one).
- **Working default**: the `isActive` version (fallback: latest WORKING).
- Aggregates each version's section totals (Σ line `total`, which is already `qty×rate÷fx + fringe`), matches sections **by code** across the two versions, and returns:

```json
{
  "baseCurrency": "AED",
  "baseline": { "id", "versionName", "status" },
  "working":  { "id", "versionName", "status" },
  "topsheetGrid": [{ "sectionCode": "1000", "sectionTitle": "ABOVE THE LINE",
      "lockedBaseline": { "versionName": "Budget V1", "total": 450000 },
      "currentWorking": { "versionName": "Working Copy — June", "total": 485000 },
      "variance": -35000 }],
  "grandTotals": { "baseline", "working", "variance" },
  "versions": [ …all versions for the two dropdown pickers… ]
}
```
`variance = baseline − working` (negative ⇒ the working copy is **over** the baseline).

`GET /production/budget/lifecycle/:projectId` returns the audit trail (newest first, 100 max).

## 12.5 Frontend — `TopsheetComparisonPanel`

Replaces the old single-version Top Sheet tab:
- **Two version pickers** (Baseline / Working) defaulting to the resolved pair, with status badges.
- **Comparison grid**: Code · Section · Locked Baseline · Current Working · Variance (over-budget rows tinted red), grand-totals row.
- **Status-aware action bar** on the selected working version: *Submit for review* (DRAFT/WORKING), *Approve* / *Send back to draft* (REVIEW), *Lock as baseline* (APPROVED), *Create working copy* (LOCKED — clone + activate). Every action prompts for notes, and server-side RBAC rejects unauthorized users.
- **Change History & Status Management**: the lifecycle log timeline (`14:22 | DRAFT → REVIEW (V1) by line producer — Finalized script lock`).
- Print button still opens the branded `/print/topsheet/[versionId]` PDF.

## 12.6 Compatibility notes

- Existing versions keep their `WORKING/APPROVED/LOCKED` statuses; `versionSequence` backfills to 0 (unsequenced) and is assigned on their first submission to REVIEW.
- Existing guards (`assertVersionEditable`, cost-report revised-budget math, working-copy flow) are unchanged — LOCKED remains the only read-only state.
- Migration required: `npx prisma db push && npx prisma generate` (enum values, three new columns, one new table).
