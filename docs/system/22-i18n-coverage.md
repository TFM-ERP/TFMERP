# TFM — Arabic (RTL) Localization: Coverage & Worklist

_Generated 2026-06-15 from a scan of `frontend/src/**/*.tsx`._

## Where we are

The **direction/RTL engine is complete** — the whole app mirrors when `dir="rtl"` (default stays English/LTR, so nothing changes until a user opts in via the top-bar **ع** toggle or Settings → Appearance → Language & layout).

**Translated end-to-end so far:**

- app shell + sidebar nav (layout.tsx)
- ⌘K command palette
- Settings · Appearance
- Scheduling home
- Finance home
- Home dashboard

**Translation memory:** `src/lib/i18n.ts` → the `AR` dictionary (one file, reviewable) currently holds **196 keys** (shell chrome + ~130 shared-vocabulary terms + the done pages).

## Scope of remaining work

- Files still containing user-facing English: **254**
- Unique English strings total: **3,877**
- High-leverage strings (appear in ≥4 files): **194** — most of this common vocabulary is **already translated** in the dictionary, so wiring a page mostly reuses existing keys.

## How to translate a page (the repeatable pattern)

```tsx
import { useLocale } from '@/lib/i18n';
// inside the component:
const { t } = useLocale();            // use { t: tr } if the file already has a `t` variable
// then wrap visible strings:
<button>{t('Save')}</button>
<input placeholder={t('Search')} />
```
Add any **new** strings to the `AR` map in `src/lib/i18n.ts`. Untranslated keys fall back to English, so partial wiring is always safe (never blank).

## Worklist — files by user-facing string count (heaviest first)

| Strings | File |
|---:|:---|
| 143 | `components/production/CastingPanel.tsx` |
| 126 | `app/(dashboard)/company/page.tsx` |
| 98 | `components/production/scripton/ScriptOnAudioPanel.tsx` |
| 94 | `app/(dashboard)/rental/assets/[id]/page.tsx` |
| 91 | `app/(dashboard)/maintenance/vendors/[id]/page.tsx` |
| 88 | `app/(dashboard)/casting/talent/page.tsx` |
| 86 | `app/(dashboard)/finance/suppliers/[id]/page.tsx` |
| 78 | `components/production/AccountingPanel.tsx` |
| 77 | `app/(dashboard)/finance/suppliers/page.tsx` |
| 77 | `components/production/LocationAssessment.tsx` |
| 74 | `app/(dashboard)/hr/employees/[id]/page.tsx` |
| 71 | `app/(dashboard)/locations/page.tsx` |
| 67 | `components/production/CrewForm.tsx` |
| 66 | `app/(dashboard)/production/projects/[id]/page.tsx` |
| 66 | `components/production/ProjectSettingsPanel.tsx` |
| 65 | `app/(dashboard)/maintenance/vendors/page.tsx` |
| 65 | `app/(dashboard)/rental/drivers/[id]/page.tsx` |
| 64 | `app/(dashboard)/setup/labor/page.tsx` |
| 62 | `app/(dashboard)/hr/employees/new/page.tsx` |
| 59 | `app/(dashboard)/clients/[id]/page.tsx` |
| 58 | `components/production/PurchasingPanel.tsx` |
| 58 | `components/production/TravelIdentityPanel.tsx` |
| 56 | `app/(dashboard)/rental/assets/page.tsx` |
| 56 | `components/production/ScriptHubPanel.tsx` |
| 54 | `app/(dashboard)/rental/maintenance/page.tsx` |
| 52 | `app/(dashboard)/comms/page.tsx` |
| 52 | `components/production/CallSheetsPanel.tsx` |
| 46 | `components/production/LocationOps.tsx` |
| 45 | `app/(dashboard)/finance/invoices/[id]/page.tsx` |
| 43 | `app/(dashboard)/clients/page.tsx` |
| 43 | `app/(dashboard)/production/projects/page.tsx` |
| 43 | `components/production/ScoutVisitsPanel.tsx` |
| 42 | `app/(dashboard)/finance/expenses/page.tsx` |
| 42 | `app/(dashboard)/locations/scouting/page.tsx` |
| 42 | `components/production/BreakdownsTab.tsx` |
| 42 | `components/production/CostReportPanel.tsx` |
| 41 | `app/(dashboard)/finance/invoices/[id]/edit/page.tsx` |
| 41 | `app/(dashboard)/finance/quotations/new/page.tsx` |
| 41 | `app/(dashboard)/maintenance/jobs/[id]/page.tsx` |
| 40 | `app/(dashboard)/rental/incidents/page.tsx` |
| 40 | `app/apply/[callId]/page.tsx` |
| 39 | `app/(dashboard)/finance/quotations/[id]/edit/page.tsx` |
| 39 | `app/(dashboard)/maintenance/tires/page.tsx` |
| 39 | `app/(dashboard)/transport/page.tsx` |
| 38 | `app/(dashboard)/finance/collections/page.tsx` |
| 38 | `app/(dashboard)/finance/invoices/new/page.tsx` |
| 38 | `app/(dashboard)/rental/bookings/new/page.tsx` |
| 36 | `app/(dashboard)/account/security/page.tsx` |
| 36 | `app/(dashboard)/workflow/page.tsx` |
| 36 | `components/production/CashPanel.tsx` |
| 36 | `components/production/LocationsPanel.tsx` |
| 35 | `app/(dashboard)/scripts/page.tsx` |
| 35 | `app/(dashboard)/users/page.tsx` |
| 34 | `app/(dashboard)/maintenance/parts/page.tsx` |
| 34 | `app/driver/page.tsx` |
| 34 | `components/production/ProjectLaborPanel.tsx` |
| 33 | `app/(dashboard)/accounting/bank-rec/page.tsx` |
| 33 | `app/(dashboard)/contacts/page.tsx` |
| 33 | `app/(dashboard)/rental/maintenance-schedule/page.tsx` |
| 33 | `app/setup/page.tsx` |
| 33 | `components/production/CaptainConsole.tsx` |
| 33 | `components/production/CrewAssignmentsPanel.tsx` |
| 32 | `app/(dashboard)/finance/vat-return/page.tsx` |
| 32 | `app/(dashboard)/rental/bookings/[id]/page.tsx` |
| 32 | `app/vendor-onboarding/[token]/page.tsx` |
| 32 | `components/production/ClearancePacksPanel.tsx` |
| 31 | `app/(dashboard)/finance/quotations/[id]/page.tsx` |
| 31 | `app/(dashboard)/finance/report-designer/page.tsx` |
| 31 | `components/production/ScriptReader.tsx` |
| 30 | `app/(dashboard)/inventory/page.tsx` |
| 29 | `app/(dashboard)/finance/services/page.tsx` |
| 29 | `app/(dashboard)/maintenance/jobs/page.tsx` |
| 29 | `components/production/BreakdownPanel.tsx` |
| 29 | `components/production/LocationReportPanel.tsx` |
| 28 | `app/(dashboard)/backups/page.tsx` |
| 27 | `components/production/LiningPanel.tsx` |
| 27 | `components/production/LocationBreakdownPanel.tsx` |
| 26 | `app/(dashboard)/executive/page.tsx` |
| 26 | `app/(dashboard)/rental/drivers/new/page.tsx` |
| 26 | `components/production/TalentV3Tabs.tsx` |
| 25 | `app/(dashboard)/business-partners/page.tsx` |
| 25 | `app/(dashboard)/finance/report-builder/page.tsx` |
| 25 | `app/(dashboard)/inventory/[id]/page.tsx` |
| 25 | `components/production/DocumentsPanel.tsx` |
| 24 | `app/(dashboard)/setup/audio-engines/page.tsx` |
| 24 | `app/print/callsheet/[id]/page.tsx` |
| 24 | `components/production/OveragesPanel.tsx` |
| 24 | `components/production/StripboardPanel.tsx` |
| 23 | `components/production/TravelPanel.tsx` |
| 22 | `app/(dashboard)/production/crew/page.tsx` |

_…and 164 more lighter files._

## Most-shared vocabulary (translate once → covers many pages)

| Files | String |
|---:|:---|
| 84 | `Cancel` |
| 50 | `Loading…` |
| 39 | `Status` |
| 36 | `Notes` |
| 30 | `Type` |
| 28 | `Email` |
| 24 | `Total` |
| 22 | `Name` |
| 21 | `Description` |
| 19 | `Refresh` |
| 19 | `Category` |
| 19 | `Asset` |
| 18 | `Next` |
| 18 | `Date` |
| 17 | `Edit` |
| 16 | `Mobile` |
| 16 | `Currency` |
| 15 | `Prev` |
| 15 | `Name *` |
| 13 | `VAT` |
| 13 | `Reject` |
| 13 | `Phone` |
| 13 | `Location` |
| 13 | `IBAN` |
| 13 | `From` |
| 13 | `Amount` |
| 12 | `To` |
| 12 | `Role` |
| 12 | `Country` |
| 12 | `Client` |
| 12 | `Approve` |
| 12 | `Actions` |
| 11 | `Scenes` |
| 11 | `Open` |
| 11 | `Days` |
| 11 | `City` |
| 10 | `Subtotal` |
| 10 | `Select…` |
| 10 | `Save` |
| 10 | `Remove` |
| 10 | `Nationality` |
| 10 | `All Statuses` |
| 10 | `Add` |
| 9 | `WhatsApp` |
| 9 | `View` |
| 9 | `Tools` |
| 9 | `Title` |
| 9 | `Summary` |
| 9 | `Qty` |
| 9 | `Driver` |
| 9 | `Cost` |
| 9 | `Bank Name` |
| 9 | `Address` |
| 9 | `Active` |
| 8 | `Website` |
| 8 | `Unit` |
| 8 | `Promise` |
| 8 | `Production` |
| 8 | `Pages` |
| 8 | `Issue Date` |

> Tip: tackle by **module priority** (the screens your Arabic users hit first) rather than purely by count. Numbers, IDs, and dynamic data stay as-is; only static UI labels need `t()`.
