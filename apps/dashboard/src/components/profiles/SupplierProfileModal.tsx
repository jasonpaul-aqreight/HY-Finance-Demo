'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DateRangeSection } from '@/components/shared/DateRangeSection';
import {
  ArrowLeft,
  ChevronRight,
  Search,
  Package,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
} from 'recharts';
import { formatRM, formatCount, marginColor } from '@/lib/supplier-margin/format';
import { SearchableSelect } from '@/components/sales/dashboard-v2/SearchableSelect';
import {
  useSupplierDetails,
  useSupplierPerformance,
  useSupplierProfileSummary,
  useSupplierItems,
  useSupplierItemTrends,
} from '@/hooks/supplier-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import { SparklineTooltip, type SparklineTooltipColumn } from '@/components/shared/SparklineTooltip';
import { formatMonth } from '@/lib/format-month';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function compactRM(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function localMarginColor(pct: number | null | undefined): string {
  if (pct == null || !isFinite(pct)) return 'text-foreground/60';
  if (pct >= 20) return 'text-emerald-600';
  if (pct >= 10) return 'text-amber-600';
  return 'text-red-600';
}

// ─── Shared UI Pieces ────────────────────────────────────────────────────────

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-foreground/30">{'\u21C5'}</span>;
  return <span className="ml-1">{asc ? '\u2191' : '\u2193'}</span>;
}

function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="rounded-md bg-primary/5 border border-primary/10 px-4 py-2.5 mb-4">
      <div className="flex items-baseline gap-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{children}</h3>
        {subtitle && <span className="text-xs font-medium text-foreground/50">{subtitle}</span>}
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-center">
      <div className="text-xs font-medium text-foreground/60 mb-0.5">{label}</div>
      <div className="text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-foreground/60 shrink-0">{label}</span>
      <span className="font-semibold text-foreground text-right">{value || '—'}</span>
    </div>
  );
}

function LogButton({ icon, label, onClick }: {
  icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between px-5 py-4 hover:bg-muted/60 transition-colors">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-foreground/40" />
    </button>
  );
}

type ItemMonthlyRow = { month: string; avg_price: number; qty: number };

const itemPriceColumns: SparklineTooltipColumn<ItemMonthlyRow>[] = [
  { header: 'Month', align: 'left', render: (r) => <span className="text-foreground/70">{formatMonth(r.month)}</span> },
  { header: 'Avg Price', align: 'right', render: (r) => <span className="font-mono">RM {r.avg_price.toFixed(2)}</span> },
  { header: 'Qty', align: 'right', render: (r) => <span className="tabular-nums">{formatCount(r.qty)}</span> },
];

function PriceTrendCell({ description, trend }: {
  description: string;
  trend: { prices: number[]; monthly: ItemMonthlyRow[] } | undefined;
}) {
  const monthly = trend?.monthly ?? [];
  if (monthly.length < 2) return null;

  return (
    <SparklineTooltip<ItemMonthlyRow>
      title={description}
      data={monthly}
      periodKey="month"
      valueKey="avg_price"
      valueLabel="Avg Price"
      valueFormatter={(v) => `RM ${v.toFixed(2)}`}
      improvementDirection="down"
      columns={itemPriceColumns}
    />
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveView = 'profile' | 'items';

interface SupplierProfileModalProps {
  open: boolean;
  onClose: () => void;
  creditorCode: string;
  companyName: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialView?: ActiveView;
  supplierMetrics?: {
    attributed_revenue: number;
    attributed_cogs: number;
    attributed_profit: number;
    margin_pct: number | null;
    items_supplied: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SupplierProfileModal({
  open, onClose, creditorCode, companyName,
  initialStartDate, initialEndDate, initialView = 'profile',
}: SupplierProfileModalProps) {
  const [activeView, setActiveView] = useState<ActiveView>(initialView);
  const defaultStart = initialStartDate ?? '';
  const defaultEnd = initialEndDate ?? '';
  const [perfStart, setPerfStart] = useState(defaultStart);
  const [perfEnd, setPerfEnd] = useState(defaultEnd);
  const [itemStart, setItemStart] = useState(defaultStart);
  const [itemEnd, setItemEnd] = useState(defaultEnd);
  const [itemSearch, setItemSearch] = useState('');

  // Data hooks
  const { data: details } = useSupplierDetails(open ? creditorCode : null);
  const { data: profileSummary } = useSupplierProfileSummary(open ? creditorCode : null, perfStart, perfEnd);
  const { data: performance } = useSupplierPerformance(open ? creditorCode : null, perfStart, perfEnd);

  const isActive = details?.is_active ?? true;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl flex flex-col" style={{ width: '90vw', height: '90vh' }}>
        {/* ─── HEADER ─────────────────────────────────────────────────── */}
        <div className="flex items-center px-6 py-4 border-b bg-background shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold text-foreground leading-tight truncate">{companyName}</h2>
            <div className="flex items-center gap-2.5 mt-1">
              <p className="text-base text-foreground/60 font-medium">{creditorCode}</p>
              {isActive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />ACTIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />INACTIVE
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1 text-xs font-bold text-white tracking-wider">SUPPLIER</span>
            <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted transition-colors text-foreground/50 hover:text-foreground">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        {/* ─── BODY ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {activeView === 'profile' ? (
            <ProfileView
              details={details}
              profileSummary={profileSummary}
              performance={performance}
              perfStart={perfStart}
              perfEnd={perfEnd}
              setPerfStart={setPerfStart}
              setPerfEnd={setPerfEnd}
              setActiveView={setActiveView}
            />
          ) : (
            <ItemsView
              creditorCode={creditorCode}
              itemStart={itemStart}
              itemEnd={itemEnd}
              setItemStart={setItemStart}
              setItemEnd={setItemEnd}
              itemSearch={itemSearch}
              setItemSearch={setItemSearch}
              onBack={() => setActiveView('profile')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE VIEW
// ═══════════════════════════════════════════════════════════════════════════════

interface SupplierDetailsData {
  creditor_type: string;
  purchase_agent: string;
  supplier_since: string;
  pic: string;
  phone: string;
  mobile: string;
  email: string;
  payment_terms: string;
  credit_limit: number;
  currency: string;
}

interface ProfileSummaryData {
  items_supplied_count: number;
  single_supplier_count: number;
  total_variant_count: number;
}

interface PerformanceData {
  margin_trend: Array<{ period: string; purchase_cost: number; attributed_revenue: number; margin_pct: number | null }>;
  top_items: Array<{ item: string; profit: number; margin_pct: number }>;
  total_purchase_cost: number;
  attributed_revenue: number;
  attributed_profit: number;
  avg_margin: number;
}

function ProfileView({
  details, profileSummary, performance,
  perfStart, perfEnd, setPerfStart, setPerfEnd, setActiveView,
}: {
  details: SupplierDetailsData | undefined;
  profileSummary: ProfileSummaryData | undefined;
  performance: PerformanceData | undefined;
  perfStart: string; perfEnd: string;
  setPerfStart: (d: string) => void; setPerfEnd: (d: string) => void;
  setActiveView: (view: ActiveView) => void;
}) {
  const [topItemsMode, setTopItemsMode] = useState<'profit' | 'margin_pct'>('profit');
  const s = details;
  const perf = performance;
  const totalPurchaseCost = perf?.total_purchase_cost ?? 0;
  const avgMargin = perf?.avg_margin ?? 0;
  const attributedProfit = perf?.attributed_profit ?? 0;
  const itemsSupplied = profileSummary?.items_supplied_count ?? 0;
  const soleCount = profileSummary?.single_supplier_count ?? 0;
  const totalVariants = profileSummary?.total_variant_count ?? 0;
  const topItems = perf?.top_items ?? [];

  return (
    <div className="px-6 py-5 space-y-8">
      {/* ─── SUPPLIER DETAILS + LOG ──────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-[1fr_auto] gap-6">
          {/* Details (left) */}
          <div>
            <SectionTitle>Supplier Details</SectionTitle>
            <div className="grid grid-cols-3 divide-x rounded-lg border overflow-hidden">
              <div className="p-4 space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-widest border-b pb-2">General</h4>
                <div className="space-y-2 text-sm">
                  <DetailRow label="Supplier Type" value={s?.creditor_type ?? '—'} />
                  <DetailRow label="Purchase Agent" value={s?.purchase_agent ?? '—'} />
                  <DetailRow label="Supplier Since" value={s?.supplier_since ? new Date(s.supplier_since).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
                </div>
              </div>
              <div className="p-4 space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-widest border-b pb-2">Contact</h4>
                <div className="space-y-2 text-sm">
                  <DetailRow label="Contact Person" value={s?.pic ?? '—'} />
                  <DetailRow label="Phone" value={s?.phone ?? '—'} />
                  <DetailRow label="Mobile" value={s?.mobile ?? '—'} />
                  <DetailRow label="Email" value={s?.email ?? '—'} />
                </div>
              </div>
              <div className="p-4 space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-widest border-b pb-2">Terms</h4>
                <div className="space-y-2 text-sm">
                  <DetailRow label="Payment Terms" value={s?.payment_terms ?? '—'} />
                  <DetailRow label="Credit Limit" value={s && s.credit_limit > 0 ? formatRM(s.credit_limit) : 'N/A'} />
                  <DetailRow label="Currency" value={s?.currency ?? 'MYR'} />
                </div>
              </div>
            </div>
          </div>

          {/* Log (right) */}
          <div className="w-96">
            <SectionTitle>Log</SectionTitle>
            <div className="rounded-lg border overflow-hidden">
              <LogButton
                icon={<Package className="h-5 w-5 text-foreground/40" />}
                label="Items Supplied"
                onClick={() => setActiveView('items')}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── PERFORMANCE (Statistics + Trends, one date picker) ─────── */}
      <section>
        <SectionTitle>Performance</SectionTitle>
        <div className="mb-4">
          <DateRangeSection label="Date Range" startDate={perfStart} endDate={perfEnd} onStartDateChange={setPerfStart} onEndDateChange={setPerfEnd} showPresets showRangeSummary={false} />
        </div>

        {/* Statistics — 2 KPI cards */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Card><CardContent className="flex flex-col items-center pt-4 pb-4">
            <p className="text-sm font-bold text-foreground mb-3">Margin Performance</p>
            <MarginGauge value={avgMargin} />
          </CardContent></Card>

          <Card><CardContent className="flex flex-col items-center pt-4 pb-4">
            <p className="text-sm font-bold text-foreground mb-3">Supply Dependency</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-4xl font-extrabold text-amber-600">{soleCount}</span>
              <span className="text-lg text-foreground/50 font-medium">/ {totalVariants}</span>
            </div>
            <p className="text-xs text-foreground/50 mt-1">product variants with no alternative supplier</p>
            <SupplyDependencyBar sole={soleCount} total={totalVariants} />
          </CardContent></Card>
        </div>

        {/* Trends — 2 charts */}
        <div className="grid grid-cols-2 gap-4">
          <Card size="sm"><CardContent>
            <p className="text-sm font-bold text-foreground mb-2">Purchase Trend &amp; Margin</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <KpiCard label="Accumulated Purchase Cost" value={formatRM(totalPurchaseCost)} />
              <KpiCard label="Avg Gross Margin" value={`${avgMargin.toFixed(1)}%`} />
              <KpiCard label="Est. Gross Profit" value={formatRM(Math.round(attributedProfit))} />
            </div>
            {perf && perf.margin_trend.length > 0 ? (
              <PurchaseMarginChart data={perf.margin_trend} />
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-foreground/50">No trend data</div>
            )}
          </CardContent></Card>

          <Card size="sm"><CardContent>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-foreground">Top 5 Items</p>
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  onClick={() => setTopItemsMode('profit')}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${topItemsMode === 'profit' ? 'bg-foreground text-background' : 'bg-background text-foreground/60 hover:bg-muted/50'}`}
                >Est. Gross Profit</button>
                <button
                  onClick={() => setTopItemsMode('margin_pct')}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${topItemsMode === 'margin_pct' ? 'bg-foreground text-background' : 'bg-background text-foreground/60 hover:bg-muted/50'}`}
                >Margin %</button>
              </div>
            </div>
            {(() => {
              const sorted = [...topItems].sort((a, b) => topItemsMode === 'profit' ? b.profit - a.profit : b.margin_pct - a.margin_pct);
              const top = sorted[0];
              return (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <KpiCard label="Top Item" value={top?.item?.split(' ')[0] ?? '—'} />
                    <KpiCard label={topItemsMode === 'profit' ? 'Est. Top Profit' : 'Top Margin'} value={top ? (topItemsMode === 'profit' ? formatRM(top.profit) : `${top.margin_pct.toFixed(1)}%`) : '—'} />
                    <KpiCard label="Top 5 Total" value={topItemsMode === 'profit' ? formatRM(sorted.reduce((sum, i) => sum + i.profit, 0)) : `${(sorted.reduce((sum, i) => sum + i.margin_pct, 0) / (sorted.length || 1)).toFixed(1)}%`} />
                  </div>
                  {sorted.length > 0 ? (
                    <TopItemsChart data={sorted} mode={topItemsMode} />
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-sm text-foreground/50">No item data</div>
                  )}
                </>
              );
            })()}
          </CardContent></Card>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ITEMS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function ItemsView({ creditorCode, itemStart, itemEnd, setItemStart, setItemEnd, itemSearch, setItemSearch, onBack }: {
  creditorCode: string;
  itemStart: string; itemEnd: string;
  setItemStart: (d: string) => void; setItemEnd: (d: string) => void;
  itemSearch: string; setItemSearch: (s: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-4 mb-5">
        <button onClick={onBack} className="shrink-0 rounded-full border p-2 hover:bg-muted transition-colors text-foreground/60 hover:text-foreground" title="Back to Profile">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground">Items Supplied</h3>
          <p className="flex items-start gap-1.5 text-xs text-foreground/70 mt-0.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="flex flex-col gap-0.5"><span><strong>Est.</strong> = Estimated — the system does not track which supplier's stock was sold to which customer, so revenue, cost of sales, and profit are split based on each supplier's share of total purchases.</span><span>Qty Purchased, Avg Purchase / Unit, and Total Spend use actual data from purchase invoices.</span></span>
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <input
            type="text"
            placeholder="Search item code or name..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
      </div>
      <div className="mb-4">
        <DateRangeSection label="Date Range" startDate={itemStart} endDate={itemEnd} onStartDateChange={setItemStart} onEndDateChange={setItemEnd} showPresets showRangeSummary={false} />
      </div>
      <ItemsSuppliedTable creditorCode={creditorCode} startDate={itemStart} endDate={itemEnd} search={itemSearch} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS VISUALS
// ═══════════════════════════════════════════════════════════════════════════════

function MarginGauge({ value }: { value: number }) {
  const s = Math.max(0, Math.min(50, value));
  const angle = (s / 50) * 180;
  const rad = (angle * Math.PI) / 180;
  const r = 70; const cx = 80; const cy = 80;
  const x = cx - r * Math.cos(rad); const y = cy - r * Math.sin(rad);
  const color = s >= 20 ? '#10b981' : s >= 10 ? '#f59e0b' : '#ef4444';
  return (
    <svg viewBox="0 0 160 95" className="w-40 h-24">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
      {s > 0 && <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />}
      <text x={cx} y={cy - 12} textAnchor="middle" fill={color} fontSize="28" fontWeight="800">{value.toFixed(1)}%</text>
      <text x={cx} y={cy + 6} textAnchor="middle" fill="#6b7280" fontSize="11">of 50% scale</text>
    </svg>
  );
}

function SupplyDependencyBar({ sole, total }: { sole: number; total: number }) {
  const multiPct = total > 0 ? ((total - sole) / total) * 100 : 100;
  const solePct = total > 0 ? (sole / total) * 100 : 0;
  return (
    <div className="w-full mt-3 space-y-1.5">
      <div className="flex h-4 rounded-full overflow-hidden">
        <div style={{ width: `${multiPct}%` }} className="bg-blue-500 transition-all" title={`Multi-source: ${total - sole}`} />
        <div style={{ width: `${solePct}%` }} className="bg-amber-500 transition-all" title={`Sole supplier: ${sole}`} />
      </div>
      <div className="flex justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-foreground/70">Multi-source ({total - sole})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span className="text-foreground/70">Sole supplier ({sole})</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREND CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function PurchaseMarginChart({ data }: { data: Array<{ period: string; purchase_cost: number; margin_pct: number | null }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="period" tickFormatter={formatMonth} tick={{ fontSize: 10 }} />
        <YAxis yAxisId="left" tickFormatter={compactRM} tick={{ fontSize: 10 }} width={40} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} width={35} domain={[0, 'auto']} />
        <Tooltip formatter={(value: any, name: any) => name === 'Margin %' ? [`${Number(value).toFixed(1)}%`, name] : [formatRM(Number(value)), name]} labelFormatter={(l: any) => formatMonth(String(l))} />
        <Bar yAxisId="left" dataKey="purchase_cost" name="Purchase Cost" fill="#6366f1" radius={[2, 2, 0, 0]} />
        <Line yAxisId="right" dataKey="margin_pct" name="Margin %" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function truncateLabel(text: string, maxLen = 28): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

function TopItemsChart({ data, mode }: { data: Array<{ item: string; profit: number; margin_pct: number }>; mode: 'profit' | 'margin_pct' }) {
  const chartData = mode === 'margin_pct'
    ? [...data].sort((a, b) => b.margin_pct - a.margin_pct)
    : data;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tickFormatter={mode === 'profit' ? compactRM : (v: number) => `${v}%`} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="item" tick={{ fontSize: 9 }} width={160} tickFormatter={(v: string) => truncateLabel(v)} />
        <Tooltip formatter={(value: any) => mode === 'profit' ? [formatRM(Number(value)), 'Est. Gross Profit'] : [`${Number(value).toFixed(1)}%`, 'Margin %']} />
        <Bar dataKey={mode} name={mode === 'profit' ? 'Est. Gross Profit' : 'Margin %'} fill={mode === 'profit' ? '#10b981' : '#6366f1'} radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ITEMS SUPPLIED TABLE (with sparklines + sole supplier toggle)
// ═══════════════════════════════════════════════════════════════════════════════

type ItemSortKey = 'item_code' | 'description' | 'qty_purchased' | 'avg_purchase_price' | 'revenue' | 'cogs' | 'margin_pct';

interface ItemRow {
  item_code: string;
  description: string;
  item_group: string | null;
  qty_purchased: number;
  avg_purchase_price: number | null;
  qty_sold: number;
  revenue: number;
  cogs: number;
  margin_pct: number | null;
}

function ItemsSuppliedTable({ creditorCode, startDate, endDate, search }: {
  creditorCode: string; startDate: string; endDate: string; search: string;
}) {
  const [sortKey, setSortKey] = useState<ItemSortKey>('margin_pct');
  const [sortAsc, setSortAsc] = useState(false);
  const [soleOnly, setSoleOnly] = useState(false);
  const [fruitFilter, setFruitFilter] = useState('');
  const [variantFilter, setVariantFilter] = useState('');

  const { data: rawData } = useSupplierItems(creditorCode, { startDate, endDate, granularity: 'monthly', suppliers: [], itemGroups: [] });
  const data = useStableData(rawData);
  const items = ((data as any)?.data ?? data ?? []) as ItemRow[];

  const { data: summaryData } = useSupplierProfileSummary(creditorCode, startDate, endDate);
  const singleSet = useMemo(() => new Set(summaryData?.single_supplier_items ?? []), [summaryData]);
  const soleCount = summaryData?.single_supplier_count ?? 0;

  const { data: trendsData } = useSupplierItemTrends(creditorCode, startDate, endDate);
  const trendMap = useMemo(() => {
    const map = new Map<string, { prices: number[]; monthly: { month: string; avg_price: number; qty: number }[] }>();
    if (trendsData?.data) {
      for (const t of trendsData.data) map.set(t.item_code, { prices: t.prices, monthly: t.monthly });
    }
    return map;
  }, [trendsData]);

  // Parse fruit name (1st word) and variant (3rd word onward before size/pack info) from description
  const parseFruit = (desc: string): { fruit: string; variant: string } => {
    const words = desc.split(' ');
    const fruit = words[0] ?? '';
    // Pattern: FRUIT COUNTRY VARIANT... (variant is 3rd word onward, stop at numbers/size markers)
    const variantWords: string[] = [];
    for (let i = 2; i < words.length; i++) {
      if (/^\d|^[XSML]{1,3}$|^PCS$|^KG$/i.test(words[i])) break;
      variantWords.push(words[i]);
    }
    return { fruit, variant: variantWords.join(' ') || '(Unknown)' };
  };

  // Dynamic fruit/variant options derived from current items (interdependent filtering)
  const fruitOptions = useMemo(() => {
    let filtered = items;
    if (variantFilter) filtered = filtered.filter(i => parseFruit(i.description).variant === variantFilter);
    const set = new Set(filtered.map(i => parseFruit(i.description).fruit).filter(Boolean));
    return [...set].sort();
  }, [items, variantFilter]);

  const variantOptions = useMemo(() => {
    let filtered = items;
    if (fruitFilter) filtered = filtered.filter(i => parseFruit(i.description).fruit === fruitFilter);
    const set = new Set(filtered.map(i => parseFruit(i.description).variant).filter(v => v && v !== '(Unknown)'));
    return [...set].sort();
  }, [items, fruitFilter]);

  const rows = useMemo(() => {
    let result = items;
    if (soleOnly) result = result.filter(i => singleSet.has(i.item_code));
    if (fruitFilter) result = result.filter(i => parseFruit(i.description).fruit === fruitFilter);
    if (variantFilter) result = result.filter(i => parseFruit(i.description).variant === variantFilter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r => r.item_code.toLowerCase().includes(s) || r.description.toLowerCase().includes(s));
    }
    return [...result].sort((a, b) => {
      const av = (a as any)[sortKey] ?? ''; const bv = (b as any)[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [items, search, sortKey, sortAsc, soleOnly, singleSet, fruitFilter, variantFilter]);

  function handleSort(key: ItemSortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'item_code' || key === 'description'); }
  }

  const TH = ({ col, label, align }: { col: ItemSortKey; label: string; align?: 'right' }) => (
    <th className={`px-3 py-2.5 cursor-pointer select-none hover:bg-muted/50 text-xs font-semibold text-foreground ${align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => handleSort(col)}>
      {label}<SortIcon active={sortKey === col} asc={sortAsc} />
    </th>
  );

  const isLoading = !data;

  return (
    <div className="space-y-3">
      {/* Filters: sole supplier toggle (left) + fruit/variant dropdowns (right) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoleOnly(!soleOnly)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              soleOnly
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-background border-input text-foreground/70 hover:bg-muted/50'
            }`}
          >
            <AlertTriangle className={`h-3.5 w-3.5 ${soleOnly ? 'text-amber-600' : 'text-foreground/40'}`} />
            Sole Source Only
            <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
              soleOnly ? 'bg-amber-200 text-amber-800' : 'bg-muted text-foreground/50'
            }`}>{soleCount}</span>
          </button>
          {soleOnly && (
            <p className="text-xs text-amber-700">
              Sole source — no other supplier supplies these product varieties. Dependency is assessed by fruit type, not individual SKU.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <SearchableSelect
            value={fruitFilter}
            onChange={(val) => { setFruitFilter(val); if (!val) setVariantFilter(''); }}
            options={fruitOptions}
            placeholder="All Products"
            searchPlaceholder="Search product..."
            className="w-[160px]"
          />
          <SearchableSelect
            value={variantFilter}
            onChange={setVariantFilter}
            options={variantOptions}
            placeholder="All Variants"
            searchPlaceholder="Search variant..."
            className="w-[200px]"
            popoverWidth="w-[280px]"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="py-8 text-center text-sm text-foreground/50">Loading purchase items...</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-foreground/50">
          {search ? 'No items match your search.' : 'No purchase records.'}
        </p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30">
              <th className="px-3 py-2.5 w-8"></th>
              <TH col="item_code" label="Item Code" />
              <TH col="description" label="Description" />
              <TH col="qty_purchased" label="Qty Purchased" align="right" />
              <TH col="avg_purchase_price" label="Avg Purchase / Unit" align="right" />
              <th className="px-3 py-2.5 text-xs font-semibold text-foreground">Price Trend</th>
              <TH col="revenue" label="Est. Revenue" align="right" />
              <TH col="cogs" label="Est. Cost of Sales" align="right" />
              <TH col="margin_pct" label="Margin %" align="right" />
            </tr></thead>
            <tbody>{rows.map((item) => {
              const isSole = singleSet.has(item.item_code);
              const trend = trendMap.get(item.item_code);
              return (
                <tr key={item.item_code} className={`border-b last:border-0 hover:bg-muted/20 ${isSole ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-3 py-1.5 text-center">
                    {isSole && <span title="Sole Supplier"><AlertTriangle className="size-4 text-amber-500" /></span>}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">{item.item_code}</td>
                  <td className="px-3 py-1.5 max-w-[280px] truncate">{item.description}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCount(item.qty_purchased)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-mono">{item.avg_purchase_price != null ? formatRM(item.avg_purchase_price, 2) : '—'}</td>
                  <td className="px-3 py-1.5"><PriceTrendCell description={item.description} trend={trend} /></td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-mono">{formatRM(item.revenue)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-mono">{formatRM(item.cogs)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${localMarginColor(item.margin_pct)}`}>
                    {item.margin_pct != null ? `${item.margin_pct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
          <div className="px-3 py-2.5 bg-muted/30 text-xs text-foreground/70 border-t">
            Showing {rows.length} item{rows.length !== 1 ? 's' : ''}
            {soleOnly && ' (sole source variants only)'}
            {search && !soleOnly && ` matching "${search}"`}
          </div>
        </div>
      )}
    </div>
  );
}
