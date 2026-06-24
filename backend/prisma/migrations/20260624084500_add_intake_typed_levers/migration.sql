-- AlterTable
ALTER TABLE "intake_profiles" ADD COLUMN     "accents" JSONB,
ADD COLUMN     "conflict" TEXT,
ADD COLUMN     "conflictId" TEXT,
ADD COLUMN     "dialogueRegister" TEXT,
ADD COLUMN     "politicalArc" TEXT,
ADD COLUMN     "scriptVariety" TEXT,
ADD COLUMN     "styleMix" JSONB;

