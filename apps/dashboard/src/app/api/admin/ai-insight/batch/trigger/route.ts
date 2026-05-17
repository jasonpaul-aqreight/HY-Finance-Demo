import { NextResponse } from 'next/server';
import { BATCH_SECTIONS } from '@/lib/ai-insight/batch-scope';
import { getLatestBatchRun, isBatchRunStale } from '@/lib/ai-insight/batch-store';
import { isInsightBatchInProcess, runInsightBatch } from '@/lib/ai-insight/batch-runner';

export const dynamic = 'force-dynamic';

function isBatchAdmin(req: Request) {
  return req.headers.get('x-user-role') === 'admin';
}

export async function POST(req: Request) {
  if (!isBatchAdmin(req)) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  try {
    if (isInsightBatchInProcess()) {
      return NextResponse.json({ error: 'Batch already running' }, { status: 409 });
    }

    const latest = await getLatestBatchRun();
    if (latest?.status === 'running' && !isBatchRunStale(latest)) {
      return NextResponse.json({ error: 'Batch already running' }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const triggeredBy = typeof body?.triggeredBy === 'string' && body.triggeredBy.trim()
      ? body.triggeredBy.trim()
      : req.headers.get('x-user-name') ?? 'admin';

    runInsightBatch(triggeredBy).catch((err) => {
      console.error('AI Insight batch failed:', err);
    });

    return NextResponse.json({
      started: true,
      sections_total: BATCH_SECTIONS.length,
    });
  } catch (err) {
    console.error('ai-insight batch trigger error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
