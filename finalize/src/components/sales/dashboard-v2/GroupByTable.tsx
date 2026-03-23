'use client';

import { useState, useMemo } from 'react';
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

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right';
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
        { key: 'total_sales', label: 'Total Sales', align: 'right', format: rm },
        { key: 'invoice_sales', label: 'Invoice Sales', align: 'right', format: rm },
        { key: 'cash_sales', label: 'Cash Sales', align: 'right', format: rm },
        { key: 'credit_notes', label: 'Credit Note', align: 'right', format: rm },
      ];
    case 'customer-type':
      return [
        { key: 'name', label: 'Category' },
        { key: 'customer_count', label: 'Count', align: 'right', format: cnt },
        { key: 'total_sales', label: 'Total Sales', align: 'right', format: rm },
        { key: 'invoice_sales', label: 'Invoice Sales', align: 'right', format: rm },
        { key: 'cash_sales', label: 'Cash Sales', align: 'right', format: rm },
      ];

    case 'agent':
      return [
        { key: 'name', label: 'Agent' },
        { key: 'is_active', label: 'Active', format: active },
        { key: 'total_sales', label: 'Total Sales', align: 'right', format: rm },
        { key: 'invoice_sales', label: 'Invoice Sales', align: 'right', format: rm },
        { key: 'cash_sales', label: 'Cash Sales', align: 'right', format: rm },
        { key: 'unique_customers', label: 'Customers', align: 'right', format: cnt },
      ];
    case 'outlet':
      return [
        { key: 'name', label: 'Location' },
        { key: 'total_sales', label: 'Total Sales', align: 'right', format: rm },
        { key: 'invoice_sales', label: 'Invoice Sales', align: 'right', format: rm },
        { key: 'cash_sales', label: 'Cash Sales', align: 'right', format: rm },
        { key: 'credit_notes', label: 'Credit Note', align: 'right', format: rm },
      ];
    case 'fruit':
      return [
        { key: 'name', label: 'Fruit' },
        { key: 'total_sales', label: 'Total Sales', align: 'right', format: rm },
        { key: 'invoice_sales', label: 'Invoice Sales', align: 'right', format: rm },
        { key: 'cash_sales', label: 'Cash Sales', align: 'right', format: rm },
        { key: 'credit_notes', label: 'Credit Note', align: 'right', format: rm },
        { key: 'qty_sold', label: 'Qty Sold', align: 'right', format: qty },
      ];
    case 'fruit-country':
      return [
        { key: 'name', label: 'Country' },
        { key: 'total_sales', label: 'Total Sales', align: 'right', format: rm },
        { key: 'invoice_sales', label: 'Invoice Sales', align: 'right', format: rm },
        { key: 'cash_sales', label: 'Cash Sales', align: 'right', format: rm },
        { key: 'credit_notes', label: 'Credit Note', align: 'right', format: rm },
        { key: 'qty_sold', label: 'Qty Sold', align: 'right', format: qty },
      ];
    case 'fruit-variant':
      return [
        { key: 'name', label: 'Fruit — Variant' },
        { key: 'total_sales', label: 'Total Sales', align: 'right', format: rm },
        { key: 'invoice_sales', label: 'Invoice Sales', align: 'right', format: rm },
        { key: 'cash_sales', label: 'Cash Sales', align: 'right', format: rm },
        { key: 'credit_notes', label: 'Credit Note', align: 'right', format: rm },
        { key: 'qty_sold', label: 'Qty Sold', align: 'right', format: qty },
      ];
  }
}

interface GroupByTableProps {
  data: GroupByRow[];
  group: GroupByDimension;
  selectedNames: Set<string>;
  onToggle: (name: string) => void;
  maxSelected?: number;
}

export function GroupByTable({ data, group, selectedNames, onToggle, maxSelected = 10 }: GroupByTableProps) {
  const columns = useMemo(() => getColumns(group), [group]);
  const [sortKey, setSortKey] = useState('total_sales');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

  return (
    <div className="border rounded-lg overflow-auto max-h-[500px]">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="w-10 px-2" />
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={`cursor-pointer select-none whitespace-nowrap text-xs ${col.align === 'right' ? 'text-right' : ''}`}
                onClick={() => handleSort(col.key)}
              >
                {col.label}{sortIndicator(col.key)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => {
            const isChecked = selectedNames.has(row.name);
            const isDisabled = !isChecked && selectedNames.size >= maxSelected;
            return (
              <TableRow key={i} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                <TableCell className="px-2">
                  <Checkbox
                    checked={isChecked}
                    disabled={isDisabled}
                    onCheckedChange={() => onToggle(row.name)}
                  />
                </TableCell>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={`text-sm whitespace-nowrap ${col.align === 'right' ? 'text-right font-mono' : ''}`}
                  >
                    {col.format ? col.format(row[col.key]) : String(row[col.key] ?? '')}
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
  );
}
