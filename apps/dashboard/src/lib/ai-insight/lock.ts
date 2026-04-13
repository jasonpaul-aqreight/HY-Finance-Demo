import { getPool } from '../postgres';
import type { LockStatus } from './types';

const STALE_LOCK_MINUTES = 6;

export async function acquireLock(
  userName: string,
  sectionKey: string,
): Promise<{ acquired: boolean; status: LockStatus }> {
  const pool = getPool();

  // Ensure singleton lock row exists (safe for concurrent calls)
  await pool.query(
    `INSERT INTO ai_insight_lock (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
  );

  // Try to acquire lock: only if unlocked or stale
  const result = await pool.query(
    `UPDATE ai_insight_lock
     SET locked_by = $1, locked_at = NOW(), section_key = $2
     WHERE id = 1
       AND (locked_by IS NULL
            OR locked_at < NOW() - INTERVAL '${STALE_LOCK_MINUTES} minutes')
     RETURNING locked_by, locked_at, section_key`,
    [userName, sectionKey],
  );

  if (result.rowCount && result.rowCount > 0) {
    return {
      acquired: true,
      status: {
        locked: true,
        locked_by: userName,
        locked_at: result.rows[0].locked_at,
        section_key: sectionKey,
      },
    };
  }

  // Lock is held by someone else — return current status
  const current = await getLockStatus();
  return { acquired: false, status: current };
}

export async function releaseLock(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE ai_insight_lock
     SET locked_by = NULL, locked_at = NULL, section_key = NULL
     WHERE id = 1`,
  );
}

export async function getLockStatus(): Promise<LockStatus> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT locked_by, locked_at, section_key FROM ai_insight_lock WHERE id = 1`,
  );

  const row = rows[0];
  if (!row || !row.locked_by) {
    return { locked: false, locked_by: null, locked_at: null, section_key: null };
  }

  // Auto-release stale locks
  const lockedAt = new Date(row.locked_at);
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000);
  if (lockedAt < staleThreshold) {
    await releaseLock();
    return { locked: false, locked_by: null, locked_at: null, section_key: null };
  }

  return {
    locked: true,
    locked_by: row.locked_by,
    locked_at: row.locked_at,
    section_key: row.section_key,
  };
}
