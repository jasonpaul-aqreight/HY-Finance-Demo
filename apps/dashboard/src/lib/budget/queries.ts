import { getPool } from '../postgres';

export const ALLOWED_BUDGET_LINE_ITEMS = [
  'Net Sales',
  'Cost of Sales',
  'Operating Costs',
] as const;

export type BudgetLineItem = (typeof ALLOWED_BUDGET_LINE_ITEMS)[number];

export interface BudgetRow {
  line_item: string;
  monthly_budget: number;
  annual_budget: number;
  tolerance_pct: number;
  approved_by: string | null;
  note: string | null;
  updated_at: string;
}

let budgetSchemaReady = false;

async function ensureBudgetSchema(): Promise<void> {
  if (budgetSchemaReady) return;
  const pool = getPool();
  await pool.query(
    `ALTER TABLE budget_global
     ADD COLUMN IF NOT EXISTS tolerance_pct NUMERIC(5,2) NOT NULL DEFAULT 5`,
  );
  budgetSchemaReady = true;
}

/** Get the global budget baseline. Returns empty array if none set. */
export async function getGlobalBudget(): Promise<BudgetRow[]> {
  await ensureBudgetSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       line_item,
       monthly_budget::float,
       annual_budget::float,
       tolerance_pct::float,
       approved_by,
       note,
       updated_at
     FROM budget_global
     ORDER BY line_item`,
  );
  return rows;
}

/** Upsert the global budget baseline. Rejects line items outside the allowed set. */
export async function saveGlobalBudget(
  lines: { line_item: string; monthly_budget: number; annual_budget: number; tolerance_pct: number }[],
  meta: { userName: string; note?: string | null },
): Promise<void> {
  await ensureBudgetSchema();
  const allowed = new Set<string>(ALLOWED_BUDGET_LINE_ITEMS);
  for (const line of lines) {
    if (!allowed.has(line.line_item)) {
      throw new Error(`Unsupported budget line_item: ${line.line_item}`);
    }
  }

  const pool = getPool();
  const client = await pool.connect();
  const approvedBy = meta.userName;
  const note = meta.note ?? null;
  try {
    await client.query('BEGIN');
    for (const line of lines) {
      await client.query(
        `INSERT INTO budget_global (line_item, monthly_budget, annual_budget, tolerance_pct, approved_by, note, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (line_item)
         DO UPDATE SET
           monthly_budget = $2,
           annual_budget = $3,
           tolerance_pct = $4,
           approved_by = $5,
           note = $6,
           updated_at = NOW()`,
        [line.line_item, line.monthly_budget, line.annual_budget, line.tolerance_pct, approvedBy, note],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
