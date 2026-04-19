import { getPool } from '../postgres';

// ─── V1 Types & Defaults ────────────────────────────────────────────────────

export interface Settings {
  creditScoreWeights: {
    timeliness: number;
    utilization: number;
    cnFrequency: number;
    aging: number;
  };
  riskThresholds: {
    low: number;
    moderate: number;
    elevated: number;
  };
  dsoBenchmark: number;
  lookbackMonths: number;
  neutralScore: number;
}

export const DEFAULT_SETTINGS: Settings = {
  creditScoreWeights: {
    timeliness: 35,
    utilization: 25,
    cnFrequency: 20,
    aging: 20,
  },
  riskThresholds: {
    low: 80,
    moderate: 60,
    elevated: 40,
  },
  dsoBenchmark: 30,
  lookbackMonths: 12,
  neutralScore: 50,
};

// ─── V2 Types & Defaults ────────────────────────────────────────────────────

export interface SettingsV2 {
  creditScoreWeights: {
    utilization: number;
    overdueDays: number;
    timeliness: number;
    doubleBreach: number;
  };
  riskThresholds: {
    low: number;
    high: number;
  };
  neutralScore?: number;
  dsoBenchmark?: number;
  lookbackMonths?: number;
}

export const DEFAULT_SETTINGS_V2: SettingsV2 = {
  creditScoreWeights: {
    utilization: 40,
    overdueDays: 30,
    timeliness: 20,
    doubleBreach: 10,
  },
  riskThresholds: {
    low: 75,
    high: 30,
  },
};

// ─── V1 read/write ─────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT value FROM app_settings WHERE key = 'credit_score_v1'`);
  if (rows.length === 0) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...rows[0].value };
}

export async function saveSettings(s: Settings): Promise<{ ok: boolean; error?: string }> {
  const w = s.creditScoreWeights;
  const sum = w.timeliness + w.utilization + w.cnFrequency + w.aging;
  if (sum !== 100) {
    return { ok: false, error: `Credit score weights must sum to 100 (got ${sum})` };
  }

  const t = s.riskThresholds;
  if (t.low <= t.moderate || t.moderate <= t.elevated || t.elevated <= 0) {
    return { ok: false, error: 'Risk thresholds must be in descending order and positive' };
  }

  if (s.dsoBenchmark <= 0) {
    return { ok: false, error: 'Collection Days benchmark must be positive' };
  }
  if (s.lookbackMonths <= 0 || s.lookbackMonths > 60) {
    return { ok: false, error: 'Lookback period must be between 1 and 60 months' };
  }
  if (s.neutralScore < 0 || s.neutralScore > 100) {
    return { ok: false, error: 'Neutral score must be between 0 and 100' };
  }

  const pool = getPool();
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('credit_score_v1', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [JSON.stringify(s)]
  );
  return { ok: true };
}

// ─── V2 read/write ──────────────────────────────────────────────────────────

export async function getSettingsV2(): Promise<SettingsV2> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT value FROM app_settings WHERE key = 'credit_score_v2'`);
  if (rows.length === 0) return DEFAULT_SETTINGS_V2;
  return { ...DEFAULT_SETTINGS_V2, ...rows[0].value };
}

export async function saveSettingsV2(s: SettingsV2): Promise<{ ok: boolean; error?: string }> {
  const w = s.creditScoreWeights;
  const sum = w.utilization + w.overdueDays + w.timeliness + w.doubleBreach;
  if (sum !== 100) {
    return { ok: false, error: `Credit health score weights must sum to 100 (got ${sum})` };
  }

  const t = s.riskThresholds;
  if (t.low <= t.high) {
    return { ok: false, error: 'Low Risk threshold must be greater than High Risk threshold' };
  }

  const pool = getPool();
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('credit_score_v2', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [JSON.stringify(s)]
  );
  return { ok: true };
}
