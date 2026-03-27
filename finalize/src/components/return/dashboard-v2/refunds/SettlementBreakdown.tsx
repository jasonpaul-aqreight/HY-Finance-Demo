'use client';

import { useRefundData } from '@/hooks/return/useCreditDataV2';
import { useStableData } from '@/hooks/useStableData';
import type { V2Filters } from '@/hooks/return/useDashboardFiltersV2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRM } from '@/lib/format';

function ProgressRow({ label, amount, pct, color }: { label: string; amount: number; pct: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span>{formatRM(amount)} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-muted rounded-full h-3">
        <div
          className={`h-3 rounded-full ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function SettlementBreakdown({ filters }: { filters: V2Filters }) {
  const { data: rawData } = useRefundData(filters);
  const data = useStableData(rawData);

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Settlement Breakdown</CardTitle></CardHeader>
        <CardContent><div className="h-[200px] bg-muted rounded animate-pulse" /></CardContent>
      </Card>
    );
  }

  const { summary } = data;

  return (
    <Card className="w-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Settlement Breakdown</CardTitle>

      </CardHeader>
      <CardContent className="space-y-4 px-4 flex-1 flex flex-col justify-center">
        <ProgressRow
          label="Knocked Off (against invoices)"
          amount={summary.total_knocked_off}
          pct={summary.knock_off_pct}
          color="bg-emerald-500"
        />
        <ProgressRow
          label="Refunded (cash/cheque)"
          amount={summary.total_refunded}
          pct={summary.refund_pct}
          color="bg-blue-500"
        />
        <ProgressRow
          label="Unresolved"
          amount={summary.total_unresolved}
          pct={summary.unresolved_pct}
          color="bg-red-500"
        />
      </CardContent>
    </Card>
  );
}
