// DELETE /api/admin/ai-insight-prompts/[prompt_key]/versions/[id]
// Removes a non-default version. If it was the selected one, the next-newer
// version (or Default) takes over.

import { NextRequest, NextResponse } from 'next/server';
import { deleteVersion, listVersions } from '@/lib/ai-insight/prompt-store';
import { queryAllPromptsFromDB } from '@/lib/ai-insight/prompt-loader';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ prompt_key: string; id: string }> },
) {
  try {
    const { prompt_key, id } = await params;
    const versionId = Number.parseInt(id, 10);
    if (!Number.isFinite(versionId) || versionId <= 0) {
      return NextResponse.json({ error: 'Invalid version id' }, { status: 400 });
    }

    const result = await deleteVersion({ promptKey: prompt_key, versionId });
    if (!result.ok) {
      const status = result.error === 'Cannot delete the Default version.' ? 400 : 404;
      return NextResponse.json({ error: result.error }, { status });
    }

    const versions = await listVersions(prompt_key);
    const allPrompts = await queryAllPromptsFromDB();
    const prompt = allPrompts.find((p) => p.promptKey === prompt_key);

    return NextResponse.json({ ok: true, prompt, versions });
  } catch (err) {
    console.error('ai-insight-prompts version DELETE error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
