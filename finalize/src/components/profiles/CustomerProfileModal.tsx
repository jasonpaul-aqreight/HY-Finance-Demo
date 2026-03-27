'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatRM } from '@/lib/payment/format';
import { riskTierBgColor } from '@/lib/payment/credit-score-v2';
import { useCustomerProfile } from '@/hooks/payment/usePaymentDataV2';
import { useCustomerReturnSummary, useCustomerReturnTrend } from '@/hooks/return/useCreditDataV2';
import { useCustomerMonthly } from '@/hooks/customer-margin/useMarginData';
import { PaymentTab } from './PaymentTab';
import { ReturnTab } from './ReturnTab';
import { SoldItemsTab } from './SoldItemsTab';

export type CustomerProfileTab = 'payment' | 'returns' | 'sold-items';

interface CustomerProfileModalProps {
  open: boolean;
  onClose: () => void;
  debtorCode: string;
  companyName: string;
  defaultTab?: CustomerProfileTab;
  initialStartDate?: string;
  initialEndDate?: string;
}

export function CustomerProfileModal({
  open, onClose, debtorCode, companyName, defaultTab = 'payment',
  initialStartDate, initialEndDate,
}: CustomerProfileModalProps) {

  // Fetch profile data (debtor master + credit health metrics)
  const { data: profile } = useCustomerProfile(open ? debtorCode : null);

  // Fetch return summary (return_count + unresolved)
  const { data: returnSummary } = useCustomerReturnSummary(open ? debtorCode : null);

  // Fetch return trend (last 12 months)
  const { data: returnTrendData } = useCustomerReturnTrend(open ? debtorCode : null);

  // Fetch monthly revenue for sales performance (last 12 months from today)
  const last12Start = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    return d.toISOString().slice(0, 10);
  }, []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: monthlyData } = useCustomerMonthly(open ? debtorCode : null, last12Start, today);

  // Payment metrics from profile API
  const pm = profile ? {
    credit_limit: profile.credit_limit,
    total_outstanding: profile.total_outstanding,
    utilization_pct: profile.utilization_pct,
    aging_count: profile.aging_count,
    oldest_due: profile.oldest_due,
    max_overdue_days: profile.max_overdue_days,
    credit_score: profile.credit_score,
    risk_tier: profile.risk_tier,
  } : null;

  // Return metrics from return summary API
  const rm = returnSummary ?? null;

  // Compute sales performance from monthly data
  const salesPerf = useMemo(() => {
    if (!monthlyData?.length) return null;
    const totalRevenue = monthlyData.reduce((s, r) => s + r.revenue, 0);
    const totalCogs = monthlyData.reduce((s, r) => s + r.cogs, 0);
    const marginPct = totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue) * 100 : 0;
    return { marginPct: Math.round(marginPct * 10) / 10 };
  }, [monthlyData]);

  // Format return trend for chart
  const returnTrend = useMemo(() => {
    if (!returnTrendData?.length) return [];
    return returnTrendData.map(r => ({
      m: r.month.slice(5),
      c: r.count,
    }));
  }, [returnTrendData]);

  // Format revenue trend for chart
  const revenueTrend = useMemo(() => {
    if (!monthlyData?.length) return [];
    return monthlyData.map(r => ({
      m: r.period.slice(5),
      r: r.revenue,
    }));
  }, [monthlyData]);

  const isActive = profile?.is_active ?? true;
  const returnColor = returnTrend.length >= 2
    ? (returnTrend[returnTrend.length - 1]?.c ?? 0) <= (returnTrend[0]?.c ?? 0) ? '#10b981' : '#ef4444'
    : '#10b981';
  const utilPct = pm?.utilization_pct ?? 0;
  const utilColor = utilPct > 100 ? 'text-red-600' : utilPct >= 80 ? 'text-yellow-600' : 'text-emerald-600';

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] flex flex-col gap-0 p-0" showCloseButton>

        {/* ── Profile Header ──────────────────────────────────── */}
        <div className="px-8 pt-6 pb-5 border-b bg-muted/30">
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-2xl font-bold tracking-tight">{companyName}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground/70">Customer</span>
            <span className="text-muted-foreground/30">|</span>
            <span className="font-mono">{debtorCode}</span>
            <span className="text-muted-foreground/30">|</span>
            <span>{profile?.debtor_type || '—'}</span>
            <span className="text-muted-foreground/30">|</span>
            <span>Agent: {profile?.sales_agent || '—'}</span>
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

          {/* ── Metric Groups: Payment | Returns | Sales Performance ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.5fr_1.5fr]">

            {/* Payment */}
            <div className="rounded-xl ring-1 ring-foreground/10 overflow-hidden self-stretch flex flex-col">
              <div className="bg-blue-500 px-5 py-2.5">
                <h2 className="text-sm font-bold text-white">Payment</h2>
              </div>
              <div className="px-5 py-5 flex-1">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Credit Limit</p>
                    <p className="text-base font-semibold">{pm && pm.credit_limit > 0 ? formatRM(pm.credit_limit) : 'None'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                    <p className="text-base font-semibold text-orange-600">{pm ? formatRM(pm.total_outstanding) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Credit Utilization</p>
                    <div className="flex items-center gap-2">
                      <p className={`text-base font-semibold ${utilColor}`}>{pm?.utilization_pct != null ? `${pm.utilization_pct.toFixed(0)}%` : 'N/A'}</p>
                      {pm?.utilization_pct != null && (
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[60px]">
                          <div className={`h-full rounded-full ${utilPct > 100 ? 'bg-red-500' : utilPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(utilPct, 100)}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Aging Count</p>
                    <p className={`text-base font-semibold ${pm && pm.aging_count > 0 ? 'text-red-600' : ''}`}>
                      {pm ? String(pm.aging_count) : '—'}
                      {pm && pm.max_overdue_days > 0 && <span className="text-xs font-normal text-muted-foreground ml-1">(Oldest: {pm.max_overdue_days} days)</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Health Score</p>
                    <p className="text-base font-semibold">{pm ? `${pm.credit_score} / 100` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Risk</p>
                    {pm ? (
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${riskTierBgColor(pm.risk_tier)}`}>
                        {pm.risk_tier}
                      </span>
                    ) : <p className="text-base font-semibold">—</p>}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Term</p>
                    <p className="text-base font-semibold">{profile?.display_term || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Payment Period</p>
                    <p className="text-base font-semibold text-blue-600">
                      {profile?.avg_payment_days != null ? `${profile.avg_payment_days} days` : '—'}
                      {profile?.avg_payment_days != null && <span className="text-xs font-normal text-muted-foreground ml-1">(Last 12 Months)</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Returns */}
            <div className="rounded-xl ring-1 ring-foreground/10 overflow-hidden self-stretch flex flex-col">
              <div className="bg-amber-500 px-5 py-2.5">
                <h2 className="text-sm font-bold text-white">Returns</h2>
              </div>
              <div className="px-5 py-5 flex-1 flex flex-col">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Return Count</p>
                    <p className="text-base font-semibold">{rm ? String(rm.return_count) : '—'} <span className="text-sm font-normal text-muted-foreground">total</span></p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unresolved</p>
                    {rm ? (
                      rm.unresolved > 0 ? (
                        <p className="text-base font-semibold text-red-600">{formatRM(rm.unresolved)}</p>
                      ) : (
                        <p className="text-base font-semibold text-emerald-600">Settled</p>
                      )
                    ) : <p className="text-base font-semibold">—</p>}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Return Trend (Last 12 Months)</p>
                <div className="flex-1 min-h-[140px]">
                  {returnTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={returnTrend}>
                        <XAxis dataKey="m" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#94a3b8' }} width={24} allowDecimals={false} />
                        <Tooltip wrapperStyle={{ zIndex: 50 }} />
                        <Line type="monotone" dataKey="c" stroke={returnColor} strokeWidth={2} dot={{ r: 3, fill: returnColor }} isAnimationActive={false} name="Returns" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No return data</div>
                  )}
                </div>
              </div>
            </div>

            {/* Sales Performance */}
            <div className="rounded-xl ring-1 ring-foreground/10 overflow-hidden self-stretch flex flex-col">
              <div className="bg-emerald-500 px-5 py-2.5">
                <h2 className="text-sm font-bold text-white">Sales Performance</h2>
              </div>
              <div className="px-5 py-5 flex-1 flex flex-col">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Profit Margin</p>
                    <p className={`text-base font-semibold ${salesPerf ? (salesPerf.marginPct >= 20 ? 'text-emerald-600' : salesPerf.marginPct >= 10 ? 'text-amber-600' : 'text-red-600') : ''}`}>
                      {salesPerf ? `${salesPerf.marginPct}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Period Revenue</p>
                    <p className="text-base font-semibold text-blue-600">
                      {monthlyData?.length ? formatRM(monthlyData.reduce((s, r) => s + r.revenue, 0)) : '—'}
                      <span className="text-sm font-normal text-muted-foreground ml-1">last 12m</span>
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Revenue Trend</p>
                <div className="flex-1 min-h-[140px]">
                  {revenueTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueTrend}>
                        <XAxis dataKey="m" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#94a3b8' }} width={36} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(v) => formatRM(Number(v))} />
                        <Line type="monotone" dataKey="r" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} isAnimationActive={false} name="Revenue" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No sales data</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Tabs ──────────────────────────────────────────── */}
          <div className="border-t pt-5">
            <Tabs defaultValue={defaultTab}>
              <TabsList variant="default" className="mb-4">
                <TabsTrigger value="payment">Pending Payment</TabsTrigger>
                <TabsTrigger value="returns">Return Records</TabsTrigger>
                <TabsTrigger value="sold-items">Sold Items</TabsTrigger>
              </TabsList>
              <TabsContent value="payment"><PaymentTab debtorCode={debtorCode} /></TabsContent>
              <TabsContent value="returns"><ReturnTab debtorCode={debtorCode} /></TabsContent>
              <TabsContent value="sold-items">
                <SoldItemsTab debtorCode={debtorCode} initialStartDate={initialStartDate} initialEndDate={initialEndDate} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
