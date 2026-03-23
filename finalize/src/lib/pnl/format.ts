export function formatRM(value: number | null | undefined, decimals = 0): string {
  if (value == null) return 'RM 0';
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-MY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (value < 0) return `-RM ${formatted}`;
  return `RM ${formatted}`;
}

export function formatRMCompact(value: number | null | undefined): string {
  if (value == null) return 'RM 0';
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 1_000_000) {
    formatted = `RM ${(abs / 1_000_000).toFixed(1)}M`;
  } else if (abs >= 1_000) {
    formatted = `RM ${(abs / 1_000).toFixed(0)}K`;
  } else {
    formatted = `RM ${abs.toFixed(0)}`;
  }
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatAmount(value: number | null | undefined): string {
  if (value == null || value === 0) return '\u2013'; // en-dash for zero
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-MY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatAmountWithDecimals(value: number | null | undefined): string {
  if (value == null || value === 0) return '\u2013';
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '\u2013';
  if (value < 0) return `-${Math.abs(value).toFixed(1)}%`;
  return `${value.toFixed(1)}%`;
}

export function formatPctChange(
  current: number | null | undefined,
  prior: number | null | undefined
): string {
  if (current == null || prior == null) return '\u2013';
  if (prior === 0 && current !== 0) return 'New';
  if (prior === 0 && current === 0) return '\u2013';
  const change = ((current - prior) / Math.abs(prior)) * 100;
  if (!isFinite(change)) return '\u2013';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

export function formatPctPoints(
  current: number | null | undefined,
  prior: number | null | undefined
): string {
  if (current == null || prior == null) return '\u2013';
  const diff = current - prior;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}pp`;
}

export function growthColor(pct: number | null | undefined, inverse = false): string {
  if (pct == null || !isFinite(pct)) return 'text-muted-foreground';
  const isPositive = inverse ? pct <= 0 : pct >= 0;
  return isPositive ? 'text-emerald-600' : 'text-red-600';
}

export function growthArrow(pct: number | null | undefined): string {
  if (pct == null || !isFinite(pct) || pct === 0) return '';
  return pct > 0 ? '\u25B2' : '\u25BC';
}

export function formatRatio(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '\u2013';
  return value.toFixed(2);
}
