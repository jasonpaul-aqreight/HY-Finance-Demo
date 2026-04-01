'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProductCustomerMatrix } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { marginBgColor } from '@/lib/customer-margin/format';

interface Props {
  filters: MarginDashboardFilters;
}

export function ProductCustomerMatrix({ filters }: Props) {
  const [showMatrix, setShowMatrix] = useState(false);
  const { data: rawData } = useProductCustomerMatrix(filters);
  const data = useStableData(rawData);

  // Pivot the flat data into a matrix
  const customerMap = new Map<string, { name: string; groups: Map<string, number> }>();
  const allGroups = new Set<string>();

  for (const row of (data ?? [])) {
    allGroups.add(row.item_group);
    let entry = customerMap.get(row.debtor_code);
    if (!entry) {
      entry = { name: row.company_name ?? row.debtor_code, groups: new Map() };
      customerMap.set(row.debtor_code, entry);
    }
    entry.groups.set(row.item_group, row.margin_pct);
  }

  const groups = Array.from(allGroups).sort();
  const customers = Array.from(customerMap.entries()).slice(0, 30);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Product Group x Customer Matrix</CardTitle>
        <button
          onClick={() => setShowMatrix(!showMatrix)}
          className="text-sm text-primary hover:underline"
        >
          {showMatrix ? 'Hide' : 'Show'} Matrix
        </button>
      </CardHeader>
      {showMatrix && (
        <CardContent>
          {!data ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="sticky left-0 z-10 bg-card px-2 py-1 text-left text-xs font-medium">Customer</th>
                    {groups.map(g => (
                      <th key={g} className="px-2 py-1 text-center text-xs font-medium">{g}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map(([code, entry]) => (
                    <tr key={code} className="border-b text-xs">
                      <td className="sticky left-0 z-10 max-w-[150px] truncate bg-card px-2 py-1 font-medium">
                        {entry.name}
                      </td>
                      {groups.map(g => {
                        const val = entry.groups.get(g);
                        return (
                          <td key={g} className={`px-2 py-1 text-center ${marginBgColor(val ?? null)}`}>
                            {val != null ? `${val.toFixed(1)}%` : '\u2014'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
