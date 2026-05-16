'use client';

import { useV3Kpis, useV3BSComparison, useV3VarianceKpi, type V3VarianceKpiTile } from '@/hooks/pnl/usePLDataV3';
import { useStableData } from '@/hooks/useStableData';
import { Card, CardContent } from '@/components/ui/card';
import { formatRM, formatPct } from '@/lib/pnl/format';
import { cn } from '@/lib/utils';
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';
import {
  getBudgetPosition,
  getBudgetPositionLabel,
  isBudgetPositionFavourable,
} from '@/lib/budget/status';

interface Props {
  fy: string;
  range?: string;
}

interface BudgetInfo {
  varianceRm: number | null;
  variancePct: number | null;
  yoyPct: number | null;
  tolerancePct: number | null;
  higherIsBetter: boolean;
  isFavourable: boolean | null;
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  valueColor?: 'red' | 'green' | null;
  componentKey?: string;
  budget?: BudgetInfo;
}

function signedRm(value: number | null): string {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatRM(value)}`;
}

function signedPct(value: number | null): string {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatPct(value)}`;
}

function StatusBadge({ budget }: { budget: BudgetInfo }) {
  const position = getBudgetPosition({
    varianceRm: budget.varianceRm,
    variancePct: budget.variancePct,
    tolerancePct: budget.tolerancePct,
    higherIsBetter: budget.higherIsBetter,
  });
  const favourable = isBudgetPositionFavourable(position);

  if (position === 'no-budget') {
    return (
      <span className="inline-flex items-center rounded-full border border-foreground/20 bg-background px-2 py-0.5 text-xs font-semibold text-foreground">
        No Budget
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
        favourable
          ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
          : 'border-red-700 bg-red-50 text-red-900',
      )}
    >
      {getBudgetPositionLabel(position)}
    </span>
  );
}

function KpiCard({ title, value, subtitle, valueColor, componentKey, budget }: KpiCardProps) {
  const varianceColor = budget?.isFavourable == null
    ? 'text-foreground'
    : budget.isFavourable
      ? 'text-emerald-800'
      : 'text-red-800';
  const lastYearColor = budget?.yoyPct == null || budget.yoyPct === 0
    ? 'text-foreground'
    : (budget.higherIsBetter ? budget.yoyPct > 0 : budget.yoyPct < 0)
      ? 'text-emerald-800'
      : 'text-red-800';

  return (
    <Card className="rounded-xl ring-1 ring-foreground/10">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-foreground uppercase tracking-wide flex items-center gap-1">
            {title}
            {componentKey && <AnalyzeIcon sectionKey="financial_overview" componentKey={componentKey} />}
          </p>
          {budget && <StatusBadge budget={budget} />}
        </div>
        <p className={cn(
          'mt-1 text-2xl font-bold',
          valueColor === 'red' && 'text-red-600',
          valueColor === 'green' && 'text-emerald-600',
        )}>
          {value}
        </p>
        {subtitle && !budget && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {budget && (
          <div className="mt-3 flex items-start justify-between gap-4 text-xs">
            <div className="min-w-0 text-left">
              <p className="whitespace-nowrap font-semibold text-foreground">vs Budget</p>
              <p className={cn('mt-0.5 whitespace-nowrap font-semibold', varianceColor)}>
                {signedRm(budget.varianceRm)}
              </p>
            </div>
            <div className="min-w-0 text-center">
              <p className="whitespace-nowrap font-semibold text-foreground">Variance %</p>
              <p className={cn('mt-0.5 whitespace-nowrap font-semibold', varianceColor)}>
                {signedPct(budget.variancePct)}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="whitespace-nowrap font-semibold text-foreground">Last Year</p>
              <p className={cn('mt-0.5 whitespace-nowrap font-semibold', lastYearColor)}>
                {signedPct(budget.yoyPct)}
              </p>
            </div>
          </div>
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

function tileToBudgetInfo(tile: V3VarianceKpiTile | undefined): BudgetInfo | undefined {
  if (!tile) return undefined;
  return {
    varianceRm: tile.varianceRm,
    variancePct: tile.variancePct,
    yoyPct: tile.yoyPct,
    tolerancePct: tile.tolerancePct,
    higherIsBetter: tile.higherIsBetter,
    isFavourable: tile.isFavourable,
  };
}

export function PLKpiCardsV3({ fy, range = 'fy' }: Props) {
  const { data: rawData } = useV3Kpis(fy);
  const data = useStableData(rawData);
  const { data: rawBsData } = useV3BSComparison(fy);
  const bsData = useStableData(rawBsData);
  const { data: rawVariance } = useV3VarianceKpi(fy, range);
  const variance = useStableData(rawVariance);

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

  let currentRatio = 0;
  if (bsData) {
    const ca = bsData.current.current_assets;
    const cl = Math.abs(bsData.current.current_liabilities);
    currentRatio = cl !== 0 ? ca / cl : 0;
  }

  const tileByCode = new Map((variance?.tiles ?? []).map((tile) => [tile.code, tile]));

  const row1: KpiCardProps[] = [
    {
      title: 'Net Sales',
      value: formatRM(data.net_sales),
      componentKey: 'fin_net_sales',
      budget: tileToBudgetInfo(tileByCode.get('NS')),
    },
    {
      title: 'Cost of Sales',
      value: formatRM(cogs),
      subtitle: 'Direct costs of products sold',
      componentKey: 'fin_cost_of_sales',
      budget: tileToBudgetInfo(tileByCode.get('CO')),
    },
    {
      title: 'Gross Profit',
      value: formatRM(data.gross_profit),
      subtitle: 'Sales - Cost of Sales',
      valueColor: data.gross_profit < 0 ? 'red' : 'green',
      componentKey: 'fin_gross_profit',
    },
    {
      title: 'Operating Costs',
      value: formatRM(data.expenses),
      subtitle: 'Day-to-day business costs',
      componentKey: 'fin_operating_costs',
      budget: tileToBudgetInfo(tileByCode.get('EP')),
    },
  ];

  const row2: KpiCardProps[] = [
    {
      title: 'Operating Profit',
      value: formatRM(operating_profit),
      subtitle: 'Gross Profit − Operating Costs',
      valueColor: operating_profit < 0 ? 'red' : 'green',
      componentKey: 'fin_operating_profit',
    },
    {
      title: 'Profit/Loss',
      value: formatRM(data.net_profit),
      subtitle: `Operating Profit + Other Income - Tax | Margin: ${formatPct(net_margin_pct)}`,
      valueColor: data.net_profit < 0 ? 'red' : 'green',
      componentKey: 'fin_net_profit',
    },
    {
      title: 'Expense Ratio',
      value: formatPct(data.expense_ratio),
      subtitle: 'Operating Costs ÷ Net Sales',
    },
    {
      title: 'Current Ratio',
      value: currentRatio.toFixed(2),
      subtitle: 'Current Assets / Current Liabilities',
      valueColor: bsData ? (currentRatio >= 1 ? 'green' : 'red') : null,
    },
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
