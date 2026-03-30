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
  TrendingDown,
  TrendingUp,
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
import {
  format as fmtDate,
  subMonths,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

// ─── Date Helpers ────────────────────────────────────────────────────────────
function getDefaultDates() {
  const end = endOfMonth(new Date());
  const start = startOfMonth(subMonths(end, 11));
  return { start: fmtDate(start, 'yyyy-MM-dd'), end: fmtDate(end, 'yyyy-MM-dd') };
}

function formatMonth(ym: string) {
  if (!ym || !ym.includes('-')) return ym;
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function formatRM(value: number | null | undefined, decimals = 0): string {
  if (value == null) return 'RM 0';
  return `RM ${Math.abs(value).toLocaleString('en-MY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function compactRM(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function marginColor(pct: number | null | undefined): string {
  if (pct == null || !isFinite(pct)) return 'text-foreground/60';
  if (pct >= 20) return 'text-emerald-600';
  if (pct >= 10) return 'text-amber-600';
  return 'text-red-600';
}

// ─── Sort helpers ────────────────────────────────────────────────────────────
function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-foreground/30">{'\u21C5'}</span>;
  return <span className="ml-1">{asc ? '\u2191' : '\u2193'}</span>;
}

// ─── Types ───────────────────────────────────────────────────────────────────
type ActiveView = 'profile' | 'items';

interface Props {
  open: boolean;
  onClose: () => void;
}

// ─── Section Title ───────────────────────────────────────────────────────────
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

// ─── KPI Mini Card ───────────────────────────────────────────────────────────
function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-center">
      <div className="text-xs font-medium text-foreground/60 mb-0.5">{label}</div>
      <div className="text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

// ─── Detail Row ──────────────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-foreground/60 shrink-0">{label}</span>
      <span className="font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}

// ─── Log Button ──────────────────────────────────────────────────────────────
function LogButton({ icon, label, onClick, borderTop }: {
  icon: React.ReactNode; label: string;
  onClick: () => void; borderTop?: boolean;
}) {
  return (
    <button onClick={onClick} className={`flex w-full items-center justify-between px-5 py-4 hover:bg-muted/60 transition-colors ${borderTop ? 'border-t' : ''}`}>
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-foreground/40" />
    </button>
  );
}

// ─── Price Sparkline ─────────────────────────────────────────────────────────
function PriceSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <span className="text-xs text-foreground/40">—</span>;
  const first = data[0];
  const last = data[data.length - 1];
  const color = last <= first ? '#10b981' : '#ef4444';
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-[48px] w-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_SUPPLIER = {
  creditor_code: '400-C003',
  company_name: 'CHEW TONG HUAT FRUITS SDN BHD',
  is_active: true,
  creditor_type: 'Local Trade Creditor',
  supplier_since: '2019-03-15',
  purchase_agent: 'GAN',
  pic: 'Mr. Chew Kok Leong',
  phone: '03-9281 4455',
  mobile: '012-338 9901',
  email: 'chew.kl@cthfruits.com.my',
  payment_terms: 'C.O.D.',
  credit_limit: 0,
  currency: 'MYR',
  items_supplied: 47,
  sole_supplier_count: 8,
};

const MOCK_PURCHASE_MARGIN_TREND = [
  { period: '2025-04', purchase_cost: 82400, margin_pct: 18.2 },
  { period: '2025-05', purchase_cost: 91200, margin_pct: 17.5 },
  { period: '2025-06', purchase_cost: 78500, margin_pct: 19.1 },
  { period: '2025-07', purchase_cost: 95300, margin_pct: 16.8 },
  { period: '2025-08', purchase_cost: 88600, margin_pct: 17.9 },
  { period: '2025-09', purchase_cost: 102100, margin_pct: 15.3 },
  { period: '2025-10', purchase_cost: 97400, margin_pct: 16.1 },
  { period: '2025-11', purchase_cost: 85200, margin_pct: 18.4 },
  { period: '2025-12', purchase_cost: 110500, margin_pct: 14.7 },
  { period: '2026-01', purchase_cost: 93800, margin_pct: 17.2 },
  { period: '2026-02', purchase_cost: 99600, margin_pct: 15.8 },
  { period: '2026-03', purchase_cost: 104200, margin_pct: 15.1 },
];

const MOCK_TOP_ITEMS = [
  { item: 'Red Apple (China)', profit: 18200 },
  { item: 'Orange Valencia', profit: 15400 },
  { item: 'Mandarin (Ponkan)', profit: 12100 },
  { item: 'Green Grape (Arra)', profit: 9800 },
  { item: 'Kiwi (Zespri)', profit: 7300 },
];

const MOCK_ITEMS_SUPPLIED = [
  { item_code: 'FR-APP-001', description: 'Red Apple (China)', group: 'Apples', qty_purchased: 3200, avg_purchase: 3.80, revenue: 14880, purchase_cost: 12160, margin_pct: 18.3, sole_supplier: false, prices: [3.60, 3.65, 3.70, 3.75, 3.78, 3.80, 3.82, 3.85, 3.80, 3.78, 3.80, 3.80] },
  { item_code: 'FR-ORA-002', description: 'Orange Valencia', group: 'Citrus', qty_purchased: 2800, avg_purchase: 2.50, revenue: 8680, purchase_cost: 7000, margin_pct: 19.4, sole_supplier: false, prices: [2.40, 2.42, 2.45, 2.48, 2.50, 2.50, 2.52, 2.48, 2.50, 2.50, 2.52, 2.50] },
  { item_code: 'FR-MAN-003', description: 'Mandarin (Ponkan)', group: 'Citrus', qty_purchased: 1900, avg_purchase: 4.20, revenue: 9500, purchase_cost: 7980, margin_pct: 16.0, sole_supplier: true, prices: [3.90, 3.95, 4.00, 4.05, 4.10, 4.12, 4.15, 4.18, 4.20, 4.20, 4.22, 4.20] },
  { item_code: 'FR-GRP-004', description: 'Green Grape (Arra)', group: 'Grapes', qty_purchased: 1500, avg_purchase: 8.50, revenue: 15300, purchase_cost: 12750, margin_pct: 16.7, sole_supplier: false, prices: [8.20, 8.30, 8.35, 8.40, 8.45, 8.50, 8.50, 8.48, 8.50, 8.52, 8.50, 8.50] },
  { item_code: 'FR-KIW-005', description: 'Kiwi (Zespri)', group: 'Exotic', qty_purchased: 1200, avg_purchase: 6.80, revenue: 10080, purchase_cost: 8160, margin_pct: 19.0, sole_supplier: true, prices: [6.50, 6.55, 6.60, 6.65, 6.70, 6.72, 6.75, 6.78, 6.80, 6.80, 6.82, 6.80] },
  { item_code: 'FR-PEA-006', description: 'Pear Ya Lie', group: 'Pears', qty_purchased: 2100, avg_purchase: 3.20, revenue: 7875, purchase_cost: 6720, margin_pct: 14.7, sole_supplier: false, prices: [3.00, 3.05, 3.08, 3.10, 3.12, 3.15, 3.18, 3.20, 3.20, 3.18, 3.20, 3.20] },
  { item_code: 'FR-WAT-007', description: 'Watermelon Seedless', group: 'Melons', qty_purchased: 4500, avg_purchase: 1.80, revenue: 10800, purchase_cost: 8100, margin_pct: 25.0, sole_supplier: false, prices: [1.90, 1.88, 1.85, 1.82, 1.80, 1.80, 1.82, 1.80, 1.78, 1.80, 1.80, 1.80] },
  { item_code: 'FR-DRA-008', description: 'Dragon Fruit Red', group: 'Exotic', qty_purchased: 800, avg_purchase: 7.50, revenue: 6480, purchase_cost: 6000, margin_pct: 7.4, sole_supplier: true, prices: [6.80, 6.90, 7.00, 7.10, 7.20, 7.25, 7.30, 7.35, 7.40, 7.45, 7.48, 7.50] },
  { item_code: 'FR-BAN-009', description: 'Banana Cavendish', group: 'Bananas', qty_purchased: 5200, avg_purchase: 1.20, revenue: 9620, purchase_cost: 6240, margin_pct: 35.1, sole_supplier: false, prices: [1.25, 1.24, 1.22, 1.22, 1.20, 1.20, 1.20, 1.18, 1.20, 1.20, 1.20, 1.20] },
  { item_code: 'FR-PAP-010', description: 'Papaya Eksotika', group: 'Tropical', qty_purchased: 1800, avg_purchase: 2.60, revenue: 4500, purchase_cost: 4680, margin_pct: -3.8, sole_supplier: true, prices: [2.30, 2.35, 2.38, 2.40, 2.45, 2.48, 2.50, 2.52, 2.55, 2.58, 2.60, 2.60] },
  { item_code: 'FR-MNG-011', description: 'Mango Harum Manis', group: 'Tropical', qty_purchased: 950, avg_purchase: 9.20, revenue: 10925, purchase_cost: 8740, margin_pct: 20.0, sole_supplier: false, prices: [9.50, 9.45, 9.40, 9.35, 9.30, 9.28, 9.25, 9.22, 9.20, 9.20, 9.20, 9.20] },
  { item_code: 'FR-LYC-012', description: 'Lychee (Fei Zi Xiao)', group: 'Exotic', qty_purchased: 600, avg_purchase: 12.00, revenue: 8880, purchase_cost: 7200, margin_pct: 18.9, sole_supplier: true, prices: [11.50, 11.60, 11.70, 11.75, 11.80, 11.85, 11.90, 11.92, 11.95, 11.98, 12.00, 12.00] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function SupplierProfileRevamp({ open, onClose }: Props) {
  const [activeView, setActiveView] = useState<ActiveView>('profile');
  const defaults = useMemo(() => getDefaultDates(), []);
  const [perfStart, setPerfStart] = useState(defaults.start);
  const [perfEnd, setPerfEnd] = useState(defaults.end);
  const [itemStart, setItemStart] = useState(defaults.start);
  const [itemEnd, setItemEnd] = useState(defaults.end);
  const [itemSearch, setItemSearch] = useState('');

  const s = MOCK_SUPPLIER;

  // Computed KPIs from trend data
  const totalPurchaseCost = MOCK_PURCHASE_MARGIN_TREND.reduce((sum, m) => sum + m.purchase_cost, 0);
  const avgMargin = MOCK_PURCHASE_MARGIN_TREND.reduce((sum, m) => sum + m.margin_pct, 0) / MOCK_PURCHASE_MARGIN_TREND.length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl flex flex-col" style={{ width: '90vw', height: '90vh' }}>
        {/* ─── HEADER ─────────────────────────────────────────────────── */}
        <div className="flex items-center px-6 py-4 border-b bg-background shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold text-foreground leading-tight truncate">{s.company_name}</h2>
            <div className="flex items-center gap-2.5 mt-1">
              <p className="text-base text-foreground/60 font-medium">{s.creditor_code}</p>
              {s.is_active ? (
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
              supplier={s}
              totalPurchaseCost={totalPurchaseCost}
              avgMargin={avgMargin}
              perfStart={perfStart}
              perfEnd={perfEnd}
              setPerfStart={setPerfStart}
              setPerfEnd={setPerfEnd}
              setActiveView={setActiveView}
            />
          ) : (
            <ItemsView
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
function ProfileView({
  supplier, totalPurchaseCost, avgMargin,
  perfStart, perfEnd, setPerfStart, setPerfEnd, setActiveView,
}: {
  supplier: typeof MOCK_SUPPLIER;
  totalPurchaseCost: number; avgMargin: number;
  perfStart: string; perfEnd: string;
  setPerfStart: (d: string) => void; setPerfEnd: (d: string) => void;
  setActiveView: (view: ActiveView) => void;
}) {
  const s = supplier;
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
                  <DetailRow label="Supplier Type" value={s.creditor_type} />
                  <DetailRow label="Purchase Agent" value={s.purchase_agent} />
                  <DetailRow label="Supplier Since" value={new Date(s.supplier_since).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })} />
                </div>
              </div>
              <div className="p-4 space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-widest border-b pb-2">Contact</h4>
                <div className="space-y-2 text-sm">
                  <DetailRow label="PIC" value={s.pic} />
                  <DetailRow label="Phone" value={s.phone} />
                  <DetailRow label="Mobile" value={s.mobile} />
                  <DetailRow label="Email" value={s.email} />
                </div>
              </div>
              <div className="p-4 space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-widest border-b pb-2">Terms</h4>
                <div className="space-y-2 text-sm">
                  <DetailRow label="Payment Terms" value={s.payment_terms} />
                  <DetailRow label="Credit Limit" value={s.credit_limit > 0 ? formatRM(s.credit_limit) : 'N/A'} />
                  <DetailRow label="Currency" value={s.currency} />
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

        {/* Statistics — 3 KPI cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Card><CardContent className="flex flex-col items-center pt-4 pb-4">
            <p className="text-sm font-bold text-foreground mb-3">Procurement Volume</p>
            <div className="text-3xl font-extrabold text-foreground">{formatRM(totalPurchaseCost)}</div>
            <div className="mt-2 flex items-center gap-1 text-sm">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <span className="font-semibold text-amber-600">+12.3%</span>
              <span className="text-foreground/50 text-xs">vs prior period</span>
            </div>
          </CardContent></Card>

          <Card><CardContent className="flex flex-col items-center pt-4 pb-4">
            <p className="text-sm font-bold text-foreground mb-3">Margin Performance</p>
            <MarginGauge value={avgMargin} />
            <div className="mt-2 flex items-center gap-1 text-sm">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="font-semibold text-red-600">-1.8pp</span>
              <span className="text-foreground/50 text-xs">vs prior period</span>
            </div>
          </CardContent></Card>

          <Card><CardContent className="flex flex-col items-center pt-4 pb-4">
            <p className="text-sm font-bold text-foreground mb-3">Supply Dependency</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-4xl font-extrabold text-amber-600">{s.sole_supplier_count}</span>
              <span className="text-lg text-foreground/50 font-medium">/ {s.items_supplied}</span>
            </div>
            <p className="text-xs text-foreground/50 mt-1">items with no alternative</p>
            <SupplyDependencyBar sole={s.sole_supplier_count} total={s.items_supplied} />
          </CardContent></Card>
        </div>

        {/* Trends — 2 charts */}
        <div className="grid grid-cols-2 gap-4">
          <Card size="sm"><CardContent>
            <p className="text-sm font-bold text-foreground mb-2">Purchase Cost &amp; Margin</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <KpiCard label="Total Spend" value={formatRM(totalPurchaseCost)} />
              <KpiCard label="Avg Margin" value={`${avgMargin.toFixed(1)}%`} />
              <KpiCard label="Gross Profit" value={formatRM(Math.round(totalPurchaseCost * avgMargin / (100 - avgMargin)))} />
            </div>
            <PurchaseMarginChart data={MOCK_PURCHASE_MARGIN_TREND} />
          </CardContent></Card>

          <Card size="sm"><CardContent>
            <p className="text-sm font-bold text-foreground mb-2">Top 5 Items by Gross Profit</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <KpiCard label="Top Item" value="Red Apple" />
              <KpiCard label="Top Profit" value={formatRM(MOCK_TOP_ITEMS[0].profit)} />
              <KpiCard label="Top 5 Total" value={formatRM(MOCK_TOP_ITEMS.reduce((s, i) => s + i.profit, 0))} />
            </div>
            <TopItemsChart data={MOCK_TOP_ITEMS} />
          </CardContent></Card>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ITEMS VIEW (dedicated page with own date picker + sparklines)
// ═══════════════════════════════════════════════════════════════════════════════
function ItemsView({ itemStart, itemEnd, setItemStart, setItemEnd, itemSearch, setItemSearch, onBack }: {
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
        <h3 className="text-lg font-bold text-foreground flex-1">Items Supplied</h3>
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
      <ItemsSuppliedTable search={itemSearch} />
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

function PurchaseMarginChart({ data }: { data: typeof MOCK_PURCHASE_MARGIN_TREND }) {
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

function TopItemsChart({ data }: { data: typeof MOCK_TOP_ITEMS }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tickFormatter={compactRM} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="item" tick={{ fontSize: 10 }} width={120} />
        <Tooltip formatter={(value: any) => [formatRM(Number(value)), 'Gross Profit']} />
        <Bar dataKey="profit" name="Gross Profit" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ITEMS SUPPLIED TABLE (with sparklines + sole supplier toggle)
// ═══════════════════════════════════════════════════════════════════════════════

type ItemSortKey = 'item_code' | 'description' | 'group' | 'qty_purchased' | 'avg_purchase' | 'revenue' | 'purchase_cost' | 'margin_pct';

function ItemsSuppliedTable({ search }: { search: string }) {
  const [sortKey, setSortKey] = useState<ItemSortKey>('margin_pct');
  const [sortAsc, setSortAsc] = useState(false);
  const [soleOnly, setSoleOnly] = useState(false);

  const soleCount = MOCK_ITEMS_SUPPLIED.filter(i => i.sole_supplier).length;

  const rows = useMemo(() => {
    let result = MOCK_ITEMS_SUPPLIED;
    if (soleOnly) result = result.filter(i => i.sole_supplier);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r => r.item_code.toLowerCase().includes(s) || r.description.toLowerCase().includes(s));
    }
    return [...result].sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [search, sortKey, sortAsc, soleOnly]);

  function handleSort(key: ItemSortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'item_code' || key === 'description' || key === 'group'); }
  }

  const TH = ({ col, label, align }: { col: ItemSortKey; label: string; align?: 'right' }) => (
    <th className={`px-3 py-2.5 cursor-pointer select-none hover:bg-muted/50 text-xs font-semibold text-foreground ${align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => handleSort(col)}>
      {label}<SortIcon active={sortKey === col} asc={sortAsc} />
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Sole supplier toggle */}
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
          Sole Supplier Only
          <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
            soleOnly ? 'bg-amber-200 text-amber-800' : 'bg-muted text-foreground/50'
          }`}>{soleCount}</span>
        </button>
        {soleOnly && (
          <p className="text-xs text-amber-700">
            Showing items sourced exclusively from this supplier — no alternative source available.
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/30">
            <th className="px-3 py-2.5 w-8"></th>
            <TH col="item_code" label="Item Code" />
            <TH col="description" label="Description" />
            <TH col="group" label="Group" />
            <TH col="qty_purchased" label="Qty Purchased" align="right" />
            <TH col="avg_purchase" label="Avg Purchase" align="right" />
            <th className="px-3 py-2.5 text-xs font-semibold text-foreground">Price Trend</th>
            <TH col="revenue" label="Revenue" align="right" />
            <TH col="purchase_cost" label="Purchase Cost" align="right" />
            <TH col="margin_pct" label="Margin %" align="right" />
          </tr></thead>
          <tbody>{rows.map((item) => (
            <tr key={item.item_code} className={`border-b last:border-0 hover:bg-muted/20 ${item.sole_supplier ? 'bg-amber-50/50' : ''}`}>
              <td className="px-3 py-2.5 text-center">
                {item.sole_supplier && <span title="Sole Supplier"><AlertTriangle className="size-4 text-amber-500" /></span>}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs">{item.item_code}</td>
              <td className="px-3 py-2.5 max-w-[200px] truncate">{item.description}</td>
              <td className="px-3 py-2.5">{item.group}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{item.qty_purchased.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-mono">{formatRM(item.avg_purchase, 2)}</td>
              <td className="px-3 py-2.5"><PriceSparkline data={item.prices} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums font-mono">{formatRM(item.revenue)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-mono">{formatRM(item.purchase_cost)}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${marginColor(item.margin_pct)}`}>{item.margin_pct.toFixed(1)}%</td>
            </tr>
          ))}</tbody>
        </table>
        <div className="px-3 py-2.5 bg-muted/30 text-xs text-foreground/70 border-t">
          Showing {rows.length} item{rows.length !== 1 ? 's' : ''}
          {soleOnly && ` (sole supplier only)`}
          {search && !soleOnly && ` matching "${search}"`}
        </div>
      </div>
    </div>
  );
}
