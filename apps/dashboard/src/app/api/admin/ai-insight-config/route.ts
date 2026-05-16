import { NextResponse } from 'next/server';
import { buildPromptConfigRows } from '@/lib/ai-insight/prompt-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({
      prompts: buildPromptConfigRows(),
      thresholdGroups: [],
    });
  } catch (err) {
    console.error('ai-insight-config GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
