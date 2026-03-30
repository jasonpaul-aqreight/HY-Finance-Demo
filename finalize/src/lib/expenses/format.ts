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
  'People & Payroll': '#2563EB',
  'Depreciation': '#E11D48',
  'Property & Utilities': '#16A34A',
  'Vehicle & Transport': '#D97706',
  'Office & Supplies': '#7C3AED',
  'Finance & Banking': '#0891B2',
  'Insurance': '#DB2777',
  'Other': '#EA580C',
  'Equipment & IT': '#4F46E5',
  'Professional Fees': '#0D9488',
  'Marketing & Entertainment': '#B91C1C',
  'Tax & Compliance': '#CA8A04',
  'Repair & Maintenance': '#15803D',
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
