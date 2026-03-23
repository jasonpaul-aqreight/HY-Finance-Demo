'use client';

import { useV3Kpis, useV3BSComparison } from '@/hooks/pnl/usePLDataV3';
import { Card, CardContent } from '@/components/ui/card';
import { formatRM, formatPct } from '@/lib/pnl/format';
import { cn } from '@/lib/utils';

interface Props {
  fy: string;
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  alarm?: 'positive' | 'negative' | null;
  valueColor?: 'red' | 'green' | null;
}

function KpiCard({ title, value, subtitle, alarm, valueColor }: KpiCardProps) {
  return (
    <Card className={cn(
      'rounded-xl',
      alarm === 'negative' && 'ring-2 ring-red-500/50 bg-red-50/50',
      alarm === 'positive' && 'ring-2 ring-emerald-500/50 bg-emerald-50/50',
      !alarm && 'ring-1 ring-foreground/10',
    )}>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
        <p className={cn(
          'text-2xl font-bold',
          valueColor === 'red' && 'text-red-600',
          valueColor === 'green' && 'text-emerald-600',
        )}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="rounded-xl ring-1 ring-foreground/10">
          <CardContent className="p-4 h-24 animate-pulse bg-muted/30" />
        </Card>
      ))}
    </div>
  );
}

export function PLKpiCardsV3({ fy }: Props) {
  const { data, isLoading } = useV3Kpis(fy);
  const { data: bsData } = useV3BSComparison(fy);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  const cogs = data.net_sales - data.gross_profit;
  const operating_profit = data.gross_profit - data.expenses;
  const net_margin_pct = data.net_margin_pct;

  // Current Ratio from Balance Sheet
  let currentRatio = 0;
  if (bsData) {
    const ca = bsData.current.current_assets;
    const cl = Math.abs(bsData.current.current_liabilities);
    currentRatio = cl !== 0 ? ca / cl : 0;
  }

  // Row 1: Revenue & Costs
  const row1: KpiCardProps[] = [
    { title: 'Net Sales', value: formatRM(data.net_sales) },
    { title: 'COGS', value: formatRM(cogs),
      subtitle: 'Cost of Goods Sold' },
    { title: 'Gross Profit', value: formatRM(data.gross_profit),
      subtitle: 'Sales - COGS',
      valueColor: data.gross_profit < 0 ? 'red' : 'green' },
    { title: 'OPEX', value: formatRM(data.expenses),
      subtitle: 'Operating Expenses' },
  ];

  // Row 2: Profitability & Ratios
  const row2: KpiCardProps[] = [
    { title: 'Operating Profit (EBIT)', value: formatRM(operating_profit),
      subtitle: 'Gross Profit - OPEX',
      alarm: operating_profit < 0 ? 'negative' : 'positive',
      valueColor: operating_profit < 0 ? 'red' : 'green' },
    { title: 'Net Profit', value: formatRM(data.net_profit),
      subtitle: `EBIT + Other Income - Tax | Margin: ${formatPct(net_margin_pct)}`,
      alarm: data.net_profit < 0 ? 'negative' : 'positive',
      valueColor: data.net_profit < 0 ? 'red' : 'green' },
    { title: 'Expense Ratio', value: formatPct(data.expense_ratio),
      subtitle: 'OPEX / Net Sales' },
    { title: 'Current Ratio', value: currentRatio.toFixed(2),
      subtitle: 'Current Assets / Current Liabilities',
      alarm: currentRatio >= 1 ? 'positive' : (bsData ? 'negative' : null),
      valueColor: currentRatio >= 1 ? 'green' : (bsData ? 'red' : null) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {row1.map(card => (
          <KpiCard key={card.title} {...card} />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {row2.map(card => (
          <KpiCard key={card.title} {...card} />
        ))}
      </div>
    </div>
  );
}
