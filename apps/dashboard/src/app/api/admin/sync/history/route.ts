import { NextResponse } from 'next/server';

const SYNC_URL = process.env.SYNC_SERVICE_URL ?? 'http://localhost:4000';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${SYNC_URL}/api/sync/history`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('sync history proxy error:', err);
    return NextResponse.json(
      { error: 'Sync service unreachable' },
      { status: 502 }
    );
  }
}
