-- 018_prompts_history.sql
-- Two-step history columns on ai_insight_prompts so the surgical-edit apply
-- flow (and, in Phase 3, manual save / reset) can rotate the previous version
-- and a version-before-that, enabling undo without a full version table.

ALTER TABLE ai_insight_prompts
  ADD COLUMN IF NOT EXISTS previous_text   TEXT,
  ADD COLUMN IF NOT EXISTS previous_text_2 TEXT;
