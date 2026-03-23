/** V2 Credit Score — Configurable 5-factor model */

export interface CreditScoreV2Weights {
  utilization: number;        // 0-100
  overdueDays: number;        // 0-100
  paymentConsistency: number; // 0-100
  timeliness: number;         // 0-100
  breach: number;             // 0-100
}

export interface CreditScoreV2Input {
  creditUtilizationPct: number | null; // Outstanding / CreditLimit * 100
  hasCreditLimit: boolean;
  oldestOverdueDays: number;           // 0 if nothing overdue
  paymentConsistency: number | null;   // months_with_payment / months_with_invoices (0-1)
  avgDaysLate: number | null;          // avg days late across paid invoices (last 12 months)
  overdueBreached: boolean;            // Outstanding > OverdueLimit
}

export interface CreditScoreV2Result {
  score: number;        // 0-100 composite
  riskTier: string;     // 'Low' | 'Moderate' | 'Elevated' | 'High'
  utilizationComponent: number;
  overdueComponent: number;
  consistencyComponent: number;
  timelinessComponent: number;
  breachComponent: number;
}

export interface RiskThresholds {
  low: number;
  moderate: number;
  high: number;
}

const DEFAULT_WEIGHTS: CreditScoreV2Weights = {
  utilization: 35,
  overdueDays: 25,
  paymentConsistency: 15,
  timeliness: 15,
  breach: 10,
};

const DEFAULT_THRESHOLDS: RiskThresholds = {
  low: 85,
  moderate: 65,
  high: 35,
};

function utilizationComponent(pct: number | null, hasCreditLimit: boolean, neutralScore: number): number {
  if (!hasCreditLimit) return neutralScore;
  if (pct == null) return 100;
  if (pct <= 50) return 90 + (50 - pct) / 50 * 10;     // 90-100
  if (pct <= 80) return 60 + (80 - pct) / 30 * 29;      // 60-89
  if (pct <= 100) return 30 + (100 - pct) / 20 * 29;    // 30-59
  // >100%
  const score = 29 - Math.min(pct - 100, 100) / 100 * 29;
  return Math.max(0, Math.round(score));
}

function overdueComponent(days: number): number {
  if (days <= 0) return 100;
  if (days <= 30) return 80;
  if (days <= 60) return 60;
  if (days <= 90) return 40;
  if (days <= 120) return 20;
  return 0;
}

function consistencyComponent(ratio: number | null, neutralScore: number): number {
  if (ratio == null) return neutralScore;
  if (ratio >= 0.9) return 100;
  if (ratio >= 0.7) return 75;
  if (ratio >= 0.5) return 50;
  return 25;
}

function timelinessComponent(avgDaysLate: number | null, neutralScore: number): number {
  if (avgDaysLate == null) return neutralScore;
  if (avgDaysLate <= 0) return 100;
  if (avgDaysLate <= 7) return 80;
  if (avgDaysLate <= 14) return 60;
  if (avgDaysLate <= 30) return 40;
  if (avgDaysLate <= 60) return 20;
  return 0;
}

function breachComponent(breached: boolean): number {
  return breached ? 0 : 100;
}

/** Risk tier from credit score (score-based, used for customer table) */
export function riskTierFromScore(
  score: number,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS,
): string {
  if (score >= thresholds.low) return 'Low';
  if (score >= thresholds.moderate) return 'Moderate';
  return 'High';
}

/** Risk tier from utilization % (used for Credit Utilization donut categories — NOT score-based) */
export function riskTierFromUtilization(pct: number | null, hasCreditLimit: boolean): string {
  if (!hasCreditLimit || pct == null) return 'Low';
  if (pct <= 50) return 'Low';
  if (pct <= 80) return 'Medium';
  if (pct <= 100) return 'High';
  return 'Exceeded';
}

export function computeCreditScoreV2(
  input: CreditScoreV2Input,
  weights: CreditScoreV2Weights = DEFAULT_WEIGHTS,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS,
  neutralScore: number = 0,
): CreditScoreV2Result {
  const util = utilizationComponent(input.creditUtilizationPct, input.hasCreditLimit, neutralScore);
  const overdue = overdueComponent(input.oldestOverdueDays);
  const consistency = consistencyComponent(input.paymentConsistency, neutralScore);
  const timely = timelinessComponent(input.avgDaysLate, neutralScore);
  const breach = breachComponent(input.overdueBreached);

  const score = Math.round(
    (weights.utilization / 100) * util +
    (weights.overdueDays / 100) * overdue +
    (weights.paymentConsistency / 100) * consistency +
    (weights.timeliness / 100) * timely +
    (weights.breach / 100) * breach
  );

  const riskTier = riskTierFromScore(score, thresholds);

  return {
    score,
    riskTier,
    utilizationComponent: util,
    overdueComponent: overdue,
    consistencyComponent: consistency,
    timelinessComponent: timely,
    breachComponent: breach,
  };
}

export function riskTierColor(tier: string): string {
  switch (tier) {
    case 'Low': return 'text-emerald-600';
    case 'Moderate': return 'text-yellow-600';
    case 'High': return 'text-red-600';
    default: return 'text-muted-foreground';
  }
}

export function riskTierBgColor(tier: string): string {
  switch (tier) {
    case 'Low': return 'bg-emerald-100 text-emerald-800';
    case 'Moderate': return 'bg-yellow-100 text-yellow-800';
    case 'High': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}
