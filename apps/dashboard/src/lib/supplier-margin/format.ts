export function formatRM(value: number | null | undefined, decimals = 0): string {
  if (value == null) return 'RM 0';
  return `RM ${Math.abs(value).toLocaleString('en-MY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatMarginPct(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}

export function formatCount(value: number | null | undefined): string {
  if (value == null) return '0';
  return value.toLocaleString('en-MY');
}

export function growthColor(pct: number | null | undefined): string {
  if (pct == null || !isFinite(pct)) return 'text-muted-foreground';
  return pct >= 0 ? 'text-emerald-600' : 'text-red-600';
}

export function marginColor(pct: number | null | undefined): string {
  if (pct == null || !isFinite(pct)) return 'text-muted-foreground';
  if (pct >= 20) return 'text-emerald-600';
  if (pct >= 10) return 'text-amber-600';
  return 'text-red-600';
}
