# ScriptON · Script Render Screen — Add Border-Glow (slice E)

_For Claude Code. The render/generation screen **already exists as its own standalone screen** (`ScriptOnBuildScreen`) and works — **do not rebuild, restyle, or move it.** This slice is exactly one thing: **add the `border-glow-card` effect** around the render screen's card so it glows while a script renders. Glow treatment authority: the card on node **104:11** (`--glow-color: hsl(40 80% 80%)`). Behind `scripton.osShell`._

## Scope
- **In scope:** wrap the existing render screen's main card/panel in the border-glow component and drive it (`sweep-active`) while rendering. That's the whole task.
- **Out of scope (don't do here):** rebuilding/restyling/moving the screen, any bokeh background, the progress wiring (already works), and the **#48** watchdog (it's its own task — keep it separate).

## Add the glow
1. **Wrap the card** — `<div class="border-glow-card sweep-active"><span class="edge-light"></span><div class="border-glow-inner">…existing card content…</div></div>`, with `--card-bg` set to the card's current background color. Don't change the card's contents or layout.
2. **Add the CSS** (below).
3. **Drive it** — keep `.sweep-active` on the card **while rendering**, remove it when done/idle (idle = glow opacity 0). Set `--edge-proximity: 100` and rotate `--cursor-angle` 0→360 continuously so the conic mask sweeps the border. Keep `--glow-color: hsl(40 80% 80%)` (warm gold) — the holographic mesh layers stay as authored.
4. **Reduced-motion** — `prefers-reduced-motion: reduce` → static glow (no rotation).

```css
/* drive the glow while the card is rendering */
@property --cursor-angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
.border-glow-card.sweep-active { --edge-proximity: 100; animation: glow-sweep 4s linear infinite; }
@keyframes glow-sweep { to { --cursor-angle: 360deg; } }
@media (prefers-reduced-motion: reduce) {
  .border-glow-card.sweep-active { animation: none; --cursor-angle: 45deg; }
}
```

```css
/* the component (as supplied) */
.border-glow-card {
  --edge-proximity: 0; --cursor-angle: 45deg; --edge-sensitivity: 30;
  --color-sensitivity: calc(var(--edge-sensitivity) + 20);
  --border-radius: 28px; --glow-padding: 40px; --cone-spread: 25;
  position: relative; border-radius: var(--border-radius); isolation: isolate;
  transform: translate3d(0,0,0.01px); display: grid;
  border: 1px solid rgb(255 255 255 / 15%); background: var(--card-bg, #120F17);
  overflow: visible;
  box-shadow: rgba(0,0,0,.1) 0 1px 2px, rgba(0,0,0,.1) 0 2px 4px, rgba(0,0,0,.1) 0 4px 8px,
    rgba(0,0,0,.1) 0 8px 16px, rgba(0,0,0,.1) 0 16px 32px, rgba(0,0,0,.1) 0 32px 64px;
}
.border-glow-card::before, .border-glow-card::after, .border-glow-card > .edge-light {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  transition: opacity .25s ease-out; z-index: -1;
}
.border-glow-card:not(:hover):not(.sweep-active)::before,
.border-glow-card:not(:hover):not(.sweep-active)::after,
.border-glow-card:not(:hover):not(.sweep-active) > .edge-light { opacity: 0; transition: opacity .75s ease-in-out; }
.border-glow-card::before {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--card-bg,#120F17) 0 100%) padding-box,
    linear-gradient(rgb(255 255 255 / 0%) 0 100%) border-box,
    var(--gradient-one, radial-gradient(at 80% 55%, hsla(268,100%,76%,1) 0px, transparent 50%)) border-box,
    var(--gradient-two, radial-gradient(at 69% 34%, hsla(349,100%,74%,1) 0px, transparent 50%)) border-box,
    var(--gradient-three, radial-gradient(at 8% 6%, hsla(136,100%,78%,1) 0px, transparent 50%)) border-box,
    var(--gradient-four, radial-gradient(at 41% 38%, hsla(192,100%,64%,1) 0px, transparent 50%)) border-box,
    var(--gradient-five, radial-gradient(at 86% 85%, hsla(186,100%,74%,1) 0px, transparent 50%)) border-box,
    var(--gradient-six, radial-gradient(at 82% 18%, hsla(52,100%,65%,1) 0px, transparent 50%)) border-box,
    var(--gradient-seven, radial-gradient(at 51% 4%, hsla(12,100%,72%,1) 0px, transparent 50%)) border-box,
    var(--gradient-base, linear-gradient(#c299ff 0 100%)) border-box;
  opacity: calc((var(--edge-proximity) - var(--color-sensitivity)) / (100 - var(--color-sensitivity)));
  mask-image: conic-gradient(from var(--cursor-angle) at center, black calc(var(--cone-spread)*1%),
    transparent calc((var(--cone-spread)+15)*1%), transparent calc((100 - var(--cone-spread) - 15)*1%),
    black calc((100 - var(--cone-spread))*1%));
}
.border-glow-card::after {
  border: 1px solid transparent;
  background:
    var(--gradient-one, radial-gradient(at 80% 55%, hsla(268,100%,76%,1) 0px, transparent 50%)) padding-box,
    var(--gradient-two, radial-gradient(at 69% 34%, hsla(349,100%,74%,1) 0px, transparent 50%)) padding-box,
    var(--gradient-three, radial-gradient(at 8% 6%, hsla(136,100%,78%,1) 0px, transparent 50%)) padding-box,
    var(--gradient-four, radial-gradient(at 41% 38%, hsla(192,100%,64%,1) 0px, transparent 50%)) padding-box,
    var(--gradient-five, radial-gradient(at 86% 85%, hsla(186,100%,74%,1) 0px, transparent 50%)) padding-box,
    var(--gradient-six, radial-gradient(at 82% 18%, hsla(52,100%,65%,1) 0px, transparent 50%)) padding-box,
    var(--gradient-seven, radial-gradient(at 51% 4%, hsla(12,100%,72%,1) 0px, transparent 50%)) padding-box,
    var(--gradient-base, linear-gradient(#c299ff 0 100%)) padding-box;
  mask-image: linear-gradient(to bottom, black, black),
    radial-gradient(ellipse at 50% 50%, black 40%, transparent 65%),
    radial-gradient(ellipse at 66% 66%, black 5%, transparent 40%),
    radial-gradient(ellipse at 33% 33%, black 5%, transparent 40%),
    radial-gradient(ellipse at 66% 33%, black 5%, transparent 40%),
    radial-gradient(ellipse at 33% 66%, black 5%, transparent 40%),
    conic-gradient(from var(--cursor-angle) at center, transparent 5%, black 15%, black 85%, transparent 95%);
  mask-composite: subtract, add, add, add, add, add;
  opacity: calc(var(--fill-opacity, .5) * (var(--edge-proximity) - var(--color-sensitivity)) / (100 - var(--color-sensitivity)));
  mix-blend-mode: soft-light;
}
.border-glow-card > .edge-light {
  inset: calc(var(--glow-padding) * -1); pointer-events: none; z-index: 1;
  mask-image: conic-gradient(from var(--cursor-angle) at center, black 2.5%, transparent 10%, transparent 90%, black 97.5%);
  opacity: calc((var(--edge-proximity) - var(--edge-sensitivity)) / (100 - var(--edge-sensitivity)));
  mix-blend-mode: plus-lighter;
}
.border-glow-card > .edge-light::before {
  content: ""; position: absolute; inset: var(--glow-padding); border-radius: inherit;
  box-shadow:
    inset 0 0 0 1px var(--glow-color, hsl(40 80% 80% / 100%)),
    inset 0 0 1px 0 var(--glow-color-60, hsl(40 80% 80% / 60%)),
    inset 0 0 3px 0 var(--glow-color-50, hsl(40 80% 80% / 50%)),
    inset 0 0 6px 0 var(--glow-color-40, hsl(40 80% 80% / 40%)),
    inset 0 0 15px 0 var(--glow-color-30, hsl(40 80% 80% / 30%)),
    inset 0 0 25px 2px var(--glow-color-20, hsl(40 80% 80% / 20%)),
    inset 0 0 50px 2px var(--glow-color-10, hsl(40 80% 80% / 10%)),
    0 0 1px 0 var(--glow-color-60, hsl(40 80% 80% / 60%)),
    0 0 3px 0 var(--glow-color-50, hsl(40 80% 80% / 50%)),
    0 0 6px 0 var(--glow-color-40, hsl(40 80% 80% / 40%)),
    0 0 15px 0 var(--glow-color-30, hsl(40 80% 80% / 30%)),
    0 0 25px 2px var(--glow-color-20, hsl(40 80% 80% / 20%)),
    0 0 50px 2px var(--glow-color-10, hsl(40 80% 80% / 10%));
}
.border-glow-inner { display: flex; flex-direction: column; position: relative; overflow: auto; z-index: 1; }
```

Use `--card-bg:#16181f` (or the card's actual bg). Define the `--glow-color-XX` alpha steps as shown (or derive from `--glow-color`).

## Acceptance
- The existing standalone render screen is **unchanged** except for a **glowing holographic + gold border** around its card while a script renders; glow off when idle; static under reduced-motion. No rebuild, no layout change, no bokeh. Behind `scripton.osShell`.
