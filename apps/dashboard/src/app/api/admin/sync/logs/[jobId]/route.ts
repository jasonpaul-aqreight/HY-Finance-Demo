import { NextResponse } from 'next/server';

const SYNC_URL = process.env.SYNC_SERVICE_URL ?? 'http://localhost:4000';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  try {
    const res = await fetch(`${SYNC_URL}/api/sync/logs/${jobId}`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('sync logs proxy error:', err);
    return NextResponse.json(
      { error: 'Sync service unreachable' },
      { status: 502 }
    );
  }
}
