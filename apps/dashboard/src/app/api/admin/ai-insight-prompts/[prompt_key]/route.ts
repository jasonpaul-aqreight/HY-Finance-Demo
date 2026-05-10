// GET single prompt — returns the prompt row plus the selected version's id/label.
// Manual save (PUT), reset, and revert are gone in Phase 2; edits flow only
// through the feedback Apply path.

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';
import { queryAllPromptsFromDB } from '@/lib/ai-insight/prompt-loader';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ prompt_key: string }> },
) {
  try {
    const { prompt_key } = await params;
    const rows = await queryAllPromptsFromDB();
    const prompt = rows.find((r) => r.promptKey === prompt_key);
    if (!prompt) {
      return NextResponse.json({ error: `Unknown prompt key: ${prompt_key}` }, { status: 404 });
    }

    let selectedVersionLabel: string | null = null;
    if (prompt.selectedVersionId != null) {
      const pool = getPool();
      const { rows: vRows } = await pool.query<{ version_label: string }>(
        `SELECT version_label FROM ai_insight_prompt_versions WHERE id = $1`,
        [prompt.selectedVersionId],
      );
      selectedVersionLabel = vRows[0]?.version_label ?? null;
    }

    return NextResponse.json({
      prompt: {
        ...prompt,
        selectedVersionLabel,
      },
    });
  } catch (err) {
    console.error('ai-insight-prompts [key] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
