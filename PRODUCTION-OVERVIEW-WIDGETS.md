# Production Overview — Widgets & Types Reference

Every widget available in the TFM‑System production overview surfaces, exported from the source. There are **two** widget surfaces:

| Surface | Page | Component | Widgets |
| --- | --- | --- | --- |
| **Project Overview** | `/production/projects/[id]` → Overview tab | `CustomizableOverview.tsx` | a customizable board of **39 widgets** in 5 categories |
| **Production Dashboard** | `/production/dashboard` | `dashboard/page.tsx` | portfolio KPIs + **2 role widgets** (Finance, Coordination) |

A legacy non‑customizable overview (`OverviewPanel.tsx`) still exists in the tree as a one‑line revert fallback, but the live surface is `CustomizableOverview`.

---

## 1. The Overview widget board (`CustomizableOverview`)

A per‑user, per‑project dashboard. You can **add** widgets from a library, **drag** to reorder, **resize** (width 1–3 columns, free height), **remove**, **save named views**, and **reset to default**. Layout persists to `localStorage` *and* to the backend (`savedViewsApi`, module `pdash:<projectId>`) so it follows you across devices. The grid is 3 columns; widget heights are measured in 24px rows.

### 1.1 The widget type (metadata shape)

Every widget in the registry is defined by this shape:

```ts
{
  icon:   string;     // emoji shown in the header & library
  title:  string;     // header label
  desc:   string;     // one-line description (shown in the Add-widget library)
  w:      number;     // default width in columns (1, 2, or 3)
  sample?: boolean;   // true → shows a "sample" badge; uses placeholder data
  tab?:   string;     // deep-link: header "Open →" jumps to this project tab
  cat?:   string;     // library category (defaults to "Production")
  render?: () => JSX; // a live render closure (reads project data), OR…
  Comp?:  Component;  // …a self-contained interactive component (own state)
}
```

A board entry is `{ id, w, h? }` — the widget id plus the user's chosen width and height override.

### 1.2 The three kinds of widget

- **Live** — bound to project APIs; the numbers are real (money, schedule, crew, approvals, etc.).
- **Sample** — carry a `sample` badge and show placeholder data until wired to a live source (`kpi-today`, `script`, `weather`, `tasks`, `birthdays`).
- **Tools & ambient** — self‑contained utilities (calculators, timers, notes); many persist their own state to `localStorage` per project. They need no project data.

### 1.3 All 39 widgets, by category

Sizes are `W×H` defaults (W = columns of 3; H = rows of 24px). "Opens" = the tab the header **Open →** deep‑links to.

#### Production (15) — live operational data

| ID | Widget | Shows | W×H | Opens |
| --- | --- | --- | --- | --- |
| `kpi-money` | 💷 Money · live | EFC, variance, cash, committed POs | 2×5 | costreport |
| `kpi-today` | 🎬 Today · on set *(sample)* | Shoot day, crew call, scenes, pages, total pages, crew | 3×5 | callsheets |
| `workflow` | ☑ Production Workflow | Gated steps & phase progress (% complete, next step) | 1×10 | — |
| `today-scenes` | 🎞 Today's scenes | Next shoot day scene strip (Sc, I/E, Set, D/N, Pages) | 2×9 | callsheets |
| `attention` | ⚠️ Needs attention | Blockers waiting on you (draft POs, unsigned memos, next step) | 1×8 | — |
| `schedule` | 🗓 Schedule | Scenes/pages, shoot days, next day | 1×6 | schedule |
| `crew` | 👥 Crew & call sheets | Headcount, deal memos signed, call sheets published | 1×6 | crew |
| `approvals` | 🛒 Approvals queue | Draft POs, open POs, committed value | 1×7 | purchasing |
| `budget` | 🧮 Budget summary | Budget vs actual vs committed vs EFC | 2×6 | actual |
| `project-info` | 🎬 Project info | Type/status, shoot dates, budget, project #, client, crew/sheets | 2×7 | settings |
| `travel` | ✈️ Travel & arrivals | Inbound cast/crew arrivals by status | 1×6 | arrivals |
| `casting` | 🎭 Casting activity | Total calls, open/in‑review, submissions | 1×6 | casting |
| `locations` | 📍 Location status | Needs, locked sets, pending options | 1×6 | locations |
| `transport` | 🚐 Transport / dispatch | Active orders, total orders, vehicles | 1×6 | transport |
| `perdiem` | 💵 Per diem | Records, total amount, unreconciled | 1×6 | perdiem |

#### Creative (6)

| ID | Widget | Shows | W×H | Type |
| --- | --- | --- | --- | --- |
| `script` | 📄 Script peek *(sample)* | Current scene from the reader | 1×7 | sample (opens `script`) |
| `quote` | 💬 Daily film quote | A rotating quote from the greats | 1×6 | rotator |
| `onthisday` | 🎞 On this day in film | A notable film moment for today | 1×6 | rotator |
| `prompt` | 💡 Creative prompt | A daily shot / story spark | 1×6 | rotator |
| `palette` | 🎨 Color palette | Generate a 5‑swatch look palette | 1×7 | tool |
| `composition` | 🖼 Composition guide | Aspect‑ratio frame + rule‑of‑thirds overlay | 1×10 | tool |

#### Productivity (6) — self‑contained, saved per project

| ID | Widget | Shows | W×H | Type |
| --- | --- | --- | --- | --- |
| `tasks` | ✅ My tasks *(sample)* | Quick sample task list | 1×6 | sample |
| `notes` | 📝 Sticky notes | Free scratchpad (localStorage) | 1×8 | tool |
| `todo` | 🗒 Personal to‑do | Your own checklist (localStorage) | 1×9 | tool |
| `pomodoro` | ⏲ Focus timer | Pomodoro work/break timer | 1×8 | tool |
| `links` | 🔗 Quick links | Your own bookmarks (localStorage) | 1×9 | tool |
| `clocks` | 🌍 World clocks | Timezones for the crew (LA, NY, London, Dubai, Mumbai) | 1×8 | tool |

#### Film utilities (7) — production calculators

| ID | Widget | Shows | W×H | Type |
| --- | --- | --- | --- | --- |
| `countdown` | ⏳ Countdown | To wrap / shoot day / delivery (localStorage) | 1×8 | tool |
| `sun` | 🌅 Sun & golden hour | Sunrise/sunset + golden hour for a lat/lng | 1×9 | tool |
| `ratio` | 🎬 Shooting ratio | Footage shot vs used | 1×8 | tool |
| `pagetime` | 📄 Pages → screen time | Estimate minutes from script pages | 1×7 | tool |
| `timecode` | ⏱ Timecode / frames | Seconds ↔ frames @ fps | 1×8 | tool |
| `units` | 📐 Unit converter | Feet ↔ metres | 1×7 | tool |
| `moon` | 🌙 Moon phase | Tonight's phase (for exteriors) | 1×7 | computed |

#### Team & ambient (5)

| ID | Widget | Shows | W×H | Type |
| --- | --- | --- | --- | --- |
| `weather` | 🌤 Weather & daylight *(sample)* | On‑set forecast & golden hour | 1×7 | sample |
| `safety` | 🦺 Safety tip | Rotating on‑set reminder | 1×6 | rotator |
| `currency` | 💱 Currency converter | Amount × your rate | 1×8 | tool |
| `ambient` | 🎧 Ambient sound | Focus / on‑set soundscape links | 1×8 | links |
| `birthdays` | 🎂 Crew birthdays *(sample)* | Today's birthdays & milestones | 1×6 | sample |

**Totals:** Production 15 · Creative 6 · Productivity 6 · Film utilities 7 · Team & ambient 5 = **39 widgets**. Library display order: Production → Film utilities → Creative → Productivity → Team & ambient.

### 1.4 Preset role views (layouts)

The board ships with 5 ready‑made layouts (selectable from the views menu); you can also save your own:

| View | Widgets in order |
| --- | --- |
| **Default** | workflow, kpi‑money, kpi‑today, today‑scenes, attention, script, schedule, crew |
| **Line Producer** | kpi‑money, approvals, budget, attention, perdiem, crew, workflow |
| **1st AD** | kpi‑today, today‑scenes, weather, schedule, transport, attention |
| **Accountant** | kpi‑money, budget, approvals, perdiem, workflow |
| **Coordinator** | travel, casting, locations, crew, tasks, attention |

### 1.5 Data sources (live widgets)

The board loads these in parallel on mount: `ledger.summary`, `costing.report`, `costing.pos`, `scheduling.board`, `crew.list`, `callsheets.list`, `projects.workflow`, `perdiem.list`, `locationNeeds.list`, `arrivalApi.dashboard`, `castingApi.calls`, `transportApi.orders`, `transportApi.vehicles`. Each widget reads from the relevant slice; failures degrade gracefully to "—".

---

## 2. The Production Dashboard (portfolio) widgets

The portfolio landing (`/production/dashboard`) is a separate surface with its own widgets, driven by `ledger.portfolio()` and `dashboard(role)`.

### 2.1 Combined KPI tiles (5)

Theme‑aware tiles across the whole portfolio: **Total Budget · Revenue · Costs · Net P&L · Cash Position**. Below them: status chips (per project status) and a per‑project financial table (Budget / Revenue / Cost / Net / Spent %).

### 2.2 Role views (3) + role widgets (2)

A role selector switches the operational widget shown:

| Role view | Widget | Panels |
| --- | --- | --- |
| **Overview** | *(none — KPIs + table only)* | — |
| **Line Producer / Finance** | `FinanceOpsWidget` | EFC variance KPIs (Budget, Actual, Committed, Est. Final Cost, Variance) · *EFC variance by project* (worst first) · *Pending budget transfers* |
| **2nd AD / Coordinator** | `CoordinationWidget` | Counters (deal memos not sent / awaiting signature, NDAs awaiting signature, people outstanding) · *Outstanding deal memos & NDAs* table · latest call‑sheet distribution status |

---

## 3. File map

| Thing | Path |
| --- | --- |
| Overview widget board + all 39 widgets + preset views | `frontend/src/components/production/CustomizableOverview.tsx` |
| Portfolio dashboard (KPIs, role selector) | `frontend/src/app/(dashboard)/production/dashboard/page.tsx` |
| Finance role widget | `frontend/src/components/production/FinanceOpsWidget.tsx` |
| Coordination role widget | `frontend/src/components/production/CoordinationWidget.tsx` |
| Legacy non‑customizable overview (fallback) | `frontend/src/components/production/OverviewPanel.tsx` |
| Project page that hosts the Overview board | `frontend/src/app/(dashboard)/production/projects/[id]/page.tsx` |

---

*Exported directly from source. The Overview board carries 39 widgets across 5 categories with 5 preset role layouts; the portfolio Dashboard adds 5 KPI tiles and 2 role widgets.*
