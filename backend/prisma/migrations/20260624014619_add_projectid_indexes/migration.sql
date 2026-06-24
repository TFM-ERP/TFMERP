-- CreateIndex
CREATE INDEX "UserNotification_projectId_idx" ON "UserNotification"("projectId");

-- CreateIndex
CREATE INDEX "audio_layer_assets_projectId_idx" ON "audio_layer_assets"("projectId");

-- CreateIndex
CREATE INDEX "bank_accounts_projectId_idx" ON "bank_accounts"("projectId");

-- CreateIndex
CREATE INDEX "budget_versions_projectId_idx" ON "budget_versions"("projectId");

-- CreateIndex
CREATE INDEX "ledger_bank_accounts_projectId_idx" ON "ledger_bank_accounts"("projectId");

-- CreateIndex
CREATE INDEX "production_crew_projectId_idx" ON "production_crew"("projectId");

-- CreateIndex
CREATE INDEX "production_schedules_projectId_idx" ON "production_schedules"("projectId");

-- CreateIndex
CREATE INDEX "pronunciation_entries_projectId_idx" ON "pronunciation_entries"("projectId");

-- CreateIndex
CREATE INDEX "script_scenes_projectId_idx" ON "script_scenes"("projectId");

-- CreateIndex
CREATE INDEX "talent_interactions_projectId_idx" ON "talent_interactions"("projectId");

-- CreateIndex
CREATE INDEX "talent_lists_projectId_idx" ON "talent_lists"("projectId");

-- CreateIndex
CREATE INDEX "usage_quotas_projectId_idx" ON "usage_quotas"("projectId");

-- CreateIndex
CREATE INDEX "voice_profiles_projectId_idx" ON "voice_profiles"("projectId");

-- CreateIndex
CREATE INDEX "workflow_instances_projectId_idx" ON "workflow_instances"("projectId");
