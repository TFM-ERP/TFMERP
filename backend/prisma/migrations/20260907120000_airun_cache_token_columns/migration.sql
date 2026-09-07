-- Prompt-caching token accounting for AiRun.
--
-- Anthropic reports `input_tokens` as the tokens AFTER the last cache breakpoint, so once a call
-- carries a cache_control block, summing inputTokens alone under-reports the real input. Recording
-- the two cache counters beside it keeps `inputTokens + cacheReadTokens + cacheCreationTokens` the
-- true input, and lets each part be priced at its own rate (read ~0.1x, 5-minute write 1.25x).
--
-- Additive and nullable: existing rows keep NULL, which reads as "this call predates caching" and
-- is treated as zero by the cost helper. No backfill, no rewrite, no lock of consequence.
ALTER TABLE "AiRun" ADD COLUMN "cacheReadTokens" INTEGER;
ALTER TABLE "AiRun" ADD COLUMN "cacheCreationTokens" INTEGER;
