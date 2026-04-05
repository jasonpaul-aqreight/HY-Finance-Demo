'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useAllCustomerReturnsAll } from '@/hooks/return/useCreditDataV2';
import { useStableData } from '@/hooks/useStableData';
import type { TopDebtorRow } from '@/lib/return/queries';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { TablePagination, type PageSize } from '@/components/ui/table-pagination';
import { formatRM, formatCount } from '@/lib/format';
import { exportToExcel } from '@/lib/export-excel';
import { CustomerProfileRevamp } from '@/components/profiles/CustomerProfileRevampPreview';

// ─── Sort helpers ────────────────────────────────────────────────────────────

type SortKey = 'debtor_code' | 'company_name' | 'return_count' | 'total_return_value' | 'total_knocked_off' | 'total_refunded' | 'unresolved';
type SortDir = 'asc' | 'desc';


function sortData(data: TopDebtorRow[], key: SortKey, dir: SortDir): TopDebtorRow[] {
  return [...data].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40">↕</span>;
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

// ─── 3-state unresolved helper ───────────────────────────────────────────────

function UnresolvedCell({ unresolved, knockedOff, refunded, className = '' }: {
  unresolved: number;
  knockedOff: number;
  refunded: number;
  className?: string;
}) {
  if (unresolved <= 0.01) {
    return <span className={`text-emerald-600 ${className}`}>Settled</span>;
  }
  const hasSettlement = knockedOff > 0 || refunded > 0;
  if (hasSettlement) {
    return <span className={`text-amber-600 ${className}`}>{formatRM(unresolved)}</span>;
  }
  return <span className={`text-red-600 ${className}`}>{formatRM(unresolved)}</span>;
}

// ─── Main table ─────────────────────────────────────────────────────────────

type StatusFilter = 'outstanding' | 'resolved' | 'all';

export function TopDebtorsTable({ initialStartDate, initialEndDate }: { initialStartDate?: string; initialEndDate?: string } = {}) {
  const { data: rawData } = useAllCustomerReturnsAll();
  const data = useStableData(rawData);
  const [sortKey, setSortKey] = useState<SortKey>('unresolved');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('outstanding');
  const [selectedCustomer, setSelectedCustomer] = useState<TopDebtorRow | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const lockedHeight = useRef<number | undefined>(undefined);

  const textColumns: SortKey[] = ['debtor_code', 'company_name'];

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data;

    // Status filter
    if (statusFilter === 'outstanding') {
      rows = rows.filter(r => r.unresolved > 0.01);
    } else if (statusFilter === 'resolved') {
      rows = rows.filter(r => r.unresolved <= 0.01);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.debtor_code.toLowerCase().includes(q) ||
        r.company_name.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [data, statusFilter, search]);

  const sorted = useMemo(() => {
    return sortData(filtered, sortKey, sortDir);
  }, [filtered, sortKey, sortDir]);

  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    const el = tableRef.current;
    if (el && paged.length > 0) {
      lockedHeight.current = el.offsetHeight;
    }
  }, [paged.length > 0, pageSize]);

  function handleExportExcel() {
    exportToExcel('customer-returns', [
      { header: 'Code', key: 'debtor_code', width: 14 },
      { header: 'Customer', key: 'company_name', width: 30 },
      { header: 'Returns', key: 'return_count', width: 10 },
      { header: 'Total Value', key: 'total_return_value', width: 16 },
      { header: 'Offset', key: 'total_knocked_off', width: 16 },
      { header: 'Refunded', key: 'total_refunded', width: 16 },
      { header: 'Unsettled', key: 'unresolved', width: 16 },
    ], sorted.map(r => ({
      debtor_code: r.debtor_code,
      company_name: r.company_name,
      return_count: r.return_count,
      total_return_value: r.total_return_value,
      total_knocked_off: r.total_knocked_off,
      total_refunded: r.total_refunded,
      unresolved: r.unresolved,
    })));
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(textColumns.includes(key) ? 'asc' : 'desc');
    }
    setPage(1);
  }

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Customer Returns</CardTitle></CardHeader>
        <CardContent><div className="h-[400px] bg-muted rounded animate-pulse" /></CardContent>
      </Card>
    );
  }

  const columns: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'debtor_code', label: 'Code' },
    { key: 'company_name', label: 'Customer' },
    { key: 'return_count', label: 'Returns', align: 'right' },
    { key: 'total_return_value', label: 'Total Value', align: 'right' },
    { key: 'total_knocked_off', label: 'Offset', align: 'right' },
    { key: 'total_refunded', label: 'Refunded', align: 'right' },
    { key: 'unresolved', label: 'Unsettled', align: 'right' },
  ];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-sm">Customer Returns</CardTitle>
          <p className="text-xs text-muted-foreground">
            {formatCount(sorted.length)} customers
            {statusFilter !== 'all' && data.length > 0 && (
              <> of {formatCount(data.length)} total</>
            )}
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
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              Export Excel
            </Button>
            <Select
              value={statusFilter}
              onValueChange={val => { setStatusFilter(val as StatusFilter); setPage(1); }}
            >
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue>{statusFilter === 'outstanding' ? 'Unsettled' : statusFilter === 'resolved' ? 'Resolved' : 'All Returned'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outstanding">Unsettled</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="all">All Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {search ? 'No matching customers found.' : 'No unsettled returns.'}
          </p>
        ) : (
          <div ref={tableRef} style={{ minHeight: lockedHeight.current }}>
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map(col => (
                      <TableHead
                        key={col.key}
                        className={`cursor-pointer select-none hover:bg-muted/50 ${col.align === 'right' ? 'text-right' : ''}`}
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.label}
                        <SortIcon active={sortKey === col.key} dir={sortDir} />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((row) => (
                    <TableRow key={row.debtor_code}>
                      <TableCell className="font-mono text-xs">{row.debtor_code}</TableCell>
                      <TableCell className="font-medium max-w-[220px] truncate" title={row.company_name}>
                        <button className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" onClick={() => setSelectedCustomer(row)}>{row.company_name}</button>
                      </TableCell>
                      <TableCell className="text-right">{formatCount(row.return_count)}</TableCell>
                      <TableCell className="text-right">{formatRM(row.total_return_value)}</TableCell>
                      <TableCell className="text-right">{formatRM(row.total_knocked_off)}</TableCell>
                      <TableCell className="text-right">
                        {row.total_refunded > 0 ? (
                          <span className="text-blue-600">{formatRM(row.total_refunded)}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <UnresolvedCell
                          unresolved={row.unresolved}
                          knockedOff={row.total_knocked_off}
                          refunded={row.total_refunded}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <TablePagination
              page={page}
              pageSize={pageSize}
              total={sorted.length}
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
          defaultTab="returns"
          initialStartDate={initialStartDate}
          initialEndDate={initialEndDate}
        />
      )}
    </Card>
  );
}
