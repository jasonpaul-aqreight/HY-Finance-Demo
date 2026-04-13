import { getLockStatus } from '@/lib/ai-insight/lock';

export async function GET() {
  const status = await getLockStatus();
  return Response.json(status);
}
