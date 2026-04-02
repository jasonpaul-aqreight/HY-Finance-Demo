'use client';

import { useState, useMemo } from 'react';
import { useCogsBreakdown } from '@/hooks/expenses/useCostData';
import type { DashboardFilters } from '@/hooks/expenses/useDashboardFilters';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRM } from '@/lib/format';
import { exportToExcel } from '@/lib/export-excel';

type SortKey = 'acc_no' | 'account_name' | 'net_cost';

interface Row {
  acc_no: string;
  account_name: string;
  net_cost: number;
}

function handleExportExcel(rows: Row[], total: number) {
  exportToExcel('cogs-breakdown', [
    { header: 'Account No', key: 'acc_no', width: 14 },
    { header: 'Account Name', key: 'account_name', width: 30 },
    { header: 'Net Cost (RM)', key: 'net_cost', width: 16 },
    { header: '% of COGS', key: 'pct_of_cogs', width: 12 },
  ], rows.map(r => ({
    acc_no: r.acc_no,
    account_name: r.account_name,
    net_cost: r.net_cost,
    pct_of_cogs: total > 0 ? Math.round((r.net_cost / total) * 10000) / 100 : 0,
  })));
}

export function CogsBreakdownTable({ filters }: { filters: DashboardFilters }) {
  const { data, isLoading } = useCogsBreakdown(filters);
  const [sortKey, setSortKey] = useState<SortKey>('net_cost');
  const [sortAsc, setSortAsc] = useState(false);

  const rows: Row[] = data?.data ?? [];
  const total = rows.reduce((s, r) => s + r.net_cost, 0);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-muted/50"
        onClick={() => handleSort(col)}
      >
        <span className="flex items-center gap-1">
          {label} {active ? (sortAsc ? ' ↑' : ' ↓') : ' ↕'}
        </span>
      </TableHead>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>COGS Breakdown</CardTitle></CardHeader>
        <CardContent><div className="h-48 bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle>COGS Breakdown</CardTitle>
        <Button size="sm" variant="outline" onClick={() => handleExportExcel(sorted, total)}>
          Export Excel
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader col="acc_no" label="Account No" />
                <SortHeader col="account_name" label="Account Name" />
                <SortHeader col="net_cost" label="Net Cost (RM)" />
                <TableHead className="text-right">% of COGS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row, i) => (
                <TableRow key={row.acc_no} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                  <TableCell className="font-mono text-sm">{row.acc_no}</TableCell>
                  <TableCell className="text-sm">{row.account_name}</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${row.net_cost < 0 ? 'text-red-600' : ''}`}>
                    {row.net_cost < 0 ? '-' : ''}{formatRM(row.net_cost, 2)}
                  </TableCell>
                  <TableCell className={`text-right text-sm ${row.net_cost < 0 ? 'text-red-600' : ''}`}>
                    {total > 0 ? ((row.net_cost / total) * 100).toFixed(1) : '0.0'}%
                  </TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No COGS data for selected period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {sorted.length > 0 && (
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>TOTAL COGS</TableCell>
                  <TableCell className="text-right font-mono">{formatRM(total, 2)}</TableCell>
                  <TableCell className="text-right">100.0%</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
