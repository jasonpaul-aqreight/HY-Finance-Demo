// Idempotent seed for the ai_insight_prompts table.
// POST inserts every default prompt; existing rows are preserved (ON CONFLICT DO NOTHING).
// Re-running is safe — it only fills gaps.
//
// Force-refresh: POST ?force=seed overwrites prompt_text + display_name on rows
// whose updated_by = 'seed' (i.e. never manually edited). Admin customisations
// are preserved. POST ?force=all overwrites every row regardless — use only
// when you intentionally want to discard admin edits.

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';
import {
  DEFAULT_GLOBAL_SYSTEM,
  DEFAULT_SUMMARY_SYSTEM,
  DEFAULT_COMPONENT_PROMPTS,
  DEFAULT_FEEDBACK_ROUTER_SYSTEM,
  DEFAULT_SURGICAL_EDITOR_SYSTEM,
  DEFAULT_SECTION_GUIDANCE,
} from '@/lib/ai-insight/prompts-defaults';
import {
  SECTION_COMPONENTS,
  SECTION_NAMES,
  SECTION_PAGE,
} from '@/lib/ai-insight/prompts';
import { invalidateCache, sectionGuidanceKey } from '@/lib/ai-insight/prompt-loader';

export const dynamic = 'force-dynamic';

interface SeedRow {
  prompt_key: string;
  prompt_text: string;
  category: 'system' | 'component' | 'section_guidance';
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
    // Guidance row — sort_order 0 so it sits above the components in the admin
    // sidebar tree. Stored under DB category `section_guidance` (the column
    // value stays for back-compat); the user-facing label is "Guidance".
    const guidanceText = DEFAULT_SECTION_GUIDANCE[sectionKey];
    if (guidanceText) {
      rows.push({
        prompt_key: sectionGuidanceKey(sectionKey),
        prompt_text: guidanceText,
        category: 'section_guidance',
        page: SECTION_PAGE[sectionKey],
        section_key: sectionKey,
        section_name: SECTION_NAMES[sectionKey],
        component_type: null,
        display_name: `${SECTION_NAMES[sectionKey]} — Guidance`,
        sort_order: 0,
      });
    }

    const components = SECTION_COMPONENTS[sectionKey];
    components.forEach((comp, idx) => {
      const promptText = DEFAULT_COMPONENT_PROMPTS[comp.key];
      if (!promptText) {
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
        // +1 so components sort below the Guidance row (sort_order 0).
        sort_order: idx + 1,
      });
    });
  }

  return rows;
}

export async function POST(req: NextRequest) {
  try {
    const force = req.nextUrl.searchParams.get('force');
    const rows = buildSeedRows();
    const pool = getPool();

    // Conflict clause varies by force mode:
    //   default       — DO NOTHING (preserve every existing row)
    //   force=seed    — DO UPDATE WHERE updated_by = 'seed' (refresh seed-only rows)
    //   force=all     — DO UPDATE unconditionally (discards admin edits)
    const conflictClause =
      force === 'all'
        ? `DO UPDATE SET
             prompt_text = EXCLUDED.prompt_text,
             display_name = EXCLUDED.display_name,
             sort_order = EXCLUDED.sort_order,
             updated_at = NOW(),
             updated_by = 'seed'`
        : force === 'seed'
          ? `DO UPDATE SET
               prompt_text = EXCLUDED.prompt_text,
               display_name = EXCLUDED.display_name,
               sort_order = EXCLUDED.sort_order,
               updated_at = NOW(),
               updated_by = 'seed'
             WHERE ai_insight_prompts.updated_by = 'seed'`
          : `DO NOTHING`;

    let touched = 0;
    for (const r of rows) {
      const result = await pool.query(
        `INSERT INTO ai_insight_prompts
           (prompt_key, prompt_text, category, page, section_key, section_name,
            component_type, display_name, sort_order, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'seed')
         ON CONFLICT (prompt_key) ${conflictClause}`,
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
      if (result.rowCount && result.rowCount > 0) touched++;
    }

    invalidateCache();

    return NextResponse.json({
      ok: true,
      mode: force ?? 'preserve',
      attempted: rows.length,
      touched,
      preserved: rows.length - touched,
    });
  } catch (err) {
    console.error('seed-defaults POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
