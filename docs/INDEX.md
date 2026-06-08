# TFM System — Documentation Index

Master map of every architecture/reference document. All are deep-search-ready Markdown; doc 18 also ships a machine-readable `.json` twin.

## System-wide (`docs/system/`)

| Doc | Covers |
|---|---|
| [SYS-01 User Accounts, Roles & Permissions](system/01-user-accounts-roles-permissions.md) | JWT + 2FA auth, 13 roles × 10 modules × 4 levels RBAC, employee-driven user lifecycle, login audit |
| [SYS-02 Finance Module](system/02-finance-module.md) | Quotations → invoices → payments, VAT, expenses + amount-based approvals, collections/reminders, client master |
| [SYS-03 Core Accounting](system/03-core-accounting.md) | GL chart, manual + auto-posted journals (idempotent), trial balance, bank reconciliation, burden posting bridge |
| [SYS-04 AI Architecture](system/04-ai-architecture.md) | Every Claude call site, the guardrail constitution, DynamicContext RAG pipeline, provenance |
| [SYS-05 V1.2 IAM & Workforce](system/05-v1.2-iam-identity-workforce.md) 🔶 | V1.2 blueprint: 3-entity identity separation (ParentUser/TalentProfile/CrewMember), passwordless OTP onboarding, per-project RBAC + field-level security, DAG approval engine, document vault + expanded OCR, offline crew portal, lifecycle automation |
| [SYS-06 Platform Domain Architecture](system/06-platform-domain-architecture.md) ★ | **North star** — 9 core engines + 13 business domains, current build mapped in (✅/◐/🔶), 9-level permission model, universal workflow engine, domain-aligned navigation plan |
| [SYS-07 Film Scout & Location System](system/07-film-scout-location-system.md) ✅ | Standalone Master Location Library + two-way project integration; scouting, tech recces, scoring, **typed permits + authority directory**, **security/marshals**, **payment schedule**, document vault + bilingual NOC, compliance/expiry alerts, **Google map (cluster + heatmap)**, **.msg email intake**; built phases 1–8 |
| [SYS-08 People & Network: Crew, Contacts & Directories](system/08-crew-contacts-people-network.md) ✅ | Master people model (CrewMember + Contact + Client/Supplier/Vendor); **crew ADFC reel-scout profile parity** (links, credits, skills, resume, affiliations, multi-role), **paste-a-profile importer**, per-department directory view; contact classification |
| [SYS-09 Email Intelligence & Contact Reconciliation](system/09-email-intelligence-and-contacts.md) ✅🔶 | On-machine `.msg` analyzer — parse/extract/classify/dedupe contacts vs live DB at master level (dry-run + apply); mailbox insights (8,349 emails) and the proposed **Travel/Visa/Logistics**, **Contracts**, **Casting/Recruitment** modules |
| [SYS-10 Casting & Recruitment](system/10-casting-recruitment.md) ✅🔶 | Dual-target casting — master dashboard + Talent Database + per-project panel + public `/apply` portal (GDPR Auto-Window); calls from breakdown, auditions, **Select → Deal Memo** (fringe-wired), talent-rep privacy. Includes **V2.0 enhancement spec**: Talent Readiness Engine, Travel Requirement Engine, Talent Operations Hub, Character Profile, Producer Review Board, Talent Performance Review, Negotiation Management |
| [SYS-11 Travel, Visa & Identity](system/11-travel-identity-and-logistics.md) ✅ | Universal `TravelerProfile` identity for talent + crew (ATL/BTL) + accompanying/consultant/VIP; passport/visa/ID + validation + readiness + documents repository + accompanying sub-profiles + meet-&-greet arrival sheet; Visa SLA engine; Two-Ledger + House project; smart-connect; configurable `travel_pii` privacy |
| [SYS-12 Accommodation, Transportation & Logistics](system/12-accommodation-transportation-logistics.md) 🔶 | **SPEC** — standalone master for where people stay & how they move (post-travel). Reuses fleet (`Asset`/`Driver`/`FuelLog`), `Supplier`/`ProductionVendor`, universal `TravelerProfile`, V2-A requirement flags, `TravelArrival` and Two-Ledger; adds only accommodation (`AccommodationProperty`/`RoomInventory`/`AccommodationAssignment`) + transport scheduling (`TransportOrder`/`TransportAssignment`/`ShuttleRoute`). Daily Movement & Occupancy boards; logistics + cost-per-shooting-day reports; phased A→G |

## Production module (`docs/production/`)

| Doc | Covers |
|---|---|
| [README](production/README.md) | Architecture, stack, module map, cross-cutting concepts |
| 01 Data model · 02 Projects · 03 Budget · 04 Finance/Accounting · 05 Crew & People · 06 Union/Fringes · 07 Rebates/Incentives · 08 AI involvement · 09 API reference · 10 Movie Magic sync | Per-area technical detail |
| [12 Budget lifecycle & topsheet comparison](production/12-budget-lifecycle-and-topsheet-comparison.md) | DRAFT→REVIEW→APPROVED→LOCKED→WORKING + dual-column comparison |
| 13 Master CoA & crew link · [14 System flows & charts](production/14-system-flows-and-charts.md) (**project-side visual master**) · 15 Distribution ledger & MM import · [16 Setup flows](production/16-setup-labor-fringe-fx-flows.md) (**setup-side visual master**) | |
| [17 MM industry CoA reconciliation](production/17-mm-industry-coa-reconciliation.md) | Industry numbering adoption, legacy translation, category mapping |
| [18 Budget & Accounting structure v2](production/18-budget-accounting-structure.md) + [.json twin](production/18-budget-accounting-structure.json) | **Money master-doc**: implemented core + studio-grade spec (e-invoicing, WHT, RCM, FX reval, SOX void, weekly financier reports, project-entity TB & audit pack) |

## Design references (`docs/`)

budget-data-model-overview · film-crew-taxonomy · fringe-union-intelligence-design · locations-and-per-diem-design · production-workflow-and-incentives

## Conventions

✅ IMPLEMENTED = live in code · 🔶 SPEC = approved architecture pending build. `CHANGELOG.md` (repo root) is the chronological record.
