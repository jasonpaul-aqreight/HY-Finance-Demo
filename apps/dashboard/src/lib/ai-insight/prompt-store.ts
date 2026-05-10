// Write helpers for ai_insight_prompts. Every mutation invalidates the
// prompt-loader cache so the next analysis sees fresh prompt text.
//
// Reads should go through prompt-loader.ts (cached). This module only
// exposes the surface needed by admin API routes.
//
// Phase 2 redesign: 2-slot history is gone. Versions live in
// ai_insight_prompt_versions. ai_insight_prompts.prompt_text is a denormalised
// cache of the selected version's body — runtime keeps a single-row read.

import { getPool } from '../postgres';
import {
  DEFAULT_GLOBAL_SYSTEM,
  DEFAULT_SUMMARY_SYSTEM,
  DEFAULT_COMPONENT_PROMPTS,
  DEFAULT_FEEDBACK_ROUTER_SYSTEM,
  DEFAULT_SURGICAL_EDITOR_SYSTEM,
  DEFAULT_SECTION_GUIDANCE,
} from './prompts-defaults';
import { invalidateCache } from './prompt-loader';

// Static cap: 1 Default + 5 feedback-derived versions per prompt.
export const VERSION_CAP = 6;
export const VERSION_CAP_REACHED = 'VERSION_CAP_REACHED';

export function getDefaultPromptText(promptKey: string): string | null {
  if (promptKey === 'global_system') return DEFAULT_GLOBAL_SYSTEM;
  if (promptKey === 'summary_system') return DEFAULT_SUMMARY_SYSTEM;
  if (promptKey === 'feedback_router_system') return DEFAULT_FEEDBACK_ROUTER_SYSTEM;
  if (promptKey === 'surgical_editor_system') return DEFAULT_SURGICAL_EDITOR_SYSTEM;
  // Section Guidance keys end in `_guidance`; strip the suffix to get the
  // section_key used as the DEFAULT_SECTION_GUIDANCE map key.
  if (promptKey.endsWith('_guidance')) {
    const sectionKey = promptKey.slice(0, -'_guidance'.length);
    return DEFAULT_SECTION_GUIDANCE[sectionKey] ?? null;
  }
  return DEFAULT_COMPONENT_PROMPTS[promptKey] ?? null;
}

// ─── Version row view (admin UI shape) ──────────────────────────────────────

export interface VersionRowView {
  id: number;
  label: string;
  isDefault: boolean;
  isSelected: boolean;
  createdAt: string;
  createdBy: string | null;
}

interface VersionDbRow {
  id: number;
  prompt_key: string;
  version_label: string;
  is_default: boolean;
  prompt_text: string;
  created_at: Date;
  created_by: string | null;
  source_feedback_id: number | null;
}

function toView(row: VersionDbRow, selectedVersionId: number | null): VersionRowView {
  return {
    id: row.id,
    label: row.version_label,
    isDefault: row.is_default,
    isSelected: selectedVersionId === row.id,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
  };
}

// ─── Read: list versions ────────────────────────────────────────────────────

// Returns versions sorted Default-first, then created_at DESC. Includes the
// `isSelected` flag for each row so the UI can highlight the active card.
export async function listVersions(promptKey: string): Promise<VersionRowView[]> {
  const pool = getPool();
  const sel = await pool.query<{ selected_version_id: number | null }>(
    `SELECT selected_version_id FROM ai_insight_prompts WHERE prompt_key = $1`,
    [promptKey],
  );
  if (sel.rowCount === 0) return [];
  const selectedVersionId = sel.rows[0].selected_version_id;

  const { rows } = await pool.query<VersionDbRow>(
    `SELECT id, prompt_key, version_label, is_default, prompt_text,
            created_at, created_by, source_feedback_id
       FROM ai_insight_prompt_versions
      WHERE prompt_key = $1
      ORDER BY is_default DESC, created_at DESC`,
    [promptKey],
  );
  return rows.map((r) => toView(r, selectedVersionId));
}

// ─── Write: insert version + select + cache through ─────────────────────────

export interface InsertVersionInput {
  promptKey: string;
  promptText: string;
  createdBy: string | null;
  sourceFeedbackId?: number | null;
  versionLabel?: string;
}

export interface InsertVersionResult {
  versionId: number;
  promptText: string;
  versionLabel: string;
}

// Inserts a new version row, updates selected_version_id, writes prompt_text
// cache — all in one transaction. Throws VERSION_CAP_REACHED if the prompt
// already has VERSION_CAP versions. Caller must catch and translate.
//
// versionLabel defaults to `${createdBy} · ${formatted date}` per Mary's
// label format. UTC formatting kept simple — UI can re-format later if needed.
export async function insertVersionAndSelect(
  input: InsertVersionInput,
): Promise<InsertVersionResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the prompt row so concurrent applies can't both pass the cap check.
    const promptCheck = await client.query<{ prompt_key: string }>(
      `SELECT prompt_key FROM ai_insight_prompts WHERE prompt_key = $1 FOR UPDATE`,
      [input.promptKey],
    );
    if (promptCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      throw new Error(`Unknown prompt key: ${input.promptKey}`);
    }

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ai_insight_prompt_versions WHERE prompt_key = $1`,
      [input.promptKey],
    );
    const count = Number.parseInt(countResult.rows[0].count, 10) || 0;
    if (count >= VERSION_CAP) {
      await client.query('ROLLBACK');
      throw new Error(VERSION_CAP_REACHED);
    }

    const label = input.versionLabel ?? buildVersionLabel(input.createdBy);

    const inserted = await client.query<{ id: number; version_label: string }>(
      `INSERT INTO ai_insight_prompt_versions
         (prompt_key, version_label, is_default, prompt_text, created_by, source_feedback_id)
       VALUES ($1, $2, FALSE, $3, $4, $5)
       RETURNING id, version_label`,
      [
        input.promptKey,
        label,
        input.promptText,
        input.createdBy,
        input.sourceFeedbackId ?? null,
      ],
    );
    const versionId = inserted.rows[0].id;

    await client.query(
      `UPDATE ai_insight_prompts
          SET selected_version_id = $2,
              prompt_text         = $3,
              updated_at          = NOW(),
              updated_by          = $4
        WHERE prompt_key = $1`,
      [input.promptKey, versionId, input.promptText, input.createdBy],
    );

    await client.query('COMMIT');
    invalidateCache();

    return {
      versionId,
      promptText: input.promptText,
      versionLabel: inserted.rows[0].version_label,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Write: select an existing version ──────────────────────────────────────

export interface SelectVersionInput {
  promptKey: string;
  versionId: number;
}

export async function selectVersion(input: SelectVersionInput): Promise<{ ok: boolean; error?: string }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const v = await client.query<{ prompt_text: string; prompt_key: string }>(
      `SELECT prompt_text, prompt_key
         FROM ai_insight_prompt_versions
        WHERE id = $1 AND prompt_key = $2
        FOR UPDATE`,
      [input.versionId, input.promptKey],
    );
    if (v.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: `Version ${input.versionId} not found for ${input.promptKey}` };
    }

    await client.query(
      `UPDATE ai_insight_prompts
          SET selected_version_id = $2,
              prompt_text         = $3,
              updated_at          = NOW()
        WHERE prompt_key = $1`,
      [input.promptKey, input.versionId, v.rows[0].prompt_text],
    );

    await client.query('COMMIT');
    invalidateCache();
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Write: delete a non-default version ────────────────────────────────────

export interface DeleteVersionInput {
  promptKey: string;
  versionId: number;
}

export interface DeleteVersionResult {
  ok: boolean;
  error?: string;
  // When the deleted version was selected, this is the version that took its
  // place (next-newer in created_at order, falling back to Default).
  newSelectedVersionId?: number;
}

export async function deleteVersion(input: DeleteVersionInput): Promise<DeleteVersionResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const target = await client.query<{
      id: number;
      is_default: boolean;
      created_at: Date;
    }>(
      `SELECT id, is_default, created_at
         FROM ai_insight_prompt_versions
        WHERE id = $1 AND prompt_key = $2
        FOR UPDATE`,
      [input.versionId, input.promptKey],
    );
    if (target.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: `Version ${input.versionId} not found for ${input.promptKey}` };
    }
    if (target.rows[0].is_default) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Cannot delete the Default version.' };
    }

    const promptRow = await client.query<{ selected_version_id: number | null }>(
      `SELECT selected_version_id FROM ai_insight_prompts WHERE prompt_key = $1 FOR UPDATE`,
      [input.promptKey],
    );
    const wasSelected = promptRow.rows[0]?.selected_version_id === input.versionId;

    let newSelectedVersionId: number | undefined;
    if (wasSelected) {
      // Pick fallback: next-newer non-default, else Default. Use the deleted
      // row's created_at as the boundary so we resolve symmetrically whether
      // it was newest, oldest, or middle.
      const fallback = await client.query<{ id: number; prompt_text: string }>(
        `SELECT id, prompt_text
           FROM ai_insight_prompt_versions
          WHERE prompt_key = $1
            AND id <> $2
          ORDER BY
            CASE WHEN created_at > $3 THEN 0 ELSE 1 END,
            CASE WHEN created_at > $3 THEN created_at END ASC,
            CASE WHEN created_at <= $3 THEN created_at END DESC,
            is_default DESC
          LIMIT 1`,
        [input.promptKey, input.versionId, target.rows[0].created_at],
      );
      if (fallback.rowCount === 0) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'No fallback version available.' };
      }
      newSelectedVersionId = fallback.rows[0].id;
      await client.query(
        `UPDATE ai_insight_prompts
            SET selected_version_id = $2,
                prompt_text         = $3,
                updated_at          = NOW()
          WHERE prompt_key = $1`,
        [input.promptKey, newSelectedVersionId, fallback.rows[0].prompt_text],
      );
    }

    await client.query(
      `DELETE FROM ai_insight_prompt_versions WHERE id = $1`,
      [input.versionId],
    );

    await client.query('COMMIT');
    invalidateCache();
    return { ok: true, newSelectedVersionId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildVersionLabel(createdBy: string | null): string {
  // Format: "${created_by} · May 10, 10:53 AM" — UTC time, simple Intl format.
  // The UI is free to re-render in the user's locale; we just need a stable
  // human-readable label for fallback display.
  const who = createdBy && createdBy.trim() ? createdBy : 'system';
  const now = new Date();
  const date = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${who} · ${date}`;
}

// Convenience: read the currently-selected version id for a prompt.
export async function getSelectedVersionId(promptKey: string): Promise<number | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ selected_version_id: number | null }>(
    `SELECT selected_version_id FROM ai_insight_prompts WHERE prompt_key = $1`,
    [promptKey],
  );
  return rows[0]?.selected_version_id ?? null;
}
