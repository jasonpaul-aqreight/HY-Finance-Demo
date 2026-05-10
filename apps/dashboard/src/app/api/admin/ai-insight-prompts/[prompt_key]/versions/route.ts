// GET /api/admin/ai-insight-prompts/[prompt_key]/versions
// Returns the list of versions for a prompt, Default-first then created_at DESC.
// Body text is intentionally NOT returned — admin UI shows the selected
// version's body via the prompt_text cache; clicking a card calls /select.

import { NextRequest, NextResponse } from 'next/server';
import { listVersions } from '@/lib/ai-insight/prompt-store';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ prompt_key: string }> },
) {
  try {
    const { prompt_key } = await params;
    const versions = await listVersions(prompt_key);
    if (versions.length === 0) {
      return NextResponse.json({ error: `Unknown prompt key: ${prompt_key}` }, { status: 404 });
    }
    return NextResponse.json({ versions });
  } catch (err) {
    console.error('ai-insight-prompts versions GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
