# Email analysis — how to run

This folder receives the outputs of `backend/tools/analyze-emails.js`, which reviews both
mailboxes (`C:\emails\…`), extracts & classifies contacts, compares them against your **live
database**, and (optionally) enriches/creates records at **master level** only.

## Why a script (and not done automatically)
The emails and the database both live on **your** machine. The assistant's sandbox can't read
the synced email files reliably nor reach your database — so this runs locally where both exist.

## Run it — DRY RUN first (changes nothing)
From the `backend` folder, PowerShell:

```
cd backend
node tools/analyze-emails.js "C:\emails"
```

This writes, into this `email-analysis/` folder:
- **report.md** — new contacts, contacts to enrich, suggested classifications, operational insights, top attachments
- **contacts.csv** — every name-bearing contact with class, DB-match and the planned action (open in Excel, review)
- **actions.json** — the machine plan
- **digest.json** — threads, attachment names and keyword signals (used for the deeper analysis)

## Review, then apply
Open `contacts.csv` and skim the classifications and CREATE/ENRICH actions. When you're happy:

```
node tools/analyze-emails.js "C:\emails" --apply
```

- People classed **CREW** → created in **CrewMember**.
- All other named people → master **Contact** directory with the right `contactType`
  (CLIENT_EMPLOYEE / VENDOR_EMPLOYEE / SUPPLIER_EMPLOYEE / OTHER).
- Existing matches are **enriched** (missing phone / email / company filled), not duplicated.
- Company records (Client / Supplier / Vendor) are matched for context but never auto-modified.

## Rules honoured
- A contact is created **only** if it has a clear full name (≥2 name tokens).
- Automated senders, role mailboxes (info@, sales@…), newsletters and company-only entries are excluded.
- Nothing is written without `--apply`.

## Then send me the outputs
After the dry run, `report.md` + `digest.json` sync back to the assistant. I'll then do the
**online verification** of the notable companies/people, refine the classifications, and write up
the **system-enhancement recommendations** (new fields, workflows, modules) from the real content.
