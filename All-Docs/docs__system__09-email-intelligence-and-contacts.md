# SYS-09 — Email Intelligence & Contact Reconciliation

**Status: ✅ TOOL BUILT · 🔶 modules proposed.** A repeatable pipeline that mines the company mailboxes (Qais + Islam, exported `.msg`) for **contacts** and **operational insight**, reconciles contacts against the live database at master level, and surfaces the system gaps the correspondence reveals.

---

## 1. The analyzer (`backend/tools/analyze-emails.js`)

Runs **on the user's machine** (the emails and the database both live there; the sandbox can reach neither). Dependency-free.

- **Parses every `.msg`** with a self-contained CFBF/OLE2 reader (sender + recipients with display names, subject, body, signature phones, attachments).
- **Extracts contacts only with a clear full name** (≥2 name tokens). Excludes automated senders, role mailboxes (`info@`/`sales@`…), newsletters, brand/system names (Microsoft, Google…), and **own/internal domains** (`@thefilmmakers.com` etc. = you/your staff).
- **Classifies** each: Crew / Client / Vendor / Supplier / Service Provider / Partner / Authority / Other — keyword + **verified company-domain** overrides (e.g. Image Nation, Breakout, Electric, Pinzutu → Partner/Client; NEEDaFIXER → Service Provider; DCT, twofour54, ADFC → Authority).
- **Dedupes vs live DB** (Contact, CrewMember, Client, Supplier): exact **email** match → safe **ENRICH**; **name-only** match → **REVIEW** (flagged, never auto-merged); else **CREATE** at master level.
- **Dry run by default** (writes a report, changes nothing); `--apply` commits.

### Outputs → `email-analysis/`
`report.md` (new / enrich / review / classifications / insights), `contacts.csv` (every contact + class + action), `actions.json` (plan), `digest.json` (keyword signals, attachments, threads), and the analyst write-up `FINAL-REPORT.md`.

### Run
```
node tools/analyze-emails.js "C:\emails"            # dry run
node tools/analyze-emails.js "C:\emails" --apply    # commit master-level
```

---

## 2. What the mailboxes revealed (8,349 emails)

**1,551 named contacts** (after the no-name filter). Operational keyword frequency:
`location 2,357 · crew 1,577 · schedule 1,136 · invoice 1,127 · permit 1,041 · travel 1,016 · contract 844 · security 650 · quotation 602 · budget 535 · visa 369 · NOC 327 · insurance 303 · accommodation 219 · risk/method-statement 195 · casting 107`.

This **validates** the built modules (Locations, Permits, Security, Insurance, Finance) and **exposes three uncovered, high-traffic workflows** → proposed modules below.

---

## 3. Proposed modules (from the analysis) 🔶

| Module | Evidence | Sketch |
|---|---|---|
| **Travel · Visa · Logistics** | travel 1,016 · visa 369 · accommodation 219 · shipping 38 · charter 10 | `Trip`, `FlightBooking`, `HotelBooking`, `VisaApplication` (status/expiry), `GroundTransport`, `ShipmentCarnet`; cost→ledger; visa/passport expiry reminders (crew fields already exist). **Highest-value gap.** |
| **Contracts & e-signature** | contract 844; DocuSign/eSignature attachments | master `Contract` register (deal memos, NDAs, talent/vendor/location agreements) — party, value, signed/expiry, signing status. |
| **Casting & Crew-application pipeline (ATS)** | casting 107 + constant inbound applications | `CastingCall`, `Submission`; applicant → status (Applied→Shortlisted→Hired) → Crew Directory. |
| Co-production / BD pipeline | partner 34; inbound co-pro/financing/distribution | extend CRM Opportunities with `CO_PRODUCTION`. |
| Vendor/Supplier master enrichment | quotation 602 · invoice 1,127 | company-level vendor/supplier directory + named contacts. |

Build order recommendation: **Travel/Visa/Logistics → Applications pipeline → Contracts**.

---

## 4. New fields & automations (smaller)

- **Contact:** `source`, `lastContactedAt`, `linkedCompanyId`, `secondaryEmails[]`/`secondaryPhones[]`.
- A light `Organization` type over Client/Supplier/Vendor so a production house can be a **Partner**.
- **Crew:** `applicationStatus`/`appliedFor`; visa/passport/insurance + contract expiry into the daily reminder digest.
- Auto-file inbound `.msg` to the matching contact/company (generalise the Locations `.msg` intake).

---

*Privacy: only named individuals are stored; internal/automated/brand senders excluded. ADFC directory not bulk-copied. Sources & data in `email-analysis/`.*
