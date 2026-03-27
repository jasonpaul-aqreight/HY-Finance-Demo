import fs from 'fs';
import path from 'path';

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

// ─── Storage shape ──────────────────────────────────────────────────────────

interface SettingsFile {
  v1: Settings;
  v2: SettingsV2;
}

const SETTINGS_PATH = path.resolve(process.cwd(), '../data/settings.json');

let _cached: SettingsFile | null = null;

function migrateV2(raw: Record<string, unknown>): SettingsV2 {
  const v2Raw = (raw ?? {}) as Record<string, unknown>;
  const weights = (v2Raw.creditScoreWeights ?? {}) as Record<string, number>;
  const thresholds = (v2Raw.riskThresholds ?? {}) as Record<string, number>;

  // Migrate old 5-factor weights → 4-factor by dropping paymentConsistency
  const hasOldConsistency = 'paymentConsistency' in weights;
  const hasOldBreach = 'breach' in weights && !('doubleBreach' in weights);
  const hasOldModerate = 'moderate' in thresholds;

  let migratedWeights = { ...DEFAULT_SETTINGS_V2.creditScoreWeights };
  if (hasOldConsistency || hasOldBreach) {
    // Old format detected — use defaults for clean migration
    migratedWeights = { ...DEFAULT_SETTINGS_V2.creditScoreWeights };
  } else if (weights.utilization != null) {
    migratedWeights = {
      utilization: weights.utilization ?? DEFAULT_SETTINGS_V2.creditScoreWeights.utilization,
      overdueDays: weights.overdueDays ?? DEFAULT_SETTINGS_V2.creditScoreWeights.overdueDays,
      timeliness: weights.timeliness ?? DEFAULT_SETTINGS_V2.creditScoreWeights.timeliness,
      doubleBreach: weights.doubleBreach ?? DEFAULT_SETTINGS_V2.creditScoreWeights.doubleBreach,
    };
  }

  let migratedThresholds = { ...DEFAULT_SETTINGS_V2.riskThresholds };
  if (hasOldModerate) {
    // Old 3-threshold format → use defaults
    migratedThresholds = { ...DEFAULT_SETTINGS_V2.riskThresholds };
  } else if (thresholds.low != null && thresholds.high != null) {
    migratedThresholds = {
      low: thresholds.low,
      high: thresholds.high,
    };
  }

  return {
    ...DEFAULT_SETTINGS_V2,
    ...v2Raw,
    creditScoreWeights: migratedWeights,
    riskThresholds: migratedThresholds,
  };
}

function readAll(): SettingsFile {
  if (_cached) return _cached;
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);

    // Migration: old flat shape (no v1/v2 keys) → wrap under v1
    if (parsed && !parsed.v1 && !parsed.v2 && parsed.creditScoreWeights) {
      const migrated: SettingsFile = {
        v1: { ...DEFAULT_SETTINGS, ...parsed },
        v2: DEFAULT_SETTINGS_V2,
      };
      _cached = migrated;
      return migrated;
    }

    _cached = {
      v1: { ...DEFAULT_SETTINGS, ...(parsed.v1 ?? {}) },
      v2: migrateV2(parsed.v2 ?? {}),
    };
    return _cached;
  } catch {
    return { v1: DEFAULT_SETTINGS, v2: DEFAULT_SETTINGS_V2 };
  }
}

function writeAll(data: SettingsFile): void {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8');
  _cached = null;
}

// ─── V1 read/write (backward compatible) ────────────────────────────────────

export function getSettings(): Settings {
  return readAll().v1;
}

export function saveSettings(s: Settings): { ok: boolean; error?: string } {
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
    return { ok: false, error: 'DSO benchmark must be positive' };
  }
  if (s.lookbackMonths <= 0 || s.lookbackMonths > 60) {
    return { ok: false, error: 'Lookback period must be between 1 and 60 months' };
  }
  if (s.neutralScore < 0 || s.neutralScore > 100) {
    return { ok: false, error: 'Neutral score must be between 0 and 100' };
  }

  const all = readAll();
  all.v1 = s;
  writeAll(all);
  return { ok: true };
}

// ─── V2 read/write ──────────────────────────────────────────────────────────

export function getSettingsV2(): SettingsV2 {
  return readAll().v2;
}

export function saveSettingsV2(s: SettingsV2): { ok: boolean; error?: string } {
  const w = s.creditScoreWeights;
  const sum = w.utilization + w.overdueDays + w.timeliness + w.doubleBreach;
  if (sum !== 100) {
    return { ok: false, error: `Credit health score weights must sum to 100 (got ${sum})` };
  }

  const t = s.riskThresholds;
  if (t.low <= t.high) {
    return { ok: false, error: 'Low Risk threshold must be greater than High Risk threshold' };
  }

  const all = readAll();
  all.v2 = s;
  writeAll(all);
  return { ok: true };
}
