'use client';

import { useState, useMemo } from 'react';
import { formatRM } from '@/lib/payment/format';
import { useCustomerReturnDetailsAll } from '@/hooks/return/useCreditDataV2';

interface ReturnTabProps {
  debtorCode: string;
}

type SortKey = 'doc_no' | 'doc_date' | 'net_total' | 'knocked_off' | 'refunded' | 'unresolved' | 'reason';

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40">{'\u21C5'}</span>;
  return <span className="ml-1">{asc ? '\u2191' : '\u2193'}</span>;
}

function UnresolvedCell({ unresolved, knockedOff, refunded }: { unresolved: number; knockedOff: number; refunded: number }) {
  if (unresolved <= 0.01) return <span className="text-emerald-600">Settled</span>;
  const hasSettlement = knockedOff > 0 || refunded > 0;
  if (hasSettlement) return <span className="text-amber-600">{formatRM(unresolved)}</span>;
  return <span className="text-red-600">{formatRM(unresolved)}</span>;
}

export function ReturnTab({ debtorCode }: ReturnTabProps) {
  const { data, isLoading } = useCustomerReturnDetailsAll(debtorCode);
  const returns = data ?? [];

  const [sortKey, setSortKey] = useState<SortKey>('doc_date');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...returns].sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [returns, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'doc_no' || key === 'doc_date' || key === 'reason'); }
  }

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading return records…</p>;

  const TH = ({ col, label, align }: { col: SortKey; label: string; align?: 'right' }) => (
    <th className={`px-3 py-2 cursor-pointer select-none hover:bg-muted/50 ${align === 'right' ? 'text-right' : ''}`} onClick={() => handleSort(col)}>
      {label}<SortIcon active={sortKey === col} asc={sortAsc} />
    </th>
  );

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">Return Records</h4>
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No return records.</p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <TH col="doc_no" label="Doc No" />
                <TH col="doc_date" label="Date" />
                <TH col="net_total" label="Amount" align="right" />
                <TH col="knocked_off" label="Knocked Off" align="right" />
                <TH col="refunded" label="Refunded" align="right" />
                <TH col="unresolved" label="Unresolved" align="right" />
                <TH col="reason" label="Reason" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.doc_key} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs">{row.doc_no}</td>
                  <td className="px-3 py-2">{row.doc_date}</td>
                  <td className="px-3 py-2 text-right">{formatRM(row.net_total)}</td>
                  <td className="px-3 py-2 text-right">{row.knocked_off > 0 ? formatRM(row.knocked_off) : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {row.refunded > 0 ? <span className="text-blue-600">{formatRM(row.refunded)}</span> : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <UnresolvedCell unresolved={row.unresolved} knockedOff={row.knocked_off} refunded={row.refunded} />
                  </td>
                  <td className="px-3 py-2 max-w-[180px] truncate" title={row.reason}>{row.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
