'use client';

import { useState, useMemo } from 'react';
import { formatRM } from '@/lib/payment/format';
import { useCustomerInvoices } from '@/hooks/payment/usePaymentDataV2';

interface PaymentTabProps {
  debtorCode: string;
  metrics?: unknown;
}

type SortKey = 'doc_no' | 'doc_date' | 'due_date' | 'local_net_total' | 'outstanding' | 'days_overdue';

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40">{'\u21C5'}</span>;
  return <span className="ml-1">{asc ? '\u2191' : '\u2193'}</span>;
}

export function PaymentTab({ debtorCode }: PaymentTabProps) {
  const { data, isLoading } = useCustomerInvoices(debtorCode);
  const invoices = (data ?? []) as {
    doc_no: string; doc_date: string; due_date: string;
    local_net_total: number; outstanding: number; days_overdue: number;
  }[];

  const [sortKey, setSortKey] = useState<SortKey>('days_overdue');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...invoices].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [invoices, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'doc_no' || key === 'doc_date' || key === 'due_date'); }
  }

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading invoices…</p>;

  const TH = ({ col, label, align }: { col: SortKey; label: string; align?: 'right' }) => (
    <th className={`px-3 py-2 cursor-pointer select-none hover:bg-muted/50 ${align === 'right' ? 'text-right' : ''}`} onClick={() => handleSort(col)}>
      {label}<SortIcon active={sortKey === col} asc={sortAsc} />
    </th>
  );

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">Pending Invoices</h4>
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No outstanding invoices.</p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <TH col="doc_no" label="Invoice No." />
                <TH col="doc_date" label="Invoice Date" />
                <TH col="due_date" label="Due Date" />
                <TH col="local_net_total" label="Total (RM)" align="right" />
                <TH col="outstanding" label="Outstanding (RM)" align="right" />
                <TH col="days_overdue" label="Days Overdue" align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((inv) => (
                <tr key={inv.doc_no} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs">{inv.doc_no}</td>
                  <td className="px-3 py-2">{inv.doc_date}</td>
                  <td className="px-3 py-2">{inv.due_date}</td>
                  <td className="px-3 py-2 text-right">{formatRM(inv.local_net_total, 2)}</td>
                  <td className="px-3 py-2 text-right">{formatRM(inv.outstanding, 2)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${inv.days_overdue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {inv.days_overdue > 0 ? `${inv.days_overdue}` : `${inv.days_overdue} (not due)`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
