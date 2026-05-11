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
      prompt_key: 'component_analysis',
      prompt_text: DEFAULT_GLOBAL_SYSTEM,
      category: 'system',
      page: 'finance',
      section_key: null,
      section_name: null,
      component_type: null,
      display_name: 'Component Analysis',
      sort_order: 0,
    },
    {
      prompt_key: 'summary_analysis',
      prompt_text: DEFAULT_SUMMARY_SYSTEM,
      category: 'system',
      page: 'finance',
      section_key: null,
      section_name: null,
      component_type: null,
      display_name: 'Summary Analysis',
      sort_order: 1,
    },
    {
      prompt_key: 'hr_component_analysis',
      prompt_text: '',
      category: 'system',
      page: 'hr',
      section_key: null,
      section_name: null,
      component_type: null,
      display_name: 'Component Analysis',
      sort_order: 2,
    },
    {
      prompt_key: 'hr_summary_analysis',
      prompt_text: '',
      category: 'system',
      page: 'hr',
      section_key: null,
      section_name: null,
      component_type: null,
      display_name: 'Summary Analysis',
      sort_order: 3,
    },
    {
      prompt_key: 'feedback_router',
      prompt_text: DEFAULT_FEEDBACK_ROUTER_SYSTEM,
      category: 'system',
      page: null,
      section_key: null,
      section_name: null,
      component_type: null,
      display_name: 'Feedback Router',
      sort_order: 4,
    },
    {
      prompt_key: 'surgical_editor',
      prompt_text: DEFAULT_SURGICAL_EDITOR_SYSTEM,
      category: 'system',
      page: null,
      section_key: null,
      section_name: null,
      component_type: null,
      display_name: 'Surgical Editor',
      sort_order: 5,
    },
  ];

  for (const sectionKey of Object.keys(SECTION_COMPONENTS) as Array<keyof typeof SECTION_COMPONENTS>) {
    // Guidance row — sort_order 0 so it sits above the components in the admin
    // sidebar tree. Stored under DB category `section_guidance` (the column
    // value stays for back-compat); the user-facing label is "Guidance".
    // Guidance rows are always seeded, even when the default body is blank.
    // Finance now intentionally ships blank Guidance prompts; feedback can fill
    // them later without losing the tree entry.
    const guidanceText = DEFAULT_SECTION_GUIDANCE[sectionKey];
    rows.push({
      prompt_key: sectionGuidanceKey(sectionKey),
      prompt_text: guidanceText ?? '',
      category: 'section_guidance',
      page: SECTION_PAGE[sectionKey],
      section_key: sectionKey,
      section_name: SECTION_NAMES[sectionKey],
      component_type: null,
      display_name: `${SECTION_NAMES[sectionKey]} — Guidance`,
      sort_order: 0,
    });

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

    // Ensure every prompt has a Default version + selected_version_id pointing
    // at it. This catches both newly-inserted prompts (no version yet) and any
    // legacy gap. Idempotent: NOT EXISTS skips prompts that already have a Default.
    await pool.query(`
      INSERT INTO ai_insight_prompt_versions
        (prompt_key, version_label, is_default, prompt_text, created_by)
      SELECT p.prompt_key, 'Default', TRUE, p.prompt_text, 'seed'
        FROM ai_insight_prompts p
       WHERE NOT EXISTS (
         SELECT 1 FROM ai_insight_prompt_versions v
         WHERE v.prompt_key = p.prompt_key AND v.is_default = TRUE
       )
    `);
    if (force === 'all' || force === 'seed') {
      for (const r of rows) {
        await pool.query(
          `UPDATE ai_insight_prompt_versions
              SET prompt_text = $2
            WHERE prompt_key = $1
              AND is_default = TRUE`,
          [r.prompt_key, r.prompt_text],
        );
      }
    }
    await pool.query(`
      UPDATE ai_insight_prompts p
         SET selected_version_id = v.id
        FROM ai_insight_prompt_versions v
       WHERE v.prompt_key = p.prompt_key
         AND v.is_default = TRUE
         AND p.selected_version_id IS NULL
    `);

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
