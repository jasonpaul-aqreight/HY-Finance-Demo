'use client';

import { useV3Kpis, useV3BSComparison } from '@/hooks/pnl/usePLDataV3';
import { useStableData } from '@/hooks/useStableData';
import { Card, CardContent } from '@/components/ui/card';
import { formatRM, formatPct } from '@/lib/pnl/format';
import { cn } from '@/lib/utils';
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';

interface Props {
  fy: string;
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  alarm?: 'positive' | 'negative' | null;
  valueColor?: 'red' | 'green' | null;
  componentKey?: string;
}

function KpiCard({ title, value, subtitle, alarm, valueColor, componentKey }: KpiCardProps) {
  return (
    <Card className={cn(
      'rounded-xl',
      alarm === 'negative' && 'ring-2 ring-red-500/50 bg-red-50/50',
      alarm === 'positive' && 'ring-2 ring-emerald-500/50 bg-emerald-50/50',
      !alarm && 'ring-1 ring-foreground/10',
    )}>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
          {title}
          {componentKey && <AnalyzeIcon sectionKey="financial_overview" componentKey={componentKey} />}
        </p>
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
  const { data: rawData } = useV3Kpis(fy);
  const data = useStableData(rawData);
  const { data: rawBsData } = useV3BSComparison(fy);
  const bsData = useStableData(rawBsData);

  if (!data) {
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

  // Row 1: Revenue & Costs — 4 of the 6 AI-analyzable profitability waterfall metrics
  const row1: KpiCardProps[] = [
    { title: 'Net Sales', value: formatRM(data.net_sales), componentKey: 'fin_net_sales' },
    { title: 'Cost of Sales', value: formatRM(cogs),
      subtitle: 'Direct costs of products sold',
      componentKey: 'fin_cost_of_sales' },
    { title: 'Gross Profit', value: formatRM(data.gross_profit),
      subtitle: 'Sales - Cost of Sales',
      valueColor: data.gross_profit < 0 ? 'red' : 'green',
      componentKey: 'fin_gross_profit' },
    { title: 'Operating Costs', value: formatRM(data.expenses),
      subtitle: 'Day-to-day business costs',
      componentKey: 'fin_operating_costs' },
  ];

  // Row 2: Profitability & Ratios — Operating Profit + Profit/Loss are the
  // remaining 2 AI-analyzable KPIs. Expense Ratio + Current Ratio are derivative /
  // balance-sheet metrics and intentionally not wired to the insight engine in §9.
  const row2: KpiCardProps[] = [
    { title: 'Operating Profit', value: formatRM(operating_profit),
      subtitle: 'Gross Profit − Operating Costs',
      alarm: operating_profit < 0 ? 'negative' : 'positive',
      valueColor: operating_profit < 0 ? 'red' : 'green',
      componentKey: 'fin_operating_profit' },
    { title: 'Profit/Loss', value: formatRM(data.net_profit),
      subtitle: `Operating Profit + Other Income - Tax | Margin: ${formatPct(net_margin_pct)}`,
      alarm: data.net_profit < 0 ? 'negative' : 'positive',
      valueColor: data.net_profit < 0 ? 'red' : 'green',
      componentKey: 'fin_net_profit' },
    { title: 'Expense Ratio', value: formatPct(data.expense_ratio),
      subtitle: 'Operating Costs ÷ Net Sales' },
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
