// POST /api/test/seed-feedback
// Inserts a feedback row directly into the DB — bypasses LLM routing.
// ONLY available outside production. Used exclusively by Playwright E2E tests.

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

interface SeedBody {
  target_prompt_key: string;
  section_key: string;
  page: string;
  raw_feedback: string;
  submitted_by?: string | null;
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as SeedBody;
    const { target_prompt_key, section_key, page, raw_feedback, submitted_by } = body;

    if (!target_prompt_key || !section_key || !page || !raw_feedback) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const pool = getPool();
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO ai_insight_feedback
         (section_key, page, raw_feedback, compact_feedback, target_prompt_key, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [section_key, page, raw_feedback, raw_feedback, target_prompt_key, submitted_by ?? null],
    );

    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (err) {
    console.error('test/seed-feedback POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
