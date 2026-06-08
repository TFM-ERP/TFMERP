# TFM-System — Production Module Design System

One visual language across the entire production module. Every panel renders from
the shared kit at `frontend/src/components/production/ui.tsx` so the design is
pixel-identical and a change in one place updates everywhere.

## Tokens

| Token | Value | Use |
|-------|-------|-----|
| Accent | `#0f172a` (slate-900) | Header icons, active tab fill, primary buttons, input focus. **Monochrome** — accent is the ink. |
| Ink | `slate-900` | Primary text / titles |
| Muted | `slate-500` | Subtitles, secondary text |
| Hint | `slate-400` | Section labels, placeholders |
| Hairline | `slate-200` | Card borders, table rules (`slate-100` for inner rules) |
| Surface | `white` | Cards |
| Canvas | `slate-50` | Inset blocks, zebra rows |

The old gold `#c3a56e` is retired — replaced everywhere by `#0f172a`.

## Semantic chip tones (colour = meaning, never decoration)

| Tone key | Classes | Meaning |
|----------|---------|---------|
| `cast` | `bg-violet-100 text-violet-700` | Cast / talent / people |
| `link` | `bg-blue-100 text-blue-700` | Location / linked entity |
| `need` | `bg-amber-100 text-amber-700` | Needs / permit / pending |
| `money` | `bg-emerald-100 text-emerald-700` | Money / complete / confirmed |
| `risk` | `bg-rose-100 text-rose-700` | Risk / blocked / cancelled |
| `slate` | `bg-slate-100 text-slate-600` | Neutral |
| `ink` | `bg-slate-900 text-white` | Strong / active |

## The clustering pattern (every list-style panel)

```
PanelHeader  (gold→charcoal icon · title · subtitle · right-aligned actions)
StatRow      (2–5 rounded-2xl metric cards)
[Tabs]       (optional inner tabs — active = slate-900 fill)
ClusterCard* (expandable: chevron · title · badges · meta/right
                 └ body: SectionLabel → Chip rows → DataTable)
```

## Shared components (`production/ui.tsx`)

- `PanelHeader({ icon, title, subtitle, actions })`
- `StatRow({ stats: [label, value][] })`
- `Tabs({ tabs: [key,label][], active, onChange })`
- `ClusterCard({ title, meta, badges, right, defaultOpen, children })`
- `Chip({ tone, children })` · `StatusPill({ tone, children })`
- `SectionLabel({ icon, children })`
- `DataTable({ cols, rows, minWidth, align })`
- `Btn({ variant: 'primary'|'secondary'|'danger' })` · `inputCls`
- `EmptyState({ icon, children })`

## Rules

- Cards `rounded-2xl`, 1px hairline border, white bg. Pills `rounded-full`.
- Two font weights only: 400 / 500 (semibold for titles). Sentence case.
- Modals: `rounded-2xl bg-white`, header with title + `X` close, footer actions right-aligned (`Btn`).
- Inputs use `inputCls` (charcoal focus ring). Tables use `DataTable` (zebra + hairline).
- Status as a `Chip`/`StatusPill` with the matching semantic tone.

## Rollout status

- ✅ Shared kit built (`ui.tsx`).
- ✅ Accent unified to `#0f172a` across the app (51 files).
- ◻ Panel migration onto the kit — in progress, batched: finance/cost panels
  (Accounting, Purchasing, Per-Diem, Topsheet, Call Sheets, CoA mapping, Workflow,
  Crew) first (they're the most off-pattern), then the already-styled panels move
  to shared components for structural identity.
