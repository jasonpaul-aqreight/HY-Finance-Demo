'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SettingsIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TablePagination, type PageSize } from '@/components/ui/table-pagination';
import { useCreditHealthV2 } from '@/hooks/payment/usePaymentDataV2';
import { useStableData } from '@/hooks/useStableData';
import { formatRM } from '@/lib/payment/format';
import { riskTierBgColor } from '@/lib/payment/credit-score-v2';
import { exportToExcel } from '@/lib/export-excel';
import { CustomerProfileRevamp } from '@/components/profiles/CustomerProfileRevampPreview';
import { SettingsDialog } from '@/components/payment/settings/SettingsForm';

type SortKey = 'debtor_code' | 'company_name' | 'debtor_type' | 'sales_agent' | 'credit_limit' | 'total_outstanding' | 'max_overdue_days' | 'aging_count' | 'utilization_pct' | 'credit_score' | 'risk_tier';

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40">{'\u2195'}</span>;
  return <span className="ml-1">{asc ? '\u2191' : '\u2193'}</span>;
}

export default function CustomerTableV2({ initialStartDate, initialEndDate }: { initialStartDate?: string; initialEndDate?: string }) {
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
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const tableRef = useRef<HTMLDivElement>(null);
  const lockedHeight = useRef<number | undefined>(undefined);

  const { data: rawData } = useCreditHealthV2(sort, order, page, search, riskFilter, categoryFilter, pageSize);
  const data = useStableData(rawData);

  useEffect(() => {
    const el = tableRef.current;
    if (el && data && data.rows?.length > 0) {
      lockedHeight.current = el.offsetHeight;
    }
  }, [data && data.rows?.length > 0, pageSize]);

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

  const handleExport = useCallback(() => {
    if (!data?.rows) return;
    exportToExcel('customer-credit-health', [
      { header: 'Code', key: 'debtor_code', width: 14 },
      { header: 'Name', key: 'company_name', width: 30 },
      { header: 'Type', key: 'debtor_type', width: 16 },
      { header: 'Agent', key: 'sales_agent', width: 14 },
      { header: 'Credit Limit', key: 'credit_limit', width: 16 },
      { header: 'Outstanding', key: 'total_outstanding', width: 16 },
      { header: 'Oldest Due', key: 'oldest_due', width: 14 },
      { header: 'Max Overdue Days', key: 'max_overdue_days', width: 16 },
      { header: 'Aging Count', key: 'aging_count', width: 12 },
      { header: 'Credit Used %', key: 'utilization_pct', width: 14 },
      { header: 'Health Score', key: 'credit_score', width: 18 },
      { header: 'Risk Level', key: 'risk_tier', width: 12 },
    ], data.rows.map(r => ({
      debtor_code: r.debtor_code,
      company_name: r.company_name,
      debtor_type: r.debtor_type,
      sales_agent: r.sales_agent,
      credit_limit: r.credit_limit,
      total_outstanding: r.total_outstanding,
      oldest_due: r.oldest_due ?? '',
      max_overdue_days: r.max_overdue_days,
      aging_count: r.aging_count,
      utilization_pct: r.utilization_pct ?? '',
      credit_score: r.credit_score,
      risk_tier: r.risk_tier,
    })));
  }, [data]);

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
              placeholder="Search by code or name..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="h-7 w-48 rounded-md border border-input bg-transparent px-2 text-sm"
            />
            <Select
              value={categoryFilter || 'all'}
              onValueChange={val => { setCategoryFilter(val === 'all' ? '' : val ?? ''); setPage(1); }}
            >
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue>{categoryFilter || 'All Types'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
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
              onValueChange={val => { setRiskFilter(val === 'all' ? '' : val ?? ''); setPage(1); }}
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
            <Button variant="outline" size="sm" onClick={handleExport}>
              Export Excel
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="h-[400px] animate-pulse rounded bg-muted" />
        ) : (
          <div ref={tableRef} style={{ minHeight: lockedHeight.current }}>
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
                    Type <SortIcon active={sort === 'debtor_type'} asc={order === 'asc'} />
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
                    Credit Used <SortIcon active={sort === 'utilization_pct'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('aging_count')}>
                    Aging Count <SortIcon active={sort === 'aging_count'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('max_overdue_days')}>
                    Oldest Due <SortIcon active={sort === 'max_overdue_days'} asc={order === 'asc'} />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('credit_score')}>
                    Health Score <SortIcon active={sort === 'credit_score'} asc={order === 'asc'} />
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

            <TablePagination
              page={page}
              pageSize={pageSize}
              total={data?.total ?? 0}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="customers"
            />
          </div>
        )}
      </CardContent>

      {selectedCustomer && (
        <CustomerProfileRevamp
          open={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          debtorCode={selectedCustomer.debtor_code}
          companyName={selectedCustomer.company_name}
          defaultTab="outstanding"
          initialStartDate={initialStartDate}
          initialEndDate={initialEndDate}
        />
      )}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Card>
  );
}
