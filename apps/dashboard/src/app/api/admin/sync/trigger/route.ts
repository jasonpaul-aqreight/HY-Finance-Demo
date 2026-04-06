import { NextResponse } from 'next/server';

const SYNC_URL = process.env.SYNC_SERVICE_URL ?? 'http://localhost:4000';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${SYNC_URL}/api/sync/status`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('sync status proxy error:', err);
    return NextResponse.json(
      { error: 'Sync service unreachable' },
      { status: 502 }
    );
  }
}

export async function POST() {
  try {
    const res = await fetch(`${SYNC_URL}/api/sync/trigger`, {
      method: 'POST',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('sync trigger proxy error:', err);
    return NextResponse.json(
      { error: 'Sync service unreachable' },
      { status: 502 }
    );
  }
}
