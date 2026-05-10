// Lists every prompt with the selected version's id/label and the count of
// pending feedback rows targeting it. defaultText / isModified are gone:
// "modified" is no longer a meaningful concept now that versions are first-class.

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';
import { queryAllPromptsFromDB } from '@/lib/ai-insight/prompt-loader';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await queryAllPromptsFromDB();

    const pool = getPool();
    const { rows: counts } = await pool.query<{ target_prompt_key: string; count: string }>(
      `SELECT target_prompt_key, COUNT(*)::text AS count
         FROM ai_insight_feedback
         GROUP BY target_prompt_key`,
    );
    const countMap = new Map<string, number>();
    for (const c of counts) {
      countMap.set(c.target_prompt_key, Number.parseInt(c.count, 10) || 0);
    }

    const { rows: versionLabels } = await pool.query<{ id: number; version_label: string }>(
      `SELECT id, version_label FROM ai_insight_prompt_versions`,
    );
    const labelMap = new Map<number, string>();
    for (const v of versionLabels) labelMap.set(v.id, v.version_label);

    const prompts = rows.map((r) => ({
      ...r,
      selectedVersionLabel: r.selectedVersionId != null ? labelMap.get(r.selectedVersionId) ?? null : null,
      feedbackCount: countMap.get(r.promptKey) ?? 0,
    }));
    return NextResponse.json({ prompts });
  } catch (err) {
    console.error('ai-insight-prompts GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
