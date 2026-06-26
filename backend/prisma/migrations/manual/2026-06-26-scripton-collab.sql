ALTER TABLE "intake_profiles" ADD COLUMN IF NOT EXISTS "collabMode" TEXT NOT NULL DEFAULT 'AUTO';
ALTER TABLE "intake_profiles" ADD COLUMN IF NOT EXISTS "scriptonDefaults" JSONB;
