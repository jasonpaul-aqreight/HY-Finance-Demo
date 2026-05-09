// Resets a single prompt to its factory default.

import { NextRequest, NextResponse } from 'next/server';
import { resetPrompt } from '@/lib/ai-insight/prompt-store';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ prompt_key: string }> },
) {
  try {
    const { prompt_key } = await params;
    const body = (await req.json().catch(() => ({}))) as { updatedBy?: string };
    const result = await resetPrompt(prompt_key, body.updatedBy ?? null);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, prompt: result.prompt });
  } catch (err) {
    console.error('ai-insight-prompts [key] reset error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
