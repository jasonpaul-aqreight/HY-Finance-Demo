export function formatRM(value: number | null | undefined, decimals = 0): string {
  if (value == null) return 'RM 0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  return `${sign}RM ${abs.toLocaleString('en-MY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatRMCompact(value: number | null | undefined): string {
  if (value == null) return 'RM 0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}RM ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}RM ${(abs / 1_000).toFixed(1)}K`;
  return `${sign}RM ${abs.toFixed(0)}`;
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
  if (pct < 10) return 'text-red-600';
  if (pct < 20) return 'text-amber-600';
  return 'text-emerald-600';
}

export function marginBgColor(pct: number | null | undefined): string {
  if (pct == null || !isFinite(pct)) return 'bg-gray-50';
  if (pct < 0) return 'bg-red-100';
  if (pct < 5) return 'bg-red-50';
  if (pct < 10) return 'bg-amber-50';
  if (pct < 20) return 'bg-emerald-50';
  return 'bg-emerald-100';
}
