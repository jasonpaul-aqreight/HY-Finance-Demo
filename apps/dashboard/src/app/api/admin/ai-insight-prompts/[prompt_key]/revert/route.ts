// Reverts a single prompt to its previous or previous-2 snapshot.
// Rotation matches the manual-save / reset / apply paths so the revert is
// itself reversible (the value being replaced moves into previous_text).

import { NextRequest, NextResponse } from 'next/server';
import { revertPrompt } from '@/lib/ai-insight/prompt-store';

export const dynamic = 'force-dynamic';

interface RevertBody {
  to?: 'previous' | 'previous_2';
  updatedBy?: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ prompt_key: string }> },
) {
  try {
    const { prompt_key } = await params;
    const body = (await req.json().catch(() => ({}))) as RevertBody;
    if (body.to !== 'previous' && body.to !== 'previous_2') {
      return NextResponse.json(
        { error: 'to must be "previous" or "previous_2"' },
        { status: 400 },
      );
    }
    const result = await revertPrompt(prompt_key, body.to, body.updatedBy ?? 'admin-revert');
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, prompt: result.prompt });
  } catch (err) {
    console.error('ai-insight-prompts [key] revert POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
