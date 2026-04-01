/**
 * Table sync utilities:
 *   1. syncLookupTable — truncate-reload for lookup tables (Phase 1)
 *   2. swapPcTable — staging + rename for pc_* tables (full rebuild)
 *   3. snapshotPcTable — upsert by date for daily snapshot tables
 */

import { Pool, PoolClient } from 'pg';
import { TableMapping } from './table-map';

const BATCH_SIZE = 1000;

/**
 * Compute doc_date_myt (DATE) and month_myt (TEXT) from a UTC timestamp.
 * AutoCount stores dates in UTC; Malaysia is UTC+8.
 */
function toMYT(utcDateStr: string): { doc_date_myt: string; month_myt: string } {
  const d = new Date(utcDateStr);
  d.setUTCHours(d.getUTCHours() + 8);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return {
    doc_date_myt: `${yyyy}-${mm}-${dd}`,
    month_myt: `${yyyy}-${mm}`,
  };
}

// ── Lookup table sync (Phase 1) ──────────────────────────────────────────

/**
 * Sync a single lookup table from RDS to local PostgreSQL.
 * Truncate-and-reload strategy. Returns row count.
 */
export async function syncLookupTable(
  source: Pool,
  target: PoolClient,
  mapping: TableMapping,
  onProgress?: (table: string, rows: number) => void
): Promise<number> {
  const { source: srcTable, target: tgtTable, columns, hasDateMyt, dateColumn, mytDateCol } = mapping;
  const mytColName = mytDateCol || 'doc_date_myt';

  // Build SELECT for source columns
  const srcCols = columns.map((c) => `"${c.src}"`).join(', ');
  const selectSQL = `SELECT ${srcCols} FROM dbo."${srcTable}"`;

  // Build INSERT target columns
  const destCols = [...columns.map((c) => c.dest)];
  if (hasDateMyt) {
    destCols.push(mytColName, 'month_myt');
  }

  // Truncate target
  await target.query(`TRUNCATE TABLE ${tgtTable} CASCADE`);

  // Read all rows from source
  const result = await source.query(selectSQL);
  const rows = result.rows;

  if (rows.length === 0) return 0;

  // Insert in batches
  let totalInserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (const row of batch) {
      const rowValues: unknown[] = [];

      for (const col of columns) {
        rowValues.push(row[col.src] ?? null);
      }

      if (hasDateMyt && dateColumn) {
        const dateVal = row[dateColumn];
        if (dateVal) {
          const myt = toMYT(String(dateVal));
          rowValues.push(myt.doc_date_myt, myt.month_myt);
        } else {
          rowValues.push(null, null);
        }
      }

      const startIdx = values.length + 1;
      const rowPlaceholders = rowValues.map((_, j) => `$${startIdx + j}`);
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
      values.push(...rowValues);
    }

    const insertSQL = `INSERT INTO ${tgtTable} (${destCols.map((c) => c.toLowerCase()).join(', ')}) VALUES ${placeholders.join(', ')}`;
    await target.query(insertSQL, values);

    totalInserted += batch.length;
    onProgress?.(tgtTable, totalInserted);
  }

  return totalInserted;
}

// ── Pre-computed table: swap pattern ─────────────────────────────────────

/**
 * Write rows to a pc_* table using the staging + rename swap pattern.
 * 1. Create staging table (copy of live table structure)
 * 2. Batch insert rows into staging
 * 3. Rename live → old, staging → live (atomic within caller's transaction)
 * 4. Drop old table
 *
 * Caller must have an active transaction on the target client.
 */
export async function swapPcTable(
  target: PoolClient,
  table: string,
  rows: Record<string, unknown>[],
  columns: string[],
  onProgress?: (table: string, rows: number) => void
): Promise<number> {
  const staging = `${table}_staging`;
  const old = `${table}_old`;

  // Cleanup from any prior failed run
  await target.query(`DROP TABLE IF EXISTS ${old}`);
  await target.query(`DROP TABLE IF EXISTS ${staging}`);

  // Create staging table with same structure + indexes
  await target.query(`CREATE TABLE ${staging} (LIKE ${table} INCLUDING ALL)`);

  if (rows.length === 0) {
    // Swap even if empty (clears old data)
    await target.query(`ALTER TABLE ${table} RENAME TO ${old}`);
    await target.query(`ALTER TABLE ${staging} RENAME TO ${table}`);
    await target.query(`DROP TABLE IF EXISTS ${old}`);
    return 0;
  }

  // Batch insert into staging
  let totalInserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (const row of batch) {
      const rowValues = columns.map((col) => row[col] ?? null);
      const startIdx = values.length + 1;
      const rowPlaceholders = rowValues.map((_, j) => `$${startIdx + j}`);
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
      values.push(...rowValues);
    }

    const insertSQL = `INSERT INTO ${staging} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;
    await target.query(insertSQL, values);

    totalInserted += batch.length;
    onProgress?.(table, totalInserted);
  }

  // Atomic swap
  await target.query(`ALTER TABLE ${table} RENAME TO ${old}`);
  await target.query(`ALTER TABLE ${staging} RENAME TO ${table}`);
  await target.query(`DROP TABLE IF EXISTS ${old}`);

  return totalInserted;
}

// ── Pre-computed table: snapshot upsert ──────────────────────────────────

/**
 * Write daily snapshot rows to a pc_* table.
 * Deletes existing rows for the snapshot date, then inserts new ones.
 * Used for tables like pc_ar_customer_snapshot and pc_ar_aging_history.
 */
export async function snapshotPcTable(
  target: PoolClient,
  table: string,
  snapshotDate: string,
  rows: Record<string, unknown>[],
  columns: string[],
  onProgress?: (table: string, rows: number) => void
): Promise<number> {
  // Delete existing snapshot for this date
  await target.query(`DELETE FROM ${table} WHERE snapshot_date = $1`, [snapshotDate]);

  if (rows.length === 0) return 0;

  // Batch insert
  let totalInserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (const row of batch) {
      const rowValues = columns.map((col) => row[col] ?? null);
      const startIdx = values.length + 1;
      const rowPlaceholders = rowValues.map((_, j) => `$${startIdx + j}`);
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
      values.push(...rowValues);
    }

    const insertSQL = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;
    await target.query(insertSQL, values);

    totalInserted += batch.length;
    onProgress?.(table, totalInserted);
  }

  return totalInserted;
}
