-- 020_prompt_versions.sql
-- Replaces the 2-slot history (previous_text, previous_text_2 from 018) with a
-- proper versions table. Each prompt gets one immutable Default version + up
-- to 5 feedback-derived versions (cap enforced in application layer).
--
-- ai_insight_prompts.prompt_text stays as a denormalised cache of the selected
-- version's body so the runtime hot path (prompt-loader) keeps reading a
-- single row — no join in summary generation.
--
-- Order matters: 2.1 create table, 2.2 add FK, 2.3 backfill Default + select,
-- 2.4 drop legacy columns. Backfill MUST run before drop.

-- 2.1 Versions table -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_insight_prompt_versions (
    id                  SERIAL PRIMARY KEY,
    prompt_key          TEXT NOT NULL REFERENCES ai_insight_prompts(prompt_key) ON DELETE CASCADE,
    version_label       TEXT NOT NULL,
    is_default          BOOLEAN NOT NULL DEFAULT FALSE,
    prompt_text         TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          TEXT,
    source_feedback_id  INTEGER  -- not FK; feedback rows get deleted on apply
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_key_created
  ON ai_insight_prompt_versions(prompt_key, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_versions_one_default
  ON ai_insight_prompt_versions(prompt_key) WHERE is_default = TRUE;

-- 2.2 FK column on prompts -----------------------------------------------------

ALTER TABLE ai_insight_prompts
  ADD COLUMN IF NOT EXISTS selected_version_id INTEGER
    REFERENCES ai_insight_prompt_versions(id) ON DELETE SET NULL;

-- 2.3 Backfill: one Default version per existing prompt, then select it -------
-- Idempotent: skips prompts that already have a Default row.

INSERT INTO ai_insight_prompt_versions (prompt_key, version_label, is_default, prompt_text, created_by)
SELECT p.prompt_key, 'Default', TRUE, p.prompt_text, 'system'
  FROM ai_insight_prompts p
 WHERE NOT EXISTS (
   SELECT 1 FROM ai_insight_prompt_versions v
    WHERE v.prompt_key = p.prompt_key AND v.is_default = TRUE
 );

UPDATE ai_insight_prompts p
   SET selected_version_id = v.id
  FROM ai_insight_prompt_versions v
 WHERE v.prompt_key = p.prompt_key
   AND v.is_default = TRUE
   AND p.selected_version_id IS NULL;

-- 2.4 Drop legacy 2-slot history columns --------------------------------------

ALTER TABLE ai_insight_prompts
  DROP COLUMN IF EXISTS previous_text,
  DROP COLUMN IF EXISTS previous_text_2;

-- Drop the non-empty CHECK constraint on prompt_text. With versions as first-
-- class objects, an "empty" prompt (HR scaffold rows, deliberately blank
-- placeholders) is now a legitimate state. The DB is the cache; semantic
-- emptiness is a UI concern.

ALTER TABLE ai_insight_prompts
  DROP CONSTRAINT IF EXISTS ai_insight_prompts_prompt_text_check;
