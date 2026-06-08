# TFM System — Restore Guide

How to bring the system back from a backup zip created by `backup-tfm.ps1`. Follow this if a change goes wrong and you need to roll back.

---

## What the backup contains

```
TFM-backup-YYYYMMDD-HHmmss.zip
├── code/
│   ├── backend/          NestJS API + Prisma schema + .env (no node_modules/dist)
│   │   └── uploads/       user-uploaded files (photos, documents)
│   ├── frontend/         Next.js app + .env (no node_modules/.next)
│   └── docs/             design documents
├── database/
│   ├── tfm_erp.sql       plain-text SQL dump (portable, human-readable)
│   └── tfm_erp.dump      compressed dump (for pg_restore)
└── BACKUP-MANIFEST.txt   summary of this backup
```

> The backup includes `.env` files with secrets (DB password, JWT secret, Anthropic key). Keep the zip private.

---

## Option A — Roll back EVERYTHING (code + database)

Use this when a migration or change broke things and you want the exact state from the backup.

### 1. Stop the running servers
Press `Ctrl+C` in the backend and frontend terminals.

### 2. Restore the code
Unzip the backup somewhere, then copy the code back over the project (or restore into a fresh folder):

```powershell
# example — adjust the backup path
$bk = "C:\Projects\TFM-Backups\TFM-backup-YYYYMMDD-HHmmss"
robocopy "$bk\code\backend"  "C:\Projects\TFM-System\backend"  /E
robocopy "$bk\code\frontend" "C:\Projects\TFM-System\frontend" /E
```

This restores source, `.env`, Prisma schema, and `uploads/`. (It does not touch `node_modules` — you reinstall those in step 5.)

### 3. Restore the database

**Easiest — overwrite the existing database** (run from the `database` folder of the backup):

```powershell
# drop & recreate, then load the plain SQL dump
psql -U postgres -c "DROP DATABASE IF EXISTS tfm_erp;"
psql -U postgres -c "CREATE DATABASE tfm_erp;"
psql -U postgres -d tfm_erp -f tfm_erp.sql
```

**Or, using the compressed dump** (`pg_restore`):

```powershell
psql -U postgres -c "DROP DATABASE IF EXISTS tfm_erp;"
psql -U postgres -c "CREATE DATABASE tfm_erp;"
pg_restore -U postgres -d tfm_erp tfm_erp.dump
```

> If `psql`/`pg_restore` aren't recognized, they live in `C:\Program Files\PostgreSQL\<version>\bin`. Either add that to PATH or call them with the full path.

### 4. Reinstall dependencies & regenerate Prisma client

```powershell
cd C:\Projects\TFM-System\backend
npm install
npx prisma generate

cd ..\frontend
npm install
```

### 5. Start again

```powershell
cd C:\Projects\TFM-System\backend
npm run start:dev
# in a second terminal:
cd C:\Projects\TFM-System\frontend
npm run dev
```

---

## Option B — Restore only the database

If the code is fine but data got corrupted:

```powershell
psql -U postgres -c "DROP DATABASE IF EXISTS tfm_erp;"
psql -U postgres -c "CREATE DATABASE tfm_erp;"
psql -U postgres -d tfm_erp -f tfm_erp.sql
```

Then restart the backend.

---

## Option C — Restore only uploaded files

If photos/documents were lost but the database is intact:

```powershell
robocopy "$bk\code\backend\uploads" "C:\Projects\TFM-System\backend\uploads" /E
```

---

## Verify after restoring

1. Backend starts with no Prisma errors (`npm run start:dev`).
2. Open a project → Cost Report loads with the expected numbers.
3. Open a crew member → photo/documents display (confirms uploads restored).
4. Spot-check a recent record you know existed before the backup.

---

## Good habits

- Run `Backup-TFM.bat` **before** every major change (migrations, schema edits, bulk imports).
- Keep the **last 3–5** zips; delete older ones to save space.
- Copy at least one recent zip to **OneDrive or an external drive** — a backup on the same disk won't help if the disk fails.
