'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useCreditHealthV2, useCustomerInvoices } from '@/hooks/payment/usePaymentDataV2';
import { formatRM } from '@/lib/payment/format';
import { riskTierBgColor } from '@/lib/payment/credit-score-v2';

type SortKey = 'debtor_code' | 'company_name' | 'debtor_type' | 'sales_agent' | 'credit_limit' | 'total_outstanding' | 'max_overdue_days' | 'aging_count' | 'utilization_pct' | 'credit_score' | 'risk_tier';

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40">{'\u2195'}</span>;
  return <span className="ml-1">{asc ? '\u2191' : '\u2193'}</span>;
}

function ExpandedInvoices({ debtorCode }: { debtorCode: string }) {
  const { data, isLoading } = useCustomerInvoices(debtorCode);

  if (isLoading) return <tr><td colSpan={12} className="p-4 text-center text-sm text-muted-foreground">Loading invoices...</td></tr>;
  if (!data || data.length === 0) return <tr><td colSpan={12} className="p-4 text-center text-sm text-muted-foreground">No outstanding invoices</td></tr>;

  return (
    <tr>
      <td colSpan={12} className="bg-muted/30 p-0">
        <div className="px-8 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-4">Invoice No.</th>
                <th className="py-1.5 pr-4">Invoice Date</th>
                <th className="py-1.5 pr-4">Due Date</th>
                <th className="py-1.5 pr-4 text-right">Total (RM)</th>
                <th className="py-1.5 pr-4 text-right">Outstanding (RM)</th>
                <th className="py-1.5 text-right">Days Overdue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((inv: {
                doc_no: string; doc_date: string; due_date: string;
                local_net_total: number; outstanding: number; days_overdue: number;
              }) => (
                <tr key={inv.doc_no} className="border-b border-muted last:border-0">
                  <td className="py-1.5 pr-4 font-mono text-xs">{inv.doc_no}</td>
                  <td className="py-1.5 pr-4">{inv.doc_date}</td>
                  <td className="py-1.5 pr-4">{inv.due_date}</td>
                  <td className="py-1.5 pr-4 text-right">{formatRM(inv.local_net_total, 2)}</td>
                  <td className="py-1.5 pr-4 text-right">{formatRM(inv.outstanding, 2)}</td>
                  <td className={`py-1.5 text-right ${inv.days_overdue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {inv.days_overdue > 0 ? `${inv.days_overdue}` : `${inv.days_overdue} (not due)`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

export default function CustomerTableV2() {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const [sort, setSort] = useState<SortKey>('total_outstanding');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data, isLoading } = useCreditHealthV2(sort, order, page, search);

  const textColumns: SortKey[] = ['debtor_code', 'company_name', 'debtor_type', 'sales_agent', 'risk_tier'];
  const handleSort = useCallback((key: SortKey) => {
    if (sort === key) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(key);
      setOrder(textColumns.includes(key) ? 'asc' : 'desc');
    }
    setPage(1);
  }, [sort]);

  const handleExportCSV = useCallback(() => {
    if (!data?.rows) return;
    const headers = ['Code', 'Name', 'Type', 'Agent', 'Credit Limit', 'Outstanding', 'Oldest Due', 'Max Overdue Days', 'Aging Count', 'Credit Util %', 'Score', 'Risk Tier'];
    const csvRows = data.rows.map(r =>
      [
        r.debtor_code, `"${r.company_name}"`, r.debtor_type, r.sales_agent,
        r.credit_limit, r.total_outstanding, r.oldest_due ?? '',
        r.max_overdue_days, r.aging_count, r.utilization_pct ?? '', r.credit_score, r.risk_tier,
      ].join(',')
    );
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-credit-health-v2.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Customer Credit Health</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Overdue calculated as of {today}
          </p>
        </div>
        <CardAction>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search customer..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="h-7 w-48 rounded-md border border-input bg-transparent px-2 text-sm"
            />
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              Export CSV
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[400px] animate-pulse rounded bg-muted" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('debtor_code')}>
                    Code <SortIcon active={sort === 'debtor_code'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('company_name')}>
                    Name <SortIcon active={sort === 'company_name'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('debtor_type')}>
                    Type <SortIcon active={sort === 'debtor_type'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('sales_agent')}>
                    Agent <SortIcon active={sort === 'sales_agent'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('credit_limit')}>
                    Credit Limit <SortIcon active={sort === 'credit_limit'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('total_outstanding')}>
                    Outstanding <SortIcon active={sort === 'total_outstanding'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('utilization_pct')}>
                    Credit Util <SortIcon active={sort === 'utilization_pct'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('aging_count')}>
                    Aging Count <SortIcon active={sort === 'aging_count'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('max_overdue_days')}>
                    Oldest Due <SortIcon active={sort === 'max_overdue_days'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('credit_score')}>
                    Score <SortIcon active={sort === 'credit_score'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('risk_tier')}>
                    Risk <SortIcon active={sort === 'risk_tier'} asc={order === 'asc'} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows?.map(row => (
                  <React.Fragment key={row.debtor_code}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === row.debtor_code ? null : row.debtor_code)}
                    >
                      <TableCell className="text-muted-foreground">
                        {expandedRow === row.debtor_code ? '\u25BC' : '\u25B6'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.debtor_code}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.company_name}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.debtor_type}</span>
                      </TableCell>
                      <TableCell className="text-xs">{row.sales_agent}</TableCell>
                      <TableCell className="text-right">{row.credit_limit > 0 ? formatRM(row.credit_limit) : '--'}</TableCell>
                      <TableCell className="text-right font-medium">{formatRM(row.total_outstanding)}</TableCell>
                      <TableCell className="text-right">
                        {row.utilization_pct != null ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full ${
                                  row.utilization_pct > 100 ? 'bg-red-500' :
                                  row.utilization_pct >= 80 ? 'bg-yellow-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(row.utilization_pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs">{row.utilization_pct.toFixed(0)}%</span>
                          </div>
                        ) : '--'}
                      </TableCell>
                      <TableCell className={`text-right text-xs font-medium ${row.aging_count > 0 ? 'text-red-600' : ''}`}>
                        {row.aging_count}
                      </TableCell>
                      <TableCell className={`text-xs ${row.max_overdue_days > 0 ? 'text-red-600 font-medium' : ''}`}>
                        {row.max_overdue_days > 0 ? `${row.max_overdue_days}d` : '--'}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {row.credit_score}
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskTierBgColor(row.risk_tier)}`}>
                          {row.risk_tier}
                        </span>
                      </TableCell>
                    </TableRow>
                    {expandedRow === row.debtor_code && (
                      <ExpandedInvoices debtorCode={row.debtor_code} />
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, data?.total ?? 0)} of {data?.total ?? 0} customers
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
