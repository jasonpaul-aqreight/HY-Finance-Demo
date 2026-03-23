import { NextRequest, NextResponse } from 'next/server';
import { getReturnProducts } from '@/lib/return/queries-v2';
import type { ReturnProductDimension, ReturnProductMetric } from '@/lib/return/queries-v2';
import { defaultDateRange } from '@/lib/return/date-utils';

export const dynamic = 'force-dynamic';

const VALID_DIMENSIONS = new Set(['item', 'fruit', 'variant', 'country']);
const VALID_METRICS = new Set(['frequency', 'value']);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const defaults = defaultDateRange();
  const start = searchParams.get('start_date') ?? defaults.start;
  const end = searchParams.get('end_date') ?? defaults.end;
  const dimParam = searchParams.get('dimension') ?? 'item';
  const dimension: ReturnProductDimension = VALID_DIMENSIONS.has(dimParam)
    ? (dimParam as ReturnProductDimension)
    : 'item';
  const metricParam = searchParams.get('metric') ?? 'frequency';
  const metric: ReturnProductMetric = VALID_METRICS.has(metricParam)
    ? (metricParam as ReturnProductMetric)
    : 'frequency';

  const data = getReturnProducts(start, end, dimension, metric);
  return NextResponse.json(data);
}
