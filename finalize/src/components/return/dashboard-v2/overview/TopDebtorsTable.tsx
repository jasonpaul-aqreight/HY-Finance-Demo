'use client';

import { useState, useMemo } from 'react';
import { useAllCustomerReturnsAll, useCustomerReturnDetailsAll } from '@/hooks/return/useCreditDataV2';
import type { TopDebtorRow } from '@/lib/return/queries-v2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatRM, formatCount } from '@/lib/format';

// ─── Sort helpers ────────────────────────────────────────────────────────────

type SortKey = 'company_name' | 'return_count' | 'total_return_value' | 'total_knocked_off' | 'total_refunded' | 'unresolved';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;

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

// ─── Detail rows (expanded) ─────────────────────────────────────────────────

function CustomerDetailRows({ debtorCode }: { debtorCode: string }) {
  const { data, isLoading } = useCustomerReturnDetailsAll(debtorCode);

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="bg-muted/30">
          <div className="py-3 text-xs text-muted-foreground text-center">Loading returns...</div>
        </TableCell>
      </TableRow>
    );
  }

  if (!data || data.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="bg-muted/30">
          <div className="py-3 text-xs text-muted-foreground text-center">No return records found.</div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {/* Sub-header */}
      <TableRow className="bg-muted/40">
        <TableCell className="text-[11px] font-semibold text-muted-foreground pl-10">Doc No</TableCell>
        <TableCell className="text-[11px] font-semibold text-muted-foreground">Date</TableCell>
        <TableCell className="text-[11px] font-semibold text-muted-foreground text-right">Amount</TableCell>
        <TableCell className="text-[11px] font-semibold text-muted-foreground text-right">Knocked Off</TableCell>
        <TableCell className="text-[11px] font-semibold text-muted-foreground text-right">Refunded</TableCell>
        <TableCell className="text-[11px] font-semibold text-muted-foreground text-right">Unresolved</TableCell>
        <TableCell className="text-[11px] font-semibold text-muted-foreground">Reason</TableCell>
      </TableRow>
      {data.map((row) => (
        <TableRow key={row.doc_key} className="bg-muted/20 hover:bg-muted/30">
          <TableCell className="text-xs pl-10 font-mono">{row.doc_no}</TableCell>
          <TableCell className="text-xs">{row.doc_date}</TableCell>
          <TableCell className="text-xs text-right">{formatRM(row.net_total)}</TableCell>
          <TableCell className="text-xs text-right">
            {row.knocked_off > 0 ? formatRM(row.knocked_off) : '—'}
          </TableCell>
          <TableCell className="text-xs text-right">
            {row.refunded > 0 ? (
              <span className="text-blue-600">{formatRM(row.refunded)}</span>
            ) : '—'}
          </TableCell>
          <TableCell className="text-xs text-right">
            <UnresolvedCell
              unresolved={row.unresolved}
              knockedOff={row.knocked_off}
              refunded={row.refunded}
              className="text-xs"
            />
          </TableCell>
          <TableCell className="text-xs max-w-[180px] truncate" title={row.reason}>
            {row.reason || '—'}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ─── Main table ─────────────────────────────────────────────────────────────

export function TopDebtorsTable() {
  const { data, isLoading } = useAllCustomerReturnsAll();
  const [sortKey, setSortKey] = useState<SortKey>('total_return_value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!data) return [];
    return sortData(data, sortKey, sortDir);
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'company_name' ? 'asc' : 'desc');
    }
    setPage(1);
    setExpandedCode(null);
  }

  function toggleExpand(code: string) {
    setExpandedCode(prev => prev === code ? null : code);
  }

  function goToPage(p: number) {
    setPage(p);
    setExpandedCode(null);
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Customer Returns</CardTitle></CardHeader>
        <CardContent><div className="h-[400px] bg-muted rounded animate-pulse" /></CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Customer Returns</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            No return credit notes found.
          </p>
        </CardContent>
      </Card>
    );
  }

  const columns: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'company_name', label: 'Customer' },
    { key: 'return_count', label: 'Returns', align: 'right' },
    { key: 'total_return_value', label: 'Total Value', align: 'right' },
    { key: 'total_knocked_off', label: 'Knocked Off', align: 'right' },
    { key: 'total_refunded', label: 'Refunded', align: 'right' },
    { key: 'unresolved', label: 'Unresolved', align: 'right' },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Customer Returns</CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatCount(data.length)} customers &middot; Click a row to expand return breakdown
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
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
              {paged.map((row) => {
                const isExpanded = expandedCode === row.debtor_code;
                return (
                  <CustomerRow
                    key={row.debtor_code}
                    row={row}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(row.debtor_code)}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {formatCount(sorted.length)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
              >
                Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Customer row + expansion ───────────────────────────────────────────────

function CustomerRow({
  row, isExpanded, onToggle,
}: {
  row: TopDebtorRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/40"
        onClick={onToggle}
      >
        <TableCell className="w-8 text-center text-muted-foreground">
          {isExpanded ? '▼' : '▶'}
        </TableCell>
        <TableCell className="font-medium max-w-[220px] truncate" title={row.company_name}>
          {row.company_name}
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
      {isExpanded && <CustomerDetailRows debtorCode={row.debtor_code} />}
    </>
  );
}
