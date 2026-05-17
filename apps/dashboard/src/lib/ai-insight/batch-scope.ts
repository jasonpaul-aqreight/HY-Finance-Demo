import { endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { getDateBounds as getExpenseDateBounds } from '@/lib/expenses/queries';
import { getFiscalYears } from '@/lib/pnl/queries';
import { getPool } from '@/lib/postgres';
import type { DateRange, FiscalPeriod, PageKey, SectionKey } from './types';

export type ScopeKind = 'range' | 'snapshot' | 'fiscal';

export interface BatchSectionScope {
  sectionKey: SectionKey;
  page: PageKey;
  kind: ScopeKind;
  resolve(): Promise<{
    dateRange: DateRange | null;
    fiscalPeriod: FiscalPeriod | null;
  }>;
}

type DateBounds = {
  min_date?: string | null;
  max_date?: string | null;
};

export function monthAlignedTrailingTwelveMonths(maxDateValue: string | Date): DateRange {
  const maxDate = typeof maxDateValue === 'string'
    ? parseISO(maxDateValue.slice(0, 10))
    : maxDateValue;
  const end = endOfMonth(maxDate);
  const start = startOfMonth(subMonths(end, 11));

  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

const rangeFromBounds = (bounds: DateBounds, label: string): DateRange => {
  if (!bounds.max_date) {
    throw new Error(`No max date available for ${label}`);
  }

  return monthAlignedTrailingTwelveMonths(bounds.max_date);
};

async function resolveRangeFromSql(sql: string, label: string): Promise<{
  dateRange: DateRange;
  fiscalPeriod: null;
}> {
  const pool = getPool();
  const { rows } = await pool.query<DateBounds>(sql);
  return {
    dateRange: rangeFromBounds(rows[0] ?? {}, label),
    fiscalPeriod: null,
  };
}

function snapshotScope() {
  return Promise.resolve({ dateRange: null, fiscalPeriod: null });
}

async function fiscalScope(): Promise<{ dateRange: null; fiscalPeriod: FiscalPeriod }> {
  const fiscalYears = await getFiscalYears();
  const selected = fiscalYears.length > 1 ? fiscalYears[1] : fiscalYears[0];
  const rawName = selected?.FiscalYearName;
  const match = String(rawName ?? '').match(/\d{4}/);
  if (!match) {
    throw new Error('No fiscal year available for AI Insight batch scope');
  }

  return {
    dateRange: null,
    fiscalPeriod: {
      fiscalYear: `FY${match[0]}`,
      range: 'fy',
    },
  };
}

async function expenseScope() {
  return {
    dateRange: rangeFromBounds(await getExpenseDateBounds(), 'expenses'),
    fiscalPeriod: null,
  };
}

const salesScope = () => resolveRangeFromSql(`
  SELECT
    MIN(doc_date)::text AS min_date,
    MAX(doc_date)::text AS max_date
  FROM pc_sales_daily
`, 'sales');

const paymentScope = () => resolveRangeFromSql(`
  SELECT
    MIN(month) || '-01' AS min_date,
    MAX(month) || '-01' AS max_date
  FROM pc_ar_monthly
  WHERE invoiced > 0
`, 'payment');

const customerMarginScope = () => resolveRangeFromSql(`
  SELECT
    MIN(month) || '-01' AS min_date,
    MAX(month) || '-01' AS max_date
  FROM pc_customer_margin
`, 'customer-margin');

const supplierMarginScope = () => resolveRangeFromSql(`
  SELECT
    MIN(month || '-01') AS min_date,
    MAX(month || '-01') AS max_date
  FROM pc_supplier_margin
`, 'supplier-performance');

const returnScope = () => resolveRangeFromSql(`
  SELECT
    MIN(month) || '-01' AS min_date,
    MAX(month) || '-01' AS max_date
  FROM pc_return_monthly
`, 'return');

export const BATCH_SECTIONS: BatchSectionScope[] = [
  { sectionKey: 'sales_trend', page: 'sales', kind: 'range', resolve: salesScope },
  { sectionKey: 'sales_breakdown', page: 'sales', kind: 'range', resolve: salesScope },
  { sectionKey: 'payment_collection_trend', page: 'payment', kind: 'range', resolve: paymentScope },
  { sectionKey: 'payment_outstanding', page: 'payment', kind: 'snapshot', resolve: snapshotScope },
  { sectionKey: 'financial_overview', page: 'financial', kind: 'fiscal', resolve: fiscalScope },
  { sectionKey: 'financial_variance', page: 'financial', kind: 'fiscal', resolve: fiscalScope },
  { sectionKey: 'financial_balance_sheet', page: 'financial', kind: 'fiscal', resolve: fiscalScope },
  { sectionKey: 'financial_pnl', page: 'financial', kind: 'fiscal', resolve: fiscalScope },
  { sectionKey: 'customer_margin_overview', page: 'customer-margin', kind: 'range', resolve: customerMarginScope },
  { sectionKey: 'customer_margin_breakdown', page: 'customer-margin', kind: 'range', resolve: customerMarginScope },
  { sectionKey: 'supplier_margin_overview', page: 'supplier-performance', kind: 'range', resolve: supplierMarginScope },
  { sectionKey: 'supplier_margin_breakdown', page: 'supplier-performance', kind: 'range', resolve: supplierMarginScope },
  { sectionKey: 'return_trend', page: 'return', kind: 'range', resolve: returnScope },
  { sectionKey: 'return_unsettled', page: 'return', kind: 'snapshot', resolve: snapshotScope },
  { sectionKey: 'expense_overview', page: 'expenses', kind: 'range', resolve: expenseScope },
  { sectionKey: 'expense_breakdown', page: 'expenses', kind: 'range', resolve: expenseScope },
];
