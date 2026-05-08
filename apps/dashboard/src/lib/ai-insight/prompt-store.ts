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
} from './prompts-defaults';
import { invalidateCache, type PromptRow } from './prompt-loader';

const SUMMARY_DELIMITER_MARKERS = ['===INSIGHT===', '---DETAIL---', '===END==='] as const;

export interface UpdateResult {
  ok: boolean;
  error?: string;
  warnings?: string[];
}

export function getDefaultPromptText(promptKey: string): string | null {
  if (promptKey === 'global_system') return DEFAULT_GLOBAL_SYSTEM;
  if (promptKey === 'summary_system') return DEFAULT_SUMMARY_SYSTEM;
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

export async function updatePrompt(
  promptKey: string,
  promptText: string,
  updatedBy: string | null,
): Promise<UpdateResult> {
  const validation = validatePromptText(promptKey, promptText);
  if (!validation.ok) return validation;

  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE ai_insight_prompts
        SET prompt_text = $2,
            updated_at  = NOW(),
            updated_by  = $3
      WHERE prompt_key = $1`,
    [promptKey, promptText, updatedBy],
  );

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

  const pool = getPool();
  const { rows, rowCount } = await pool.query(
    `UPDATE ai_insight_prompts
        SET prompt_text = $2,
            updated_at  = NOW(),
            updated_by  = $3
      WHERE prompt_key = $1
      RETURNING prompt_key, prompt_text, category, page, section_key,
                section_name, component_type, display_name, sort_order,
                updated_at, updated_by`,
    [promptKey, defaultText, updatedBy],
  );

  if (rowCount === 0) {
    return { ok: false, error: `Prompt not found in DB: ${promptKey}. Has the seed endpoint been run?` };
  }

  invalidateCache();

  const r = rows[0];
  return {
    ok: true,
    prompt: {
      promptKey: r.prompt_key,
      promptText: r.prompt_text,
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
            SET prompt_text = $2,
                updated_at  = NOW(),
                updated_by  = $3
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
