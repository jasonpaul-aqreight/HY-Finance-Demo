// Write helpers for ai_insight_prompts. Every mutation invalidates the
// prompt-loader cache so the next analysis sees fresh prompt text.
//
// Reads should go through prompt-loader.ts (cached). This module only
// exposes the surface needed by admin API routes.

import { getPool } from '../postgres';
import {
  DEFAULT_GLOBAL_SYSTEM,
  DEFAULT_SUMMARY_SYSTEM,
  DEFAULT_COMPONENT_PROMPTS,
  DEFAULT_FEEDBACK_ROUTER_SYSTEM,
  DEFAULT_SURGICAL_EDITOR_SYSTEM,
  DEFAULT_SECTION_GUIDANCE,
} from './prompts-defaults';
import { invalidateCache, type PromptCategory, type PromptRow } from './prompt-loader';

const SUMMARY_DELIMITER_MARKERS = ['===INSIGHT===', '---DETAIL---', '===END==='] as const;

export interface UpdateResult {
  ok: boolean;
  error?: string;
  warnings?: string[];
}

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

function validatePromptText(promptKey: string, promptText: string): UpdateResult {
  if (!promptText || !promptText.trim()) {
    return { ok: false, error: 'Prompt text cannot be empty' };
  }

  const warnings: string[] = [];

  if (promptKey === 'summary_system') {
    const missing = SUMMARY_DELIMITER_MARKERS.filter((m) => !promptText.includes(m));
    if (missing.length > 0) {
      warnings.push(
        `Summary parser depends on these delimiters: ${missing.join(', ')}. ` +
        `Removing them will break section summaries until restored.`
      );
    }
  }

  return warnings.length ? { ok: true, warnings } : { ok: true };
}

// Shared write that rotates the two-step history in one statement.
// Used by every path that changes prompt_text (manual save, reset, surgical
// apply rotates inline in its own transaction, revert rotates explicitly).
// Per Phase-2 lessons: centralising rotation prevents silent corruption when
// any path forgets to rotate.
interface RotatedRow {
  prompt_key: string;
  prompt_text: string;
  previous_text: string | null;
  previous_text_2: string | null;
  category: PromptCategory;
  page: string | null;
  section_key: string | null;
  section_name: string | null;
  component_type: 'kpi' | 'chart' | 'table' | 'breakdown' | null;
  display_name: string;
  sort_order: number;
  updated_at: Date;
  updated_by: string | null;
}

async function rotateAndWrite(
  promptKey: string,
  newText: string,
  updatedBy: string | null,
): Promise<{ rowCount: number; row?: RotatedRow }> {
  const pool = getPool();
  const { rows, rowCount } = await pool.query<RotatedRow>(
    `UPDATE ai_insight_prompts
        SET previous_text_2 = previous_text,
            previous_text   = prompt_text,
            prompt_text     = $2,
            updated_at      = NOW(),
            updated_by      = $3
      WHERE prompt_key = $1
      RETURNING prompt_key, prompt_text, previous_text, previous_text_2,
                category, page, section_key, section_name, component_type,
                display_name, sort_order, updated_at, updated_by`,
    [promptKey, newText, updatedBy],
  );
  return { rowCount: rowCount ?? 0, row: rows[0] };
}

export async function updatePrompt(
  promptKey: string,
  promptText: string,
  updatedBy: string | null,
): Promise<UpdateResult> {
  const validation = validatePromptText(promptKey, promptText);
  if (!validation.ok) return validation;

  const { rowCount } = await rotateAndWrite(promptKey, promptText, updatedBy);

  if (rowCount === 0) {
    return { ok: false, error: `Unknown prompt key: ${promptKey}` };
  }

  invalidateCache();
  return validation; // carries warnings (if any)
}

export async function resetPrompt(
  promptKey: string,
  updatedBy: string | null,
): Promise<{ ok: boolean; prompt?: PromptRow; error?: string }> {
  const defaultText = getDefaultPromptText(promptKey);
  if (defaultText == null) {
    return { ok: false, error: `Unknown prompt key: ${promptKey}` };
  }

  const { rowCount, row: r } = await rotateAndWrite(promptKey, defaultText, updatedBy);

  if (rowCount === 0 || !r) {
    return { ok: false, error: `Prompt not found in DB: ${promptKey}. Has the seed endpoint been run?` };
  }

  invalidateCache();

  return {
    ok: true,
    prompt: {
      promptKey: r.prompt_key,
      promptText: r.prompt_text,
      previousText: r.previous_text,
      previousText2: r.previous_text_2,
      category: r.category,
      page: r.page,
      sectionKey: r.section_key,
      sectionName: r.section_name,
      componentType: r.component_type,
      displayName: r.display_name,
      sortOrder: r.sort_order,
      updatedAt: r.updated_at.toISOString(),
      updatedBy: r.updated_by,
    },
  };
}

// Revert restores either the previous or previous-2 snapshot into prompt_text,
// rotating the history slots so the action is itself reversible. Returns the
// new state of all three slots so the caller can refresh its UI.
export async function revertPrompt(
  promptKey: string,
  to: 'previous' | 'previous_2',
  updatedBy: string | null,
): Promise<{
  ok: boolean;
  error?: string;
  prompt?: {
    promptKey: string;
    promptText: string;
    hasPrevious: boolean;
    hasPrevious2: boolean;
    updatedAt: string;
  };
}> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query<{
      prompt_text: string;
      previous_text: string | null;
      previous_text_2: string | null;
    }>(
      `SELECT prompt_text, previous_text, previous_text_2
         FROM ai_insight_prompts
        WHERE prompt_key = $1
        FOR UPDATE`,
      [promptKey],
    );
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: `Unknown prompt key: ${promptKey}` };
    }
    const c = current.rows[0];
    const target = to === 'previous' ? c.previous_text : c.previous_text_2;
    if (target == null) {
      await client.query('ROLLBACK');
      return { ok: false, error: `No ${to} snapshot available for ${promptKey}` };
    }
    // Rotate identically to a normal write so the revert is itself reversible.
    const updated = await client.query<{
      prompt_key: string;
      prompt_text: string;
      previous_text: string | null;
      previous_text_2: string | null;
      updated_at: Date;
    }>(
      `UPDATE ai_insight_prompts
          SET previous_text_2 = previous_text,
              previous_text   = prompt_text,
              prompt_text     = $2,
              updated_at      = NOW(),
              updated_by      = $3
        WHERE prompt_key = $1
        RETURNING prompt_key, prompt_text, previous_text, previous_text_2, updated_at`,
      [promptKey, target, updatedBy],
    );
    await client.query('COMMIT');
    invalidateCache();
    const r = updated.rows[0];
    return {
      ok: true,
      prompt: {
        promptKey: r.prompt_key,
        promptText: r.prompt_text,
        hasPrevious: r.previous_text != null,
        hasPrevious2: r.previous_text_2 != null,
        updatedAt: r.updated_at.toISOString(),
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function resetAllPrompts(updatedBy: string | null): Promise<{ ok: boolean; count: number }> {
  const pool = getPool();
  const client = await pool.connect();
  let count = 0;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ prompt_key: string }>(
      `SELECT prompt_key FROM ai_insight_prompts`
    );
    for (const { prompt_key } of rows) {
      const defaultText = getDefaultPromptText(prompt_key);
      if (defaultText == null) continue; // orphan row (key removed from defaults) — skip
      await client.query(
        `UPDATE ai_insight_prompts
            SET previous_text_2 = previous_text,
                previous_text   = prompt_text,
                prompt_text     = $2,
                updated_at      = NOW(),
                updated_by      = $3
          WHERE prompt_key = $1`,
        [prompt_key, defaultText, updatedBy],
      );
      count++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  invalidateCache();
  return { ok: true, count };
}
