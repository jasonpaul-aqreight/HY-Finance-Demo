/**
 * HTTP API for the sync service.
 *
 * Routes:
 *   POST /api/sync/trigger    — Manually trigger a full sync
 *   GET  /api/sync/status     — Current sync status + last result
 *   GET  /api/sync/schedule   — Get cron schedule
 *   PUT  /api/sync/schedule   — Update cron schedule
 *   GET  /api/sync/history    — Recent sync jobs
 *   GET  /api/sync/logs/:id   — Detailed logs for a sync job
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { runFullSync, getSyncStatus } from './sync-engine';

export function createApiRouter(
  sourcePool: Pool,
  targetPool: Pool,
  dataDir: string,
  reschedule: (cron: string) => void
): Router {
  const router = Router();

  // POST /api/sync/trigger — Start a manual sync
  router.post('/api/sync/trigger', async (_req: Request, res: Response) => {
    const { status } = getSyncStatus();
    if (status === 'running') {
      res.status(409).json({ error: 'Sync already in progress' });
      return;
    }

    // Run async — don't wait for completion
    runFullSync(sourcePool, targetPool, dataDir)
      .then((result) => console.log(`Sync completed: ${result.totalRows} rows in ${result.durationMs}ms`))
      .catch((err) => console.error('Sync failed:', err));

    res.json({ message: 'Sync started' });
  });

  // GET /api/sync/status — Current status
  router.get('/api/sync/status', (_req: Request, res: Response) => {
    res.json(getSyncStatus());
  });

  // GET /api/sync/schedule — Get schedule from app_settings
  router.get('/api/sync/schedule', async (_req: Request, res: Response) => {
    try {
      const { rows } = await targetPool.query(
        `SELECT value, updated_at FROM app_settings WHERE key = 'sync_schedule'`
      );
      if (rows.length === 0) {
        res.json({ cron_expression: '0 6 * * *', is_active: true, timezone: 'Asia/Kuala_Lumpur' });
      } else {
        res.json({ ...rows[0].value, updated_at: rows[0].updated_at });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // PUT /api/sync/schedule — Update schedule in app_settings
  router.put('/api/sync/schedule', async (req: Request, res: Response) => {
    const { cron_expression, is_active } = req.body;
    if (!cron_expression) {
      res.status(400).json({ error: 'cron_expression is required' });
      return;
    }

    try {
      await targetPool.query(
        `UPDATE app_settings
         SET value = value || $1::jsonb, updated_at = NOW()
         WHERE key = 'sync_schedule'`,
        [JSON.stringify({ cron_expression, is_active: is_active ?? true })]
      );
      reschedule(cron_expression);
      res.json({ message: 'Schedule updated', cron_expression, is_active });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/sync/history — Recent sync jobs (matches sync_job schema)
  router.get('/api/sync/history', async (_req: Request, res: Response) => {
    try {
      const { rows } = await targetPool.query(
        `SELECT id, status, trigger_type, started_at, completed_at,
                tables_total, tables_completed, rows_synced, error_message, created_at
         FROM sync_job ORDER BY created_at DESC LIMIT 20`
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/sync/logs/:id — Logs for a specific job (matches sync_log schema)
  router.get('/api/sync/logs/:id', async (req: Request, res: Response) => {
    try {
      const { rows } = await targetPool.query(
        `SELECT table_name, phase, message, rows_affected, duration_ms, level, "timestamp"
         FROM sync_log WHERE job_id = $1 ORDER BY id`,
        [req.params.id]
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
