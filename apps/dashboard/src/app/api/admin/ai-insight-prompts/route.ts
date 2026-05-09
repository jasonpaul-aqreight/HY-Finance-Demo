// Lists every prompt with its current text, factory default, a flag indicating
// whether it has been edited away from default, and the count of pending
// feedback rows targeting it.

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';
import { getAllPrompts } from '@/lib/ai-insight/prompt-loader';
import { getDefaultPromptText } from '@/lib/ai-insight/prompt-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await getAllPrompts();

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

    const prompts = rows.map((r) => {
      const defaultText = getDefaultPromptText(r.promptKey);
      return {
        ...r,
        defaultText,
        isModified: defaultText != null && defaultText !== r.promptText,
        feedbackCount: countMap.get(r.promptKey) ?? 0,
      };
    });
    return NextResponse.json({ prompts });
  } catch (err) {
    console.error('ai-insight-prompts GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
