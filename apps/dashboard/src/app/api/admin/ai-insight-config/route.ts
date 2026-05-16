import { NextResponse } from 'next/server';
import { buildPromptConfigRows } from '@/lib/ai-insight/prompt-config';
import { invalidateThresholdCache } from '@/lib/ai-insight/threshold-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    invalidateThresholdCache();
    const prompts = await buildPromptConfigRows();
    return NextResponse.json({
      prompts,
      thresholdGroups: prompts.flatMap((prompt) => prompt.thresholdGroups),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('ai-insight-config GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
