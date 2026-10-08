-- F10 — a revision-level verdict needs somewhere to live.
-- Additive and nullable: every existing row reads NULL, nothing is rewritten.
-- Separate from "consumed" on purpose: consumed = provenance, checks = verdict.
ALTER TABLE "script_revisions" ADD COLUMN "checks" JSONB;
