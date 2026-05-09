// Single prompt — GET returns current + default + isModified; PUT updates text.

import { NextRequest, NextResponse } from 'next/server';
import { getAllPrompts } from '@/lib/ai-insight/prompt-loader';
import { getDefaultPromptText, updatePrompt } from '@/lib/ai-insight/prompt-store';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ prompt_key: string }> },
) {
  try {
    const { prompt_key } = await params;
    const rows = await getAllPrompts();
    const prompt = rows.find((r) => r.promptKey === prompt_key);
    if (!prompt) {
      return NextResponse.json({ error: `Unknown prompt key: ${prompt_key}` }, { status: 404 });
    }
    const defaultText = getDefaultPromptText(prompt_key);
    return NextResponse.json({
      prompt,
      defaultText,
      isModified: defaultText != null && defaultText !== prompt.promptText,
    });
  } catch (err) {
    console.error('ai-insight-prompts [key] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ prompt_key: string }> },
) {
  try {
    const { prompt_key } = await params;
    const body = (await req.json()) as { promptText?: string; updatedBy?: string };
    if (typeof body.promptText !== 'string') {
      return NextResponse.json({ error: 'promptText is required' }, { status: 400 });
    }

    const result = await updatePrompt(prompt_key, body.promptText, body.updatedBy ?? null);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, warnings: result.warnings });
  } catch (err) {
    console.error('ai-insight-prompts [key] PUT error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
