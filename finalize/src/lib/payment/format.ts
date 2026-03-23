export function formatRM(value: number | null | undefined, decimals = 0): string {
  if (value == null) return 'RM 0';
  return `RM ${Math.abs(value).toLocaleString('en-MY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '--';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatCount(value: number | null | undefined): string {
  if (value == null) return '0';
  return value.toLocaleString('en-MY');
}

export function formatDays(value: number | null | undefined): string {
  if (value == null) return '--';
  return `${Math.round(value)} days`;
}

export function growthColor(pct: number | null | undefined): string {
  if (pct == null || !isFinite(pct)) return 'text-muted-foreground';
  return pct >= 0 ? 'text-emerald-600' : 'text-red-600';
}

export function riskColor(level: string): string {
  switch (level) {
    case 'Low Risk': return 'text-emerald-600';
    case 'Moderate Risk': return 'text-yellow-600';
    case 'Elevated Risk': return 'text-orange-600';
    case 'High Risk': return 'text-red-600';
    default: return 'text-muted-foreground';
  }
}

export function riskBgColor(level: string): string {
  switch (level) {
    case 'Low Risk': return 'bg-emerald-100 text-emerald-800';
    case 'Moderate Risk': return 'bg-yellow-100 text-yellow-800';
    case 'Elevated Risk': return 'bg-orange-100 text-orange-800';
    case 'High Risk': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}
