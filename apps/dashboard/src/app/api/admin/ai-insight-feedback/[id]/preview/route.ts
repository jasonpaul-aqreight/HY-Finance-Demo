// Admin: preview a surgical edit for a pending feedback row.
// Loads the feedback + current prompt, asks the surgical editor LLM for a
// minimally-edited new version, and returns it WITHOUT writing to the DB.
// The admin then sees a diff modal and either confirms (POST .../apply)
// or cancels (no-op; the feedback row remains pending).

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';
import { proposeSurgicalEdit } from '@/lib/ai-insight/feedback-llm';

export const dynamic = 'force-dynamic';

interface FeedbackJoinRow {
  id: number;
  compact_feedback: string;
  raw_feedback: string;
  target_prompt_key: string;
  prompt_text: string;
  display_name: string;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const numericId = Number.parseInt(id, 10);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const pool = getPool();
    const { rows } = await pool.query<FeedbackJoinRow>(
      `SELECT f.id,
              f.compact_feedback,
              f.raw_feedback,
              f.target_prompt_key,
              p.prompt_text,
              p.display_name
         FROM ai_insight_feedback f
         JOIN ai_insight_prompts p ON p.prompt_key = f.target_prompt_key
        WHERE f.id = $1`,
      [numericId],
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    const row = rows[0];
    const result = await proposeSurgicalEdit({
      current_prompt_text: row.prompt_text,
      compact_feedback: row.compact_feedback,
      prompt_display_name: row.display_name,
    });

    return NextResponse.json({
      id: row.id,
      targetPromptKey: row.target_prompt_key,
      currentText: row.prompt_text,
      proposedText: result.proposed_text,
      changeSummary: result.change_summary,
    });
  } catch (err) {
    console.error('ai-insight-feedback [id] preview POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
