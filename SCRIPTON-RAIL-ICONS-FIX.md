# ScriptON · Rail Icons — Match the Figma (definitive fix)

_For Claude Code. The rail's items, labels, 76px geometry, active-box and colors already match the approved design — the **only** remaining mismatch is the **icon glyphs** (the live rail uses lucide icons that differ from the Figma's). This is almost certainly why the rail "still looks the same." Swap to the **exact Figma icons** below — these are the verbatim SVGs exported from the Figma rail (node `6:111`), with `stroke="currentColor"` so the active(gold)/inactive(mute) coloring keeps working. 24×24, stroke-width 1.5._

## What changes (only the rail icon glyphs — nothing else)
Replace the lucide icon for these items with the exact SVG below. Make each a tiny inline-SVG icon component; size + color come from CSS via `currentColor` (so the gold active state still works). Touch **only** the icons — not the rail geometry, labels, active-box, or the top bar.

| Item | Figma icon (replace lucide with the SVG) |
|---|---|
| **Build** | **clapperboard** (replaces the hammer — this matches the design; if you'd rather keep the hammer, leave lucide `Hammer` for Build only — your call) |
| **Canon** | 3-node connected graph |
| **Versions** | git-branch |
| **Room** | two people (users) |
| **Slate** | 2×2 grid |
| **Studio** | radial / sun |

**Keep lucide** for **Home** (house), **Write** (`PenLine`), **Doctor** (`Stethoscope`) — they already match the Figma. (Want them exact too? Export `6:112` / `6:116` / `6:125` from the Figma.)

The top-bar **avatars stay real** (1 real collaborator, not the Figma's 3-avatar sample) — that's the no-mocks rule, not a bug. Don't fake 3.

## Exact SVGs (already set to `currentColor`)

**Build**
```svg
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.5 8.5H4.5C3.67157 8.5 3 9.17157 3 10V18.5C3 19.3284 3.67157 20 4.5 20H19.5C20.3284 20 21 19.3284 21 18.5V10C21 9.17157 20.3284 8.5 19.5 8.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 8.5L6 4L9 7L12 4L15 7L18 4L21 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

**Canon**
```svg
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9C7.10457 9 8 8.10457 8 7C8 5.89543 7.10457 5 6 5C4.89543 5 4 5.89543 4 7C4 8.10457 4.89543 9 6 9Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 8C19.1046 8 20 7.10457 20 6C20 4.89543 19.1046 4 18 4C16.8954 4 16 4.89543 16 6C16 7.10457 16.8954 8 18 8Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 20C13.1046 20 14 19.1046 14 18C14 16.8954 13.1046 16 12 16C10.8954 16 10 16.8954 10 18C10 19.1046 10.8954 20 12 20Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.6001 8L10.8001 16.2M16.3001 7L13.2001 16.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

**Versions**
```svg
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 7.5C7.10457 7.5 8 6.60457 8 5.5C8 4.39543 7.10457 3.5 6 3.5C4.89543 3.5 4 4.39543 4 5.5C4 6.60457 4.89543 7.5 6 7.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 20.5C7.10457 20.5 8 19.6046 8 18.5C8 17.3954 7.10457 16.5 6 16.5C4.89543 16.5 4 17.3954 4 18.5C4 19.6046 4.89543 20.5 6 20.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 11C18.1046 11 19 10.1046 19 9C19 7.89543 18.1046 7 17 7C15.8954 7 15 7.89543 15 9C15 10.1046 15.8954 11 17 11Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 7.5V16.5M6 13C7.56293 13.5897 9.27124 13.6753 10.8853 13.2449C12.4994 12.8145 13.9382 11.8896 15 10.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

**Room**
```svg
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 11C10.6569 11 12 9.65685 12 8C12 6.34315 10.6569 5 9 5C7.34315 5 6 6.34315 6 8C6 9.65685 7.34315 11 9 11Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.80005 19.5C3.80005 18.1209 4.3479 16.7982 5.32309 15.823C6.29828 14.8478 7.62092 14.3 9.00005 14.3C10.3792 14.3 11.7018 14.8478 12.677 15.823C13.6522 16.7982 14.2 18.1209 14.2 19.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 11.2C18.7151 11.2 19.7 10.215 19.7 8.99999C19.7 7.78496 18.7151 6.79999 17.5 6.79999C16.285 6.79999 15.3 7.78496 15.3 8.99999C15.3 10.215 16.285 11.2 17.5 11.2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 19.5C15.6164 18.8781 15.8599 18.2868 16.2153 17.7633C16.5706 17.2397 17.0301 16.7951 17.5651 16.4572C18.1001 16.1193 18.699 15.8955 19.3244 15.7996C19.9499 15.7037 20.5884 15.7379 21.2 15.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

**Slate**
```svg
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 4H5.5C4.67157 4 4 4.67157 4 5.5V9.5C4 10.3284 4.67157 11 5.5 11H9.5C10.3284 11 11 10.3284 11 9.5V5.5C11 4.67157 10.3284 4 9.5 4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 4H14.5C13.6716 4 13 4.67157 13 5.5V9.5C13 10.3284 13.6716 11 14.5 11H18.5C19.3284 11 20 10.3284 20 9.5V5.5C20 4.67157 19.3284 4 18.5 4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 13H5.5C4.67157 13 4 13.6716 4 14.5V18.5C4 19.3284 4.67157 20 5.5 20H9.5C10.3284 20 11 19.3284 11 18.5V14.5C11 13.6716 10.3284 13 9.5 13Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 13H14.5C13.6716 13 13 13.6716 13 14.5V18.5C13 19.3284 13.6716 20 14.5 20H18.5C19.3284 20 20 19.3284 20 18.5V14.5C20 13.6716 19.3284 13 18.5 13Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

**Studio**
```svg
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3V5.5M12 18.5V21M3 12H5.5M18.5 12H21M5.5 5.5L7.3 7.3M16.7 16.7L18.5 18.5M18.5 5.5L16.7 7.3M7.3 16.7L5.5 18.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

## Acceptance
The left rail's icons visibly match the Figma (`6:111`): **clapperboard** Build · **graph** Canon · **git-branch** Versions · **users** Room · **grid** Slate · **sun** Studio (Home/Write/Doctor unchanged), with the gold active highlight intact. Verify at 1440 against `6:111`, behind `scripton.osShell`, 0 console errors. Commit + push. That's the last piece.
