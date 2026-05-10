// POST /api/admin/ai-insight-prompts/[prompt_key]/versions/[id]/select
// Marks a version as selected and write-throughs its body to the prompt_text cache.

import { NextRequest, NextResponse } from 'next/server';
import { selectVersion, listVersions } from '@/lib/ai-insight/prompt-store';
import { getAllPrompts } from '@/lib/ai-insight/prompt-loader';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ prompt_key: string; id: string }> },
) {
  try {
    const { prompt_key, id } = await params;
    const versionId = Number.parseInt(id, 10);
    if (!Number.isFinite(versionId) || versionId <= 0) {
      return NextResponse.json({ error: 'Invalid version id' }, { status: 400 });
    }

    const result = await selectVersion({ promptKey: prompt_key, versionId });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    const versions = await listVersions(prompt_key);
    const allPrompts = await getAllPrompts();
    const prompt = allPrompts.find((p) => p.promptKey === prompt_key);

    return NextResponse.json({ ok: true, prompt, versions });
  } catch (err) {
    console.error('ai-insight-prompts version select POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
