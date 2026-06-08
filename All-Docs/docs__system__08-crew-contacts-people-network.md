# SYS-08 — People & Network: Crew, Contacts & Directories

**Status: ✅ BUILT (crew profile parity + master Contact directory).** How the system holds *people* — freelance crew, company contacts, clients, suppliers, vendors, partners, authorities — at **master/company level**, and how email and the ADFC industry directory feed it.

---

## 1. The people model (master level)

| Model | Holds | Notes |
|---|---|---|
| **CrewMember** | freelance crew & talent | rate card, documents, banking, ERP-identity link, **+ professional profile (below)** |
| **Contact** | any named person + a `contactType` | the master people directory; links to Client / Supplier / MaintenanceVendor |
| **Client** | client *companies* | companyName, contactName, TRN, terms |
| **Supplier** | supplier *companies* | categories, TRN, vendor link |
| **MaintenanceVendor** | workshops / vendors | — |

`ContactType`: `CREW_MEMBER · VENDOR_EMPLOYEE · CLIENT_EMPLOYEE · WORKSHOP_EMPLOYEE · DRIVER_CONTACT · SUPPLIER_EMPLOYEE · FREELANCER · OTHER`.

**Rule:** people (named individuals) live in **Contact** (or **CrewMember** for crew); **companies** live in Client/Supplier/Vendor. A person record is only created when a **clear full name** exists.

---

## 2. Crew professional profile — ADFC reel-scout parity ✅

Modelled on the Abu Dhabi Film Commission (reel-scout) crew profile so our directory carries the same richness. `CrewMember` gains:

- `resumeUrl` (CV) · `skills` (Special Skills & Experience) · `bio` ("Description")
- `links` — Json `[{label,url}]`: IMDB, showreel, website, socials
- `credits` — Json `[{year,title,role}]`: previous work / filmography
- `categories` — Json `[{department,role}]`: additional roles beyond the primary
- `affiliations` — Json: experience tags (Emirati Crew & Talent, Arabic/Indian/International/TVC/Unscripted Production Experience)

**Field mapping (ADFC → ours):** Description→`bio`, Weblinks→`links`, Credits→`credits`, Special Skills→`skills`, View File/Resume→`resumeUrl`, multi "Category"→`department`/`role`+`categories`.

### UI
- **Crew form → Professional profile card:** repeatable links & credits, skills, resume upload, affiliation chips, additional roles.
- **"Paste profile" importer:** paste a CV/profile text → Anthropic extracts the fields for review (`POST /crew/parse-profile`). Suggestion-only, never auto-saved; for your own roster / consented crew — **not** bulk scraping.
- **Crew Directory → "By department" view:** groups crew under their department with roles, clickable weblinks and a credits preview.

> We deliberately did **not** bulk-copy the ADFC industry directory (third-party personal data + their terms). The paste importer is the lawful, one-at-a-time path.

---

## 3. Contacts from email & classification

Contacts are also discovered from the mailboxes (see SYS-09). Each named person is classified — **Crew / Client / Vendor / Supplier / Service Provider / Business Partner / Authority / Other** — using context (subjects, body, verified company domains), deduped against existing records, and written at master level (crew → CrewMember; others → Contact with the mapped `contactType`). Company records are matched for context, never auto-modified.

---

## 4. Endpoints (summary)

`/crew` (list/get/create/update/remove), `/crew/parse-profile`, `/crew/parent-users`, `/crew/:id/parent-user`, `/crew/departments`, `/crew/:id/availability`. Contacts/Clients/Suppliers via their own modules.

---

Indexed in `docs/INDEX.md`. Chronology in `CHANGELOG.md`.
