-- 024_drop_ai_insight_feedback_prompt_tables.sql
-- Phase 1 removes the feedback loop and DB-backed prompt/version store.
--
-- Drop order is explicit because ai_insight_prompts.selected_version_id and
-- ai_insight_prompt_versions.prompt_key create a circular FK once migration 020
-- has run. Constraints are dropped first so the table removal is predictable.

ALTER TABLE ai_insight_prompts
  DROP CONSTRAINT IF EXISTS ai_insight_prompts_selected_version_id_fkey;

ALTER TABLE ai_insight_prompt_versions
  DROP CONSTRAINT IF EXISTS ai_insight_prompt_versions_prompt_key_fkey;

ALTER TABLE ai_insight_feedback
  DROP CONSTRAINT IF EXISTS ai_insight_feedback_target_prompt_key_fkey;

DROP TABLE IF EXISTS ai_insight_feedback;
DROP TABLE IF EXISTS ai_insight_prompt_versions;
DROP TABLE IF EXISTS ai_insight_prompts;
