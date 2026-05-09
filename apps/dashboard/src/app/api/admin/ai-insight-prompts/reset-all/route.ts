// Resets every prompt to its factory default in a single transaction.

import { NextRequest, NextResponse } from 'next/server';
import { resetAllPrompts } from '@/lib/ai-insight/prompt-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { updatedBy?: string };
    const result = await resetAllPrompts(body.updatedBy ?? null);
    return NextResponse.json({ ok: true, count: result.count });
  } catch (err) {
    console.error('ai-insight-prompts reset-all error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
