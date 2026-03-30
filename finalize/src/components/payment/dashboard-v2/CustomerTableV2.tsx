'use client';

import React, { useState, useCallback } from 'react';
import { SettingsIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreditHealthV2 } from '@/hooks/payment/usePaymentDataV2';
import { useStableData } from '@/hooks/useStableData';
import { formatRM } from '@/lib/payment/format';
import { riskTierBgColor } from '@/lib/payment/credit-score-v2';
import { CustomerProfileRevamp } from '@/components/profiles/CustomerProfileRevampPreview';
import { SettingsDialog } from '@/components/payment/settings/SettingsDialog';

type SortKey = 'debtor_code' | 'company_name' | 'debtor_type' | 'sales_agent' | 'credit_limit' | 'total_outstanding' | 'max_overdue_days' | 'aging_count' | 'utilization_pct' | 'credit_score' | 'risk_tier';

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40">{'\u2195'}</span>;
  return <span className="ml-1">{asc ? '\u2191' : '\u2193'}</span>;
}

export default function CustomerTableV2() {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const [sort, setSort] = useState<SortKey>('total_outstanding');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<{
    debtor_code: string; company_name: string;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [riskFilter, setRiskFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: rawData } = useCreditHealthV2(sort, order, page, search, riskFilter, categoryFilter);
  const data = useStableData(rawData);

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
    const headers = ['Code', 'Name', 'Category', 'Agent', 'Credit Limit', 'Outstanding', 'Oldest Due', 'Max Overdue Days', 'Aging Count', 'Credit Util %', 'Credit Health Score', 'Risk Level'];
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
              placeholder="Search by customer code or name..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="h-7 w-48 rounded-md border border-input bg-transparent px-2 text-sm"
            />
            <Select
              value={categoryFilter || 'all'}
              onValueChange={val => { setCategoryFilter(val === 'all' ? '' : val); setPage(1); }}
            >
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue>{categoryFilter || 'All Category'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Category</SelectItem>
                <SelectItem value="Consumer">Consumer</SelectItem>
                <SelectItem value="Fruit Shop">Fruit Shop</SelectItem>
                <SelectItem value="Hospitality Business">Hospitality</SelectItem>
                <SelectItem value="Intermediary">Intermediary</SelectItem>
                <SelectItem value="Supermarket">Supermarket</SelectItem>
                <SelectItem value="Wet Market">Wet Market</SelectItem>
                <SelectItem value="Wholesaler">Wholesaler</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={riskFilter || 'all'}
              onValueChange={val => { setRiskFilter(val === 'all' ? '' : val); setPage(1); }}
            >
              <SelectTrigger size="sm" className="w-[140px]">
                <SelectValue>{riskFilter ? `${riskFilter} Risk` : 'All Risk Level'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Level</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Moderate">Moderate</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon className="size-3.5 mr-1.5" />
              Score &amp; Risk
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              Export CSV
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="h-[400px] animate-pulse rounded bg-muted" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('debtor_code')}>
                    Code <SortIcon active={sort === 'debtor_code'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('company_name')}>
                    Name <SortIcon active={sort === 'company_name'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('debtor_type')}>
                    Category <SortIcon active={sort === 'debtor_type'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('sales_agent')}>
                    Agent <SortIcon active={sort === 'sales_agent'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('credit_limit')}>
                    Credit Limit <SortIcon active={sort === 'credit_limit'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('total_outstanding')}>
                    Outstanding <SortIcon active={sort === 'total_outstanding'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('utilization_pct')}>
                    Credit Util <SortIcon active={sort === 'utilization_pct'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('aging_count')}>
                    Aging Count <SortIcon active={sort === 'aging_count'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('max_overdue_days')}>
                    Oldest Due <SortIcon active={sort === 'max_overdue_days'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('credit_score')}>
                    Credit Health Score <SortIcon active={sort === 'credit_score'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('risk_tier')}>
                    Risk Level <SortIcon active={sort === 'risk_tier'} asc={order === 'asc'} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows?.map(row => (
                  <TableRow
                    key={row.debtor_code}
                  >
                    <TableCell className="font-mono text-xs">{row.debtor_code}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      <button className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" onClick={() => setSelectedCustomer(row)}>{row.company_name}</button>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.debtor_type}</span>
                    </TableCell>
                    <TableCell className="text-xs">{row.sales_agent}</TableCell>
                    <TableCell>{row.credit_limit > 0 ? formatRM(row.credit_limit) : '--'}</TableCell>
                    <TableCell className="font-medium">{formatRM(row.total_outstanding)}</TableCell>
                    <TableCell>
                      {row.utilization_pct != null ? (
                        <div className="flex items-center gap-2">
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
                    <TableCell className={`text-xs font-medium ${row.aging_count > 0 ? 'text-red-600' : ''}`}>
                      {row.aging_count}
                    </TableCell>
                    <TableCell className={`text-xs ${row.max_overdue_days > 0 ? 'text-red-600 font-medium' : ''}`}>
                      {row.max_overdue_days > 0 ? `${row.max_overdue_days}d` : '--'}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {row.credit_score}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskTierBgColor(row.risk_tier)}`}>
                        {row.risk_tier}
                      </span>
                    </TableCell>
                  </TableRow>
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

      {selectedCustomer && (
        <CustomerProfileRevamp
          open={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          debtorCode={selectedCustomer.debtor_code}
          companyName={selectedCustomer.company_name}
          defaultTab="outstanding"
        />
      )}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Card>
  );
}
