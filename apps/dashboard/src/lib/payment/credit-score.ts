/** Credit Score Components (0-100 each) */

export function timelinessScore(avgDaysLate: number | null, neutralScore = 50): number {
  if (avgDaysLate == null) return neutralScore; // no payment history → neutral
  if (avgDaysLate <= 0) return 100;
  if (avgDaysLate <= 7) return 85;
  if (avgDaysLate <= 14) return 70;
  if (avgDaysLate <= 30) return 50;
  if (avgDaysLate <= 60) return 30;
  if (avgDaysLate <= 90) return 15;
  return 0;
}

export function utilizationScore(utilizationPct: number | null, hasCreditLimit: boolean, neutralScore = 50): number {
  if (!hasCreditLimit) return neutralScore; // no credit limit → neutral
  if (utilizationPct == null) return 100;
  if (utilizationPct < 50) return 100;
  if (utilizationPct < 80) return 75;
  if (utilizationPct <= 100) return 40;
  return 10;
}

export function cnFrequencyScore(cnRatio: number | null, hasInvoices: boolean, neutralScore = 50): number {
  if (!hasInvoices) return neutralScore; // no invoices → neutral
  if (cnRatio == null || cnRatio < 2) return 100;
  if (cnRatio < 5) return 80;
  if (cnRatio < 10) return 60;
  if (cnRatio < 20) return 30;
  return 10;
}

export function agingConcentrationScore(pct90Plus: number | null, hasOutstanding: boolean): number {
  if (!hasOutstanding) return 100;
  if (pct90Plus == null || pct90Plus === 0) return 100;
  if (pct90Plus < 10) return 80;
  if (pct90Plus < 30) return 60;
  if (pct90Plus < 60) return 30;
  return 10;
}

export interface CreditScoreConfig {
  weights: { timeliness: number; utilization: number; cnFrequency: number; aging: number };
  thresholds: { low: number; moderate: number; elevated: number };
  neutralScore: number;
}

export interface CreditScoreResult {
  score: number;
  timeliness: number;
  utilization: number;
  cnFreq: number;
  aging: number;
  riskLevel: string;
}

export function computeCreditScore(params: {
  avgDaysLate: number | null;
  utilizationPct: number | null;
  hasCreditLimit: boolean;
  cnRatio: number | null;
  hasInvoices: boolean;
  pct90Plus: number | null;
  hasOutstanding: boolean;
}, config?: CreditScoreConfig): CreditScoreResult {
  const ns = config?.neutralScore ?? 50;
  const t = timelinessScore(params.avgDaysLate, ns);
  const u = utilizationScore(params.utilizationPct, params.hasCreditLimit, ns);
  const c = cnFrequencyScore(params.cnRatio, params.hasInvoices, ns);
  const a = agingConcentrationScore(params.pct90Plus, params.hasOutstanding);

  const w = config?.weights ?? { timeliness: 35, utilization: 25, cnFrequency: 20, aging: 20 };
  const score = Math.round(
    (w.timeliness / 100) * t +
    (w.utilization / 100) * u +
    (w.cnFrequency / 100) * c +
    (w.aging / 100) * a
  );

  const th = config?.thresholds ?? { low: 80, moderate: 60, elevated: 40 };
  let riskLevel: string;
  if (score >= th.low) riskLevel = 'Low Risk';
  else if (score >= th.moderate) riskLevel = 'Moderate Risk';
  else if (score >= th.elevated) riskLevel = 'Elevated Risk';
  else riskLevel = 'High Risk';

  return { score, timeliness: t, utilization: u, cnFreq: c, aging: a, riskLevel };
}
