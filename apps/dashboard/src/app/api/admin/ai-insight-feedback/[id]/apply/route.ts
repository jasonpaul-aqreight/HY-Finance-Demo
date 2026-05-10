// Admin: apply a previewed surgical edit.
// Inserts a new version row (and selects it) via prompt-store.insertVersionAndSelect,
// then deletes the feedback row. Cache invalidation happens inside the helper.

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';
import {
  insertVersionAndSelect,
  VERSION_CAP_REACHED,
} from '@/lib/ai-insight/prompt-store';

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
    const feedback = await pool.query<{ id: number; target_prompt_key: string }>(
      `SELECT id, target_prompt_key FROM ai_insight_feedback WHERE id = $1`,
      [numericId],
    );
    if (feedback.rowCount === 0) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }
    const targetKey = feedback.rows[0].target_prompt_key;

    let inserted;
    try {
      inserted = await insertVersionAndSelect({
        promptKey: targetKey,
        promptText: proposedText,
        createdBy: body.updatedBy ?? 'feedback-apply',
        sourceFeedbackId: numericId,
      });
    } catch (err) {
      if (err instanceof Error && err.message === VERSION_CAP_REACHED) {
        return NextResponse.json(
          {
            error: VERSION_CAP_REACHED,
            message:
              'The prompt version section is full. Please clear unwanted versions before proceeding with this action.',
          },
          { status: 400 },
        );
      }
      throw err;
    }

    // Feedback row delete happens after a successful version insert. Worst
    // case if this fails: the version is created but feedback lingers — admin
    // can discard manually. Acceptable trade-off vs holding a write txn open
    // across two helpers.
    await pool.query(`DELETE FROM ai_insight_feedback WHERE id = $1`, [numericId]);

    return NextResponse.json({
      ok: true,
      prompt: {
        promptKey: targetKey,
        promptText: inserted.promptText,
        selectedVersionId: inserted.versionId,
        selectedVersionLabel: inserted.versionLabel,
      },
    });
  } catch (err) {
    console.error('ai-insight-feedback [id] apply POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
