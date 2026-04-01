/**
 * Sync Engine: orchestrates the full ETL pipeline.
 *
 * Pipeline:
 *   Phase 1 — Sync 13 lookup tables (truncate-reload from RDS)
 *   Phase 1b — Transform products (parse UDF_BoC → fruit columns)
 *   Phase 2 — Build 17 pc_* pre-computed tables (aggregation from RDS)
 *   Phase 2b — Swap staging tables → live (atomic within transaction)
 *   Commit — All changes visible at once
 */

import { Pool, PoolClient } from 'pg';
import { LOOKUP_MAPPINGS } from './table-map';
import { syncLookupTable, swapPcTable, snapshotPcTable } from './table-sync';
import { transformProducts } from './transforms';
import { PC_BUILDERS, BuilderContext } from './builders';

// ── Types ─────────────────────────────────────────────────────────────────

export interface SyncResult {
  jobId: number;
  status: 'success' | 'error';
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  lookups: { table: string; rows: number; durationMs: number }[];
  transforms: { name: string; rows: number; durationMs: number }[];
  builders: { table: string; rows: number; durationMs: number }[];
  totalRows: number;
  error?: string;
}

export type SyncStatus = 'idle' | 'running';

let currentStatus: SyncStatus = 'idle';
let currentProgress: string = '';
let lastResult: SyncResult | null = null;

export function getSyncStatus() {
  return { status: currentStatus, progress: currentProgress, lastResult };
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Get current date in MYT (UTC+8) as YYYY-MM-DD */
function getMytDate(): string {
  const now = new Date();
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return myt.toISOString().slice(0, 10);
}

/** Load credit score v2 config from app_settings */
async function loadCreditScoreConfig(target: PoolClient): Promise<BuilderContext['creditScoreConfig']> {
  try {
    const { rows } = await target.query(
      `SELECT value FROM app_settings WHERE key = 'credit_score_v2'`
    );
    if (rows.length > 0) {
      const cfg = rows[0].value;
      return {
        weights: cfg.creditScoreWeights,
        thresholds: cfg.riskThresholds,
      };
    }
  } catch {
    // Fall through to defaults
  }
  return undefined;
}

// ── Main Pipeline ─────────────────────────────────────────────────────────

/**
 * Run a full sync from AutoCount → local PostgreSQL.
 */
export async function runFullSync(
  sourcePool: Pool,
  targetPool: Pool,
  _dataDir: string
): Promise<SyncResult> {
  if (currentStatus === 'running') {
    throw new Error('Sync already in progress');
  }

  currentStatus = 'running';
  currentProgress = 'Starting sync...';
  const startedAt = new Date();

  const lookupResults: SyncResult['lookups'] = [];
  const transformResults: SyncResult['transforms'] = [];
  const builderResults: SyncResult['builders'] = [];
  let jobId = 0;

  const totalSteps = LOOKUP_MAPPINGS.length + 1 + PC_BUILDERS.length; // lookups + product transform + builders
  let stepsCompleted = 0;

  const targetClient = await targetPool.connect();

  try {
    // ── Create sync job record ────────────────────────────────────────
    const jobRow = await targetClient.query(
      `INSERT INTO sync_job (status, trigger_type, started_at, tables_total)
       VALUES ('running', 'manual', NOW(), $1)
       RETURNING id`,
      [totalSteps]
    );
    jobId = jobRow.rows[0].id;

    // ── Load builder context ──────────────────────────────────────────
    const creditScoreConfig = await loadCreditScoreConfig(targetClient);
    const builderCtx: BuilderContext = {
      snapshotDate: getMytDate(),
      creditScoreConfig,
      targetClient,
    };

    // ── BEGIN TRANSACTION ─────────────────────────────────────────────
    await targetClient.query('BEGIN');

    // ══ Phase 1: Sync lookup tables ═══════════════════════════════════
    for (const mapping of LOOKUP_MAPPINGS) {
      currentProgress = `Syncing lookup: ${mapping.source} → ${mapping.target}...`;
      const tStart = Date.now();

      const rows = await syncLookupTable(sourcePool, targetClient, mapping, (table, count) => {
        currentProgress = `Syncing ${table}: ${count} rows...`;
      });

      const tDuration = Date.now() - tStart;
      lookupResults.push({ table: mapping.target, rows, durationMs: tDuration });
      stepsCompleted++;

      await targetClient.query(
        `INSERT INTO sync_log (job_id, level, table_name, phase, message, rows_affected, duration_ms)
         VALUES ($1, 'info', $2, 'lookup', $3, $4, $5)`,
        [jobId, mapping.target, `Synced ${rows} rows`, rows, tDuration]
      );

      await targetClient.query(
        `UPDATE sync_job SET tables_completed = $1, rows_synced = $2 WHERE id = $3`,
        [stepsCompleted, lookupResults.reduce((s, t) => s + t.rows, 0), jobId]
      );
    }

    // ══ Phase 1b: Transform products ══════════════════════════════════
    currentProgress = 'Transforming products (parsing UDF_BoC + Description fallback)...';
    let tStart = Date.now();
    const productCount = await transformProducts(targetClient);
    transformResults.push({
      name: 'product_fruit_parse',
      rows: productCount,
      durationMs: Date.now() - tStart,
    });
    stepsCompleted++;

    // ══ Phase 2: Build pre-computed tables ═════════════════════════════
    // Each builder runs inside a SAVEPOINT so individual failures
    // don't roll back the entire transaction.
    const failedBuilders: string[] = [];

    for (const builder of PC_BUILDERS) {
      currentProgress = `Building ${builder.table}...`;
      tStart = Date.now();

      const savepoint = `sp_${builder.table}`;
      await targetClient.query(`SAVEPOINT ${savepoint}`);

      try {
        // Run aggregation query against RDS
        const { rows, columns } = await builder.build(sourcePool, builderCtx);

        // Write to local PostgreSQL
        let insertedRows: number;
        if (builder.mode === 'swap') {
          insertedRows = await swapPcTable(targetClient, builder.table, rows, columns, (table, count) => {
            currentProgress = `Writing ${table}: ${count} rows...`;
          });
        } else {
          // snapshot mode
          insertedRows = await snapshotPcTable(
            targetClient, builder.table, builderCtx.snapshotDate, rows, columns, (table, count) => {
              currentProgress = `Writing ${table}: ${count} rows...`;
            }
          );
        }

        await targetClient.query(`RELEASE SAVEPOINT ${savepoint}`);

        const tDuration = Date.now() - tStart;
        builderResults.push({ table: builder.table, rows: insertedRows, durationMs: tDuration });
        stepsCompleted++;

        await targetClient.query(
          `INSERT INTO sync_log (job_id, level, table_name, phase, message, rows_affected, duration_ms)
           VALUES ($1, 'info', $2, 'builder', $3, $4, $5)`,
          [jobId, builder.table, `Built ${insertedRows} rows (${builder.mode})`, insertedRows, tDuration]
        );
      } catch (builderErr: unknown) {
        await targetClient.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);

        const errMsg = builderErr instanceof Error ? builderErr.message : String(builderErr);
        failedBuilders.push(`${builder.table}: ${errMsg}`);
        console.error(`[sync] Builder ${builder.table} failed:`, errMsg);

        const tDuration = Date.now() - tStart;
        builderResults.push({ table: builder.table, rows: 0, durationMs: tDuration });
        stepsCompleted++;

        await targetClient.query(
          `INSERT INTO sync_log (job_id, level, table_name, phase, message, duration_ms)
           VALUES ($1, 'warn', $2, 'builder', $3, $4)`,
          [jobId, builder.table, `FAILED: ${errMsg}`, tDuration]
        );
      }

      await targetClient.query(
        `UPDATE sync_job SET tables_completed = $1, rows_synced = $2 WHERE id = $3`,
        [
          stepsCompleted,
          lookupResults.reduce((s, t) => s + t.rows, 0) +
            builderResults.reduce((s, t) => s + t.rows, 0),
          jobId,
        ]
      );
    }

    // ── COMMIT ────────────────────────────────────────────────────────
    await targetClient.query('COMMIT');

    // ── Update job status ─────────────────────────────────────────────
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const totalRows =
      lookupResults.reduce((sum, t) => sum + t.rows, 0) +
      builderResults.reduce((sum, t) => sum + t.rows, 0);

    const jobStatus = failedBuilders.length > 0 ? 'partial' : 'success';
    if (failedBuilders.length > 0) {
      console.warn(`[sync] ${failedBuilders.length} builder(s) failed:`, failedBuilders);
    }

    await targetClient.query(
      `UPDATE sync_job SET status = $4, completed_at = NOW(),
       tables_completed = $1, rows_synced = $2,
       error_message = $5
       WHERE id = $3`,
      [stepsCompleted, totalRows, jobId, jobStatus,
       failedBuilders.length > 0 ? failedBuilders.join('; ') : null]
    );

    const result: SyncResult = {
      jobId,
      status: failedBuilders.length > 0 ? 'error' : 'success',
      startedAt,
      completedAt,
      durationMs,
      lookups: lookupResults,
      transforms: transformResults,
      builders: builderResults,
      totalRows,
      error: failedBuilders.length > 0 ? failedBuilders.join('; ') : undefined,
    };

    lastResult = result;
    return result;

  } catch (err: unknown) {
    try { await targetClient.query('ROLLBACK'); } catch { /* ignore */ }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const errorMsg = err instanceof Error ? err.message : String(err);

    try {
      await targetClient.query(
        `UPDATE sync_job SET status = 'error', completed_at = NOW(),
         error_message = $1 WHERE id = $2`,
        [errorMsg, jobId]
      );
    } catch { /* ignore */ }

    const result: SyncResult = {
      jobId,
      status: 'error',
      startedAt,
      completedAt,
      durationMs,
      lookups: lookupResults,
      transforms: transformResults,
      builders: builderResults,
      totalRows:
        lookupResults.reduce((sum, t) => sum + t.rows, 0) +
        builderResults.reduce((sum, t) => sum + t.rows, 0),
      error: errorMsg,
    };

    lastResult = result;
    throw err;

  } finally {
    currentStatus = 'idle';
    currentProgress = '';
    targetClient.release();
  }
}
