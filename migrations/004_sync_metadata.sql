-- ============================================================================
-- 004_sync_metadata.sql — Tables for sync service state management
-- ============================================================================

CREATE TABLE sync_job (
    id                  SERIAL PRIMARY KEY,
    status              TEXT NOT NULL DEFAULT 'pending',
    trigger_type        TEXT NOT NULL DEFAULT 'scheduled',
    triggered_by        TEXT,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    tables_total        INTEGER DEFAULT 0,
    tables_completed    INTEGER DEFAULT 0,
    rows_synced         INTEGER DEFAULT 0,
    error_message       TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_job_status ON sync_job(status);
CREATE INDEX idx_sync_job_created ON sync_job(created_at DESC);

CREATE TABLE sync_log (
    id                  BIGSERIAL PRIMARY KEY,
    job_id              INTEGER NOT NULL REFERENCES sync_job(id) ON DELETE CASCADE,
    "timestamp"         TIMESTAMPTZ DEFAULT NOW(),
    level               TEXT NOT NULL DEFAULT 'info',
    table_name          TEXT,
    phase               TEXT,
    message             TEXT NOT NULL,
    rows_affected       INTEGER DEFAULT 0,
    duration_ms         INTEGER
);

CREATE INDEX idx_sync_log_job ON sync_log(job_id);
CREATE INDEX idx_sync_log_timestamp ON sync_log("timestamp" DESC);
