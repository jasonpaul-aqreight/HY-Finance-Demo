import { NextRequest } from 'next/server';
import { getComponentInsight } from '@/lib/ai-insight/storage';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ section_key: string; component_key: string }> },
) {
  const { section_key, component_key } = await params;
  const insight = await getComponentInsight(section_key, component_key);

  if (!insight) {
    return Response.json({ exists: false }, { status: 404 });
  }

  return Response.json({
    exists: true,
    ...insight,
  });
}
