// User-facing feedback submission endpoint.
// Body: { section_key, page, raw_feedback, submitted_by? }
// Calls the router LLM, inserts into ai_insight_feedback, returns the id +
// the routed prompt key.

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';
import { routeFeedback } from '@/lib/ai-insight/feedback-llm';
import { SECTION_COMPONENTS } from '@/lib/ai-insight/prompts';
import { FEEDBACK_MAX_WORDS, countWords } from '@/lib/ai-insight/word-count';
import type { SectionKey } from '@/lib/ai-insight/types';

export const dynamic = 'force-dynamic';

interface FeedbackBody {
  section_key?: string;
  page?: string;
  raw_feedback?: string;
  submitted_by?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FeedbackBody;
    const sectionKey = body.section_key;
    const page = body.page;
    const raw = body.raw_feedback?.trim();
    const submittedBy = body.submitted_by ?? null;

    if (!sectionKey || !(sectionKey in SECTION_COMPONENTS)) {
      return NextResponse.json(
        { error: 'Invalid or missing section_key' },
        { status: 400 },
      );
    }
    if (!page || !page.trim()) {
      return NextResponse.json({ error: 'page is required' }, { status: 400 });
    }
    if (!raw) {
      return NextResponse.json(
        { error: 'raw_feedback is required' },
        { status: 400 },
      );
    }
    if (countWords(raw) > FEEDBACK_MAX_WORDS) {
      return NextResponse.json(
        { error: `Feedback exceeds ${FEEDBACK_MAX_WORDS} words.` },
        { status: 400 },
      );
    }

    const routed = await routeFeedback({
      section_key: sectionKey as SectionKey,
      page,
      raw_feedback: raw,
    });

    // No rewrite step — store raw feedback verbatim in both columns. The
    // compact_feedback column is preserved for back-compat (read by the
    // surgical-editor preview route); future cleanup may drop it.
    const pool = getPool();
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO ai_insight_feedback
         (section_key, page, raw_feedback, compact_feedback,
          target_prompt_key, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        sectionKey,
        page,
        raw,
        raw,
        routed.target_prompt_key,
        submittedBy,
      ],
    );

    return NextResponse.json({
      ok: true,
      id: rows[0].id,
      target_prompt_key: routed.target_prompt_key,
    });
  } catch (err) {
    console.error('ai-insight/feedback POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
