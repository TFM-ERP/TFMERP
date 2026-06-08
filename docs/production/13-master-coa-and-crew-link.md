# 13 — Master Chart of Accounts & Crew-to-Budget Linking

Defines the default COA seeded by `ProjectsService.createDefaultBudget()` on every new project, and the crew-to-budget-line dropdown in the frontend budget grid. Implemented as specified, with the adaptations noted below.

---

## 1. Crew-to-Budget Linking (implemented)

**Goal:** a Line Producer clicks a dropdown on any budget line, picks a crew member already onboarded to the project, and the line shows e.g. `1301 Producer (Name) Qais Qandil`.

**How it works:**
- The dropdown lists **project crew** (`CrewService.findByProject` via `productionApi.crew.list`), showing `name · role · rate/day`.
- On select, the line's existing **`crewMemberId`** field is set. (Stored value: the assignment's Crew-Directory link `crewMemberId` when present, else the assignment id — the grid resolves either back to a name.)
- **Rate pull prompt:** if the assignment has a `dailyRate`, the UI asks *"Pull {name}'s daily rate of {rate} into this line?"* — accepting sets the line's rate (and `days` units in the add form).
- **Display:** the grid row renders a sky badge after the description: `(Name) Qais Qandil`. Combined with the line's sub-code this reads exactly `1301 Producer (Name) Qais Qandil`.
- Available in both the **add-item form** (next to Labor Classification) and the **inline edit row**; persisted through the existing `createLineItem`/`updateLineItem` endpoints (both already accept `crewMemberId`).

## 2. Master Chart of Accounts (seeded on project creation)

> **Expanded (doc 15 era):** the COA now lives at module level in `projects.service.ts` as
> `MASTER_COA` (always seeded) and `DISTRIBUTION_COA` (optional 6000–9000 studio ledger —
> see `docs/production/15-distribution-ledger-and-mm-import-refactor.md`), both inserted
> through the shared `seedSections()` helper.

`createDefaultBudget()` seeds the version (status **DRAFT** per the lifecycle in doc 12) with the full hierarchy below. **Tier is set explicitly on each section** (POST lives at 3000 and OTHER at 4000 in the expanded chart). Every line item seeds at `qty 1 × rate 0, units "allow"`, ready to fill; labor lines carry a default fringe `classificationCode` (PRODUCER / DIRECTOR / PERFORMER / STUNT / WRITER / BG / DRIVER / CREW) so the union engine applies the moment rates are entered.

| Tier (Section) | Account | Department | Lines (highlights) |
|---|---|---|---|
| **ATL · 1000** | 1100 | Story & Rights | 1101 Story Rights/Option · 1102 Screenplay Purchase (WRITER) · 1103 Writers Guild/Statutory Fringes (WRITER) · 1104 Research & Clearances |
| | 1200 | Writing | 1201 Screenwriter (WRITER) · 1202 Revisions/Polish (WRITER) · 1203 Translators/Subtitlers |
| | 1300 | Producers | 1301 Executive Producer · 1302 Producer · 1303 Line Producer · 1304 Co-/Associate Producer (all PRODUCER) |
| | 1400 | Director | 1401 Director · 1402 2nd Unit Director (DIRECTOR) · 1403 Director's Assistant · 1404 Storyboard Artist |
| | 1500 | Cast (Principal) | 1501–1504 Leads/Supporting/Day Players · 1505 Voiceover (all PERFORMER) |
| | 1600 | Casting | 1601 Casting Director · 1602 Associate · 1603 Studio Rental & Expenses |
| | 1700 | Stunts | 1701 Stunt Coordinator · 1702 Stunt Performers/Doubles (STUNT) |
| **BTL · 2000** | 2100 | Production Staff | UPM · 1st/2nd/2nd 2nd AD · Supervisor · Coordinator · APOC · PAs · Script Supervisor |
| | 2150 | Extra Talent | 2151 Background (BG) · 2152 Stand-Ins (BG) · 2153 Precision Drivers (DRIVER) · 2154 Tutor · 2155 Animal Wranglers |
| | 2200 | Camera | DOP · Operator · 1st/2nd AC · DIT · Steadicam · Drone · 2210 Camera Package · 2211 Lenses, Filters & Media |
| | 2300 | Grip | Key/Best Boy/Dolly/Rigging Grips · 2310 Grip Package · 2311 Cranes & Jibs · 2312 Expendables |
| | 2400 | Electric / Lighting | Gaffer · Best Boy · Set/Rigging Electricians · Genny Op · 2410 Lighting Package · 2411 Generators & Fuel · 2412 Expendables/Gels |
| | 2500 | Production Sound | Mixer · Boom Op · Utility · Playback · 2510 Sound Package & Comms |
| | 2600 | Art Department | Production Designer · Art Director · Asst AD · Coordinator · Graphic Artist · 2610 Purchases & Supplies |
| | 2650 | Set Construction | Construction Coordinator/Foreman · Carpenters · Scenic Painters · 2660 Materials · 2661 Mill Rental |
| | 2700 | Set Dressing | Set Decorator · Leadman · Swing Gang · Buyer · Greensman · 2710 Furniture & Drapery · 2711 Fixtures |
| | 2750 | Property (Props) | Prop Master · Asst · Armorer · 2760 Purchases & Rentals · 2761 Blank Ammo/Expendables |
| | 2800 | Wardrobe | Costume Designer · Supervisor · Set Costumer · Tailor/Ager & Dyer · 2810 Purchases & Rentals · 2811 Dry Cleaning |
| | 2900 | Makeup & Hair | Key Makeup · Key Hair · Crowd · SFX Makeup · 2910 Supplies & Prosthetics |
| | 2920 | Special Effects (SFX) | SFX Supervisor · Foreman/Techs · 2930 Equipment & Rigging · 2931 Pyro, Smoke, Water & Wind |
| | 2940 | Locations | Location Manager · ALM · Scouts · Site Security · 2950 Fees & Site Rentals · 2951 Permits · 2952 Waste & Cleaning |
| | 2960 | Transportation | Coordinator · Captain · Drivers (DRIVER) · Picture Car Coordinator · 2970 Picture Cars · 2971 Vehicles & Fuel |
| | 2980 | Catering & Craft | Chef/Catering Staff · Crafty Key · 2983 Catering Truck · 2984 Food & Beverage |
| | 2990 | Safety & Welfare | Medic · H&S Supervisor · Intimacy Coordinator · Fire Watch/Police Detail |
| **POST · 3000** | 3100 | Editorial | Editor · 1st Assistant · Post Supervisor · 3110 Edit Suite & Storage |
| | 3200 | Post Sound | Supervising Sound Editor · Sound Designer · Re-recording Mixer · Foley · 3210 ADR/Foley/Mix Studio |
| | 3300 | Music | Composer · Music Supervisor · Musicians/Scoring Mixer · 3310 Licensing, Sync & Master Rights |
| | 3400 | Visual Effects | VFX Supervisor · VFX Producer · Artists · 3410 Render Farm & Software |
| | 3500 | Color & Finishing | Colorist (DI) · DI Producer/Online Editor · 3510 Color Suite |
| | 3600 | Titles & Deliverables | Title Designer · Subtitles/CC/AD · QC & LTO Backups |
| **OTHER · 4000** | 4100 | Insurance | CGL · E&O · Equipment Package · Workers Comp |
| | 4200 | Legal & Accounting | Production Accountant · Payroll Clerk · Legal Counsel · Payroll Service Fees |
| | 4300 | Publicity | Unit Publicist · Stills Photographer · EPK Crew |
| | 4400 | Office & Admin | Office Rental · Equipment · Comms · Courier |
| | 4500 | Contingency | 4501 Production Contingency (10%) |

**Optional studio ledger** (checkbox at project creation, or "Add distribution ledger" in Settings — see doc 15): **6000** Prints & Advertising (6100 Creative Materials · 6200 Media Buy · 6300 Publicity & PR · 6400 Print & Logistics) · **7000** Revenue (7100 Sales & Licensing) · **8000** Cost of Goods Sold (8100 Amortization, Residuals, Participations, Sales-agent fees) · **9000** Corporate Overhead (9100 Corporate SG&A).

**Notes:**
- The seed creates `BudgetLineItem` rows (not just accounts), so a new project opens with the full skeleton — globals (shoot_days etc.) and fringe profiles are still seeded as before.
- Crew-department BTL lines default to the generic `CREW` classification; refine to specific locals per project after the labor snapshot.
- **Existing projects are unaffected** — the expanded COA applies to projects created after this change. The 6000–9000 block can be appended to an existing project via `POST /production/projects/:id/inject-distribution`.
