# SYS-12.F — Figma ↔ code mapping (Transport Captain + Driver app)

The Transport module is reflected in the Figma file (`j9C0DvyskGpdzHnv0fNGu5`, page **Page 1**) in the
real Graphite & Gold system — token-bound (Color · Light/Dark, Spacing, Radius) and reusing the shared
components (Status Bar, Tab Bar, Card, Chip, Button, etc.).

**No auto-sync.** This is a **pro** plan, so there is no Figma Code Connect / Dev Mode auto-sync. The link
is maintained **manually, one screen at a time, gated**: when a screen changes on either side, update the
other and bump the row below. Each frame was built *from* the shipped code, so design and code start at parity.

## Screen map

| # | Figma frame | node | Code | Notes |
|---|---|---|---|---|
| 1 | Driver · Up Next (Dark) | `130:116` | `frontend/src/components/production/DriverRunView.tsx` | Glanceable Up-Next card, one-tap FSM, Navigate, glovebox, panic FAB, turnaround chip |
| 2 | Driver · Up Next (Daylight) | `142:154` | same (`html.daylight` / Light theme) | High-contrast sunlight variant — Light-mode tokens |
| 3 | Driver · Vehicle Check | `143:192` | `DriverRunView.tsx` `onCondition` + `captain.service.ts › conditionReport` | 4-point SHA-256 + GPS + time → Document Vault |
| 4 | Driver · En route | `154:230` | `DriverRunView.tsx` `primary()` | FSM state — button "I've arrived" |
| 5 | Driver · On board | `154:279` | `DriverRunView.tsx` `primary()` | FSM state — button "Complete run" |
| 6 | Driver · Completed | `154:328` | `DriverRunView.tsx` `primary()` | Terminal state |
| 7 | Captain · Dispatch (Desktop, Dark) | `145:230` | `frontend/src/components/production/CaptainConsole.tsx` (`RunCard`) | Lifecycle Kanban — assign + turnaround gate |
| 8 | Captain · Garage (Desktop) | `149:230` | `CaptainConsole.tsx` Garage tab + `captain.service.ts › garage` | Fleet by class + rental-return countdown |
| 9 | Captain · Crew · HOS (Desktop) | `152:230` | `CaptainConsole.tsx` Crew tab + `captain.service.ts › hosBoard` | Turnaround roster + driver run-view drill-in |
| 10 | Captain · Dispatch (Desktop, Light) | `155:344` | `CaptainConsole.tsx` (Light mode) | Light-token variant of #7 |
| 11 | Captain · Map (Desktop) | `157:344` | `CaptainConsole.tsx` Map tab → `DispatchBoard.tsx` + `telemetryApi` | Live fleet pins, geofence rings, arrivals rail |
| 12 | Captain · Garage (Desktop, Light) | `159:344` | `CaptainConsole.tsx` Garage (Light) | Light-token variant of #8 |
| 13 | Captain · Crew · HOS (Desktop, Light) | `159:451` | `CaptainConsole.tsx` Crew (Light) | Light-token variant of #9 |
| 14 | Driver · Vehicle Check (Daylight) | `161:344` | `DriverRunView.tsx` (Light) | Light-token variant of #3 |
| 15 | Captain · Map (Desktop, Light) | `161:379` | `CaptainConsole.tsx` Map (Light) | Light-token variant of #11 |

Shared backend: `backend/src/production/logistics/captain.{service,controller}.ts`. Client: `captainApi` in
`frontend/src/lib/api.ts`.

## Gated workflow (per screen)
1. Change lands on one side (design **or** code).
2. Reflect it on the other side — one screen at a time.
3. Screenshot the Figma frame; eyeball against the running component.
4. Update this table's row (date / who). Don't batch-sync the whole file.

> Deep link pattern: `https://www.figma.com/design/j9C0DvyskGpdzHnv0fNGu5/?node-id=<node-with-dash>`
> (e.g. `node-id=145-230` for the Captain Dispatch board).
