-- ============================================================================
-- 005_app_settings.sql — Application settings (replaces data/settings.json)
-- ============================================================================

CREATE TABLE app_settings (
    key                 TEXT PRIMARY KEY,
    value               JSONB NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_by          TEXT
);

-- Seed with current settings.json values and sync schedule
INSERT INTO app_settings (key, value) VALUES
(
    'sync_schedule',
    '{
        "cron_expression": "0 */6 * * *",
        "description": "Every 6 hours",
        "is_active": true,
        "timezone": "Asia/Kuala_Lumpur"
    }'::jsonb
),
(
    'credit_score_v1',
    '{
        "creditScoreWeights": {
            "timeliness": 35,
            "utilization": 25,
            "cnFrequency": 20,
            "aging": 20
        },
        "riskThresholds": {
            "low": 80,
            "moderate": 60,
            "elevated": 40
        },
        "dsoBenchmark": 30,
        "lookbackMonths": 12,
        "neutralScore": 50
    }'::jsonb
),
(
    'credit_score_v2',
    '{
        "creditScoreWeights": {
            "utilization": 40,
            "overdueDays": 30,
            "timeliness": 20,
            "doubleBreach": 10
        },
        "riskThresholds": {
            "low": 75,
            "high": 30
        }
    }'::jsonb
);
