# ScripON — Live Pixel Pass Checklist

**Goal:** confirm each live `/scripon` screen is a faithful match to its approved `design/` frame (the design‑lock's final screen‑by‑screen check).

**How to run**
1. Start both servers (two PowerShell windows): `cd backend; npm run start:dev` and `cd frontend; npm run dev`.
2. Open **http://localhost:3000** → log in → left rail **ScriptON ▸ ✦ Script Hub**.
3. In a second browser tab, open the matching frame file from `C:\Projects\TFM-System\design\` and compare side‑by‑side.
4. For anything off, jot: **`<screen> — <what looks wrong>`** (e.g. "Greenlight — gauge ring too small") and send the list back to me; I'll fix each against the frame.

**Check on every screen (global)**
- Rail = 10 items in this order: Home · Library · Reader · Breakdown · Schedule · Doctor · **Studio** · **Greenlight** · Reports · Settings — the current one gold‑filled with the gold left bar.
- Top bar: gold TFM logo, title, status pill, right‑side action buttons.
- Palette charcoal/gold (bg ~#0b0c0f, gold #C6A463); fonts Inter (UI) + Courier Prime (script text).
- No clipped text, overlapping panels, or stray scrollbars.

**Screen‑by‑screen** (live route ↔ design frame ↔ what to focus on)

| # | Live route | Design frame | Focus |
|---|-----------|--------------|-------|
| 1 | `/scripon` | `dashboard.html` | KPI row, the loop strip, "needs attention", quick actions |
| 2 | `/scripon/reader` | `ScriptHub-Reader-Desktop-HiFi.html` | scene navigator, paper canvas, Doctor dock + action grid |
| 3 | `/scripon/breakdown` | `breakdown.html` | the 6 element lenses, element chips, detail panel |
| 4 | `/scripon/doctor` | `doctor.html` | gauges, coverage report, Diagnostics tab |
| 5 | `/scripon/schedule` | `schedule.html` | stripboard stripes, day columns, budget rail |
| 6 | `/scripon/reports` | `reports.html` | report gallery cards + preview pane |
| 7 | `/scripon/revisions` | `revisions.html` | colour ladder timeline + two‑revision diff |
| 8 | `/scripon/library` | `library.html` | slate of script cards |
| 9 | `/scripon/notes` | `notes.html` | scene‑anchored threads, bubbles |
| 10 | `/scripon/approvals` | `approvals.html` | kanban columns + approval chain + compliance gate |
| 11 | `/scripon/settings` | `settings.html` | model + confidence gate + human‑approval + AiRun log |
| 12 | press **⌘K / Ctrl‑K** | `command-palette.html` | centered overlay, searchable list |
| 13 | `/scripon/studio` ✦ | `studio.html` | Develop ladder, the spine, comps; tabs Develop·Adapt·Format |
| 14 | `/scripon/greenlight` ✦ | `greenlight.html` | comps, forecast band, probability ring, ROI; tabs Market·Audience·Cost·Decision |

**Device check (optional):** narrow the browser window — at **≤1112px** you should get the tablet layout (top segmented nav), at **≤640px** the mobile layout (bottom tab bar). Compare against `tablet-*.html` / `mobile-*.html`.

> Tip: the new **Studio** and **Greenlight** are the two screens never yet eyeballed live — give those the closest look.
