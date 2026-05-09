// Admin: apply a previewed surgical edit.
// In one transaction: rotate history (previous_text_2 ← previous_text,
// previous_text ← prompt_text, prompt_text ← proposed), then delete the
// feedback row. Cache is invalidated so the next analysis sees the new text.

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';
import { invalidateCache } from '@/lib/ai-insight/prompt-loader';

export const dynamic = 'force-dynamic';

interface ApplyBody {
  proposedText?: string;
  updatedBy?: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const numericId = Number.parseInt(id, 10);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as ApplyBody;
    const proposedText = body.proposedText;
    if (typeof proposedText !== 'string' || !proposedText.trim()) {
      return NextResponse.json({ error: 'proposedText is required' }, { status: 400 });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the feedback row first so concurrent apply/discard can't race.
      const feedback = await client.query<{
        id: number;
        target_prompt_key: string;
      }>(
        `SELECT id, target_prompt_key
           FROM ai_insight_feedback
          WHERE id = $1
          FOR UPDATE`,
        [numericId],
      );

      if (feedback.rowCount === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
      }

      const targetKey = feedback.rows[0].target_prompt_key;

      const updated = await client.query<{
        prompt_key: string;
        prompt_text: string;
        previous_text: string | null;
        previous_text_2: string | null;
        updated_at: Date;
      }>(
        `UPDATE ai_insight_prompts
            SET previous_text_2 = previous_text,
                previous_text   = prompt_text,
                prompt_text     = $2,
                updated_at      = NOW(),
                updated_by      = $3
          WHERE prompt_key = $1
          RETURNING prompt_key, prompt_text, previous_text, previous_text_2, updated_at`,
        [targetKey, proposedText, body.updatedBy ?? 'feedback-apply'],
      );

      if (updated.rowCount === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: `Target prompt no longer exists: ${targetKey}` },
          { status: 409 },
        );
      }

      await client.query(
        `DELETE FROM ai_insight_feedback WHERE id = $1`,
        [numericId],
      );

      await client.query('COMMIT');

      invalidateCache();

      const r = updated.rows[0];
      return NextResponse.json({
        ok: true,
        prompt: {
          promptKey: r.prompt_key,
          promptText: r.prompt_text,
          hasPrevious: r.previous_text != null,
          hasPrevious2: r.previous_text_2 != null,
          updatedAt: r.updated_at.toISOString(),
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ai-insight-feedback [id] apply POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
