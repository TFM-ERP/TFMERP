# SYS-06 — Platform Domain Architecture (North Star)

**The guiding architecture.** The platform is a **modular enterprise production ecosystem**: every feature belongs to a **business domain (system)**, never merely to a tab/page/form. All systems share one set of **core engines**. This is the blueprint the codebase evolves toward — and a map of how much already exists.

> **Principle:** *Don't think in tabs. Think in business domains.* Tabs overcrowd and don't scale; domains compose and expand.
> **Status:** ✅ exists · ◐ partial · 🔶 spec/planned.

---

## A. Core Platform Layer (shared by every domain)

| Engine | Status | Today |
|---|---|---|
| **User & Identity Management** | ◐ | `User` (employee-driven), JWT+2FA, login audit (SYS-01); crew↔ERP `parentSystemUserId` separation (SYS-05) |
| **Role & Permission Engine** | ◐ | Global 13×10×4 matrix + per-project `PermissionTemplate`/`ProjectRoleAssignment` with field-level security & enforced capabilities (SYS-05 §2). **Target:** the full 9-level model (§D) |
| **Workflow & Approval Engine** | ◐→✅ core | **Universal engine LIVE**: `WorkflowDefinition`/`Node`/`Instance`/`ApprovalAction`; sequential routing, auto-skip nodes, per-node approver by project-template OR global-role, "My Approvals" inbox, `isApproved()` gate for callers. 6 seeded chains (PO/petty-cash/timecard/transfer/overage/invoice). **Integrations LIVE:** PO ("Route for approval") and **project costs/invoices** (Ledger DRAFT cost → "Submit for approval", entity INVOICE if it has an invoice number else EXPENSE) both flow through the engine → My Approvals → on final approval the decoupled effect-applier flips the entity (PO→APPROVED, transaction→APPROVED counts as an actual; also handles transfer/overage/timecard). **Remaining:** petty cash + timecard submit buttons, parallel/conditional modes, SLA-escalation cron, delegation |
| **Notification Engine** | ◐ | Email (collections, callsheets, SMTP per company) + in-app NotificationBell. **Target:** unified email/SMS/push/in-app with approval alerts, deadline/emergency notifications |
| **AI & OCR Engine** | ◐ | Vision OCR (invoice/receipt/timesheet), script breakdown, MM CoA mapping, rate research, DynamicContext RAG (SYS-04). **Target:** + contract/permit OCR, call-sheet parsing, doc classification, budget analysis, cost forecasting, risk ID |
| **Reporting Engine** | ◐ | Cost report (live EFC), trial balance, AP aging, cashflow, report-builder/designer. **Target:** one cross-domain reporting service |
| **Document Vault** | ◐ | Per-project document store + asset photos. **Target:** company+project vault with version control, access control, approval history, AI search, metadata tags, retention, watermarking |
| **Mobile Portal Framework** | ◐ | PWA offline petty-cash + locations sync queue; token/OTP crew onboarding pattern (vendor-onboarding). **Target:** walled crew portal (timecards, scout photos, watermarked scripts) — no ledger reach |
| **Audit & Compliance Engine** | ◐ | Audit-log interceptor (mutations w/ old→new value diffs), global Audit Log page, **per-record history** (`?resourceId=`), login history, budget lifecycle log, period locks, SOX void pattern (spec). **Target:** doc-access logging, uniform cost-change trail, per-entity history popovers wired into records |

---

## B. Business Domains (the 13 systems)

Each maps existing features onto a domain. The crowded "tabs" become **views inside a system**.

1. **Production Planning** — ✅ Project Setup, Script import, Breakdowns, Scheduling, Stripboards · ◐ Version tracking (budget versions exist; script revision tracking 🔶) · 🔶 Development slate.
2. **Budgeting & Cost Control** — ✅ ATL/BTL/POST, Fringes, Union rules, Country/State/City rules, Currency (master FX), Cost Reports, Actuals, Petty Cash, POs · ◐ Forecasting (EFC/ETC live; predictive 🔶). *(Master doc: prod 18.)*
3. **Film Scout & Location** — ◐ Location binder, permits, fee posting, offline locations · 🔶 Scout assignments, tech recces, GIS/map, mobile scout portal, location budgeting/reports.
4. **Workforce & Crew** — ✅ Crew DB, deal memos, onboarding link, timesheets, access mgmt (parentSystemUser), lifecycle status · ◐ Payroll data, certifications · 🔶 Structured contracts, offboarding automation.
5. **Vendor & Rental** — ✅ Rental houses, equipment, inventory, POs, vendor agreements, returns, damage reports (rentals module) · ◐ Delivery tracking.
6. **Accounting & Finance** — ✅ AP/AR, invoices, payment approvals, bank reconciliation, tax (VAT/ZATCA/JoFotara schema), multi-project · ◐ Multi-company · 🔶 WHT/RCM/FX-reval/CT engines (prod 18 spec).
7. **Production Operations** — ✅ Call sheets · 🔶 Daily/Unit Production Reports, progress tracking, safety & incident reports.
8. **Travel & Accommodation** — ◐ Per diems · 🔶 Flights, hotels, transport, visa tracking, travel costs (ATL/BTL T&L accounts exist in CoA).
9. **Asset & Media Management** — ◐ Photos (assets/crew) · 🔶 Videos, references, storyboards, dailies, deliverables, version control.
10. **Legal & Compliance** — ◐ Document vault, insurance accounts, compliance renewals/e-invoicing module · 🔶 Contracts, releases, NDAs, permit mgmt, expiration tracking.
11. **Post-Production** — ◐ POST budget accounts (editorial/VFX/sound/color/deliverables) · 🔶 Workflow tracking, distribution.
12. **Executive Dashboard** — ✅ Executive dashboard, production dashboard (project health, budget/cash, byStatus) · 🔶 Schedule status, crew status, risk indicators consolidated.
13. *(Cross-cutting)* every domain consumes the Core Layer — never reimplements auth/workflow/docs/reporting/AI/audit.

---

## C. How the current UI maps onto the domains (fixing the crowding)

Today the project page crams ~22 tabs into 6 groups; the Production sidebar has 6 links. The domain model regroups them so each lands in its system. **Proposed project tab groups (domain-aligned):**

| Group (system) | Tabs |
|---|---|
| **Overview** | Overview |
| **Planning** | Schedule, Stripboard, Breakdown, Call Sheets |
| **Budget & Cost** | Budget, Top Sheet, Fringe Detail, Incentives, Overages |
| **Accounting** | Budget vs Actual, Cost Report, Purchasing, Ledger, Cash |
| **Workforce** | Crew, Per Diem |
| **Locations** | Locations |
| **Setup & Output** | Project Settings, Labor & Union, Globals, Documents, Email, End Credits |

The Production **sidebar** becomes domain entry points (Dashboard, Projects, Crew, Locations, Vendors…) with masters (Labor & Fringe, Rate Approvals) under a Setup sub-group, rather than a flat crowded list.

> ✅ **DONE** for the project page — tabs regrouped into the 7 domain groups above (Overview · Planning · Budget & Cost · Accounting · Workforce · Locations · Setup & Output). The Production sidebar declutter is the remaining piece.

---

## D. Advanced Permission Engine (target model)

Permissions resolve at **9 levels**, most-specific wins:

```
System → Project → Department → Module → Page → Tab → Section → Record → Field
```

- **Today:** global (system/module/level) + project (template capabilities + field-level). ✅ for System/Module/Project/Field.
- **Target adds:** Department, Page, Tab, Section, Record scoping; admin-buildable Global / Project / Department roles + custom profiles.
- Role library: Producer, EP, Production Manager, Line Producer, AD, Accountant, Location Manager, Scout, Unit Manager, Dept Head, Vendor, Freelancer — each a `PermissionTemplate` with configurable permissions across all systems.

---

## E. Universal Workflow Engine (target model)

One engine, every approvable entity. Modes: Sequential · Parallel · Conditional · Escalation · Delegated · Auto · Reminders.

```
Crew Member → Dept Head → Production Manager → Accountant → Finance → Final
```

Powers: invoices, timesheets, overtime, POs, petty cash, contracts, location approvals, budget changes, schedule changes. (See SYS-05 §3 for the DAG schema sketch.) Replaces the current flat amount-chain, which migrates in as one seeded definition.

---

## F. Build philosophy (how we get there without redesigns)

1. **Domains are stable; tabs are views.** New features attach to a domain, reusing core engines — no new auth/workflow/doc/report code per feature.
2. **Every write is approval-gated, period-guarded, audit-logged, void-not-deleted.** (The V1.1/V1.2 constitution.)
3. **Ship in slices, behind the guardrails**, each updating this doc's ✅/◐/🔶 tags.
4. **Migrate, never break** — historical/locked data and existing numbering are immutable; capabilities apply forward.

This document is the platform's north star. Per-domain detail lives in the SYS-/production-doc set indexed in `docs/INDEX.md`.
