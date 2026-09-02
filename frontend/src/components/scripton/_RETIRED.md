# ScriptON — retired legacy files (scheduled for deletion)

These files are **dead code**: the old-OS / tablet / mobile ScriptOn screens. Every one is **unreferenced**
(no route or component imports it) — they are not in the build and cannot be reached. They are kept for now
(disabled, not deleted) and each carries a `@deprecated` banner. Delete them whenever you're ready.

## ✅ Safe to delete now — 23 files (fully unreferenced)

One command, from `C:\Projects\TFM-System\frontend`:

```sh
git rm \
  src/components/scripton/ScriptOnDashboard.tsx \
  src/components/scripton/ScriptOnDashboardTablet.tsx \
  src/components/scripton/ScriptOnDashboardMobile.tsx \
  src/components/scripton/ScriptOnNotes.tsx \
  src/components/scripton/ScriptOnNotesTablet.tsx \
  src/components/scripton/ScriptOnNotesMobile.tsx \
  src/components/scripton/ScriptOnRevisions.tsx \
  src/components/scripton/ScriptOnRevisionsTablet.tsx \
  src/components/scripton/ScriptOnRevisionsMobile.tsx \
  src/components/scripton/ScriptOnLibraryTablet.tsx \
  src/components/scripton/ScriptOnLibraryMobile.tsx \
  src/components/scripton/ScriptOnReaderTablet.tsx \
  src/components/scripton/ScriptOnReaderMobile.tsx \
  src/components/scripton/ScriptOnStudioTablet.tsx \
  src/components/scripton/ScriptOnStudioMobile.tsx \
  src/components/scripton/ScriptOnDoctorTablet.tsx \
  src/components/scripton/ScriptOnDoctorMobile.tsx \
  src/components/scripton/ScriptOnGreenlight.tsx \
  src/components/scripton/ScriptOnGreenlightTablet.tsx \
  src/components/scripton/ScriptOnGreenlightMobile.tsx \
  src/components/scripton/ScriptOnReports.tsx \
  src/components/scripton/ScriptOnReportsTablet.tsx \
  src/components/scripton/ScriptOnReportsMobile.tsx
```

| File | Replaced by |
| --- | --- |
| ScriptOnDashboard(.tsx / Tablet / Mobile) | `home/ScriptonHome` |
| ScriptOnNotes(.tsx / Tablet / Mobile) | `room/ScriptonRoom` |
| ScriptOnRevisions(.tsx / Tablet / Mobile) | `versions/ScriptonVersions` + `compare/ScriptonCompare` |
| ScriptOnLibraryTablet / ScriptOnLibraryMobile | `ScriptOnLibrary` (embedded) under `ScriptonShell` |
| ScriptOnReaderTablet / ScriptOnReaderMobile | `write/ScriptonWrite` |
| ScriptOnStudioTablet / ScriptOnStudioMobile | `develop/ScriptonDevelop` + `studio` create-flow |
| ScriptOnDoctorTablet / ScriptOnDoctorMobile | `doctor/ScriptonDoctor` |
| ScriptOnGreenlight(.tsx / Tablet / Mobile) | `greenlight/ScriptonGreenlight` |
| ScriptOnReports(.tsx / Tablet / Mobile) | `reports/ScriptonReports` |

## ⏳ Kept on purpose — not yet deletable

| File | Why it stays |
| --- | --- |
| `ScriptOnReader.tsx` | still **exports types** (`SxScene`, `SxSceneRead`, `SxTab`) used by the new Write route. Delete after a type-extraction pass. |
| `ScriptOnDoctor.tsx` | still **exports types** (`SxGauge`, `SxCoverage`, `SxDiag`, `SxPt`, `SxTab`) used by the new Doctor route. Same. |
| `ScriptOnStudio.tsx` | still the **live adapt / intake / build-render chrome** for the Studio create-flow. Delete after that flow is rebuilt on the shell. |
| `ScriptOnIntake.tsx`, `ScriptOnBuildScreen.tsx`, `ScriptOnBuildsPanel.tsx` | active in the new Studio create/build flow. |
| `ScriptOnBudgetFit`, `ScriptOnRewriteSlate`, `ScriptOnCompsDeck`, `ScriptOnPackagePanel`, `ScriptOnCoverageHistory`, `ScriptOnFormatPanel` | shared **overlays** the new Doctor still opens. |
| `ScriptOnLibrary.tsx` | the new Slate renders it `embedded`. |
| `ScriptOnBreakdown / Schedule / Approvals` (+ twins) | distinct production **features** that only ever had legacy screens — rebuild on the OS when wanted, not redundant old-vs-new. |

## ✅ Done as part of the retirement
- `osShellFlag` `'old'` fallback removed from all 8 dual routes (new OS is the only path).
- Shared primitives (`SxRail`, `SX_CSS`, `cleanStageText`, `Sx*` types) extracted to `shared/sx`.
- Greenlight + Reports rebuilt on `ScriptonShell`.
