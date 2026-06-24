# SYS-17 — Figma ↔ Code Mapping (TFM app design system)

**Figma file:** https://www.figma.com/design/j9C0DvyskGpdzHnv0fNGu5
**Status:** design system + 14 screens (light + dark) built in Figma, bound to the `globals.css` token sheet.
**Companion to:** SYS-13d (ScriptON DS), SYS-14 (UX IA), SYS-16 (mobile companion research).

This document is the bridge between the Figma library and the React/PWA code, so design and code stay one-to-one.

---

## 1. Why not formal Figma Code Connect (yet)

Figma's built-in **Code Connect** (the feature that surfaces real code snippets in Dev Mode and round-trips via the CLI) has two hard prerequisites we don't currently meet:

1. **Plan** — Code Connect requires an **Organization or Enterprise** plan. This team is on **Professional (Pro)**.
2. **Published components** — Code Connect only maps components **published to a team library**. Ours live in a working design file (drafts), not a published library.

Until both are in place, the mapping is delivered two ways that work on Pro today:

- **Figma component descriptions** — each component carries its code counterpart + path + prop notes, visible in Dev Mode's inspect panel (added; see §3).
- **This document** — the authoritative Figma→code table, plus ready-to-publish `.figma.ts` templates (§4) for the day the team upgrades and publishes the library.

---

## 2. Tokens (already code-synced)

Every Figma variable carries its **WEB code syntax** = the exact `globals.css` custom property, so Dev Mode shows `var(--surface-0)` etc. No translation needed.

| Figma collection | Figma variable | CSS variable | Light | Dark |
|---|---|---|---|---|
| Color | `color/surface/0` | `var(--surface-0)` | `#F5F5F4` | `#0B0B0D` |
| Color | `color/surface/1` | `var(--surface-1)` | `#FFFFFF` | `#141416` |
| Color | `color/surface/2` | `var(--surface-2)` | `#F0EFEC` | `#1C1C1F` |
| Color | `color/text/1‑3` | `var(--text-1‑3)` | charcoal ramp | off‑white ramp |
| Color | `color/border/1‑2` | `var(--border-1‑2)` | warm stone | charcoal |
| Color | `color/accent` | `var(--accent)` | `#1C2433` | `#C9A96A` |
| Color | `color/gold` | `var(--gold)` | `#B08D4F` | `#C9A96A` |
| Color | `color/status/{ok,warn,danger}(+soft)` | `var(--ok / --warn / --danger ...)` | AA light | AA dark |
| Spacing | `space/2 … 40` | `2px … 40px` | — | — |
| Radius | `radius/{sm,md,lg,xl,2xl,full}` | `8 … 999px` | — | — |

Mode flip: a frame's Color mode (Light/Dark) maps to the `.dark` class / `prefers-color-scheme` switch in code. One toggle re-skins the whole tree — verified across all 14 screens.

---

## 3. Component mapping

| Figma component | React component | Source | Prop mapping |
|---|---|---|---|
| **Button** (set) | `SonBtn` | `src/components/production/scripton/Son.tsx` | `Style=Primary → primary`; `Secondary/Danger/Ghost → className`; Label → `children` |
| **Chip** (set) | `SonChip` | Son.tsx | `Tone → color`; Label → `children` |
| **Card** | `SonCard` | Son.tsx | `children` → content; `className` for variants |
| **List Row** | `SonCard className="son-row"` | Son.tsx | avatar · title · subtitle · chevron |
| **Tab Bar** | `SonTabs` / `.son-bottomnav` | Son.tsx | `tabs[]`, `active`, `onChange`; active = `--gold` |
| **Metric Cell** | *(new)* `SonMetric` candidate | — | `son-card` + label(`text-3`) + value(`heading`) |
| **Badge** | *(new)* custom | — | status token bg + `accent-on` text; Count → `children` |
| **Status Bar** | device chrome | app shell | not a code component |
| Reader transport (on ScriptON Reader) | `SonTransport` | Son.tsx | `title`, `sub`, `playing`, `onToggle`, `position`, `children` |

Notes:
- An alternate legacy kit exists at `src/components/production/ui.tsx` (`Btn({variant})`, `Chip({tone})`); SON primitives are the target per SYS-13d.
- **Metric Cell** and **Badge** have no dedicated primitive yet — good candidates to add to `Son.tsx` (`SonMetric`, `SonBadge`) so the Figma kit and code kit reach full parity.

---

## 4. Ready-to-publish `.figma.ts` templates

Drop these in once the library is published on Org/Enterprise (they use the MCP template format).

### `SonBtn.figma.ts`
```ts
// url=https://www.figma.com/design/j9C0DvyskGpdzHnv0fNGu5?node-id=22-12
// source=src/components/production/scripton/Son.tsx
// component=SonBtn
import figma from 'figma'
const instance = figma.selectedInstance
const label = instance.findText('Label')?.textContent
const style = instance.getEnum('Style', {
  'Primary': 'primary', 'Secondary': 'secondary', 'Danger': 'danger', 'Ghost': 'ghost',
})
export default {
  example: figma.code`<SonBtn${style === 'primary' ? ' primary' : ''}${style !== 'primary' && style !== 'secondary' ? ` className="son-btn--${style}"` : ''}>${label}</SonBtn>`,
  imports: ['import { SonBtn } from "@/components/production/scripton/Son"'],
  id: 'son-btn',
  metadata: { nestable: true },
}
```

### `SonChip.figma.ts`
```ts
// url=https://www.figma.com/design/j9C0DvyskGpdzHnv0fNGu5?node-id=23-17
// source=src/components/production/scripton/Son.tsx
// component=SonChip
import figma from 'figma'
const instance = figma.selectedInstance
const label = instance.findText('Label')?.textContent
const color = instance.getEnum('Tone', {
  'Neutral': 'slate', 'Gold': 'gold', 'Ok': 'ok', 'Warn': 'warn', 'Danger': 'danger',
})
export default {
  example: figma.code`<SonChip color="${color}">${label}</SonChip>`,
  imports: ['import { SonChip } from "@/components/production/scripton/Son"'],
  id: 'son-chip',
  metadata: { nestable: true },
}
```

### `SonCard.figma.ts`
```ts
// url=https://www.figma.com/design/j9C0DvyskGpdzHnv0fNGu5?node-id=25-5
// source=src/components/production/scripton/Son.tsx
// component=SonCard
import figma from 'figma'
const instance = figma.selectedInstance
export default {
  example: figma.code`<SonCard>{/* content */}</SonCard>`,
  imports: ['import { SonCard } from "@/components/production/scripton/Son"'],
  id: 'son-card',
  metadata: { nestable: true },
}
```

---

## 5. Turning on formal Code Connect later

1. Upgrade the Figma team to **Organization/Enterprise**.
2. **Publish** the Components page to a team library.
3. `npm i -D @figma/code-connect`; add `@figma/code-connect/figma-types` to `tsconfig.json` `types`.
4. Add `figma.config.json` (`parser: react`, `paths`/`importPaths`).
5. Drop the templates from §4 next to the components and run `figma connect publish`.

Until then: the descriptions (§3) + this doc are the source of truth, and the token code-syntax (§2) already gives Dev Mode the right CSS variables.
