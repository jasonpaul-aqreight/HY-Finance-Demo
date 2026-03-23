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

export function formatCount(value: number | null | undefined): string {
  if (value == null) return '0';
  return value.toLocaleString('en-MY');
}

export function growthColor(pct: number | null | undefined): string {
  if (pct == null || !isFinite(pct)) return 'text-muted-foreground';
  return pct >= 0 ? 'text-emerald-600' : 'text-red-600';
}

// ─── Cost category colors ────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  COGS: '#3B82F6',
  OPEX: '#F97316',
};

const OPEX_SUBCATEGORY_COLORS: Record<string, string> = {
  'Payroll': '#F97316',
  'Electricity & Water': '#EAB308',
  'Packaging Materials': '#22C55E',
  'Fuel': '#EF4444',
  'Rental': '#A855F7',
  'Repair & Maintenance': '#06B6D4',
  'Vehicle & Equipment Upkeep': '#EC4899',
  'Depreciation': '#78716C',
  'Insurance': '#0EA5E9',
  'Finance Costs': '#F43F5E',
  'Other OPEX': '#6B7280',
};

// Distinct high-contrast palette for COGS account breakdown
const COGS_PALETTE = [
  '#2563EB', '#E11D48', '#16A34A', '#D97706', '#7C3AED',
  '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#4F46E5',
  '#0D9488', '#B91C1C', '#CA8A04', '#9333EA', '#0284C7',
  '#BE185D', '#15803D',
];

export function getCategoryColor(category: string, costType: 'all' | 'cogs' | 'opex', index = 0): string {
  if (costType === 'all') {
    return TYPE_COLORS[category] ?? '#6B7280';
  }
  if (costType === 'opex') {
    return OPEX_SUBCATEGORY_COLORS[category] ?? '#6B7280';
  }
  // costType === 'cogs': dynamic palette by index
  return COGS_PALETTE[index % COGS_PALETTE.length];
}
