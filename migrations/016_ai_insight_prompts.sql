-- 016_ai_insight_prompts.sql
-- Storage for editable AI Insight prompts. Source of truth at runtime.
-- Defaults seeded by POST /api/admin/ai-insight-prompts/seed-defaults
-- (idempotent — uses INSERT ... ON CONFLICT (prompt_key) DO NOTHING).

CREATE TABLE IF NOT EXISTS ai_insight_prompts (
    prompt_key       TEXT PRIMARY KEY,
    prompt_text      TEXT NOT NULL CHECK (length(trim(prompt_text)) > 0),
    category         TEXT NOT NULL CHECK (category IN ('system','component')),
    page             TEXT,                -- NULL for system prompts
    section_key      TEXT,                -- NULL for system prompts
    section_name     TEXT,                -- denormalised for tree UI
    component_type   TEXT,                -- 'kpi'|'chart'|'table'|'breakdown'|NULL
    display_name     TEXT NOT NULL,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_insight_prompts_section
  ON ai_insight_prompts(section_key, sort_order);

CREATE INDEX IF NOT EXISTS idx_ai_insight_prompts_category
  ON ai_insight_prompts(category);
