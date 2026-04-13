-- AI Insight Engine — Database Schema
-- Run against the local PostgreSQL (DATABASE_URL)

-- 1. Global lock (singleton row)
CREATE TABLE IF NOT EXISTS ai_insight_lock (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  locked_by     TEXT,
  locked_at     TIMESTAMP WITH TIME ZONE,
  section_key   TEXT,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO ai_insight_lock (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. Section-level insight (high-level summary)
CREATE TABLE IF NOT EXISTS ai_insight_section (
  id               SERIAL PRIMARY KEY,
  page             TEXT NOT NULL,
  section_key      TEXT NOT NULL,
  summary_json     JSONB NOT NULL,
  analysis_time_s  NUMERIC(6,1),
  token_count      INTEGER,
  cost_usd         NUMERIC(8,4),
  date_range_start DATE,
  date_range_end   DATE,
  generated_by     TEXT NOT NULL,
  generated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (page, section_key)
);

-- 3. Component-level insight (individual analyses)
CREATE TABLE IF NOT EXISTS ai_insight_component (
  id              SERIAL PRIMARY KEY,
  section_id      INTEGER NOT NULL REFERENCES ai_insight_section(id) ON DELETE CASCADE,
  component_key   TEXT NOT NULL,
  component_type  TEXT NOT NULL,
  analysis_md     TEXT NOT NULL,
  token_count     INTEGER,
  generated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (section_id, component_key)
);
