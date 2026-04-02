'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { DateRangeSection } from '@/components/shared/DateRangeSection';
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  RotateCcw,
  Search,
  ShoppingCart,
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
  Legend,
} from 'recharts';
import { formatRM } from '@/lib/format';
import { useCustomerProfile, useCustomerInvoices } from '@/hooks/payment/usePaymentDataV2';
import { useCustomerReturnSummary, useCustomerReturnTrend, useCustomerReturnDetailsAll } from '@/hooks/return/useCreditDataV2';
import { useCustomerMonthly, useCustomerProducts } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import {
  format as fmtDate,
  subMonths,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

// ─── Fetcher ─────────────────────────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then(r => r.json());

// ─── Date Helpers ────────────────────────────────────────────────────────────
function getDefaultDates() {
  return { start: '', end: '' };
}

function toYearMonth(dateStr: string) { return dateStr.substring(0, 7); }

function formatMonth(ym: string) {
  if (!ym || !ym.includes('-')) return ym;
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}


// ─── Chart Colors — distinct per bucket ──────────────────────────────────────
const AGING_COLORS: Record<string, string> = {
  'Not Due': '#3b82f6',
  '1-30 days': '#22c55e',
  '31-60 days': '#facc15',
  '61-90 days': '#f97316',
  '91-120 days': '#ef4444',
  '120+ days': '#7c3aed',
};

const RETURN_DONUT_COLORS = ['#10b981', '#ef4444'];

function compactRM(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

// ─── Sort helpers ────────────────────────────────────────────────────────────
function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-foreground/30">{'\u21C5'}</span>;
  return <span className="ml-1">{asc ? '\u2191' : '\u2193'}</span>;
}

// ─── Types ───────────────────────────────────────────────────────────────────
type ActiveView = 'profile' | 'outstanding' | 'returns' | 'sales';

interface Props {
  open: boolean;
  onClose: () => void;
  debtorCode: string;
  companyName: string;
  defaultTab?: ActiveView;
  initialStartDate?: string;
  initialEndDate?: string;
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function CustomerProfileRevamp({ open, onClose, debtorCode, companyName, defaultTab = 'profile', initialStartDate, initialEndDate }: Props) {
  const [activeView, setActiveView] = useState<ActiveView>(defaultTab);
  const defaults = useMemo(() => getDefaultDates(), []);
  const [trendStart, setTrendStart] = useState(initialStartDate ?? defaults.start);
  const [trendEnd, setTrendEnd] = useState(initialEndDate ?? defaults.end);
  const [salesStart, setSalesStart] = useState(initialStartDate ?? defaults.start);
  const [salesEnd, setSalesEnd] = useState(initialEndDate ?? defaults.end);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [returnSearch, setReturnSearch] = useState('');
  const [salesSearch, setSalesSearch] = useState('');

  // Data hooks
  const { data: profile, isLoading: profileLoading, error: profileError } = useCustomerProfile(debtorCode);
  const { data: invoices, isLoading: invoicesLoading, error: invoicesError } = useCustomerInvoices(debtorCode);
  const { data: returnSummary } = useCustomerReturnSummary(debtorCode);
  const { data: returnTrend, isLoading: returnTrendLoading, isValidating: returnTrendValidating, error: returnTrendError } = useCustomerReturnTrend(debtorCode, trendStart, trendEnd);
  const { data: monthlyData, isLoading: monthlyLoading, isValidating: monthlyValidating, error: monthlyError } = useCustomerMonthly(debtorCode, trendStart, trendEnd);
  const { data: returnDetails, isLoading: returnDetailsLoading, error: returnDetailsError } = useCustomerReturnDetailsAll(debtorCode);
  const { data: rawProductsData, isLoading: productsInitialLoading, isValidating: productsValidating, error: productsError } = useCustomerProducts(debtorCode, salesStart, salesEnd);
  const productsData = useStableData(rawProductsData);
  const productsLoading = productsInitialLoading || (productsValidating && rawProductsData === undefined);

  const startMonth = toYearMonth(trendStart);
  const endMonth = toYearMonth(trendEnd);
  const { data: collectionTrendRes, isLoading: collectionLoading, isValidating: collectionValidating, error: collectionError } = useSWR<{ data: any[]; avg_pay_days: number | null }>(
    `/api/payment/collection-trend?customer=${encodeURIComponent(debtorCode)}&start_month=${startMonth}&end_month=${endMonth}`,
    fetcher, { revalidateOnFocus: false },
  );
  const collectionTrend = collectionTrendRes?.data;
  const scopedAvgPayDays = collectionTrendRes?.avg_pay_days;

  // ─── Computed ────────────────────────────────────────────────────────────
  const agingBuckets = useMemo(() => {
    if (!invoices || !Array.isArray(invoices)) return [];
    const buckets: Record<string, { amount: number; count: number }> = {
      'Not Due': { amount: 0, count: 0 }, '1-30 days': { amount: 0, count: 0 },
      '31-60 days': { amount: 0, count: 0 }, '61-90 days': { amount: 0, count: 0 },
      '91-120 days': { amount: 0, count: 0 }, '120+ days': { amount: 0, count: 0 },
    };
    for (const inv of invoices) {
      const overdue = inv.days_overdue ?? 0;
      let key: string;
      if (overdue <= 0) key = 'Not Due';
      else if (overdue <= 30) key = '1-30 days';
      else if (overdue <= 60) key = '31-60 days';
      else if (overdue <= 90) key = '61-90 days';
      else if (overdue <= 120) key = '91-120 days';
      else key = '120+ days';
      buckets[key].amount += inv.outstanding ?? 0;
      buckets[key].count += 1;
    }
    return Object.entries(buckets).map(([name, { amount, count }]) => ({ name, amount: Math.round(amount), count }));
  }, [invoices]);

  const totalOutstanding = useMemo(() => agingBuckets.reduce((s, b) => s + b.amount, 0), [agingBuckets]);
  const overdueAmount = useMemo(() => agingBuckets.filter(b => !b.name.startsWith('Not')).reduce((s, b) => s + b.amount, 0), [agingBuckets]);

  const salesKpis = useMemo(() => {
    if (!monthlyData || !Array.isArray(monthlyData)) return { revenue: 0, cogs: 0, avgMargin: 0 };
    const revenue = monthlyData.reduce((s: number, m: any) => s + (m.revenue ?? 0), 0);
    const cogs = monthlyData.reduce((s: number, m: any) => s + (m.cogs ?? 0), 0);
    const margins = monthlyData.filter((m: any) => m.margin_pct != null);
    const avgMargin = margins.length > 0 ? margins.reduce((s: number, m: any) => s + m.margin_pct, 0) / margins.length : 0;
    return { revenue, cogs, avgMargin };
  }, [monthlyData]);

  const collectionKpis = useMemo(() => {
    if (!collectionTrend || !Array.isArray(collectionTrend)) return { collected: 0, invoiced: 0, rate: 0 };
    const collected = collectionTrend.reduce((s: number, m: any) => s + (m.total_collected ?? 0), 0);
    const invoiced = collectionTrend.reduce((s: number, m: any) => s + (m.total_invoiced ?? 0), 0);
    const rate = invoiced > 0 ? (collected / invoiced) * 100 : 0;
    return { collected, invoiced, rate };
  }, [collectionTrend]);

  const returnKpis = useMemo(() => {
    if (!returnTrend || !Array.isArray(returnTrend)) return { totalValue: 0, totalCount: 0 };
    const totalValue = returnTrend.reduce((s: number, m: any) => s + (m.value ?? 0), 0);
    const totalCount = returnTrend.reduce((s: number, m: any) => s + (m.count ?? 0), 0);
    return { totalValue, totalCount };
  }, [returnTrend]);

  const returnDonutData = useMemo(() => {
    if (!returnDetails || !Array.isArray(returnDetails)) return [{ name: 'Settled', value: 0 }, { name: 'Unsettled', value: 0 }];
    const unsettledCount = returnDetails.filter((r: any) => (r.unresolved ?? 0) > 0.01).length;
    return [{ name: 'Settled', value: returnDetails.length - unsettledCount }, { name: 'Unsettled', value: unsettledCount }];
  }, [returnDetails]);

  const unsettledCount = returnDonutData.find(d => d.name === 'Unsettled')?.value ?? 0;
  const outstandingCount = invoices?.length ?? 0;

  if (profileLoading) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-[90vw] h-[90vh] overflow-y-auto" showCloseButton>
          <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>
        </DialogContent>
      </Dialog>
    );
  }

  if (profileError) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-[90vw] h-[90vh] overflow-y-auto" showCloseButton>
          <div className="flex items-center justify-center h-full"><ErrorMessage message="Failed to load customer profile" /></div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[90vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" showCloseButton={false}>
        {/* ─── HEADER ─────────────────────────────────────────────────── */}
        <div className="flex items-center px-6 py-4 border-b bg-background shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold text-foreground leading-tight truncate">{companyName}</h2>
            <div className="flex items-center gap-2.5 mt-1">
              <p className="text-base text-foreground/60 font-medium">{debtorCode}</p>
              {profile?.is_active ? (
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
            <span className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white tracking-wider">CUSTOMER</span>
            <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted transition-colors text-foreground/50 hover:text-foreground">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* ─── BODY ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {activeView === 'profile' ? (
            <ProfileView
              profile={profile} agingBuckets={agingBuckets} totalOutstanding={totalOutstanding}
              overdueAmount={overdueAmount} returnDonutData={returnDonutData} returnSummary={returnSummary}
              returnTrend={returnTrend} monthlyData={monthlyData} collectionTrend={collectionTrend}
              salesKpis={salesKpis} collectionKpis={collectionKpis} returnKpis={returnKpis}
              scopedAvgPayDays={scopedAvgPayDays ?? null}
              outstandingCount={outstandingCount} unsettledCount={unsettledCount}
              trendStart={trendStart} trendEnd={trendEnd} setTrendStart={setTrendStart}
              setTrendEnd={setTrendEnd} setActiveView={setActiveView}
              monthlyLoading={monthlyLoading || monthlyValidating} collectionLoading={collectionLoading || collectionValidating} returnTrendLoading={returnTrendLoading || returnTrendValidating}
              invoicesLoading={invoicesLoading} returnDetailsLoading={returnDetailsLoading}
              monthlyError={monthlyError} collectionError={collectionError} returnTrendError={returnTrendError} invoicesError={invoicesError} returnDetailsError={returnDetailsError}
            />
          ) : activeView === 'outstanding' ? (
            <TableLogView title="Outstanding Invoices" onBack={() => setActiveView('profile')} searchPlaceholder="Search Doc No..." search={invoiceSearch} onSearchChange={setInvoiceSearch}>
              <OutstandingTable invoices={invoices} search={invoiceSearch} isLoading={invoicesLoading} error={invoicesError} />
            </TableLogView>
          ) : activeView === 'returns' ? (
            <TableLogView title="Return Records" onBack={() => setActiveView('profile')} searchPlaceholder="Search Doc No..." search={returnSearch} onSearchChange={setReturnSearch}>
              <ReturnRecordsTable records={returnDetails} search={returnSearch} isLoading={returnDetailsLoading} error={returnDetailsError} />
            </TableLogView>
          ) : (
            <TableLogView title="Sales Transactions" onBack={() => setActiveView('profile')} searchPlaceholder="Search Item Code..." search={salesSearch} onSearchChange={setSalesSearch}>
              <div className="mb-4">
                <DateRangeSection label="Date Range" startDate={salesStart} endDate={salesEnd} onStartDateChange={setSalesStart} onEndDateChange={setSalesEnd} showPresets showRangeSummary={false} />
              </div>
              <SalesTransactionsTable products={productsData} search={salesSearch} isLoading={productsLoading} error={productsError} />
            </TableLogView>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ProfileView({
  profile, agingBuckets, totalOutstanding, overdueAmount, returnDonutData, returnSummary,
  returnTrend, monthlyData, collectionTrend, salesKpis, collectionKpis, returnKpis,
  scopedAvgPayDays, outstandingCount, unsettledCount, trendStart, trendEnd, setTrendStart, setTrendEnd, setActiveView,
  monthlyLoading, collectionLoading, returnTrendLoading,
  invoicesLoading, returnDetailsLoading,
  monthlyError, collectionError, returnTrendError, invoicesError, returnDetailsError,
}: {
  profile: any; agingBuckets: any[]; totalOutstanding: number; overdueAmount: number;
  returnDonutData: any[]; returnSummary: any; returnTrend: any; monthlyData: any;
  collectionTrend: any; salesKpis: any; collectionKpis: any; returnKpis: any;
  scopedAvgPayDays: number | null;
  outstandingCount: number; unsettledCount: number;
  trendStart: string; trendEnd: string; setTrendStart: (d: string) => void;
  setTrendEnd: (d: string) => void; setActiveView: (view: ActiveView) => void;
  monthlyLoading?: boolean; collectionLoading?: boolean; returnTrendLoading?: boolean;
  invoicesLoading?: boolean; returnDetailsLoading?: boolean;
  monthlyError?: any; collectionError?: any; returnTrendError?: any; invoicesError?: any; returnDetailsError?: any;
}) {
  return (
    <div className="px-6 py-5 space-y-8">
      {/* ─── CUSTOMER DETAILS + LOGS (same row) ─────────────────────── */}
      <section>
        <div className="grid grid-cols-[1fr_auto] gap-6">
          {/* Details (left 2/3) */}
          <div>
            <SectionTitle>Customer Details</SectionTitle>
            <div className="grid grid-cols-3 divide-x rounded-lg border overflow-hidden">
              <div className="p-4 space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-widest border-b pb-2">General</h4>
                <div className="space-y-2 text-sm">
                  <DetailRow label="Customer Type" value={profile?.debtor_type || '—'} />
                  <DetailRow label="Sales Agent" value={profile?.sales_agent || '—'} />
                  <DetailRow label="Customer Since" value={profile?.created_date ? formatDate(profile.created_date) : '—'} />
                </div>
              </div>
              <div className="p-4 space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-widest border-b pb-2">Contact</h4>
                <div className="space-y-2 text-sm">
                  <DetailRow label="PIC" value={profile?.attention || '—'} />
                  <DetailRow label="Phone" value={profile?.phone1 || '—'} />
                  <DetailRow label="Mobile" value={profile?.mobile || '—'} />
                  <DetailRow label="Email" value={profile?.email_address || '—'} />
                </div>
              </div>
              <div className="p-4 space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-widest border-b pb-2">Financial</h4>
                <div className="space-y-2 text-sm">
                  <DetailRow label="Credit Limit" value={formatRM(profile?.credit_limit)} />
                  <DetailRow label="Payment Terms" value={profile?.display_term || '—'} />
                  <DetailRow label="Currency" value={profile?.currency_code || '—'} />
                </div>
              </div>
            </div>
          </div>
          {/* Logs (right 1/3) */}
          <div className="w-96">
            <SectionTitle>Logs</SectionTitle>
            <div className="space-y-0 rounded-lg border overflow-hidden">
              <LogButton icon={<ClipboardList className="h-5 w-5 text-foreground/40" />} label="Outstanding Invoices" badge={outstandingCount > 0 ? `${outstandingCount} Outstanding` : undefined} badgeColor="red" onClick={() => setActiveView('outstanding')} />
              <LogButton icon={<RotateCcw className="h-5 w-5 text-foreground/40" />} label="Return Records" badge={unsettledCount > 0 ? `${unsettledCount} Unsettled` : undefined} badgeColor="amber" onClick={() => setActiveView('returns')} borderTop />
              <LogButton icon={<ShoppingCart className="h-5 w-5 text-foreground/40" />} label="Sales Transactions" onClick={() => setActiveView('sales')} borderTop />
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATISTICS ────────────────────────────────────────────────── */}
      <section>
        <SectionTitle subtitle="Lifetime snapshot — from first transaction to today">Statistics</SectionTitle>
        <div className="grid grid-cols-4 gap-4">
          {/* Credit Health */}
          <Card><CardContent className="flex flex-col items-center pt-2">
            <p className="text-sm font-bold text-foreground mb-3">Credit Health Score</p>
            <CreditHealthGauge score={profile?.credit_score ?? 0} />
            <div className="mt-3"><RiskTierChip tier={profile?.risk_tier ?? 'Low'} /></div>
            <div className="mt-3 text-sm text-foreground/70">Avg Pay: <span className="font-bold text-foreground">{profile?.avg_payment_days ?? '—'} days</span></div>
          </CardContent></Card>

          {/* Credit Utilization */}
          <Card><CardContent className="flex flex-col items-center pt-2">
            <p className="text-sm font-bold text-foreground mb-3">Credit Utilization</p>
            <CreditUtilizationDonut utilPct={profile?.utilization_pct ?? 0} />
            <div className="mt-3 text-center text-sm">
              <div><span className="font-bold text-foreground">Total Outstanding: {formatRM(profile?.total_outstanding)}</span></div>
              <div className="text-foreground/60">of {formatRM(profile?.credit_limit)} limit</div>
            </div>
          </CardContent></Card>

          {/* Outstanding Invoices */}
          <Card><CardContent className="pt-2">
            <p className="text-sm font-bold text-foreground mb-3 text-center">Outstanding Invoices</p>
            <AgingStackedBar buckets={agingBuckets} total={totalOutstanding} isLoading={invoicesLoading} error={invoicesError} />
            <div className="mt-4 text-center">
              {overdueAmount > 0 && <div className="text-base font-bold text-red-600">Overdue: {formatRM(overdueAmount)}</div>}
              {overdueAmount === 0 && <div className="text-base font-bold text-emerald-600">No Overdue</div>}
            </div>
          </CardContent></Card>

          {/* Returns */}
          <Card><CardContent className="flex flex-col items-center pt-2">
            <p className="text-sm font-bold text-foreground mb-3">Returns</p>
            <ReturnsDonut data={returnDonutData} isLoading={returnDetailsLoading} error={returnDetailsError} />
            <div className="mt-3 text-center text-sm">
              <div className="text-foreground/70">Unsettled: <span className="font-bold text-red-600">{formatRM(returnSummary?.unresolved)}</span></div>
            </div>
          </CardContent></Card>
        </div>
      </section>

      {/* ─── TRENDS (2x2 grid, no tabs) ────────────────────────────────── */}
      <section>
        <SectionTitle>Trends</SectionTitle>
        <div className="mb-4">
          <DateRangeSection label="Date Range" startDate={trendStart} endDate={trendEnd} onStartDateChange={setTrendStart} onEndDateChange={setTrendEnd} showPresets showRangeSummary={false} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Sales & Margin */}
          <Card size="sm"><CardContent>
            <p className="text-sm font-bold text-foreground mb-2">Sales &amp; Margin</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <KpiCard label="Net Sales" value={formatRM(salesKpis.revenue)} />
              <KpiCard label="Avg Margin" value={`${salesKpis.avgMargin.toFixed(1)}%`} />
              <KpiCard label="COGS" value={formatRM(salesKpis.cogs)} />
            </div>
            <SalesMarginChart data={monthlyData} isLoading={monthlyLoading} error={monthlyError} />
          </CardContent></Card>

          {/* Payment */}
          <Card size="sm"><CardContent>
            <p className="text-sm font-bold text-foreground mb-2">Payment</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <KpiCard label="Collection" value={formatRM(collectionKpis.collected)} />
              <KpiCard label="Rate" value={`${collectionKpis.rate.toFixed(1)}%`} />
              <KpiCard label="Avg Pay Days" value={`${scopedAvgPayDays ?? '—'}`} />
            </div>
            <PaymentTrendChart data={collectionTrend} isLoading={collectionLoading} error={collectionError} />
          </CardContent></Card>

          {/* Returns */}
          <Card size="sm"><CardContent>
            <p className="text-sm font-bold text-foreground mb-2">Returns</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <KpiCard label="Total Returns" value={formatRM(returnKpis.totalValue)} />
              <KpiCard label="Count" value={String(returnKpis.totalCount)} />
            </div>
            <ReturnTrendChart data={returnTrend} isLoading={returnTrendLoading} error={returnTrendError} />
          </CardContent></Card>
        </div>
      </section>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL ROW
// ═══════════════════════════════════════════════════════════════════════════════
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-foreground/60 shrink-0">{label}</span>
      <span className="font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI MINI (bordered card for trend section)
// ═══════════════════════════════════════════════════════════════════════════════
function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-center">
      <div className="text-xs font-medium text-foreground/60 mb-0.5">{label}</div>
      <div className="text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE LOG VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function TableLogView({ title, onBack, searchPlaceholder, search, onSearchChange, children }: {
  title: string; onBack: () => void; searchPlaceholder?: string;
  search?: string; onSearchChange?: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-4 mb-5">
        <button onClick={onBack} className="shrink-0 rounded-full border p-2 hover:bg-muted transition-colors text-foreground/60 hover:text-foreground" title="Back to Profile">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-lg font-bold text-foreground flex-1">{title}</h3>
        {searchPlaceholder && onSearchChange && (
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border bg-background pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS VISUALS
// ═══════════════════════════════════════════════════════════════════════════════

function CreditHealthGauge({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, score));
  const angle = (s / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const r = 70; const cx = 80; const cy = 80;
  const x = cx - r * Math.cos(rad); const y = cy - r * Math.sin(rad);
  const color = s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <svg viewBox="0 0 160 95" className="w-40 h-24">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
      {s > 0 && <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />}
      <text x={cx} y={cy - 12} textAnchor="middle" fill={color} fontSize="28" fontWeight="800">{s}</text>
      <text x={cx} y={cy + 6} textAnchor="middle" fill="#6b7280" fontSize="12">/ 100</text>
    </svg>
  );
}

function RiskTierChip({ tier }: { tier: string }) {
  const c: Record<string, string> = { Low: 'bg-emerald-600 text-white', Moderate: 'bg-amber-500 text-white', High: 'bg-red-600 text-white' };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${c[tier] ?? 'bg-gray-500 text-white'}`}>{tier} Risk</span>;
}

function CreditUtilizationDonut({ utilPct }: { utilPct: number }) {
  const pct = Math.min(utilPct ?? 0, 150);
  const remaining = Math.max(0, 100 - pct);
  const data = [{ name: 'Used', value: pct || 0.01 }, { name: 'Available', value: remaining || 0.01 }];
  const fill = pct > 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981';
  return (
    <div className="relative w-36 h-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={data} innerRadius={52} outerRadius={64} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
          <Cell fill={fill} /><Cell fill="#e5e7eb" />
        </Pie></PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-extrabold text-foreground">{Math.round(utilPct ?? 0)}%</span>
      </div>
    </div>
  );
}

function AgingStackedBar({ buckets, total, isLoading, error }: { buckets: any[]; total: number; isLoading?: boolean; error?: any }) {
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load invoice data" />;
  if (total === 0) return <div className="text-sm text-foreground/60 text-center py-6">No outstanding invoices</div>;
  return (
    <div className="space-y-2">
      <div className="flex h-6 rounded-full overflow-hidden">
        {buckets.map((b) => {
          const w = total > 0 ? (b.amount / total) * 100 : 0;
          if (w < 0.5) return null;
          return <div key={b.name} style={{ width: `${w}%`, backgroundColor: AGING_COLORS[b.name] }} className="transition-all" title={`${b.name}: ${formatRM(b.amount)} (${b.count})`} />;
        })}
      </div>
      {/* Inline legend with RM amounts */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {buckets.map((b) => (
          <div key={b.name} className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: AGING_COLORS[b.name] }} />
            <span className="font-medium text-foreground">{b.name}</span>
            <span className="text-foreground/60">{formatRM(b.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReturnsDonut({ data, isLoading, error }: { data: any[]; isLoading?: boolean; error?: any }) {
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load return data" />;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="text-sm text-foreground/60 text-center py-6">No returns</div>;
  const unsettled = data.find(d => d.name === 'Unsettled')?.value ?? 0;
  return (
    <div>
      <div className="relative w-36 h-36 mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={data} innerRadius={52} outerRadius={64} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
            {data.map((entry, i) => <Cell key={entry.name} fill={RETURN_DONUT_COLORS[i]} />)}
          </Pie></PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-foreground">{unsettled}</span>
          <span className="text-xs text-foreground/50">/ {total}</span>
        </div>
      </div>
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-foreground/70">Settled</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-foreground/70">Unsettled</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREND CHARTS (compact for 2x2 grid)
// ═══════════════════════════════════════════════════════════════════════════════

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8 gap-2">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/60" />
      <span className="text-sm text-foreground/60">Loading data...</span>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-8 gap-2">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <span className="text-sm text-red-600 font-medium">{message}</span>
    </div>
  );
}

function SalesMarginChart({ data, isLoading, error }: { data: any; isLoading?: boolean; error?: any }) {
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load sales data" />;
  if (!data || !Array.isArray(data) || data.length === 0) return <div className="text-sm text-foreground/60 text-center py-8">No data</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="period" tickFormatter={formatMonth} tick={{ fontSize: 10 }} />
        <YAxis yAxisId="left" tickFormatter={compactRM} tick={{ fontSize: 10 }} width={40} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} width={35} domain={[0, 'auto']} />
        <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(value: any, name: any) => name === 'Margin %' ? [`${Number(value).toFixed(1)}%`, name] : [formatRM(Number(value)), name]} labelFormatter={(l: any) => formatMonth(String(l))} />
        <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#2E5090" radius={[2, 2, 0, 0]} />
        <Line yAxisId="right" dataKey="margin_pct" name="Margin %" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function PaymentTrendChart({ data, isLoading, error }: { data: any; isLoading?: boolean; error?: any }) {
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load payment data" />;
  if (!data || !Array.isArray(data) || data.length === 0) return <div className="text-sm text-foreground/60 text-center py-8">No data</div>;
  const chartData = data.map((row: any) => ({ ...row, collection_rate: row.total_invoiced > 0 ? Math.round((row.total_collected / row.total_invoiced) * 1000) / 10 : 0 }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10 }} />
        <YAxis yAxisId="left" tickFormatter={compactRM} tick={{ fontSize: 10 }} width={40} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} width={35} domain={[0, 'auto']} />
        <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(value: any, name: any) => name === 'Collection Rate' ? [`${Number(value).toFixed(1)}%`, name] : [formatRM(Number(value)), name]} labelFormatter={(l: any) => formatMonth(String(l))} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar yAxisId="left" dataKey="total_invoiced" name="Invoiced" fill="#93c5fd" radius={[2, 2, 0, 0]} />
        <Bar yAxisId="left" dataKey="total_collected" name="Collected" fill="#2E5090" radius={[2, 2, 0, 0]} />
        <Line yAxisId="right" dataKey="collection_rate" name="Collection Rate" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ReturnTrendChart({ data, isLoading, error }: { data: any; isLoading?: boolean; error?: any }) {
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load return trend" />;
  if (!data || !Array.isArray(data) || data.length === 0) return <div className="text-sm text-foreground/60 text-center py-8">No data</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={compactRM} tick={{ fontSize: 10 }} width={40} />
        <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(value: any, name: any) => name === 'Count' ? [value, name] : [formatRM(Number(value)), name]} labelFormatter={(l: any) => formatMonth(String(l))} />
        <Line dataKey="value" name="Return Value" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOG BUTTON (with colored chip on right)
// ═══════════════════════════════════════════════════════════════════════════════
function LogButton({ icon, label, badge, badgeColor, onClick, borderTop }: {
  icon: React.ReactNode; label: string; badge?: string; badgeColor?: 'red' | 'amber';
  onClick: () => void; borderTop?: boolean;
}) {
  const chipColors = {
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
  };
  return (
    <button onClick={onClick} className={`flex w-full items-center justify-between px-5 py-4 hover:bg-muted/60 transition-colors ${borderTop ? 'border-t' : ''}`}>
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge && badgeColor && (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${chipColors[badgeColor]}`}>{badge}</span>
        )}
        <ChevronRight className="h-4 w-4 text-foreground/40" />
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE VIEWS
// ═══════════════════════════════════════════════════════════════════════════════

type InvoiceSortKey = 'doc_no' | 'doc_date' | 'due_date' | 'total' | 'outstanding' | 'days_overdue';

function OutstandingTable({ invoices, search = '', isLoading, error }: { invoices: any; search?: string; isLoading?: boolean; error?: any }) {
  const [sortKey, setSortKey] = useState<InvoiceSortKey>('days_overdue');
  const [sortAsc, setSortAsc] = useState(false);
  const rows = useMemo(() => {
    if (!invoices || !Array.isArray(invoices)) return [];
    const filtered = search ? invoices.filter((inv: any) => (inv.doc_no ?? '').toLowerCase().includes(search.toLowerCase())) : invoices;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [invoices, sortKey, sortAsc, search]);
  function handleSort(key: InvoiceSortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'doc_no' || key === 'doc_date' || key === 'due_date'); }
  }
  const TH = ({ col, label, align }: { col: InvoiceSortKey; label: string; align?: 'right' }) => (
    <th className={`px-3 py-2.5 cursor-pointer select-none hover:bg-muted/50 text-xs font-semibold text-foreground ${align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => handleSort(col)}>
      {label}<SortIcon active={sortKey === col} asc={sortAsc} />
    </th>
  );
  if (isLoading || invoices === undefined) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load outstanding invoices" />;
  if (rows.length === 0) return <div className="text-sm text-foreground/60 text-center py-8">No outstanding invoices</div>;
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/30">
          <TH col="doc_no" label="Doc No" /><TH col="doc_date" label="Doc Date" /><TH col="due_date" label="Due Date" />
          <TH col="total" label="Total (RM)" align="right" /><TH col="outstanding" label="Outstanding (RM)" align="right" /><TH col="days_overdue" label="Days Overdue" align="right" />
        </tr></thead>
        <tbody>{rows.map((inv: any, i: number) => {
          const isOverdue = (inv.days_overdue ?? 0) > 0;
          return (
            <tr key={inv.doc_no ?? i} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-3 py-2.5 font-mono text-xs">{inv.doc_no}</td>
              <td className="px-3 py-2.5">{formatDate(inv.doc_date)}</td>
              <td className="px-3 py-2.5">{formatDate(inv.due_date)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatRM(inv.total ?? inv.local_net_total, 2)}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${isOverdue ? 'text-red-600' : 'text-foreground'}`}>{formatRM(inv.outstanding, 2)}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums ${isOverdue ? 'text-red-600 font-medium' : 'text-emerald-600'}`}>{isOverdue ? `${inv.days_overdue}` : `${inv.days_overdue} (not due)`}</td>
            </tr>
          );
        })}</tbody>
      </table>
      <div className="px-3 py-2.5 bg-muted/30 text-xs text-foreground/70 border-t">Showing {rows.length} outstanding invoice{rows.length !== 1 ? 's' : ''}</div>
    </div>
  );
}

type ReturnSortKey = 'doc_no' | 'doc_date' | 'net_total' | 'knocked_off' | 'refunded' | 'unresolved' | 'reason';

function ReturnRecordsTable({ records, search = '', isLoading, error }: { records: any; search?: string; isLoading?: boolean; error?: any }) {
  const [sortKey, setSortKey] = useState<ReturnSortKey>('doc_date');
  const [sortAsc, setSortAsc] = useState(false);
  const rows = useMemo(() => {
    if (!records || !Array.isArray(records)) return [];
    const filtered = search ? records.filter((r: any) => (r.doc_no ?? '').toLowerCase().includes(search.toLowerCase())) : records;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [records, sortKey, sortAsc, search]);
  function handleSort(key: ReturnSortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'doc_no' || key === 'doc_date' || key === 'reason'); }
  }
  const TH = ({ col, label, align }: { col: ReturnSortKey; label: string; align?: 'right' }) => (
    <th className={`px-3 py-2.5 cursor-pointer select-none hover:bg-muted/50 text-xs font-semibold text-foreground ${align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => handleSort(col)}>
      {label}<SortIcon active={sortKey === col} asc={sortAsc} />
    </th>
  );
  if (isLoading || records === undefined) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load return records" />;
  if (rows.length === 0) return <div className="text-sm text-foreground/60 text-center py-8">No return records</div>;
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/30">
          <TH col="doc_no" label="Doc No" /><TH col="doc_date" label="Date" /><TH col="net_total" label="Amount (RM)" align="right" />
          <TH col="knocked_off" label="Knocked Off" align="right" /><TH col="refunded" label="Refunded" align="right" />
          <TH col="unresolved" label="Unresolved" align="right" /><TH col="reason" label="Reason" />
        </tr></thead>
        <tbody>{rows.map((r: any, i: number) => {
          const isSettled = (r.unresolved ?? 0) <= 0.01;
          const hasSettlement = (r.knocked_off ?? 0) > 0 || (r.refunded ?? 0) > 0;
          return (
            <tr key={r.doc_no ?? i} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-3 py-2.5 font-mono text-xs">{r.doc_no}</td>
              <td className="px-3 py-2.5">{formatDate(r.doc_date)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatRM(r.net_total)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{(r.knocked_off ?? 0) > 0 ? formatRM(r.knocked_off) : '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{(r.refunded ?? 0) > 0 ? <span className="text-blue-600">{formatRM(r.refunded)}</span> : '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {isSettled ? <span className="text-emerald-600">Settled</span> : hasSettlement ? <span className="text-amber-600">{formatRM(r.unresolved)}</span> : <span className="text-red-600">{formatRM(r.unresolved)}</span>}
              </td>
              <td className="px-3 py-2.5 max-w-[180px] truncate" title={r.reason}>{r.reason || '—'}</td>
            </tr>
          );
        })}</tbody>
      </table>
      <div className="px-3 py-2.5 bg-muted/30 text-xs text-foreground/70 border-t">Showing {rows.length} return record{rows.length !== 1 ? 's' : ''}</div>
    </div>
  );
}

type SalesSortKey = 'item_code' | 'description' | 'qty_sold' | 'revenue' | 'cost' | 'margin_pct';

function SalesTransactionsTable({ products, search = '', isLoading, error }: { products: any; search?: string; isLoading?: boolean; error?: any }) {
  const items = products?.data ?? products ?? [];
  const [sortKey, setSortKey] = useState<SalesSortKey>('revenue');
  const [sortAsc, setSortAsc] = useState(false);
  const rows = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const filtered = search ? items.filter((item: any) => (item.item_code ?? '').toLowerCase().includes(search.toLowerCase())) : items;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [items, sortKey, sortAsc, search]);
  function handleSort(key: SalesSortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'item_code' || key === 'description'); }
  }
  const TH = ({ col, label, align }: { col: SalesSortKey; label: string; align?: 'right' }) => (
    <th className={`px-3 py-2.5 cursor-pointer select-none hover:bg-muted/50 text-xs font-semibold text-foreground ${align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => handleSort(col)}>
      {label}<SortIcon active={sortKey === col} asc={sortAsc} />
    </th>
  );
  if (isLoading || products === undefined) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load sales transactions" />;
  if (rows.length === 0) return <div className="text-sm text-foreground/60 text-center py-8">No sales transactions</div>;
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/30">
          <TH col="item_code" label="Item Code" /><TH col="description" label="Description" />
          <TH col="qty_sold" label="Qty Sold" align="right" /><TH col="revenue" label="Revenue (RM)" align="right" />
          <TH col="cost" label="Cost (RM)" align="right" /><TH col="margin_pct" label="Margin %" align="right" />
        </tr></thead>
        <tbody>{rows.map((item: any, i: number) => {
          const margin = item.margin_pct ?? 0;
          const mc = margin >= 20 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-red-600';
          return (
            <tr key={item.item_code ?? i} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{item.item_code}</td>
              <td className="px-3 py-2.5 truncate">{item.description}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{(item.qty_sold ?? 0).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatRM(item.revenue)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatRM(item.cost)}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${mc}`}>{margin.toFixed(1)}%</td>
            </tr>
          );
        })}</tbody>
      </table>
      <div className="px-3 py-2.5 bg-muted/30 text-xs text-foreground/70 border-t">Showing {rows.length} item{rows.length !== 1 ? 's' : ''}</div>
    </div>
  );
}
