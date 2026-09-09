-- Canon as an explicit build-level step, and the two AiRun columns that would have named every
-- ceiling defect outright instead of leaving it to be inferred from outputTokens == maxTokens.
--
-- canonState IS NULLABLE WITH NO DEFAULT, DELIBERATELY. NULL means "legacy: never extracted", and
-- the gate treats it as extract-on-demand: the first stage request starts the extraction and says
-- so, rather than refusing. A DEFAULT of 'pending' plus a strict gate would have locked all 22
-- existing builds out of stage generation the moment this ran.
ALTER TABLE "development_builds" ADD COLUMN "canonState" TEXT;
ALTER TABLE "development_builds" ADD COLUMN "canonError" TEXT;
ALTER TABLE "development_builds" ADD COLUMN "canonAt" TIMESTAMP(3);
CREATE INDEX "development_builds_canonState_idx" ON "development_builds"("canonState");

ALTER TABLE "AiRun" ADD COLUMN "stopReason" TEXT;
ALTER TABLE "AiRun" ADD COLUMN "maxTokens" INTEGER;
