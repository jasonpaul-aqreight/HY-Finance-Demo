/**
 * Standalone script to run a full sync without starting the HTTP server.
 * Usage: npx tsx src/run-sync.ts
 */

import { Pool } from 'pg';
import { resolve } from 'path';
import { runFullSync } from './sync-engine';

const DATA_DIR = process.env.DATA_DIR || resolve(__dirname, '../../data');

const sourcePool = new Pool({
  connectionString: process.env.AUTOCOUNT_DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10000,
  ssl: process.env.AUTOCOUNT_DATABASE_URL?.includes('sslmode=no-verify')
    ? { rejectUnauthorized: false }
    : undefined,
});

const targetPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
});

async function main() {
  console.log('Starting full sync...');
  console.log(`Source: ${process.env.AUTOCOUNT_DATABASE_URL?.replace(/:[^@]+@/, ':***@')}`);
  console.log(`Target: ${process.env.DATABASE_URL?.replace(/:[^@]+@/, ':***@')}`);
  console.log(`Data dir: ${DATA_DIR}`);
  console.log('');

  const result = await runFullSync(sourcePool, targetPool, DATA_DIR);

  console.log('\n═══ Sync Result ═══');
  console.log(`Status: ${result.status}`);
  console.log(`Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log(`Total rows: ${result.totalRows.toLocaleString()}`);

  console.log('\n── Lookups ──');
  for (const t of result.lookups) {
    console.log(`  ${t.table.padEnd(28)} ${t.rows.toLocaleString().padStart(10)} rows  ${(t.durationMs / 1000).toFixed(1)}s`);
  }

  console.log('\n── Transforms ──');
  for (const t of result.transforms) {
    console.log(`  ${t.name.padEnd(28)} ${t.rows.toLocaleString().padStart(10)} rows  ${(t.durationMs / 1000).toFixed(1)}s`);
  }

  console.log('\n── Pre-Computed Tables ──');
  for (const b of result.builders) {
    console.log(`  ${b.table.padEnd(34)} ${b.rows.toLocaleString().padStart(10)} rows  ${(b.durationMs / 1000).toFixed(1)}s`);
  }

  if (result.error) {
    console.error(`\nError: ${result.error}`);
  }

  await sourcePool.end();
  await targetPool.end();
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
