import { NextRequest } from 'next/server';
import { getRenderedComponentInfo } from '@/lib/ai-insight/component-info-renderer';
import { getComponentInsight } from '@/lib/ai-insight/storage';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ section_key: string; component_key: string }> },
) {
  const { section_key, component_key } = await params;
  const [insight, componentInfo] = await Promise.all([
    getComponentInsight(section_key, component_key),
    getRenderedComponentInfo(component_key),
  ]);

  if (!insight) {
    return Response.json({ exists: false, componentInfo });
  }

  return Response.json({
    exists: true,
    componentInfo,
    ...insight,
  });
}
