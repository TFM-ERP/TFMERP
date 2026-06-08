# Standard Production Workflow + Abu Dhabi Incentive — Design & Enhancement Plan

**Purpose:** define the *correct, standard* order of a film production in this system (so steps can't sensibly be done out of sequence), and add the Abu Dhabi Film Commission rebate (rate + certificate/audit process) as a guided workflow.

---

## 1. The problem today

The project screen shows every tab at once (Budget, Schedule, Fringe, Incentives, Labor, Accounting…) with no implied order. A user can, e.g., build a budget before setting the currency, apply fringes before freezing a labor snapshot, or estimate incentives before there's a budget to measure. Nothing is *wrong* technically, but it isn't the standard production accounting sequence, and newcomers get lost.

**Goal:** keep the flexibility, but overlay a **standard, guided, stage-gated workflow** that tells you what to do next and warns (softly) when a prerequisite is missing.

---

## 2. The standard production order (canonical)

This is the order a line producer / production accountant actually works in. Each step's *output* is the next step's *input*.

| # | Stage | Step | Why it must come here | System location |
|---|-------|------|----------------------|-----------------|
| 0 | **Development** | Create project · choose **type** + **base currency** | Everything denominates in one currency; set it once, first. | New Project form |
| 1 | Development | **Labor & jurisdiction** → freeze fringe snapshot | Country/region/union status decide which fringes exist *before* you budget. | Labor & Union tab |
| 2 | Development | **Script breakdown** (import script → scenes + elements) | The script is the source of truth for cast, sets, elements. | Schedule → Import script |
| 3 | Prep | **Schedule** (stripboard order → shoot days) → **DOOD** | Shoot-day count + cast working pattern drive budget quantities & per-diems. | Schedule tab |
| 4 | Prep | **Budget** (from breakdown + schedule globals + rates) | Built on real scenes, days and labor. | Budget tab |
| 5 | Prep | **Apply fringes** → burdened budget + Top Sheet | Uses the frozen snapshot from step 1. | Fringe Detail tab |
| 6 | Prep | **Incentives** estimate → net cost | Measured against the burdened budget. | Incentives tab |
| 7 | Prep | **Lock budget version** (Approved Budget) → set active | Greenlight baseline; everything after is tracked vs this. | Budget version → Lock |
| 8 | Production | POs · petty cash · deal memos · call sheets · **Cost Report (EFC)** · cash flow · per diems · overages | Daily running of the show vs the locked budget. | Purchasing / Cash / Cost Report |
| 9 | Production | **Accounting** — auto-post to GL + burden journals | Books mirror the production ledger. | Accounting tab |
| 10 | Post / Wrap | Final cost report · credits · **audited cost statement** | Closeout + incentive evidence. | Cost Report / End Credits |
| 11 | Claim | **Incentive claim**: interim cert → audited report → final cert → payment | Realise the rebate. | Incentives → AD tracker (new) |

**Hard prerequisites (should warn if skipped):**
- Apply fringes (5) requires a **frozen labor snapshot** (1).
- Incentives (6) are only meaningful once a **budget** exists (4) and ideally fringed (5).
- Cost Report / POs (8) are only meaningful against a **locked budget** (7).
- Incentive **claim** (11) requires an **audited cost report** (10).

---

## 3. Proposed enhancement — a guided, stage-gated workflow

### 3.1 Project Stage field
Add a `stage` to the project: `DEVELOPMENT → PREP → PRODUCTION → POST → WRAPPED`. Drives a progress bar and filters what's emphasised (e.g. Development highlights Labor/Breakdown/Budget; Production highlights Cost Report/Cash).

### 3.2 "Getting Started / Workflow" checklist on the Overview
A right-rail checklist that:
- Lists the 11 steps in order, each with **auto-detected status** (done / available / blocked) and a **deep link**.
- Highlights the **single next recommended action**.
- Shows a soft **warning chip** when a step is reached out of order ("Lock the budget before raising POs", "Freeze the labor snapshot before applying fringes").
- Never hard-locks — production reality needs flexibility — but makes the standard path obvious.

Status detection (read-only, cheap):
- Currency set ✓ when project.currency chosen at create.
- Labor frozen ✓ when `ProjectLaborConfig.snapshotAt` set.
- Breakdown ✓ when project has Strips/BreakdownElements.
- Schedule ✓ when any Strip has shootDay > 0 (DOOD populated).
- Budget ✓ when active version has line items.
- Fringes ✓ when any line has `fringeDetail`.
- Incentives ✓ when any `ProjectIncentive` saved.
- Locked ✓ when active version status = LOCKED.

### 3.3 Currency at creation (gap to fix)
The New Project form does **not** currently ask for currency (defaults to AED). Add a **Base Currency** dropdown to the create form so step 0 is correct from the start. (The Misfits sample correctly uses USD; new projects should choose explicitly.)

---

## 4. Abu Dhabi Film Commission — 35%++ Cashback Rebate

> Decision-support summary from official sources. Confirm current rules with ADFC before relying on figures.

### 4.1 Rate
- **Base: 35%** cashback on **ADQPE** (Abu Dhabi Qualifying Production Expenditure) — pre-production, production and/or post spend in Abu Dhabi.
- **Up to 50%** via a **points-based uplift** ("the ++"):
  - 10–14 points → **+2.5%** (37.5% total), scaling up to **+15%** at **85+ points** (50% total).
  - Example point awards: UAE cultural value **+10 pts** (≈ +2.5%); content featuring Abu Dhabi **+20 pts** (≈ +5%, 40% total); a **UAE national in an ATL role** (writer/director/lead/stunt) with on-screen credit **= 20 pts**; **entire TV series** shot in Abu Dhabi **= 20 pts**; **full post-production** in Abu Dhabi; main-unit feature in Abu Dhabi; use of **local Emirati talent**.
- Available for all qualifying formats from **1 January 2025** (features, TV series/programmes, short-form incl. TVCs & music videos, reality/game shows, animation). Project financial caps apply.

### 4.2 Qualifying spend (ADQPE)
Counts spend such as: **below-the-line UAE-resident crew** (valid UAE residence / freelancer / short-term work permit), and **production & post-production services with Abu Dhabi-licensed providers**. (ATL and non-AD/non-qualifying spend generally excluded — confirm per the ADFC Rebate Guidelines.)

### 4.3 The process — step by step (certificate → audit → payment)
1. **Apply** — submit the Rebate Application at least **30 business days before** principal photography in Abu Dhabi. Required: full **itemised production budget + ADQPE rebate worksheet**, executed **financier agreement(s)**, **production services agreement**, and **production insurance binder**.
2. **Interim Certificate** — if approved, ADFC issues it within **30 business days** of an approved application.
3. **Start shooting** — principal photography must commence in Abu Dhabi within **90 days** of the Interim Certificate (extendable at ADFC discretion up to a total of **120 days** for bona-fide delays).
4. **Audited cost statement** — within **180 days** of completing principal photography / post in Abu Dhabi, submit a written **audited expenditure statement** prepared by an **approved auditor**. The audit confirms final ADQPE and the rebate amount.
5. **Final Certificate** — issued on a successful audit.
6. **Payment** — paid to the **Abu Dhabi-registered applicant company** within **30 business days** of the Final Certificate.

### 4.4 How the system should support it (proposed "AD Incentive Tracker")
A workflow object attached to the project's incentive:
- **Points calculator** → computes uplift % (35 → 50) from selected criteria; feeds the incentive estimate's rate automatically.
- **Stage tracker**: Eligibility → Application → Interim Certificate → Principal Photography → Audited Statement → Final Certificate → Payment, each with status + date.
- **Deadline reminders** (using the existing scheduled-tasks engine): "apply ≥30 business days before PP", "PP within 90 days of interim cert", "audited statement due 180 days after wrap", "payment expected within 30 business days of final cert".
- **Document checklist** (using the existing document vault): itemised budget + ADQPE worksheet, financier agreement, production services agreement, insurance binder, approved-auditor report, certificates.
- **ADQPE worksheet**: tag which budget lines are AD-qualifying (BTL UAE crew + AD-licensed services) so the rebate is computed on the correct base, not the whole budget.

---

## 5. Recommended build order for the enhancement
1. **Currency at creation** (small, unblocks step 0).
2. **Workflow checklist + Project Stage** on the Overview (the "make it standard" win).
3. **Abu Dhabi Incentive Tracker**: points calculator + stage tracker + ADQPE tagging (+ optional deadline reminders & doc checklist).

---

## Sources
- Abu Dhabi Film Commission — 35%++ Rebate & FAQs: https://www.film.gov.ae/35-rebate , https://www.film.gov.ae/35-rebate/faqs
- ADFC Rebate Guidelines (PDF): https://www.film.gov.ae/storage/staticPage/ADFC%20Rebate%20Guidelines%20FINAL%20En.pdf
- ADFC enhancements / points system: https://www.film.gov.ae/media-centre/abu-dhabi-announces-multifaceted-enhancements-to-increase-the-35-plus-plus-cashback-rebate
- KPMG — Navigating Abu Dhabi's qualifying production expenditure: https://kpmg.com/ae/en/insights/sector-insights/navigating-abu-dhabis-qualifying-production-expenditure.html
- Bird & Bird — The new 35%++ Abu Dhabi Film Rebate: https://www.twobirds.com/en/insights/2025/united-arab-emirates/lights-camera-rebate-the-new-35-abu-dhabi-film-rebate
