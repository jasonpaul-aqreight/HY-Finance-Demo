import { getPool } from '@/lib/postgres';

export type BatchRunStatus = 'idle' | 'running' | 'success' | 'partial' | 'error';

export interface BatchSectionError {
  sectionKey: string;
  message: string;
}

export interface BatchRun {
  id: number;
  status: BatchRunStatus;
  started_at: string | null;
  finished_at: string | null;
  total_runtime_s: number | null;
  total_cost_usd: number | null;
  total_tokens: number | null;
  sections_total: number;
  sections_completed: number;
  sections_failed: number;
  current_section: string | null;
  section_errors: BatchSectionError[];
  error_message: string | null;
  triggered_by: string | null;
  created_at: string | null;
}

export class BatchAlreadyRunningError extends Error {
  constructor(message = 'AI Insight batch already running') {
    super(message);
    this.name = 'BatchAlreadyRunningError';
  }
}

interface BatchRunRow {
  id: number;
  status: BatchRunStatus;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  total_runtime_s: string | number | null;
  total_cost_usd: string | number | null;
  total_tokens: number | null;
  sections_total: number;
  sections_completed: number;
  sections_failed: number;
  current_section: string | null;
  section_errors: unknown;
  error_message: string | null;
  triggered_by: string | null;
  created_at: Date | string | null;
}

export function getBatchStaleMinutes(): number {
  const parsed = Number(process.env.AI_INSIGHT_BATCH_STALE_MIN ?? 40);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 40;
}

export function isBatchRunStale(run: Pick<BatchRun, 'status' | 'started_at'>, staleMinutes = getBatchStaleMinutes()): boolean {
  if (run.status !== 'running' || !run.started_at) return false;
  return Date.now() - new Date(run.started_at).getTime() > staleMinutes * 60_000;
}

export async function markStaleRunningBatches(staleMinutes = getBatchStaleMinutes()): Promise<number> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE ai_insight_batch_run
        SET status = 'error',
            finished_at = NOW(),
            total_runtime_s = ROUND(EXTRACT(EPOCH FROM (NOW() - started_at))::numeric, 1),
            current_section = NULL,
            error_message = 'Run interrupted (process restart)'
      WHERE status = 'running'
        AND started_at IS NOT NULL
        AND started_at < NOW() - ($1::int * INTERVAL '1 minute')`,
    [staleMinutes],
  );
  return rowCount ?? 0;
}

export async function createBatchRun(triggeredBy: string, total: number): Promise<BatchRun> {
  await markStaleRunningBatches();

  const pool = getPool();
  try {
    const { rows } = await pool.query<BatchRunRow>(
      `INSERT INTO ai_insight_batch_run
         (status, started_at, sections_total, sections_completed, sections_failed,
          section_errors, triggered_by)
       VALUES ('running', NOW(), $1, 0, 0, '[]'::jsonb, $2)
       RETURNING *`,
      [total, triggeredBy],
    );
    return normalizeBatchRun(rows[0]);
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      throw new BatchAlreadyRunningError();
    }
    throw err;
  }
}

export async function updateBatchProgress(id: number, progress: {
  currentSection?: string | null;
  sectionsCompleted?: number;
  sectionsFailed?: number;
  totalCostUsd?: number;
  totalTokens?: number;
  sectionErrors?: BatchSectionError[];
}): Promise<void> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  const add = (sql: string, value: unknown) => {
    values.push(value);
    assignments.push(`${sql} = $${values.length}`);
  };

  if (progress.currentSection !== undefined) add('current_section', progress.currentSection);
  if (progress.sectionsCompleted !== undefined) add('sections_completed', progress.sectionsCompleted);
  if (progress.sectionsFailed !== undefined) add('sections_failed', progress.sectionsFailed);
  if (progress.totalCostUsd !== undefined) add('total_cost_usd', progress.totalCostUsd);
  if (progress.totalTokens !== undefined) add('total_tokens', progress.totalTokens);
  if (progress.sectionErrors !== undefined) add('section_errors', JSON.stringify(progress.sectionErrors));

  if (assignments.length === 0) return;

  values.push(id);
  await getPool().query(
    `UPDATE ai_insight_batch_run
        SET ${assignments.join(', ')}
      WHERE id = $${values.length}`,
    values,
  );
}

export async function finishBatchRun(id: number, params: {
  status: Exclude<BatchRunStatus, 'idle' | 'running'>;
  errorMessage?: string;
  totalCostUsd: number;
  totalTokens: number;
  sectionsCompleted: number;
  sectionsFailed: number;
  sectionErrors: BatchSectionError[];
}): Promise<BatchRun> {
  const { rows } = await getPool().query<BatchRunRow>(
    `UPDATE ai_insight_batch_run
        SET status = $2,
            finished_at = NOW(),
            total_runtime_s = ROUND(EXTRACT(EPOCH FROM (NOW() - started_at))::numeric, 1),
            total_cost_usd = $3,
            total_tokens = $4,
            sections_completed = $5,
            sections_failed = $6,
            section_errors = $7::jsonb,
            error_message = $8,
            current_section = NULL
      WHERE id = $1
      RETURNING *`,
    [
      id,
      params.status,
      params.totalCostUsd,
      params.totalTokens,
      params.sectionsCompleted,
      params.sectionsFailed,
      JSON.stringify(params.sectionErrors),
      params.errorMessage ?? null,
    ],
  );
  return normalizeBatchRun(rows[0]);
}

export async function getLatestBatchRun(): Promise<BatchRun | null> {
  const { rows } = await getPool().query<BatchRunRow>(
    `SELECT *
       FROM ai_insight_batch_run
      ORDER BY created_at DESC
      LIMIT 1`,
  );
  return rows[0] ? normalizeBatchRun(rows[0]) : null;
}

function normalizeBatchRun(row: BatchRunRow): BatchRun {
  return {
    id: row.id,
    status: row.status,
    started_at: toIsoString(row.started_at),
    finished_at: toIsoString(row.finished_at),
    total_runtime_s: toNumberOrNull(row.total_runtime_s),
    total_cost_usd: toNumberOrNull(row.total_cost_usd),
    total_tokens: row.total_tokens,
    sections_total: row.sections_total,
    sections_completed: row.sections_completed,
    sections_failed: row.sections_failed,
    current_section: row.current_section,
    section_errors: normalizeSectionErrors(row.section_errors),
    error_message: row.error_message,
    triggered_by: row.triggered_by,
    created_at: toIsoString(row.created_at),
  };
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toNumberOrNull(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSectionErrors(value: unknown): BatchSectionError[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      sectionKey: typeof (item as { sectionKey?: unknown }).sectionKey === 'string'
        ? (item as { sectionKey: string }).sectionKey
        : '',
      message: typeof (item as { message?: unknown }).message === 'string'
        ? (item as { message: string }).message
        : '',
    }))
    .filter((item) => item.sectionKey && item.message);
}
