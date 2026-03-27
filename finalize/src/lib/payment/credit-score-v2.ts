/** V2 Credit Health Score — Configurable 4-factor model */

export interface CreditScoreV2Weights {
  utilization: number;        // 0-100
  overdueDays: number;        // 0-100
  timeliness: number;         // 0-100
  doubleBreach: number;       // 0-100
}

export interface CreditScoreV2Input {
  creditUtilizationPct: number | null; // Outstanding / CreditLimit * 100
  hasCreditLimit: boolean;
  oldestOverdueDays: number;           // 0 if nothing overdue
  avgDaysLate: number | null;          // avg days late across paid invoices (last 12 months)
  creditLimitBreached: boolean;        // Outstanding > CreditLimit
  overdueLimitBreached: boolean;       // Outstanding > OverdueLimit
}

export interface CreditScoreV2Result {
  score: number;        // 0-100 composite
  riskTier: string;     // 'Low' | 'Moderate' | 'High'
  utilizationComponent: number;
  overdueComponent: number;
  timelinessComponent: number;
  doubleBreachComponent: number;
}

export interface RiskThresholds {
  low: number;
  high: number;
}

const DEFAULT_WEIGHTS: CreditScoreV2Weights = {
  utilization: 40,
  overdueDays: 30,
  timeliness: 20,
  doubleBreach: 10,
};

const DEFAULT_THRESHOLDS: RiskThresholds = {
  low: 75,
  high: 30,
};

/** Credit Utilization: Score = max(0, 100 - utilization%) */
function utilizationComponent(pct: number | null, hasCreditLimit: boolean, neutralScore: number): number {
  if (!hasCreditLimit) return neutralScore;
  if (pct == null) return 100;
  return Math.max(0, Math.round(100 - pct));
}

/** Overdue Days: scoring ladder based on oldest overdue invoice */
function overdueComponent(days: number): number {
  if (days <= 0) return 100;
  if (days <= 30) return 80;
  if (days <= 60) return 60;
  if (days <= 90) return 40;
  if (days <= 120) return 20;
  return 0;
}

/** Payment Timeliness: scoring ladder based on average days late */
function timelinessComponent(avgDaysLate: number | null, neutralScore: number): number {
  if (avgDaysLate == null) return neutralScore;
  if (avgDaysLate <= 0) return 100;
  if (avgDaysLate <= 7) return 80;
  if (avgDaysLate <= 14) return 60;
  if (avgDaysLate <= 30) return 40;
  if (avgDaysLate <= 60) return 20;
  return 0;
}

/** Double Breach: 0 if BOTH credit limit AND overdue limit are breached, 100 otherwise */
function doubleBreachComponent(creditLimitBreached: boolean, overdueLimitBreached: boolean): number {
  return (creditLimitBreached && overdueLimitBreached) ? 0 : 100;
}

/** Risk tier from credit health score */
export function riskTierFromScore(
  score: number,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS,
): string {
  if (score >= thresholds.low) return 'Low';
  if (score <= thresholds.high) return 'High';
  return 'Moderate';
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
  const timely = timelinessComponent(input.avgDaysLate, neutralScore);
  const dblBreach = doubleBreachComponent(input.creditLimitBreached, input.overdueLimitBreached);

  const score = Math.round(
    (weights.utilization / 100) * util +
    (weights.overdueDays / 100) * overdue +
    (weights.timeliness / 100) * timely +
    (weights.doubleBreach / 100) * dblBreach
  );

  const riskTier = riskTierFromScore(score, thresholds);

  return {
    score,
    riskTier,
    utilizationComponent: util,
    overdueComponent: overdue,
    timelinessComponent: timely,
    doubleBreachComponent: dblBreach,
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
