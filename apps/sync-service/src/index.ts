/**
 * Sync Service entry point.
 * - Express HTTP server for manual triggers and status
 * - node-cron scheduler for automated syncs
 */

import express from 'express';
import cron from 'node-cron';
import { Pool } from 'pg';
import { createApiRouter } from './http-api';
import { runFullSync } from './sync-engine';
import { resolve } from 'path';

// ── Configuration ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.SYNC_PORT || '4000', 10);
const DATA_DIR = process.env.DATA_DIR || resolve(__dirname, '../../data');
const DEFAULT_CRON = process.env.SYNC_CRON || '0 6 * * *'; // Daily at 6 AM MYT

// Source: AutoCount on AWS RDS
const sourcePool = new Pool({
  connectionString: process.env.AUTOCOUNT_DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10000,
  ssl: process.env.AUTOCOUNT_DATABASE_URL?.includes('sslmode=no-verify')
    ? { rejectUnauthorized: false }
    : undefined,
});

// Target: Local PostgreSQL (Docker)
const targetPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
});

// ── Cron Scheduler ─────────────────────────────────────────────────────────

let scheduledTask: cron.ScheduledTask | null = null;

function scheduleSync(cronExpression: string) {
  if (scheduledTask) {
    scheduledTask.stop();
  }

  if (!cron.validate(cronExpression)) {
    console.error(`Invalid cron expression: ${cronExpression}`);
    return;
  }

  scheduledTask = cron.schedule(cronExpression, async () => {
    console.log(`[CRON] Starting scheduled sync at ${new Date().toISOString()}`);
    try {
      const result = await runFullSync(sourcePool, targetPool, DATA_DIR, 'scheduled');
      console.log(`[CRON] Sync completed: ${result.totalRows} rows in ${result.durationMs}ms`);
    } catch (err) {
      console.error('[CRON] Sync failed:', err);
    }
  });

  console.log(`Sync scheduled: ${cronExpression}`);
}

// ── Express Server ─────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Track whether initial sync has completed (used by Docker healthcheck)
let initialSyncDone = process.env.SYNC_ON_STARTUP !== 'true';

// Health check — returns 503 until initial sync is done
app.get('/health', (_req, res) => {
  if (!initialSyncDone) {
    res.status(503).json({ status: 'syncing', uptime: process.uptime() });
    return;
  }
  res.json({ status: 'ok', uptime: process.uptime() });
});

// API routes
const apiRouter = createApiRouter(sourcePool, targetPool, DATA_DIR, scheduleSync);
app.use(apiRouter);

// ── Start ──────────────────────────────────────────────────────────────────

async function main() {
  // Test connections
  try {
    const srcResult = await sourcePool.query('SELECT 1 AS ok');
    console.log('AutoCount source connected:', srcResult.rows[0].ok === 1 ? 'OK' : 'FAIL');
  } catch (err) {
    console.error('Failed to connect to AutoCount source:', err);
    process.exit(1);
  }

  try {
    const tgtResult = await targetPool.query('SELECT 1 AS ok');
    console.log('Local PostgreSQL connected:', tgtResult.rows[0].ok === 1 ? 'OK' : 'FAIL');
  } catch (err) {
    console.error('Failed to connect to local PostgreSQL:', err);
    process.exit(1);
  }

  // Run initial sync on startup if enabled (for Docker demo handoff)
  if (process.env.SYNC_ON_STARTUP === 'true') {
    console.log('[STARTUP] Running initial data sync — this may take a few minutes...');
    try {
      const result = await runFullSync(sourcePool, targetPool, DATA_DIR, 'manual');
      console.log(`[STARTUP] Initial sync completed: ${result.totalRows} rows in ${result.durationMs}ms`);
    } catch (err) {
      console.error('[STARTUP] Initial sync failed (cron will retry later):', err);
    }
    initialSyncDone = true;
  }

  // Load schedule from app_settings or use default
  try {
    const { rows } = await targetPool.query(
      `SELECT value FROM app_settings WHERE key = 'sync_schedule'`
    );
    if (rows.length > 0 && rows[0].value.is_active) {
      scheduleSync(rows[0].value.cron_expression);
    } else {
      scheduleSync(DEFAULT_CRON);
    }
  } catch {
    scheduleSync(DEFAULT_CRON);
  }

  app.listen(PORT, () => {
    console.log(`Sync service listening on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
