import { NextResponse } from 'next/server';
import { getSuppliers, getItemGroups } from '@/lib/supplier-margin/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const suppliers = await getSuppliers();
    const itemGroups = await getItemGroups();
    return NextResponse.json({ suppliers, itemGroups });
  } catch (error) {
    console.error('Error fetching dimensions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dimensions' },
      { status: 500 },
    );
  }
}
