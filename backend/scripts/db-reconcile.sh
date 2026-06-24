#!/usr/bin/env bash
# =============================================================================
# TFM — Prisma migration / drift reconcile  (SAFE · dry-run by default)
# -----------------------------------------------------------------------------
# Problem this fixes: the schema (≈260 models) was grown with `prisma db push`,
# so the migration history is far behind the schema. This records the current
# schema as a baseline migration WITHOUT recreating tables that already exist.
#
# Usage (run from backend/, with DATABASE_URL pointing at the target DB):
#   bash scripts/db-reconcile.sh            # DRY-RUN: report drift + write the
#                                           # baseline SQL for review. Applies nothing.
#   bash scripts/db-reconcile.sh --apply    # after review: record the baseline
#                                           # (prisma migrate resolve --applied)
#
# GOLDEN RULES
#   • Take a database backup first. Run on STAGING before prod.
#   • --apply only RECORDS the baseline; it never runs DDL. It is safe ONLY when
#     the live DB already matches schema.prisma (i.e. `db push` was run). The
#     script verifies that for you and refuses to baseline if the DB is behind.
#   • After this, ALWAYS use `npx prisma migrate dev --name <change>` — never
#     bare `db push` again.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

SCHEMA="prisma/schema.prisma"
STAMP="$(date +%Y%m%d%H%M%S)"
NAME="${STAMP}_reconcile_baseline"
MIG_DIR="prisma/migrations/${NAME}"
APPLY="${1:-}"

command -v npx >/dev/null || { echo "npx not found — run from the backend/ project root."; exit 1; }
[ -n "${DATABASE_URL:-}" ] || echo "WARN: DATABASE_URL is not set in this shell; Prisma will read it from .env if present."

echo "==> 1/4  Migration status"
npx prisma migrate status || true
echo

echo "==> 2/4  Is the LIVE DB already in sync with schema.prisma? (db-vs-schema drift)"
# exit code 0 = no diff (DB matches schema → safe to baseline); 2 = the DB is missing changes.
if npx prisma migrate diff \
      --from-schema-datasource "$SCHEMA" \
      --to-schema-datamodel  "$SCHEMA" \
      --exit-code >/tmp/_dbdiff.sql 2>/dev/null; then
  DB_IN_SYNC=1; echo "    OK — the database already matches the schema."
else
  DB_IN_SYNC=0
  echo "    ⚠ The database is BEHIND the schema. Pending changes the DB does not have yet:"
  echo "    --------------------------------------------------------------"
  sed -n '1,60p' /tmp/_dbdiff.sql
  echo "    --------------------------------------------------------------"
fi
echo

echo "==> 3/4  Generating the baseline migration (schema not yet in migration history)"
mkdir -p "$MIG_DIR"
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel "$SCHEMA" \
  --script > "${MIG_DIR}/migration.sql"
GAP_LINES=$(grep -cve '^[[:space:]]*$' "${MIG_DIR}/migration.sql" || true)
echo "    wrote ${MIG_DIR}/migration.sql (${GAP_LINES} non-blank lines) — review it:"
echo "    --------------------------------------------------------------"
sed -n '1,60p' "${MIG_DIR}/migration.sql"
echo "    --------------------------------------------------------------"
echo

if [ "$APPLY" != "--apply" ]; then
  echo "==> DRY-RUN complete. Nothing applied."
  echo "    Next:"
  echo "      • If step 2 said the DB matches schema  → re-run with --apply to record the baseline."
  echo "      • If step 2 showed pending DDL           → the DB is behind. On a BACKUP/staging copy run"
  echo "        'npx prisma migrate deploy' (or apply ${MIG_DIR}/migration.sql), verify, then --apply here."
  echo "      • If you do NOT want to keep this generated folder, delete ${MIG_DIR}."
  exit 0
fi

if [ "${DB_IN_SYNC}" != "1" ]; then
  echo "REFUSING to baseline: the live DB is behind the schema (see step 2)."
  echo "Bring the DB up to schema on a backup/staging copy first, then re-run with --apply."
  exit 2
fi

echo "==> 4/4  Recording the baseline as already-applied (no DDL is executed)"
npx prisma migrate resolve --applied "$NAME"
npx prisma migrate status
echo
echo "Done ✓  Schema and migration history are reconciled."
echo "From now on: 'npx prisma migrate dev --name <change>'  (never bare 'db push')."
