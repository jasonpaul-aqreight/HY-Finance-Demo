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
    paymentConsistency: number;
    timeliness: number;
    breach: number;
  };
  riskThresholds: {
    low: number;
    moderate: number;
    high: number;
  };
  neutralScore?: number;
  dsoBenchmark?: number;
  lookbackMonths?: number;
}

export const DEFAULT_SETTINGS_V2: SettingsV2 = {
  creditScoreWeights: {
    utilization: 35,
    overdueDays: 25,
    paymentConsistency: 15,
    timeliness: 15,
    breach: 10,
  },
  riskThresholds: {
    low: 85,
    moderate: 65,
    high: 35,
  },
};

// ─── Storage shape ──────────────────────────────────────────────────────────

interface SettingsFile {
  v1: Settings;
  v2: SettingsV2;
}

const SETTINGS_PATH = path.resolve(process.cwd(), '../data/settings.json');

let _cached: SettingsFile | null = null;

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

    const parsedV2 = parsed.v2 ?? {};
    _cached = {
      v1: { ...DEFAULT_SETTINGS, ...(parsed.v1 ?? {}) },
      v2: {
        ...DEFAULT_SETTINGS_V2,
        ...parsedV2,
        creditScoreWeights: {
          ...DEFAULT_SETTINGS_V2.creditScoreWeights,
          ...(parsedV2.creditScoreWeights ?? {}),
        },
      },
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
  const sum = w.utilization + w.overdueDays + w.paymentConsistency + w.timeliness + w.breach;
  if (sum !== 100) {
    return { ok: false, error: `Credit score weights must sum to 100 (got ${sum})` };
  }

  const t = s.riskThresholds;
  if (t.low <= t.moderate || t.moderate <= t.high) {
    return { ok: false, error: 'Risk thresholds must be in descending order (Low > Moderate > High)' };
  }

  const all = readAll();
  all.v2 = s;
  writeAll(all);
  return { ok: true };
}
