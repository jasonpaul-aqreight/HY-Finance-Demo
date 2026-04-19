import { getPool } from '../postgres';

export interface BudgetRow {
  line_item: string;
  annual_budget: number;
  monthly_budget: number;
  updated_at: string;
}

/** Get saved budget for a fiscal year. Returns empty array if none. */
export async function getBudget(fiscalYear: string): Promise<BudgetRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT line_item, annual_budget::float, monthly_budget::float, updated_at
     FROM budget
     WHERE fiscal_year = $1
     ORDER BY id`,
    [fiscalYear],
  );
  return rows;
}

/** Upsert budget lines for a fiscal year. */
export async function saveBudget(
  fiscalYear: string,
  lines: { line_item: string; annual_budget: number; monthly_budget: number }[],
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const line of lines) {
      await client.query(
        `INSERT INTO budget (fiscal_year, line_item, annual_budget, monthly_budget)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (fiscal_year, line_item)
         DO UPDATE SET annual_budget = $3, monthly_budget = $4, updated_at = NOW()`,
        [fiscalYear, line.line_item, line.annual_budget, line.monthly_budget],
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
