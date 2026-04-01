import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings, getSettingsV2, saveSettingsV2 } from '@/lib/payment/settings';
import type { Settings, SettingsV2 } from '@/lib/payment/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [v1, v2] = await Promise.all([getSettings(), getSettingsV2()]);
    return NextResponse.json({ ...v1, v2 });
  } catch (err) {
    console.error('settings GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // If body has a `v2` key, save V2 settings
    if (body.v2) {
      const result = await saveSettingsV2(body.v2 as SettingsV2);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    // Otherwise save V1 settings (backward compatible)
    const result = await saveSettings(body as Settings);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('settings POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
