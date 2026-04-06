import { NextRequest, NextResponse } from 'next/server';

const SYNC_URL = process.env.SYNC_SERVICE_URL ?? 'http://localhost:4000';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${SYNC_URL}/api/sync/schedule`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('sync schedule GET proxy error:', err);
    return NextResponse.json(
      { error: 'Sync service unreachable' },
      { status: 502 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${SYNC_URL}/api/sync/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('sync schedule PUT proxy error:', err);
    return NextResponse.json(
      { error: 'Sync service unreachable' },
      { status: 502 }
    );
  }
}
