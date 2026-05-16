import { NextResponse } from 'next/server';
import { buildPromptConfigRows } from '@/lib/ai-insight/prompt-config';
import {
  getThresholdGroups,
  saveThresholdValues,
} from '@/lib/ai-insight/threshold-config';

export const dynamic = 'force-dynamic';

// Sandbox mapping: local "admin" is the superadmin-equivalent write role.
function isThresholdAdmin(req: Request) {
  return req.headers.get('x-user-role') === 'admin';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const componentKey = searchParams.get('componentKey');
    if (!componentKey) {
      return NextResponse.json({ error: 'componentKey is required' }, { status: 400 });
    }

    const thresholdGroups = await getThresholdGroups(componentKey);
    return NextResponse.json({ componentKey, thresholdGroups });
  } catch (err) {
    console.error('ai-insight-thresholds GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    if (!isThresholdAdmin(req)) {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const componentKey = typeof body?.componentKey === 'string' ? body.componentKey : '';
    const values = body?.values;
    const updatedBy = typeof body?.updatedBy === 'string' ? body.updatedBy : 'Admin';

    if (!componentKey) {
      return NextResponse.json({ error: 'componentKey is required' }, { status: 400 });
    }
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return NextResponse.json({ error: 'values must be an object keyed by token' }, { status: 400 });
    }

    const result = await saveThresholdValues(componentKey, values as Record<string, unknown>, updatedBy);
    if (!result.ok) {
      return NextResponse.json({ error: 'Invalid threshold values', details: result.errors }, { status: 400 });
    }

    const prompts = await buildPromptConfigRows();
    const prompt = prompts.find((candidate) => candidate.promptKey === componentKey) ?? null;

    return NextResponse.json({
      ok: true,
      componentKey,
      prompt,
      thresholdGroups: await getThresholdGroups(componentKey),
    });
  } catch (err) {
    console.error('ai-insight-thresholds PUT error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
