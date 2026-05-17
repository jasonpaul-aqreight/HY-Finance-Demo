import { NextResponse } from 'next/server';
import { BATCH_SECTIONS } from '@/lib/ai-insight/batch-scope';
import {
  getLatestBatchRun,
  isBatchRunStale,
  markStaleRunningBatches,
} from '@/lib/ai-insight/batch-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let latest = await getLatestBatchRun();

    if (latest?.status === 'running' && isBatchRunStale(latest)) {
      await markStaleRunningBatches();
      latest = await getLatestBatchRun();
    }

    return NextResponse.json(latest ?? {
      status: 'idle',
      sections_total: BATCH_SECTIONS.length,
      sections_completed: 0,
      sections_failed: 0,
      section_errors: [],
    });
  } catch (err) {
    console.error('ai-insight batch status error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
