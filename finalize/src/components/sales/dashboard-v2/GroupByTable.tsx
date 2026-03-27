'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { formatRM, formatCount } from '@/lib/format';
import type { GroupByDimension, GroupByRow } from '@/lib/sales/types';
import { CustomerProfileModal } from '@/components/profiles/CustomerProfileModal';

interface Column {
  key: string;
  label: string;
  format?: (v: unknown) => string;
}

function getColumns(group: GroupByDimension): Column[] {
  const rm = (v: unknown) => formatRM(v as number);
  const cnt = (v: unknown) => formatCount(v as number);
  const qty = (v: unknown) => {
    const n = v as number;
    return n != null ? Math.round(n).toLocaleString('en-MY') : '0';
  };

  const active = (v: unknown) => (v === 'T' ? 'True' : v === 'F' ? 'False' : String(v ?? ''));

  switch (group) {
    case 'customer':
      return [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Customer Name' },
        { key: 'customer_type', label: 'Category' },
        { key: 'total_sales', label: 'Total Sales', format: rm },
        { key: 'invoice_sales', label: 'Invoice Sales', format: rm },
        { key: 'cash_sales', label: 'Cash Sales', format: rm },
        { key: 'credit_notes', label: 'Credit Note', format: rm },
      ];
    case 'customer-type':
      return [
        { key: 'name', label: 'Category' },
        { key: 'customer_count', label: 'Count', format: cnt },
        { key: 'total_sales', label: 'Total Sales', format: rm },
        { key: 'invoice_sales', label: 'Invoice Sales', format: rm },
        { key: 'cash_sales', label: 'Cash Sales', format: rm },
      ];

    case 'agent':
      return [
        { key: 'name', label: 'Agent' },
        { key: 'is_active', label: 'Active', format: active },
        { key: 'total_sales', label: 'Total Sales', format: rm },
        { key: 'invoice_sales', label: 'Invoice Sales', format: rm },
        { key: 'cash_sales', label: 'Cash Sales', format: rm },
        { key: 'unique_customers', label: 'Customers', format: cnt },
      ];
    case 'outlet':
      return [
        { key: 'name', label: 'Location' },
        { key: 'total_sales', label: 'Total Sales', format: rm },
        { key: 'invoice_sales', label: 'Invoice Sales', format: rm },
        { key: 'cash_sales', label: 'Cash Sales', format: rm },
        { key: 'credit_notes', label: 'Credit Note', format: rm },
      ];
    case 'fruit':
      return [
        { key: 'name', label: 'Fruit' },
        { key: 'fruit_country', label: 'Country' },
        { key: 'fruit_variant', label: 'Variant' },
        { key: 'total_sales', label: 'Total Sales', format: rm },
        { key: 'qty_sold', label: 'Qty Sold', format: qty },
      ];
  }
}

/** Unique row key — for fruit uses composite, others use name */
function rowKey(row: GroupByRow, group: GroupByDimension): string {
  if (group === 'fruit') {
    return `${row.name}|${row.fruit_country ?? ''}|${row.fruit_variant ?? ''}`;
  }
  return row.name;
}

interface GroupByTableProps {
  data: GroupByRow[];
  group: GroupByDimension;
  selectedNames: Set<string>;
  onToggle: (key: string) => void;
  maxSelected?: number;
  startDate?: string;
  endDate?: string;
}

export function GroupByTable({ data, group, selectedNames, onToggle, maxSelected = 10, startDate, endDate }: GroupByTableProps) {
  const columns = useMemo(() => getColumns(group), [group]);
  const [sortKey, setSortKey] = useState('total_sales');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedCustomer, setSelectedCustomer] = useState<{ code: string; name: string } | null>(null);

  const isCustomerGroup = group === 'customer';

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'desc' ? bv - av : av - bv;
      }
      return sortDir === 'desc'
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv));
    });
  }, [data, sortKey, sortDir]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sortIndicator = (key: string) => {
    if (sortKey !== key) return ' \u21C5';
    return sortDir === 'desc' ? ' \u2193' : ' \u2191';
  };

  // Lock container height to its natural size so client-side filtering
  // (search / dropdown) doesn't collapse the container and cause page scroll jump
  const containerRef = useRef<HTMLDivElement>(null);
  const lockedHeight = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (el && data.length > 0) {
      lockedHeight.current = el.offsetHeight;
    }
  }, [data.length > 0]); // only recalculate when data goes from empty→populated

  return (
    <>
      <div
        ref={containerRef}
        className="border rounded-lg overflow-auto max-h-[500px]"
        style={{ minHeight: lockedHeight.current }}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-10 px-2" />
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className="cursor-pointer select-none whitespace-nowrap text-xs"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}{sortIndicator(col.key)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => {
              const key = rowKey(row, group);
              const isChecked = selectedNames.has(key);
              const isDisabled = !isChecked && selectedNames.size >= maxSelected;
              return (
                <TableRow
                  key={i}
                  className={i % 2 === 0 ? '' : 'bg-muted/20'}
                >
                  <TableCell className="px-2">
                    <Checkbox
                      checked={isChecked}
                      disabled={isDisabled}
                      onCheckedChange={() => onToggle(key)}
                    />
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className="text-sm whitespace-nowrap"
                    >
                      {col.key === 'name' && isCustomerGroup ? (
                        <button
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          onClick={() => setSelectedCustomer({ code: String(row.code ?? ''), name: row.name })}
                        >
                          {String(row[col.key] ?? '')}
                        </button>
                      ) : col.format ? col.format(row[col.key]) : String(row[col.key] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">
                  No data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selectedCustomer && (
        <CustomerProfileModal
          open={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          debtorCode={selectedCustomer.code}
          companyName={selectedCustomer.name}
          defaultTab="sold-items"
          initialStartDate={startDate}
          initialEndDate={endDate}
        />
      )}
    </>
  );
}
