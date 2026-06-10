# SYS-14 · UX Redesign — Information Architecture Consolidation Map (RESEARCH)

Status: **research / proposal — nothing implemented.**
Companion to `docs/system/mockups/redesign-shell-mockup.html` (the clickable shell).

Principle: the nav narrates how a production company works, not how the database is
organized. Company-wide libraries live in hubs; project-specific work lives inside the
project, organized by production phase. Every page stays reachable via Ctrl-K.

---

## 1 · Hubs: 18 modules → 7 rail icons

| # | Hub | What moves in (from today's modules) |
|---|-----|--------------------------------------|
| 1 | **Home** | Home (Dashboard, Executive, Workflow & KPIs) + Production "My Approvals" + Finance "Approvals" → one **My Day** inbox with filters |
| 2 | **Production** | Production, ScriptON, Locations, Casting, Contracts (production-side) — the modules that already alias production permissions |
| 3 | **Finance** | Finance + Compliance (VAT, e-Invoicing) |
| 4 | **People** | HR, Partners, Travel & Visas |
| 5 | **Assets** | Rentals, Maintenance, Transport (fleet), Accommodation (properties) |
| 6 | **Insights** | Reports, CRM |
| 7 | **Setup** | Setup + every stray admin page (rate approvals, audio engines, email config) |

---

## 2 · Page-by-page disposition

Legend: **Keep** (same place, new shell) · **Move** (new home) · **Merge** (folds into another page) · **Kill** (duplicate — one source of truth remains)

### Home hub
| Today | Disposition |
|---|---|
| Home / Dashboard | Keep → **My Day** (personal worklist) |
| Home / Executive | Keep (role-gated tab of Home) |
| Home / Workflow & KPIs | Merge → into My Day + Insights |
| Production / My Approvals | **Move** → My Day "Approvals" filter |
| Finance / Approvals | **Move** → My Day "Approvals" filter (finance-scoped view stays linkable) |

### Production hub
| Today | Disposition |
|---|---|
| Production / Dashboard | Keep → hub overview |
| Production / Projects (+ [id] workspace) | Keep → the 6-phase workspace (§3) |
| Production / Crew Directory | Keep (company library) |
| Production / Email Sender | **Move** → Setup / Email & Notifications (project sends launch from inside the project) |
| Production / Labor & Fringe Master | **Move** → Setup / Master data |
| Production / Rate Approvals | **Move** → Setup / Master data (or My Day approvals feed) |
| ScriptON / Script Library | Keep → Production / Script Library (company library) |
| ScriptON / Audio Engines | **Move** → Setup / Integrations & engines (admin config, not daily work) |
| Locations / Library, Map, Scouting, Scout Visits | Merge → **one Locations Library page** with view switcher (list / map) + Scouting tab |
| Locations / Permit Authorities | **Move** → Setup / Master data |
| Casting / Dashboard | Kill (thin) — its numbers fold into Talent page header |
| Casting / Talent Database | Keep → Production / Talent (company library) |
| Contracts / Dashboard | Kill (thin) — list IS the page |
| Contracts / Templates | **Move** → Setup / Templates |

### Finance hub
| Today | Disposition |
|---|---|
| Dashboard | Keep |
| Quotations, Invoices, Collections | Keep → grouped as **Sales** section |
| Payments, Expenses | Keep → grouped as **Payables** section |
| COA, Journals, Trial Balance, Bank Rec | Keep → grouped as **Ledger** section |
| Compliance / VAT Return, e-Invoicing | **Move** → Finance / Compliance section |
| Compliance / Renewals | **Move** → People (staff licences) or Assets (vehicle renewals) — split by record type |

### People hub
| Today | Disposition |
|---|---|
| HR / Dashboard, Employees, Attendance, Leave | Keep → **Employees** section |
| HR / Payroll | Keep |
| Partners / All, Clients, Suppliers, Vendors, Contacts | Merge → **one Partners page** with type filter chips (5 pages → 1) |
| Travel / Dashboard | Kill (thin) — travelers list IS the page |
| Travel / Travelers | Keep → People / Travel & visas |

### Assets hub
| Today | Disposition |
|---|---|
| Rentals / Dashboard, Bookings, Availability, Utilization | Keep → **Fleet & rentals** (Availability + Utilization merge into one calendar/insights view) |
| Rentals / Assets, Inventory, Services | Keep |
| Rentals / Drivers, Driver Approvals | Merge → one **Drivers** page (approvals = tab) |
| Rentals / Incidents, Fuel | Keep → **Operations** section |
| Maintenance / Records, Jobs, PM Schedule, Damage, Tires, Parts | Keep as **Maintenance** section (6 pages → 4: Records+Jobs merge, Tires+Parts → "Parts & tires") |
| Transport / Vehicles & Drivers | Merge → Fleet (it duplicates rentals fleet concepts) |
| Transport / Logistics Dashboard | **Move** → inside project (Shoot phase); company-level view under Assets/Operations |
| Accommodation / Properties | Keep → Assets / Properties |

### Insights hub
| Today | Disposition |
|---|---|
| Reports / Center, Designer, Builder | Merge → **one Reports page**, tabs: Browse · Design (3 pages → 1) |
| CRM / Pipeline, Leads | Merge → **one CRM page** with Pipeline/Leads toggle |

### Setup hub
| Today | Disposition |
|---|---|
| Company, Users, Roles & Permissions, Workflows, Integrations, Audit, Currencies, Backups | Keep |
| Identity Changes | Merge → Users (review queue tab); **kill** the duplicate path from Account/Security |
| Email & Notifications | Keep — **single source**; kill `/production/settings/email` |
| + receives: Audio engines, Labor & fringe, Rate approvals, Permit authorities, Contract templates | (from above) |

**Net result: ~107 pages → ~62 destinations.** Nothing is lost — merged pages become tabs/filters, and Ctrl-K reaches everything by name.

---

## 3 · Project workspace: 34 tabs → landing + 6 phases + settings

**Landing (not a phase):** Overview → becomes the project worklist ("what needs attention"), checklist, recent activity.

| Phase | Absorbs today's tabs |
|---|---|
| **Develop** | script (ScriptON: read, notes, tags, analyze, audio) |
| **Plan** | schedule, breakdowns, locations, casting, crew, contracts, travel, accommodation, transport (booking side) |
| **Budget** | budget, topsheet, fringe, incentives |
| **Shoot** | callsheets, perdiem, shuttle, arrivals, fuel, logistics, overages |
| **Account** | actual, costreport, purchasing, accounting, cash |
| **Deliver** | credits, documents (outputs), exports |
| **⚙ Project settings** (gear, not a phase) | settings, labor (project labor matrix) |

Rules:
- A phase page = a few surface tiles + a worklist (see mockup). No phase shows more than ~6 tiles.
- Opening a surface (e.g. ScriptON) is a **full-page takeover**: breadcrumb deepens, context row swaps. Chrome never exceeds 2 rows.
- Cross-phase records (e.g. a travel booking with cost) appear where the work happens; money always ALSO rolls up in Budget/Account automatically.

---

## 4 · ScriptON surface: 11 toolbar buttons → 8 context tabs + actions menu

| Today (toolbar button) | Proposed |
|---|---|
| (viewer itself) | **Pages** tab (default) |
| Reader | **Reader** tab |
| Tags | **Tags** tab |
| Lining | **Lining** tab |
| Sides | **Sides** tab |
| Analyze | **Analyze** tab |
| Audio Studio | **Audio Studio** tab (its 5 tabs replace the row on entry) |
| Audio (voice memos) | Merge → Reader (record note) + Audio Studio Library |
| Pages (facing pages) | Merge → Sides ("Page maker" is a sides-adjacent output) |
| Procurement | Merge → Tags (it stages FROM tags) with a "send to Budget" action |
| Upload revision / Library link / Export | **"⋯ Actions" menu** + Ctrl-K actions |

---

## 5 · Migration order (when you say go — smallest risk first)

1. Token sheet + dark-mode token migration (kills the readability bug class) — no IA change.
2. New shell (rail + breadcrumb + single context row) wrapping EXISTING pages unchanged.
3. Project workspace: regroup 34 tabs into landing + 6 phases (pure regrouping, no page rewrites).
4. ScriptON toolbar → context tabs (replace overlays-on-overlays with takeovers).
5. Hub consolidation moves (the table above), with old URLs redirecting.
6. Kill duplicates last, once redirects prove nothing references them.
