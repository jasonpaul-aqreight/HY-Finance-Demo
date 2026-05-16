export type BudgetPosition =
  | 'no-budget'
  | 'on-budget'
  | 'above-target'
  | 'below-target'
  | 'over-budget'
  | 'under-budget';

export interface BudgetPositionInput {
  varianceRm: number | null;
  variancePct: number | null;
  tolerancePct: number | null;
  higherIsBetter: boolean;
}

export function getBudgetPosition({
  varianceRm,
  variancePct,
  tolerancePct,
  higherIsBetter,
}: BudgetPositionInput): BudgetPosition {
  if (varianceRm == null) return 'no-budget';

  const tolerance = Math.max(0, tolerancePct ?? 5);
  if (variancePct == null) {
    if (varianceRm === 0) return 'on-budget';
  } else if (Math.abs(variancePct) <= tolerance) {
    return 'on-budget';
  }

  if (higherIsBetter) {
    return varianceRm > 0 ? 'above-target' : 'below-target';
  }

  return varianceRm > 0 ? 'over-budget' : 'under-budget';
}

export function getBudgetPositionLabel(position: BudgetPosition): string {
  switch (position) {
    case 'no-budget':
      return 'No Budget';
    case 'on-budget':
      return 'On Budget';
    case 'above-target':
      return 'Above Target';
    case 'below-target':
      return 'Below Target';
    case 'over-budget':
      return 'Over Budget';
    case 'under-budget':
      return 'Under Budget';
  }
}

export function isBudgetPositionFavourable(position: BudgetPosition): boolean | null {
  switch (position) {
    case 'above-target':
    case 'under-budget':
    case 'on-budget':
      return true;
    case 'below-target':
    case 'over-budget':
      return false;
    case 'no-budget':
      return null;
  }
}
