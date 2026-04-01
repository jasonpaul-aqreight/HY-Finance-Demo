'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { useCreditNoteImpact } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM, formatMarginPct } from '@/lib/customer-margin/format';

interface Props {
  filters: MarginDashboardFilters;
}

const PAGE_SIZE = 20;

export function CreditNoteImpactTable({ filters }: Props) {
  const { data: rawData } = useCreditNoteImpact(filters);
  const data = useStableData(rawData);
  const [page, setPage] = useState(1);

  const allRows = data ?? [];
  const totalPages = Math.ceil(allRows.length / PAGE_SIZE);
  const pagedRows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Note Impact on Margins</CardTitle>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">IV Revenue</TableHead>
                  <TableHead className="text-right">CN Amount</TableHead>
                  <TableHead className="text-right">Return Rate</TableHead>
                  <TableHead className="text-right">Margin Before</TableHead>
                  <TableHead className="text-right">Margin After</TableHead>
                  <TableHead className="text-right">Margin Lost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.map(r => (
                  <TableRow key={r.debtor_code}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {r.company_name ?? r.debtor_code}
                    </TableCell>
                    <TableCell className="text-right">{formatRM(r.iv_revenue)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatRM(r.cn_revenue)}</TableCell>
                    <TableCell className={`text-right font-medium ${r.return_rate_pct > 10 ? 'text-red-600' : r.return_rate_pct > 5 ? 'text-amber-600' : ''}`}>
                      {formatMarginPct(r.return_rate_pct)}
                    </TableCell>
                    <TableCell className="text-right">{formatMarginPct(r.margin_before)}</TableCell>
                    <TableCell className="text-right">{formatMarginPct(r.margin_after)}</TableCell>
                    <TableCell className={`text-right ${r.margin_lost > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {r.margin_lost > 0 ? '-' : '+'}{formatMarginPct(Math.abs(r.margin_lost))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {allRows.length} customers total
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    Prev
                  </Button>
                  <span className="text-muted-foreground">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
