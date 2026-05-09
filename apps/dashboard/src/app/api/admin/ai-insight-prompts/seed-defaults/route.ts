// Idempotent seed for the ai_insight_prompts table.
// POST inserts every default prompt; existing rows are preserved (ON CONFLICT DO NOTHING).
// Re-running is safe — it only fills gaps.

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';
import {
  DEFAULT_GLOBAL_SYSTEM,
  DEFAULT_SUMMARY_SYSTEM,
  DEFAULT_COMPONENT_PROMPTS,
  DEFAULT_FEEDBACK_ROUTER_SYSTEM,
  DEFAULT_SURGICAL_EDITOR_SYSTEM,
} from '@/lib/ai-insight/prompts-defaults';
import {
  SECTION_COMPONENTS,
  SECTION_NAMES,
  SECTION_PAGE,
} from '@/lib/ai-insight/prompts';
import { invalidateCache } from '@/lib/ai-insight/prompt-loader';

export const dynamic = 'force-dynamic';

interface SeedRow {
  prompt_key: string;
  prompt_text: string;
  category: 'system' | 'component';
  page: string | null;
  section_key: string | null;
  section_name: string | null;
  component_type: 'kpi' | 'chart' | 'table' | 'breakdown' | null;
  display_name: string;
  sort_order: number;
}

function buildSeedRows(): SeedRow[] {
  const rows: SeedRow[] = [
    {
      prompt_key: 'global_system',
      prompt_text: DEFAULT_GLOBAL_SYSTEM,
      category: 'system',
      page: null,
      section_key: null,
      section_name: null,
      component_type: null,
      display_name: 'Global System Prompt',
      sort_order: 0,
    },
    {
      prompt_key: 'summary_system',
      prompt_text: DEFAULT_SUMMARY_SYSTEM,
      category: 'system',
      page: null,
      section_key: null,
      section_name: null,
      component_type: null,
      display_name: 'Summary System Prompt',
      sort_order: 1,
    },
    {
      prompt_key: 'feedback_router_system',
      prompt_text: DEFAULT_FEEDBACK_ROUTER_SYSTEM,
      category: 'system',
      page: null,
      section_key: null,
      section_name: null,
      component_type: null,
      display_name: 'Feedback Router Prompt',
      sort_order: 2,
    },
    {
      prompt_key: 'surgical_editor_system',
      prompt_text: DEFAULT_SURGICAL_EDITOR_SYSTEM,
      category: 'system',
      page: null,
      section_key: null,
      section_name: null,
      component_type: null,
      display_name: 'Surgical Editor Prompt',
      sort_order: 3,
    },
  ];

  for (const sectionKey of Object.keys(SECTION_COMPONENTS) as Array<keyof typeof SECTION_COMPONENTS>) {
    const components = SECTION_COMPONENTS[sectionKey];
    components.forEach((comp, idx) => {
      const promptText = DEFAULT_COMPONENT_PROMPTS[comp.key];
      if (!promptText) {
        // Component is in the registry but has no prompt — should never happen
        // for shipped components. Skip rather than crash the seed.
        console.warn(`[seed-defaults] No prompt for component ${comp.key} — skipping`);
        return;
      }
      rows.push({
        prompt_key: comp.key,
        prompt_text: promptText,
        category: 'component',
        page: SECTION_PAGE[sectionKey],
        section_key: sectionKey,
        section_name: SECTION_NAMES[sectionKey],
        component_type: comp.type,
        display_name: comp.name,
        sort_order: idx,
      });
    });
  }

  return rows;
}

export async function POST() {
  try {
    const rows = buildSeedRows();
    const pool = getPool();

    let inserted = 0;
    for (const r of rows) {
      const result = await pool.query(
        `INSERT INTO ai_insight_prompts
           (prompt_key, prompt_text, category, page, section_key, section_name,
            component_type, display_name, sort_order, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'seed')
         ON CONFLICT (prompt_key) DO NOTHING`,
        [
          r.prompt_key,
          r.prompt_text,
          r.category,
          r.page,
          r.section_key,
          r.section_name,
          r.component_type,
          r.display_name,
          r.sort_order,
        ],
      );
      if (result.rowCount && result.rowCount > 0) inserted++;
    }

    invalidateCache();

    return NextResponse.json({
      ok: true,
      attempted: rows.length,
      inserted,
      preserved: rows.length - inserted,
    });
  } catch (err) {
    console.error('seed-defaults POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
