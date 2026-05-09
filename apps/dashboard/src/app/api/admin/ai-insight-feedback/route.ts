// Admin: list pending feedback rows.
// Optional ?prompt_key=… filters to a single prompt.

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

interface FeedbackRow {
  id: number;
  section_key: string;
  page: string;
  raw_feedback: string;
  compact_feedback: string;
  target_prompt_key: string;
  submitted_by: string | null;
  submitted_at: Date;
}

export async function GET(req: NextRequest) {
  try {
    const promptKey = req.nextUrl.searchParams.get('prompt_key');
    const pool = getPool();

    const params: string[] = [];
    let where = '';
    if (promptKey) {
      where = 'WHERE target_prompt_key = $1';
      params.push(promptKey);
    }

    const { rows } = await pool.query<FeedbackRow>(
      `SELECT id, section_key, page, raw_feedback, compact_feedback,
              target_prompt_key, submitted_by, submitted_at
         FROM ai_insight_feedback
         ${where}
         ORDER BY submitted_at DESC`,
      params,
    );

    const feedback = rows.map((r) => ({
      id: r.id,
      sectionKey: r.section_key,
      page: r.page,
      rawFeedback: r.raw_feedback,
      compactFeedback: r.compact_feedback,
      targetPromptKey: r.target_prompt_key,
      submittedBy: r.submitted_by,
      submittedAt: r.submitted_at.toISOString(),
    }));

    return NextResponse.json({ feedback });
  } catch (err) {
    console.error('ai-insight-feedback GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
