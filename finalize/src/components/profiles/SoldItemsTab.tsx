'use client';

import { useState, useMemo } from 'react';
import { DateRangeSection } from '@/components/shared/DateRangeSection';
import { formatRM, formatMarginPct, marginColor } from '@/lib/customer-margin/format';
import { useCustomerProducts } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';

interface SoldItemsTabProps {
  debtorCode: string;
  initialStartDate?: string;
  initialEndDate?: string;
}

type SortKey = 'item_code' | 'description' | 'product_group' | 'qty_sold' | 'revenue' | 'cost' | 'margin_pct';

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40">{'\u21C5'}</span>;
  return <span className="ml-1">{asc ? '\u2191' : '\u2193'}</span>;
}

export function SoldItemsTab({ debtorCode, initialStartDate, initialEndDate }: SoldItemsTabProps) {
  const [startDate, setStartDate] = useState(initialStartDate ?? '2025-01-01');
  const [endDate, setEndDate] = useState(initialEndDate ?? '2025-12-31');
  const { data: rawData } = useCustomerProducts(debtorCode, startDate, endDate);
  const data = useStableData(rawData);
  const isLoading = !data;
  const products = data?.data ?? [];

  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...products].sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [products, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'item_code' || key === 'description' || key === 'product_group'); }
  }

  const TH = ({ col, label, align }: { col: SortKey; label: string; align?: 'right' }) => (
    <th className={`px-3 py-2 cursor-pointer select-none hover:bg-muted/50 ${align === 'right' ? 'text-right' : ''}`} onClick={() => handleSort(col)}>
      {label}<SortIcon active={sortKey === col} asc={sortAsc} />
    </th>
  );

  return (
    <div className="space-y-4">
      <DateRangeSection
        label="Date Range"
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        showPresets
        showRangeSummary={false}
      />

      <div>
        <h4 className="mb-2 text-sm font-medium">Items Sold</h4>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading sold items…</p>
        ) : sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No sold items on record.</p>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <TH col="item_code" label="Item Code" />
                  <TH col="description" label="Description" />
                  <TH col="product_group" label="Group" />
                  <TH col="qty_sold" label="Qty Sold" align="right" />
                  <TH col="revenue" label="Revenue" align="right" />
                  <TH col="cost" label="Cost" align="right" />
                  <TH col="margin_pct" label="Margin %" align="right" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.item_code} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.item_code}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate">{p.description}</td>
                    <td className="px-3 py-2">{p.product_group || '—'}</td>
                    <td className="px-3 py-2 text-right">{(p.qty_sold ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{formatRM(p.revenue)}</td>
                    <td className="px-3 py-2 text-right">{formatRM(p.cost)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${marginColor(p.margin_pct)}`}>
                      {formatMarginPct(p.margin_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
