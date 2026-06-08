<#
  TFM System — Full Backup
  ------------------------
  Captures EVERYTHING needed to restore the system if a change goes wrong:
    1. Source code (frontend + backend + docs + root files)   — excludes node_modules / dist / .next
    2. Database     (full PostgreSQL dump of tfm_erp)          — plain .sql AND compressed .dump
    3. Uploaded files (backend/uploads — crew photos, docs)    — 69 MB+
    4. Environment files (.env) and Prisma schema
  Everything is written to a timestamped folder and zipped into one archive.

  USAGE (PowerShell, from anywhere):
    powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Projects\TFM-System\scripts\backup-tfm.ps1"

  Or just double-click  scripts\Backup-TFM.bat

  Options:
    -BackupRoot "D:\Backups"   change where backups are written (default C:\Projects\TFM-Backups)
    -SkipDb                    skip the database dump (code + files only)
    -SkipUploads               skip the 69 MB uploads folder (smaller, faster)
    -NoZip                     leave the folder uncompressed (don't build the .zip)
#>

param(
  [string]$ProjectDir = "C:\Projects\TFM-System",
  [string]$BackupRoot = "C:\Projects\TFM-Backups",
  [string]$Label = "",            # optional name, e.g. "V1" -> TFM-V1-Backup-<stamp>
  [switch]$SkipDb,
  [switch]$SkipUploads,
  [switch]$NoZip
)

$ErrorActionPreference = "Stop"
function Say($m, $c = "Cyan") { Write-Host $m -ForegroundColor $c }
function Warn($m) { Write-Host "  ! $m" -ForegroundColor Yellow }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$name  = if ($Label) { "TFM-$Label-Backup-$stamp" } else { "TFM-backup-$stamp" }
$dest  = Join-Path $BackupRoot $name

Say "=================================================="
Say " TFM System — Full Backup"
Say " $(Get-Date -Format 'dddd, dd MMMM yyyy HH:mm:ss')"
Say "=================================================="
Say "Source : $ProjectDir"
Say "Target : $dest`n"

New-Item -ItemType Directory -Force -Path $dest             | Out-Null
New-Item -ItemType Directory -Force -Path "$dest\database"  | Out-Null
New-Item -ItemType Directory -Force -Path "$dest\code"      | Out-Null

# ---------------------------------------------------------------------------
# 1. DATABASE DUMP
# ---------------------------------------------------------------------------
$dbOk = $false; $dbName = "tfm_erp"
if (-not $SkipDb) {
  Say "[1/4] Dumping PostgreSQL database..."
  $envFile = Join-Path $ProjectDir "backend\.env"
  if (-not (Test-Path $envFile)) {
    Warn "backend\.env not found — skipping database dump."
  } else {
    $line = (Get-Content $envFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1)
    $url  = ($line -replace '^\s*DATABASE_URL\s*=\s*','').Trim().Trim('"').Trim("'")
    if ($url -match 'postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?]+)') {
      $dbUser=$matches[1]; $dbPass=$matches[2]; $dbHost=$matches[3]; $dbPort=$matches[4]; $dbName=$matches[5]

      # locate pg_dump: PATH first, then standard PostgreSQL install folders (highest version)
      $pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
      if (-not $pgDump) {
        $pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
                  Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
      }
      if (-not $pgDump) {
        Warn "pg_dump.exe not found. Install PostgreSQL client tools or add its \bin to PATH, then re-run with the DB."
        Warn "Code + uploads will still be backed up below."
      } else {
        $env:PGPASSWORD = $dbPass
        try {
          Say "      using $pgDump"
          & $pgDump -h $dbHost -p $dbPort -U $dbUser -d $dbName -F p -f "$dest\database\$dbName.sql"
          & $pgDump -h $dbHost -p $dbPort -U $dbUser -d $dbName -F c -f "$dest\database\$dbName.dump"
          $dbOk = $true
          Say "      OK  $dbName.sql (plain) + $dbName.dump (compressed)" "Green"
        } catch {
          Warn "pg_dump failed: $($_.Exception.Message)"
        } finally {
          Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        }
      }
    } else {
      Warn "Could not parse DATABASE_URL — skipping database dump."
    }
  }
} else { Say "[1/4] Database dump SKIPPED (-SkipDb)" }

# ---------------------------------------------------------------------------
# 2. SOURCE CODE  (robocopy mirror, excluding heavy/rebuildable folders)
# ---------------------------------------------------------------------------
Say "`n[2/4] Copying source code..."
$common = @("/E","/NFL","/NDL","/NJH","/NJS","/NP","/R:1","/W:1")
$xdBack = @("node_modules","dist","dist(1)","build",".next","backups",".git","coverage")
if ($SkipUploads) { $xdBack += "uploads" }

# backend (keeps prisma, src, uploads, .env)
robocopy "$ProjectDir\backend"  "$dest\code\backend"  @common /XD @xdBack /XF "*.log" | Out-Null
# frontend
robocopy "$ProjectDir\frontend" "$dest\code\frontend" @common /XD "node_modules" ".next" "dist" "build" ".git" /XF "*.log" | Out-Null
# docs + analysis + root files
if (Test-Path "$ProjectDir\docs") { robocopy "$ProjectDir\docs" "$dest\code\docs" @common | Out-Null }
if (Test-Path "$ProjectDir\email-analysis") { robocopy "$ProjectDir\email-analysis" "$dest\code\email-analysis" @common | Out-Null }
Get-ChildItem $ProjectDir -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -in ".md",".docx",".txt",".json",".xlsx",".csv" } |
  ForEach-Object { Copy-Item $_.FullName "$dest\code\" -Force }
Say "      OK  backend + frontend + docs copied" "Green"

if (-not $SkipUploads) {
  $u = Get-ChildItem "$dest\code\backend\uploads" -Recurse -File -ErrorAction SilentlyContinue |
       Measure-Object Length -Sum
  if ($u) { Say ("      uploads: {0} files, {1:N1} MB" -f $u.Count, ($u.Sum/1MB)) "Green" }
}

# ---------------------------------------------------------------------------
# 3. MANIFEST  (what's inside + how to restore)
# ---------------------------------------------------------------------------
Say "`n[3/4] Writing manifest..."
$manifest = @"
TFM SYSTEM — BACKUP MANIFEST
============================
Created      : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Source       : $ProjectDir
Database     : $dbName  (dump included: $dbOk)
Uploads      : $(if ($SkipUploads) {'EXCLUDED'} else {'included'})

CONTENTS
  code\backend           NestJS API, Prisma schema, .env  (no node_modules/dist)
  code\backend\uploads   user-uploaded files (photos, docs)
  code\frontend          Next.js app, .env  (no node_modules/.next)
  code\docs              design docs
  database\$dbName.sql    plain-text SQL dump (human-readable, portable)
  database\$dbName.dump   compressed custom-format dump (for pg_restore)

SECURITY
  This backup CONTAINS .env files with secrets (DB password, JWT secret,
  Anthropic API key). Keep the archive private; do not commit or share it.

RESTORE — see RESTORE-GUIDE.md in the project's scripts\ folder. Short version:
  1. Unzip to a folder.
  2. Restore DB:   createdb $dbName   then   psql -d $dbName -f database\$dbName.sql
                   (or:  pg_restore -d $dbName --clean database\$dbName.dump )
  3. Copy code back, restore .env files.
  4. cd backend  ->  npm install  ->  npx prisma generate
     cd frontend ->  npm install
  5. Restore backend\uploads.
"@
$manifest | Out-File "$dest\BACKUP-MANIFEST.txt" -Encoding UTF8
Say "      OK" "Green"

# ---------------------------------------------------------------------------
# 4. ZIP
# ---------------------------------------------------------------------------
if (-not $NoZip) {
  Say "`n[4/4] Compressing to a single archive (this can take a minute)..."
  $zip = "$dest.zip"
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path "$dest\*" -DestinationPath $zip -CompressionLevel Optimal
  $zipMB = (Get-Item $zip).Length / 1MB
  Say ("      OK  {0}  ({1:N1} MB)" -f $zip, $zipMB) "Green"
} else { Say "`n[4/4] Zip SKIPPED (-NoZip) — folder left at $dest" }

Say "`n=================================================="
Say " BACKUP COMPLETE" "Green"
Say " Folder : $dest"
if (-not $NoZip) { Say " Archive: $dest.zip" }
Say " Tip: copy the .zip to OneDrive or an external drive for off-machine safety."
Say "==================================================" "Green"
