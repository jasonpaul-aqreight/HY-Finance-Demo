'use client';

import { Fragment, useState, useMemo } from 'react';
import { useOpexBreakdown } from '@/hooks/expenses/useCostData';
import type { DashboardFilters } from '@/hooks/expenses/useDashboardFilters';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRM } from '@/lib/format';

interface Row {
  category: string;
  acc_no: string;
  account_name: string;
  net_cost: number;
}

interface GroupedCategory {
  category: string;
  subtotal: number;
  rows: Row[];
}

import { CATEGORY_ORDER } from '@/lib/shared/expense-categories';

function exportCsv(groups: GroupedCategory[], total: number) {
  const headers = ['Category', 'Account No', 'Account Name', 'Net Cost (RM)', '% of OPEX'];
  const lines: string[] = [];
  for (const g of groups) {
    for (const r of g.rows) {
      lines.push([
        `"${r.category}"`,
        r.acc_no,
        `"${r.account_name}"`,
        r.net_cost.toFixed(2),
        total > 0 ? ((r.net_cost / total) * 100).toFixed(2) : '0',
      ].join(','));
    }
  }
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'opex-breakdown.csv';
  a.click();
}

export function OpexBreakdownTable({ filters }: { filters: DashboardFilters }) {
  const { data, isLoading } = useOpexBreakdown(filters);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(CATEGORY_ORDER));

  const rows: Row[] = data?.data ?? [];
  const total = rows.reduce((s, r) => s + r.net_cost, 0);

  const groups = useMemo(() => {
    const map: Record<string, GroupedCategory> = {};
    for (const row of rows) {
      if (!map[row.category]) {
        map[row.category] = { category: row.category, subtotal: 0, rows: [] };
      }
      map[row.category].subtotal += row.net_cost;
      map[row.category].rows.push(row);
    }
    // Sort groups by CATEGORY_ORDER
    return CATEGORY_ORDER
      .filter(c => map[c])
      .map(c => map[c]);
  }, [rows]);

  function toggleCollapse(cat: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>OPEX Breakdown</CardTitle></CardHeader>
        <CardContent><div className="h-48 bg-muted animate-pulse rounded" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle>OPEX Breakdown</CardTitle>
        <Button size="sm" variant="outline" onClick={() => exportCsv(groups, total)}>
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category / Account</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead className="text-right">Net Cost (RM)</TableHead>
                <TableHead className="text-right">% of OPEX</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <Fragment key={group.category}>
                  {/* Category header row */}
                  <TableRow
                    className="bg-muted/40 cursor-pointer hover:bg-muted/60"
                    onClick={() => toggleCollapse(group.category)}
                  >
                    <TableCell className="font-semibold" colSpan={2}>
                      <span className="mr-2">{collapsed.has(group.category) ? '▶' : '▼'}</span>
                      {group.category}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatRM(group.subtotal, 2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {total > 0 ? ((group.subtotal / total) * 100).toFixed(1) : '0.0'}%
                    </TableCell>
                  </TableRow>
                  {/* Account rows */}
                  {!collapsed.has(group.category) && group.rows.map((row, i) => (
                    <TableRow key={row.acc_no} className={i % 2 === 0 ? 'bg-muted/10' : ''}>
                      <TableCell className="font-mono text-sm pl-8">{row.acc_no}</TableCell>
                      <TableCell className="text-sm">{row.account_name}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatRM(row.net_cost, 2)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {total > 0 ? ((row.net_cost / total) * 100).toFixed(1) : '0.0'}%
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
              {groups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No OPEX data for selected period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {groups.length > 0 && (
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>TOTAL OPEX</TableCell>
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
