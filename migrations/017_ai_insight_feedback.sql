-- 017_ai_insight_feedback.sql
-- Per-prompt feedback rows from end users.
-- Inserted by POST /api/ai-insight/feedback after the router LLM picks a target.
-- Read by /admin/ai-insight-config; deleted on discard or apply.

CREATE TABLE IF NOT EXISTS ai_insight_feedback (
    id                SERIAL PRIMARY KEY,
    section_key       TEXT NOT NULL,
    page              TEXT NOT NULL,
    raw_feedback      TEXT NOT NULL CHECK (length(trim(raw_feedback)) > 0),
    compact_feedback  TEXT NOT NULL CHECK (length(trim(compact_feedback)) > 0),
    target_prompt_key TEXT NOT NULL REFERENCES ai_insight_prompts(prompt_key) ON DELETE CASCADE,
    submitted_by      TEXT,
    submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_target
  ON ai_insight_feedback(target_prompt_key);
