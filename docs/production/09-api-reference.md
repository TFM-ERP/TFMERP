# 09 — API Reference (Production)

Every production HTTP route, grouped by controller. All routes require `JwtAuthGuard` + `PermissionsGuard` with `@RequirePermission('production', n)` (labor under `@RequirePermission(... )` likewise). Base API prefix omitted (e.g. `/api/v1`). Format: `VERB /path → service.method`.

---

## production/projects
```
GET    /production/projects/dashboard            → getDashboard
GET    /production/projects                       → findAll
GET    /production/projects/:id                   → findOne
GET    /production/projects/:id/workflow          → workflow
POST   /production/projects                       → create
POST   /production/projects/:id/convert-currency  → convertCurrency
POST   /production/projects/:id/duplicate         → duplicate
PUT    /production/projects/:id                   → update
```

## production/budget
```
GET    /versions/:versionId                       → getVersion
POST   /versions                                  → createVersion
PATCH  /versions/:versionId/activate              → setActiveVersion
PATCH  /versions/:versionId/lock                  → lockVersion
POST   /versions/:versionId/clone                 → cloneVersion
GET    /versions/:versionId/topsheet              → getTopSheet
GET    /versions/:versionId/budget-vs-actual      → getBudgetVsActual
POST   /versions/:versionId/recalculate           → recalculateVersion
POST   /versions/:versionId/globals               → upsertGlobal
DELETE /globals/:globalId                         → deleteGlobal
POST   /versions/:versionId/fringes               → createFringe
PUT    /fringes/:fringeId                          → updateFringe
DELETE /fringes/:fringeId                          → deleteFringe
POST   /versions/:versionId/sections              → createSection
PUT    /sections/:sectionId                        → updateSection
POST   /sections/:sectionId/accounts              → createAccount
PUT    /accounts/:accountId                        → updateAccount
POST   /accounts/:accountId/items                 → createLineItem
PUT    /items/:itemId                              → updateLineItem
DELETE /items/:itemId                              → deleteLineItem
```

## production/costing
```
GET    /vendors                                   → vendors
POST   /vendors                                   → createVendor
PUT    /vendors/:id                               → updateVendor
DELETE /vendors/:id                               → removeVendor
GET    /supplier-catalog                          → supplierCatalog
POST   /vendors/add-from-suppliers                → addFromSuppliers
POST   /vendors/:id/refresh-from-supplier         → refreshVendorFromSupplier
GET    /report/:projectId                         → costReport
GET    /finance-summary/:projectId                → financeSummary
GET    /overspend/:projectId                      → overspendSuggestions
GET    /transfers                                 → listTransfers
POST   /transfers                                 → createTransfer
PATCH  /transfers/:id/status                      → setTransferStatus
DELETE /transfers/:id                             → removeTransfer
GET    /snapshots/:projectId                      → listSnapshots
POST   /snapshots/:projectId                      → saveSnapshot
PATCH  /accounts/:accountId/etc                   → setEtc
GET    /pos                                        → listPos
POST   /pos                                        → createPo
PUT    /pos/:id                                   → updatePo
PATCH  /pos/:id/status                            → setPoStatus
POST   /pos/:id/invoice                           → invoicePo
DELETE /pos/:id                                   → removePo
GET    /floats                                     → floats
POST   /floats                                     → createFloat
PATCH  /floats/:id/close                           → closeFloat
GET    /floats/:floatId/txns                       → pettyTxns
POST   /floats/:floatId/txns                       → addPettyTxn
DELETE /petty-txns/:id                             → removePettyTxn
GET    /cashflow/:projectId                        → cashflow
```

## production/ledger
```
GET    /portfolio                                 → portfolio
GET    /summary/:projectId                        → summary
GET    /ap-aging/:projectId                       → apAging
POST   /pay/:projectId                            → paySelected
GET    /by-account/:projectId                     → byAccount
GET    /account/:projectId/:code                  → accountLedger
GET    /gl/:projectId                             → glByAccount
GET    /periods/:projectId                        → listPeriods
POST   /periods/:projectId                        → setPeriod
GET    /                                           → list
POST   /                                           → create
PUT    /:id                                        → update
PATCH  /:id/status                                → setStatus
DELETE /:id                                        → remove
```

## production/scheduling
```
GET    /board/:projectId                          → board
GET    /dood/:projectId                           → dood
GET    /strips                                     → listStrips
POST   /strips                                     → createStrip
PUT    /strips/:id                                 → updateStrip
POST   /reorder                                    → reorder
POST   /auto-schedule/:projectId                  → autoSchedule
DELETE /strips/:id                                 → removeStrip
```

## production/breakdown
```
POST   /import-script/:projectId                  → ScriptImportService.importScript
POST   /import-script-full/:projectId             → ScriptImportService.fullSetup
GET    /strip/:stripId                             → byStrip
GET    /sheet/:stripId                             → sheet
GET    /summary/:projectId                         → summary
POST   /push-to-budget/:projectId                 → pushToBudget
GET    /budget-preview/:projectId                  → budgetPreview
POST   /budget-generate/:projectId                → budgetFromBreakdown
POST   /                                            → create
PUT    /:id                                         → update
DELETE /:id                                         → remove
```

## production/overages
```
GET / → list   ·   POST / → create   ·   PUT /:id → update   ·   PATCH /:id/status → setStatus   ·   DELETE /:id → remove
```

## production/perdiem
```
GET / → list · POST / → create · POST /generate → generateFromSchedule · PUT /:id → update · PATCH /:id/status → setStatus · DELETE /:id → remove
```

## production/payroll
```
GET    /:projectId          → list
POST   /:projectId/preview  → preview
POST   /:projectId          → create
PUT    /card/:id            → update
DELETE /card/:id            → remove
POST   /card/:id/post       → post
POST   /card/:id/reverse    → reverse
```

## production/locations
```
GET    /:projectId          → list
GET    /item/:id            → get
POST   /:projectId          → create
PUT    /item/:id            → update
DELETE /item/:id            → remove
POST   /item/:id/post-fee   → postFee
```

## production/crew
```
GET    /project/:projectId        → findByProject
GET    /assignment/:id            → findAssignment
POST   /                          → create
PUT    /:id                       → update
DELETE /:id                       → remove
GET    /schedule/:projectId       → getSchedule
POST   /schedule/:projectId       → createScheduleDay
PUT    /schedule/day/:dayId       → updateScheduleDay
DELETE /schedule/day/:dayId       → deleteScheduleDay
```

## production/callsheets
```
GET / → list · GET /:id → findOne · POST / → create · PUT /:id → update · PATCH /:id/publish → publish · POST /:id/pull-schedule → pullFromSchedule · DELETE /:id → remove
```

## production/credits
```
GET /:projectId → getOrBuild · PUT /:projectId → save · POST /:projectId/regenerate → regenerate
```

## production/documents
```
GET / → list · POST / → create · PUT /:id → update · DELETE /:id → remove
```

## production/mail
```
GET  /status                          → status
GET  /settings                        → getSettings
PUT  /settings                        → saveSettings
POST /test                            → testSettings
GET  /settings/project/:projectId     → getProjectSettings
PUT  /settings/project/:projectId     → saveProjectSettings
POST /test/project/:projectId         → testProjectSettings
POST /callsheet/:id                   → sendCallSheet
POST /cost-report/:projectId          → sendCostReport
POST /deal-memo/:assignmentId         → sendDealMemo
```

## labor  (union / fringe / incentive intelligence)
```
GEO        GET /geo/tree → geoTree · GET /geo → geoList · POST /geo → createGeo · PUT /geo/:id → updateGeo · DELETE /geo/:id → removeGeo
BODIES     GET /bodies → laborBodies · POST /bodies → createLaborBody · PUT /bodies/:id → updateLaborBody · DELETE /bodies/:id → removeLaborBody
AGREEMENTS GET /agreements → agreements · GET /agreements/:id → agreement · POST /agreements → createAgreement · PUT /agreements/:id → updateAgreement · DELETE /agreements/:id → removeAgreement
CLASSES    POST /classifications → createClassification · PUT /classifications/:id → updateClassification · DELETE /classifications/:id → removeClassification
RULES      GET /rate-rules → rateRules · POST /rate-rules → createRateRule · PUT /rate-rules/:id → updateRateRule · DELETE /rate-rules/:id → removeRateRule
SOURCES    GET /sources → sources · POST /sources → createSource · PUT /sources/:id → updateSource · DELETE /sources/:id → removeSource
REFRESH/AI POST /refresh → refreshRates · POST /ai-research → aiResearch · POST /ai-update-all → aiUpdateAll
PROPOSALS  GET /proposals → listProposals · GET /proposals/pending-count → pendingCount · POST /proposals → createProposal · POST /proposals/:id/approve → approveProposal · POST /proposals/:id/reject → rejectProposal
RESOLVE    POST /resolve → resolvePreview
PROJECT    GET /project/:projectId/config → getProjectConfig · PUT /project/:projectId/config → saveConfig · POST /project/:projectId/snapshot → snapshot
           PUT /project-rule/:id/toggle → toggleProjectRule · GET /project/:projectId/updates → checkUpdates · POST /project/:projectId/apply-updates → applyUpdates
BUDGET     POST /budget/:versionId/apply-fringes → applyFringesToVersion · GET /budget/:versionId/fringe-detail → fringeDetail
INCENTIVES GET /incentives → incentivePrograms · POST /incentives → createIncentiveProgram · PUT /incentives/:id → updateIncentiveProgram · DELETE /incentives/:id → removeIncentiveProgram
           GET /project/:projectId/incentives → projectIncentives · POST /project/:projectId/incentives → addProjectIncentive · PUT /project-incentive/:id → updateProjectIncentive · DELETE /project-incentive/:id → removeProjectIncentive
CLAIM      GET /project/:projectId/claim → getClaim · PUT /project/:projectId/claim → saveClaim
```

## Print / PDF pages (frontend `app/print/`)
```
/print/budget/[versionId]      production budget
/print/topsheet/[versionId]    top sheet
/print/fringe/[versionId]      fringe detail
/print/costreport/[projectId]  cost report (EFC, revised budget)
/print/callsheet/[id]          call sheet
/print/schedule/[projectId]    one-line shooting schedule
/print/breakdown/[stripId]     scene breakdown sheet
/print/dealmemo/[id]           crew deal memo
/print/credits/[projectId]     end-credit roll
```
