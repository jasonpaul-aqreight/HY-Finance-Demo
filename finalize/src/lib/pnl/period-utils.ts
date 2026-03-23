const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function decodePeriod(p: number): { year: number; month: number } {
  const month = p % 12;
  if (month === 0) {
    return { year: Math.floor(p / 12) - 1, month: 12 };
  }
  return { year: Math.floor(p / 12), month };
}

export function encodePeriod(year: number, month: number): number {
  return year * 12 + month;
}

export function periodLabel(p: number): string {
  const { year, month } = decodePeriod(p);
  return `${MONTH_NAMES[month]} ${year}`;
}

export function periodShortLabel(p: number): string {
  const { month } = decodePeriod(p);
  return MONTH_NAMES[month];
}

/**
 * Fiscal month index: Mar=1, Apr=2, ... Jan=11, Feb=12
 */
export function fiscalMonthIndex(month: number): number {
  return month >= 3 ? month - 2 : month + 10;
}

/**
 * Parse fiscal year name like "Fiscal Year 2025" or "FY2025"
 * and return the period range (Mar start to Feb end).
 */
export function fyNameToNumber(fyName: string): number {
  const match = fyName.match(/(\d{4})/);
  if (!match) throw new Error(`Invalid fiscal year name: ${fyName}`);
  return parseInt(match[1], 10);
}

export function fyToPeriodRange(fyNumber: number): { from: number; to: number } {
  // FY2025 = Mar 2024 (period 24291) to Feb 2025 (period 24302)
  const startYear = fyNumber - 1;
  const from = encodePeriod(startYear, 3); // March
  const to = encodePeriod(fyNumber, 2);     // February
  return { from, to };
}

/**
 * Get all period numbers for a fiscal year range, in fiscal order (Mar->Feb).
 */
export function fyPeriods(from: number, to: number): number[] {
  const periods: number[] = [];
  for (let p = from; p <= to; p++) {
    periods.push(p);
  }
  return periods;
}

/**
 * Get the latest period that has data, given a max period.
 */
export function currentPeriod(): number {
  const now = new Date();
  // Use the previous month as the "current" period (data lags)
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  return encodePeriod(year, month);
}
