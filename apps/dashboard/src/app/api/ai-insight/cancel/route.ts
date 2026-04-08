import { NextRequest } from 'next/server';
import { releaseLock, getLockStatus } from '@/lib/ai-insight/lock';
import { activeControllers } from '../analyze/route';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { section_key } = body;

  const status = await getLockStatus();
  if (!status.locked) {
    return Response.json({ message: 'No analysis is currently running' });
  }

  // Abort the active controller for this section
  const controller = activeControllers.get(section_key ?? status.section_key ?? '');
  if (controller) {
    controller.abort();
  }

  await releaseLock();
  return Response.json({ message: 'Analysis cancelled' });
}
