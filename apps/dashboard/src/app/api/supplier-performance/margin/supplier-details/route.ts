import { NextRequest, NextResponse } from 'next/server';
import { getSupplierDetails } from '@/lib/supplier-margin/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const creditorCode = req.nextUrl.searchParams.get('creditor_code');
    if (!creditorCode) {
      return NextResponse.json({ error: 'creditor_code is required' }, { status: 400 });
    }

    const data = await getSupplierDetails(creditorCode);
    if (!data) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('supplier-details error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
