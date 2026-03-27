'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowLeft,
  FileText,
  ChevronRight,
  Info,
  CalendarIcon,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Legend,
} from 'recharts';
import { formatRM } from '@/lib/format';
import { useCustomerProfile, useCustomerInvoices } from '@/hooks/payment/usePaymentDataV2';
import { useCustomerReturnSummary, useCustomerReturnTrend, useCustomerReturnDetailsAll } from '@/hooks/return/useCreditDataV2';
import { useCustomerMonthly, useCustomerProducts } from '@/hooks/customer-margin/useMarginData';

// ─── Fetcher ─────────────────────────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then(r => r.json());

// ─── Date Helpers ────────────────────────────────────────────────────────────
function getLast12Months() {
  const now = new Date();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const startDate = new Date(now);
  startDate.setFullYear(startDate.getFullYear() - 1);
  startDate.setDate(1);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
  return { start, end };
}

function getStartMonth() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getEndMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(ym: string) {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Mock Contact Data ───────────────────────────────────────────────────────
const MOCK_CONTACT = {
  pic: 'Tan Ah Kow',
  phone: '012-345-6789',
  email: 'tanak@luenseng.com.my',
  joinDate: '2020-01-15',
};

// ─── Chart Colors ────────────────────────────────────────────────────────────
const AGING_COLORS: Record<string, string> = {
  'Not Yet Due': '#10b981',
  '1-30 Days': '#f59e0b',
  '31-60 Days': '#f97316',
  '61-90 Days': '#ef4444',
  '91-120 Days': '#dc2626',
  '120+ Days': '#991b1b',
};

const RETURN_DONUT_COLORS = ['#10b981', '#ef4444'];

// ─── Compact RM formatter for chart axes ─────────────────────────────────────
function compactRM(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

// ─── Types ───────────────────────────────────────────────────────────────────
type ActiveView = 'profile' | 'outstanding' | 'returns' | 'sales';

interface Props {
  open: boolean;
  onClose: () => void;
  debtorCode: string;
  companyName: string;
  defaultTab?: ActiveView;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function CustomerProfileRevamp({ open, onClose, debtorCode, companyName, defaultTab = 'profile' }: Props) {
  const [activeView, setActiveView] = useState<ActiveView>(defaultTab);
  const [trendTab, setTrendTab] = useState('sales');

  // Date range for trends
  const dates = useMemo(() => getLast12Months(), []);
  const startMonth = useMemo(() => getStartMonth(), []);
  const endMonth = useMemo(() => getEndMonth(), []);

  // ─── Data Hooks ──────────────────────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useCustomerProfile(debtorCode);
  const { data: invoices } = useCustomerInvoices(debtorCode);
  const { data: returnSummary } = useCustomerReturnSummary(debtorCode);
  const { data: returnTrend } = useCustomerReturnTrend(debtorCode);
  const { data: monthlyData } = useCustomerMonthly(debtorCode, dates.start, dates.end);
  const { data: returnDetails } = useCustomerReturnDetailsAll(debtorCode);
  const { data: productsData } = useCustomerProducts(debtorCode, dates.start, dates.end);

  // Collection trend for payment tab
  const { data: collectionTrend } = useSWR(
    `/api/payment/collection-trend?customer=${encodeURIComponent(debtorCode)}&start_month=${startMonth}&end_month=${endMonth}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  // ─── Computed: Aging Buckets ─────────────────────────────────────────────
  const agingBuckets = useMemo(() => {
    if (!invoices || !Array.isArray(invoices)) return [];
    const buckets: Record<string, { amount: number; count: number }> = {
      'Not Yet Due': { amount: 0, count: 0 },
      '1-30 Days': { amount: 0, count: 0 },
      '31-60 Days': { amount: 0, count: 0 },
      '61-90 Days': { amount: 0, count: 0 },
      '91-120 Days': { amount: 0, count: 0 },
      '120+ Days': { amount: 0, count: 0 },
    };
    for (const inv of invoices) {
      const overdue = inv.days_overdue ?? 0;
      let key: string;
      if (overdue <= 0) key = 'Not Yet Due';
      else if (overdue <= 30) key = '1-30 Days';
      else if (overdue <= 60) key = '31-60 Days';
      else if (overdue <= 90) key = '61-90 Days';
      else if (overdue <= 120) key = '91-120 Days';
      else key = '120+ Days';
      buckets[key].amount += inv.outstanding ?? 0;
      buckets[key].count += 1;
    }
    return Object.entries(buckets).map(([name, { amount, count }]) => ({ name, amount: Math.round(amount), count }));
  }, [invoices]);

  const totalOutstandingFromInvoices = useMemo(
    () => agingBuckets.reduce((s, b) => s + b.amount, 0),
    [agingBuckets],
  );

  // ─── Computed: Sales KPIs ────────────────────────────────────────────────
  const salesKpis = useMemo(() => {
    if (!monthlyData || !Array.isArray(monthlyData)) return { revenue: 0, cogs: 0, avgMargin: 0 };
    const revenue = monthlyData.reduce((s: number, m: { revenue: number }) => s + (m.revenue ?? 0), 0);
    const cogs = monthlyData.reduce((s: number, m: { cogs: number }) => s + (m.cogs ?? 0), 0);
    const margins = monthlyData.filter((m: { margin_pct: number }) => m.margin_pct != null);
    const avgMargin = margins.length > 0
      ? margins.reduce((s: number, m: { margin_pct: number }) => s + m.margin_pct, 0) / margins.length
      : 0;
    return { revenue, cogs, avgMargin };
  }, [monthlyData]);

  // ─── Computed: Collection KPIs ───────────────────────────────────────────
  const collectionKpis = useMemo(() => {
    if (!collectionTrend || !Array.isArray(collectionTrend)) return { collected: 0, invoiced: 0, rate: 0 };
    const collected = collectionTrend.reduce((s: number, m: { total_collected: number }) => s + (m.total_collected ?? 0), 0);
    const invoiced = collectionTrend.reduce((s: number, m: { total_invoiced: number }) => s + (m.total_invoiced ?? 0), 0);
    const rate = invoiced > 0 ? (collected / invoiced) * 100 : 0;
    return { collected, invoiced, rate };
  }, [collectionTrend]);

  // ─── Computed: Return Trend KPIs ─────────────────────────────────────────
  const returnKpis = useMemo(() => {
    if (!returnTrend || !Array.isArray(returnTrend)) return { totalValue: 0, totalCount: 0 };
    const totalValue = returnTrend.reduce((s: number, m: { value: number }) => s + (m.value ?? 0), 0);
    const totalCount = returnTrend.reduce((s: number, m: { count: number }) => s + (m.count ?? 0), 0);
    return { totalValue, totalCount };
  }, [returnTrend]);

  // ─── Computed: Return donut data ─────────────────────────────────────────
  const returnDonutData = useMemo(() => {
    const total = returnSummary?.return_count ?? 0;
    const unresolved = returnSummary?.unresolved ?? 0;
    // return_count is count, unresolved is amount — for donut we show amount-based
    // We'll show settled vs unsettled from returnDetails if available
    if (!returnDetails || !Array.isArray(returnDetails)) {
      return [
        { name: 'Settled', value: Math.max(0, total - 1) },
        { name: 'Unsettled', value: 1 },
      ];
    }
    const unsettledCount = returnDetails.filter((r: { unresolved: number }) => (r.unresolved ?? 0) > 0.01).length;
    const settledCount = returnDetails.length - unsettledCount;
    return [
      { name: 'Settled', value: settledCount },
      { name: 'Unsettled', value: unsettledCount },
    ];
  }, [returnSummary, returnDetails]);

  const unsettledCount = returnDonutData.find(d => d.name === 'Unsettled')?.value ?? 0;
  const outstandingCount = invoices?.length ?? 0;

  // ─── Loading State ───────────────────────────────────────────────────────
  if (profileLoading) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-[90vw] h-[90vh] overflow-y-auto" showCloseButton>
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-foreground/60">Loading profile...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[90vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" showCloseButton>
        {/* ─── HEADER (persistent) ────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white tracking-wide">
              CUSTOMER
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground leading-tight">{companyName}</h2>
              <p className="text-sm text-foreground/70">{debtorCode}</p>
            </div>
          </div>
          <div>
            {profile?.is_active ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                <span className="h-2 w-2 rounded-full bg-white" />
                ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                <span className="h-2 w-2 rounded-full bg-white" />
                INACTIVE
              </span>
            )}
          </div>
        </div>

        {/* ─── BODY (scrollable, view-dependent) ──────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {activeView === 'profile' ? (
            <ProfileView
              profile={profile}
              agingBuckets={agingBuckets}
              totalOutstanding={totalOutstandingFromInvoices}
              returnDonutData={returnDonutData}
              returnSummary={returnSummary}
              returnTrend={returnTrend}
              monthlyData={monthlyData}
              collectionTrend={collectionTrend}
              salesKpis={salesKpis}
              collectionKpis={collectionKpis}
              returnKpis={returnKpis}
              outstandingCount={outstandingCount}
              unsettledCount={unsettledCount}
              trendTab={trendTab}
              setTrendTab={setTrendTab}
              setActiveView={setActiveView}
            />
          ) : activeView === 'outstanding' ? (
            <TableLogView
              title="Outstanding Invoices"
              onBack={() => setActiveView('profile')}
            >
              <OutstandingTable invoices={invoices} />
            </TableLogView>
          ) : activeView === 'returns' ? (
            <TableLogView
              title="Return Records"
              onBack={() => setActiveView('profile')}
            >
              <ReturnRecordsTable records={returnDetails} />
            </TableLogView>
          ) : (
            <TableLogView
              title="Sales Transactions"
              onBack={() => setActiveView('profile')}
            >
              <SalesTransactionsTable products={productsData} />
            </TableLogView>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE VIEW (main profile page)
// ═══════════════════════════════════════════════════════════════════════════════
function ProfileView({
  profile,
  agingBuckets,
  totalOutstanding,
  returnDonutData,
  returnSummary,
  returnTrend,
  monthlyData,
  collectionTrend,
  salesKpis,
  collectionKpis,
  returnKpis,
  outstandingCount,
  unsettledCount,
  trendTab,
  setTrendTab,
  setActiveView,
}: {
  profile: any;
  agingBuckets: any[];
  totalOutstanding: number;
  returnDonutData: any[];
  returnSummary: any;
  returnTrend: any;
  monthlyData: any;
  collectionTrend: any;
  salesKpis: any;
  collectionKpis: any;
  returnKpis: any;
  outstandingCount: number;
  unsettledCount: number;
  trendTab: string;
  setTrendTab: (tab: string) => void;
  setActiveView: (view: ActiveView) => void;
}) {
  return (
    <div className="px-6 py-5 space-y-6">
      {/* ─── CUSTOMER DETAILS ──────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Customer Details</h3>
        <Card size="sm">
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              {/* Contact */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Contact</h4>
                <div className="space-y-1.5 text-sm">
                  <div><span className="font-medium text-foreground">PIC:</span> <span className="text-foreground/80">{MOCK_CONTACT.pic}</span></div>
                  <div><span className="font-medium text-foreground">Phone:</span> <span className="text-foreground/80">{MOCK_CONTACT.phone}</span></div>
                  <div><span className="font-medium text-foreground">Email:</span> <span className="text-foreground/80">{MOCK_CONTACT.email}</span></div>
                </div>
              </div>
              {/* Financial */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Financial</h4>
                <div className="space-y-1.5 text-sm">
                  <div><span className="font-medium text-foreground">Credit Limit:</span> <span className="text-foreground/80">{formatRM(profile?.credit_limit)}</span></div>
                  <div><span className="font-medium text-foreground">Overdue Limit:</span> <span className="text-foreground/80">{formatRM(0)}</span></div>
                  <div><span className="font-medium text-foreground">Payment Terms:</span> <span className="text-foreground/80">{profile?.display_term || '—'}</span></div>
                </div>
              </div>
              {/* Account */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Account</h4>
                <div className="space-y-1.5 text-sm">
                  <div><span className="font-medium text-foreground">Customer Type:</span> <span className="text-foreground/80">{profile?.debtor_type || '—'}</span></div>
                  <div><span className="font-medium text-foreground">Sales Agent:</span> <span className="text-foreground/80">{profile?.sales_agent || '—'}</span></div>
                  <div><span className="font-medium text-foreground">Customer Since:</span> <span className="text-foreground/80">{formatDate(MOCK_CONTACT.joinDate)}</span></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ─── STATISTICS ────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Statistics</h3>
        <div className="grid grid-cols-4 gap-4">
          {/* Credit Health Gauge */}
          <Card size="sm">
            <CardContent className="flex flex-col items-center">
              <p className="text-xs font-semibold text-foreground mb-2">Credit Health</p>
              <CreditHealthGauge score={profile?.credit_score ?? 0} />
              <RiskTierChip tier={profile?.risk_tier ?? 'Low'} />
              <div className="mt-2 text-xs text-foreground/80">
                Avg Pay: <span className="font-semibold text-foreground">{profile?.avg_payment_days ?? '—'} days</span>
              </div>
            </CardContent>
          </Card>

          {/* Credit Utilization Donut */}
          <Card size="sm">
            <CardContent className="flex flex-col items-center">
              <p className="text-xs font-semibold text-foreground mb-2">Credit Utilization</p>
              <CreditUtilizationDonut
                utilPct={profile?.utilization_pct ?? 0}
                outstanding={profile?.total_outstanding ?? 0}
                creditLimit={profile?.credit_limit ?? 0}
              />
              <div className="mt-2 text-center text-xs text-foreground/80">
                <div className="font-semibold text-foreground">{formatRM(profile?.total_outstanding)}</div>
                <div>of {formatRM(profile?.credit_limit)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Outstanding Invoices — Aging Bar */}
          <Card size="sm">
            <CardContent>
              <p className="text-xs font-semibold text-foreground mb-2 text-center">Outstanding Invoices</p>
              <AgingStackedBar buckets={agingBuckets} total={totalOutstanding} />
              <div className="mt-3 text-center">
                <div className="text-sm font-bold text-foreground">Total: {formatRM(totalOutstanding)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Returns Donut */}
          <Card size="sm">
            <CardContent className="flex flex-col items-center">
              <p className="text-xs font-semibold text-foreground mb-2">Returns</p>
              <ReturnsDonut data={returnDonutData} />
              <div className="mt-2 text-center text-xs">
                <div className="text-foreground/80">
                  Unsettled: <span className="font-semibold text-red-600">{formatRM(returnSummary?.unresolved)}</span>
                </div>
                <div className="text-foreground/80">
                  Total: <span className="font-semibold text-foreground">{returnSummary?.return_count ?? 0} Returns</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex items-center gap-1.5 mt-2 text-xs text-foreground/60">
          <Info className="h-3 w-3" />
          Statistics based on last 12 months unless otherwise noted
        </div>
      </section>

      {/* ─── TRENDS ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Trends</h3>
          <div className="flex items-center gap-1.5 text-xs text-foreground/70 border rounded-md px-2.5 py-1">
            <CalendarIcon className="h-3.5 w-3.5" />
            {formatMonth(getStartMonth())} — {formatMonth(getEndMonth())}
          </div>
        </div>
        <Tabs value={trendTab} onValueChange={(v) => setTrendTab(v as string)}>
          <TabsList>
            <TabsTrigger value="sales">Sales &amp; Margin</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <Card size="sm" className="mt-3">
              <CardContent>
                <SalesMarginChart data={monthlyData} />
                <div className="grid grid-cols-3 gap-4 mt-4 pt-3 border-t">
                  <KpiMini label="Net Sales" value={formatRM(salesKpis.revenue)} />
                  <KpiMini label="Avg Margin" value={`${salesKpis.avgMargin.toFixed(1)}%`} />
                  <KpiMini label="COGS" value={formatRM(salesKpis.cogs)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment">
            <Card size="sm" className="mt-3">
              <CardContent>
                <PaymentTrendChart data={collectionTrend} />
                <div className="grid grid-cols-3 gap-4 mt-4 pt-3 border-t">
                  <KpiMini label="Period Collection" value={formatRM(collectionKpis.collected)} />
                  <KpiMini label="Collection Rate" value={`${collectionKpis.rate.toFixed(1)}%`} />
                  <KpiMini label="Avg Payment Days" value={`${profile?.avg_payment_days ?? '—'} days`} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="returns">
            <Card size="sm" className="mt-3">
              <CardContent>
                <ReturnTrendChart data={returnTrend} />
                <div className="grid grid-cols-3 gap-4 mt-4 pt-3 border-t">
                  <KpiMini label="Total Returns" value={formatRM(returnKpis.totalValue)} />
                  <KpiMini label="Return Count" value={String(returnKpis.totalCount)} />
                  <KpiMini label="Unsettled" value={formatRM(returnSummary?.unresolved)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* ─── LOGS ──────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Logs</h3>
        <div className="space-y-0 rounded-lg border overflow-hidden">
          <LogButton
            label="Outstanding Invoices"
            badge={`${outstandingCount} Outstanding`}
            onClick={() => setActiveView('outstanding')}
          />
          <LogButton
            label="Return Records"
            badge={`${unsettledCount} Unsettled`}
            onClick={() => setActiveView('returns')}
            borderTop
          />
          <LogButton
            label="Sales Transactions"
            onClick={() => setActiveView('sales')}
            borderTop
          />
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE LOG VIEW (wraps table pages)
// ═══════════════════════════════════════════════════════════════════════════════
function TableLogView({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-3 mb-5">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Button>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS VISUALS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Credit Health Gauge (Semi-Circle SVG) ───────────────────────────────────
function CreditHealthGauge({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const angle = (clampedScore / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const r = 60;
  const cx = 70;
  const cy = 70;
  const x = cx - r * Math.cos(rad);
  const y = cy - r * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;

  const gaugeColor = clampedScore >= 70 ? '#10b981' : clampedScore >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <svg viewBox="0 0 140 85" className="w-32 h-20">
      {/* Background arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {/* Score arc */}
      {clampedScore > 0 && (
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`}
          fill="none"
          stroke={gaugeColor}
          strokeWidth="12"
          strokeLinecap="round"
        />
      )}
      {/* Score text */}
      <text x={cx} y={cy - 8} textAnchor="middle" className="text-2xl font-bold" fill={gaugeColor} fontSize="22">
        {clampedScore}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#6b7280" fontSize="10">
        / 100
      </text>
    </svg>
  );
}

// ─── Risk Tier Chip ──────────────────────────────────────────────────────────
function RiskTierChip({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    Low: 'bg-emerald-600 text-white',
    Moderate: 'bg-amber-500 text-white',
    High: 'bg-red-600 text-white',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${colors[tier] ?? 'bg-gray-500 text-white'}`}>
      {tier} Risk
    </span>
  );
}

// ─── Credit Utilization Donut ────────────────────────────────────────────────
function CreditUtilizationDonut({ utilPct, outstanding, creditLimit }: { utilPct: number; outstanding: number; creditLimit: number }) {
  const pct = Math.min(utilPct ?? 0, 100);
  const remaining = Math.max(0, 100 - pct);
  const data = [
    { name: 'Used', value: pct || 0.01 },
    { name: 'Available', value: remaining || 0.01 },
  ];
  const fillColor = pct > 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981';

  return (
    <div className="relative w-28 h-28">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={32}
            outerRadius={48}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            strokeWidth={0}
          >
            <Cell fill={fillColor} />
            <Cell fill="#e5e7eb" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-foreground">{Math.round(utilPct ?? 0)}%</span>
      </div>
    </div>
  );
}

// ─── Aging Stacked Horizontal Bar ────────────────────────────────────────────
function AgingStackedBar({ buckets, total }: { buckets: any[]; total: number }) {
  if (total === 0) {
    return <div className="text-sm text-foreground/60 text-center py-4">No outstanding invoices</div>;
  }
  return (
    <div className="space-y-1.5">
      {/* Stacked bar */}
      <div className="flex h-5 rounded-full overflow-hidden">
        {buckets.map((b) => {
          const widthPct = total > 0 ? (b.amount / total) * 100 : 0;
          if (widthPct < 0.5) return null;
          return (
            <div
              key={b.name}
              style={{ width: `${widthPct}%`, backgroundColor: AGING_COLORS[b.name] }}
              className="transition-all"
              title={`${b.name}: ${formatRM(b.amount)} (${b.count})`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {buckets.map((b) => (
          <div key={b.name} className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: AGING_COLORS[b.name] }} />
            <span className="text-foreground/70 truncate">{b.name}</span>
            <span className="ml-auto font-medium text-foreground tabular-nums">{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Returns Donut ───────────────────────────────────────────────────────────
function ReturnsDonut({ data }: { data: any[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <div className="text-sm text-foreground/60 text-center py-4">No returns</div>;
  }
  const unsettled = data.find(d => d.name === 'Unsettled')?.value ?? 0;
  return (
    <div className="relative w-28 h-28">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={32}
            outerRadius={48}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={RETURN_DONUT_COLORS[i]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-foreground">{unsettled}</span>
        <span className="text-[10px] text-foreground/60">/ {total}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREND CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Sales & Margin Chart ────────────────────────────────────────────────────
function SalesMarginChart({ data }: { data: any }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="text-sm text-foreground/60 text-center py-8">No sales data available</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="period" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tickFormatter={compactRM} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 'auto']} />
        <Tooltip
          wrapperStyle={{ zIndex: 50 }}
          formatter={(value: any, name: any) => {
            if (name === 'Margin %') return [`${Number(value).toFixed(1)}%`, name];
            return [formatRM(Number(value)), name];
          }}
          labelFormatter={(label: any) => formatMonth(String(label))}
        />
        <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#2E5090" radius={[3, 3, 0, 0]} />
        <Line yAxisId="right" dataKey="margin_pct" name="Margin %" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Payment Trend Chart ─────────────────────────────────────────────────────
function PaymentTrendChart({ data }: { data: any }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="text-sm text-foreground/60 text-center py-8">No payment data available</div>;
  }
  // Add collection rate to each row
  const chartData = data.map((row: any) => ({
    ...row,
    collection_rate: row.total_invoiced > 0 ? Math.round((row.total_collected / row.total_invoiced) * 1000) / 10 : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tickFormatter={compactRM} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 'auto']} />
        <Tooltip
          wrapperStyle={{ zIndex: 50 }}
          formatter={(value: any, name: any) => {
            if (name === 'Collection Rate') return [`${Number(value).toFixed(1)}%`, name];
            return [formatRM(Number(value)), name];
          }}
          labelFormatter={(label: any) => formatMonth(String(label))}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="total_invoiced" name="Invoiced" fill="#93c5fd" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="left" dataKey="total_collected" name="Collected" fill="#2E5090" radius={[3, 3, 0, 0]} />
        <Line yAxisId="right" dataKey="collection_rate" name="Collection Rate" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Return Trend Chart ──────────────────────────────────────────────────────
function ReturnTrendChart({ data }: { data: any }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="text-sm text-foreground/60 text-center py-8">No return data available</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={compactRM} tick={{ fontSize: 11 }} />
        <Tooltip
          wrapperStyle={{ zIndex: 50 }}
          formatter={(value: any, name: any) => {
            if (name === 'Count') return [value, name];
            return [formatRM(Number(value)), name];
          }}
          labelFormatter={(label: any) => formatMonth(String(label))}
        />
        <Bar dataKey="value" name="Return Value" fill="#f59e0b" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOG BUTTON
// ═══════════════════════════════════════════════════════════════════════════════
function LogButton({ label, badge, onClick, borderTop }: { label: string; badge?: string; onClick: () => void; borderTop?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-3.5 hover:bg-muted/60 transition-colors ${borderTop ? 'border-t' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <FileText className="h-4 w-4 text-foreground/50" />
        <span className="text-sm font-medium text-foreground">{label}</span>
        {badge && (
          <span className="text-xs font-medium text-foreground/60">({badge})</span>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-foreground/40" />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI MINI (for below charts)
// ═══════════════════════════════════════════════════════════════════════════════
function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-foreground/70">{label}</div>
      <div className="text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE VIEWS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Outstanding Invoices Table ──────────────────────────────────────────────
function OutstandingTable({ invoices }: { invoices: any }) {
  if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
    return <div className="text-sm text-foreground/60 text-center py-8">No outstanding invoices</div>;
  }
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left px-4 py-2.5 font-semibold text-foreground">Doc No</th>
            <th className="text-left px-4 py-2.5 font-semibold text-foreground">Doc Date</th>
            <th className="text-left px-4 py-2.5 font-semibold text-foreground">Due Date</th>
            <th className="text-right px-4 py-2.5 font-semibold text-foreground">Total (RM)</th>
            <th className="text-right px-4 py-2.5 font-semibold text-foreground">Outstanding (RM)</th>
            <th className="text-right px-4 py-2.5 font-semibold text-foreground">Days Overdue</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv: any, i: number) => {
            const isOverdue = (inv.days_overdue ?? 0) > 0;
            return (
              <tr key={inv.doc_no ?? i} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium text-foreground">{inv.doc_no}</td>
                <td className="px-4 py-2.5 text-foreground/80">{formatDate(inv.doc_date)}</td>
                <td className="px-4 py-2.5 text-foreground/80">{formatDate(inv.due_date)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{formatRM(inv.total ?? inv.local_net_total)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${isOverdue ? 'text-red-600' : 'text-foreground'}`}>
                  {formatRM(inv.outstanding)}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${isOverdue ? 'text-red-600 font-medium' : 'text-emerald-600'}`}>
                  {isOverdue ? `${inv.days_overdue} days` : 'Not due'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-2.5 bg-muted/30 text-xs text-foreground/70 border-t">
        Showing {invoices.length} outstanding invoice{invoices.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ─── Return Records Table ────────────────────────────────────────────────────
function ReturnRecordsTable({ records }: { records: any }) {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return <div className="text-sm text-foreground/60 text-center py-8">No return records</div>;
  }
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left px-4 py-2.5 font-semibold text-foreground">Doc No</th>
            <th className="text-left px-4 py-2.5 font-semibold text-foreground">Date</th>
            <th className="text-right px-4 py-2.5 font-semibold text-foreground">Amount (RM)</th>
            <th className="text-right px-4 py-2.5 font-semibold text-foreground">Knocked Off</th>
            <th className="text-right px-4 py-2.5 font-semibold text-foreground">Refunded</th>
            <th className="text-right px-4 py-2.5 font-semibold text-foreground">Unresolved</th>
            <th className="text-left px-4 py-2.5 font-semibold text-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r: any, i: number) => {
            const isSettled = (r.unresolved ?? 0) <= 0.01;
            return (
              <tr key={r.doc_no ?? i} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium text-foreground">{r.doc_no}</td>
                <td className="px-4 py-2.5 text-foreground/80">{formatDate(r.doc_date)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{formatRM(r.net_total)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-foreground/80">{formatRM(r.knocked_off)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-foreground/80">{formatRM(r.refunded)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${isSettled ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatRM(r.unresolved)}
                </td>
                <td className="px-4 py-2.5">
                  {isSettled ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">Settled</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">Unsettled</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-2.5 bg-muted/30 text-xs text-foreground/70 border-t">
        Showing {records.length} return record{records.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ─── Sales Transactions Table ────────────────────────────────────────────────
function SalesTransactionsTable({ products }: { products: any }) {
  const items = products?.data ?? products;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return <div className="text-sm text-foreground/60 text-center py-8">No sales transactions</div>;
  }
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left px-4 py-2.5 font-semibold text-foreground">Item Code</th>
            <th className="text-left px-4 py-2.5 font-semibold text-foreground">Description</th>
            <th className="text-left px-4 py-2.5 font-semibold text-foreground">Group</th>
            <th className="text-right px-4 py-2.5 font-semibold text-foreground">Qty Sold</th>
            <th className="text-right px-4 py-2.5 font-semibold text-foreground">Revenue (RM)</th>
            <th className="text-right px-4 py-2.5 font-semibold text-foreground">Cost (RM)</th>
            <th className="text-right px-4 py-2.5 font-semibold text-foreground">Margin %</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, i: number) => {
            const margin = item.margin_pct ?? 0;
            const marginColor = margin >= 20 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-red-600';
            return (
              <tr key={item.item_code ?? i} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium text-foreground">{item.item_code}</td>
                <td className="px-4 py-2.5 text-foreground/80">{item.description}</td>
                <td className="px-4 py-2.5 text-foreground/80">{item.product_group}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{item.qty_sold?.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{formatRM(item.revenue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-foreground/80">{formatRM(item.cost)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${marginColor}`}>
                  {margin.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-2.5 bg-muted/30 text-xs text-foreground/70 border-t">
        Showing {items.length} item{items.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
