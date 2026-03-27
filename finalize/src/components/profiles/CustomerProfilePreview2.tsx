'use client';

import { useState, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, CartesianGrid,
} from 'recharts';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronRight, FileText, RotateCcw, ShoppingCart, Info } from 'lucide-react';
import { formatRM } from '@/lib/payment/format';
import { riskTierBgColor } from '@/lib/payment/credit-score-v2';
import { useCustomerProfile, useCustomerInvoices } from '@/hooks/payment/usePaymentDataV2';
import { useCustomerReturnSummary, useCustomerReturnTrend, useCustomerReturnDetailsAll } from '@/hooks/return/useCreditDataV2';
import { useCustomerMonthly, useCustomerProducts } from '@/hooks/customer-margin/useMarginData';
import { useStableData } from '@/hooks/useStableData';
import { PaymentTab } from './PaymentTab';
import { ReturnTab } from './ReturnTab';
import { SoldItemsTab } from './SoldItemsTab';

/* ── Constants ───────────────────────────────────────────── */

// Contact info from CSV (not yet in DB — needs new API field)
const CONTACT_INFO: Record<string, { attention: string; phone: string; email: string; join_date: string }> = {
  '300-L006': { attention: 'AK YUK', phone: '016-680 3347', email: '—', join_date: '2021-03-01' },
};

const AGING_COLORS: Record<string, string> = {
  'Not Yet Due': '#4ade80',
  '1-30 Days':   '#facc15',
  '31-60 Days':  '#fb923c',
  '61-90 Days':  '#f87171',
  '91-120 Days': '#ef4444',
  '120+ Days':   '#dc2626',
};

type ActiveView = 'profile' | 'payment' | 'returns' | 'sold-items';

/* ── Helpers ─────────────────────────────────────────────── */

function shortMonth(m: string) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(m.slice(5, 7), 10) - 1] ?? m;
}

function scoreColor(s: number) {
  if (s >= 70) return '#10b981';
  if (s >= 40) return '#f59e0b';
  return '#ef4444';
}

function utilColorHex(pct: number) {
  if (pct > 100) return '#ef4444';
  if (pct >= 80) return '#f59e0b';
  return '#10b981';
}

/* ── Props ───────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
  debtorCode: string;
  companyName: string;
  defaultTab?: ActiveView;
}

/* ── Main Component ──────────────────────────────────────── */

export function CustomerProfilePreview2({
  open, onClose, debtorCode, companyName, defaultTab = 'profile',
}: Props) {
  const [activeView, setActiveView] = useState<ActiveView>(defaultTab);

  // ── Data hooks (same as CustomerProfileModal) ──
  const { data: profile } = useCustomerProfile(open ? debtorCode : null);
  const { data: returnSummary } = useCustomerReturnSummary(open ? debtorCode : null);
  const { data: returnTrend } = useCustomerReturnTrend(open ? debtorCode : null);
  const { data: invoiceData } = useCustomerInvoices(open ? debtorCode : null);
  const invoices = (invoiceData ?? []) as { doc_no: string; doc_date: string; due_date: string; local_net_total: number; outstanding: number; days_overdue: number }[];

  const last12Start = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() - 12); return d.toISOString().slice(0, 10); }, []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: monthlyData } = useCustomerMonthly(open ? debtorCode : null, last12Start, today);

  const { data: returnDetails } = useCustomerReturnDetailsAll(open ? debtorCode : null);
  const unsettledCount = returnDetails?.filter(r => r.unresolved > 0.01).length ?? 0;
  const overdueCount = invoices.filter(i => i.days_overdue > 0).length;

  const isActive = profile?.is_active ?? true;
  const contact = CONTACT_INFO[debtorCode] ?? { attention: '—', phone: '—', email: '—', join_date: '—' };

  // ── Sales perf from monthly data ──
  const salesPerf = useMemo(() => {
    if (!monthlyData?.length) return null;
    const totalRev = monthlyData.reduce((s, r) => s + r.revenue, 0);
    const totalCogs = monthlyData.reduce((s, r) => s + r.cogs, 0);
    const avgMargin = monthlyData.length > 0 ? monthlyData.reduce((s, r) => s + r.margin_pct, 0) / monthlyData.length : 0;
    return { totalRev, totalCogs, avgMargin };
  }, [monthlyData]);

  // ── Aging buckets from invoice data ──
  const agingBuckets = useMemo(() => {
    const buckets: Record<string, number> = {
      'Not Yet Due': 0, '1-30 Days': 0, '31-60 Days': 0,
      '61-90 Days': 0, '91-120 Days': 0, '120+ Days': 0,
    };
    for (const inv of invoices) {
      const d = inv.days_overdue;
      const amt = inv.outstanding;
      if (d <= 0) buckets['Not Yet Due'] += amt;
      else if (d <= 30) buckets['1-30 Days'] += amt;
      else if (d <= 60) buckets['31-60 Days'] += amt;
      else if (d <= 90) buckets['61-90 Days'] += amt;
      else if (d <= 120) buckets['91-120 Days'] += amt;
      else buckets['120+ Days'] += amt;
    }
    return buckets;
  }, [invoices]);

  const totalOutstanding = Object.values(agingBuckets).reduce((s, v) => s + v, 0);
  const totalOverdue = totalOutstanding - agingBuckets['Not Yet Due'];
  const agingEntries = Object.entries(agingBuckets).filter(([, v]) => v > 0);

  // ── Utilization ──
  const utilPct = profile?.utilization_pct ?? 0;
  const utilColor = utilPct > 100 ? 'text-red-600' : utilPct >= 80 ? 'text-yellow-600' : 'text-emerald-600';

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] flex flex-col gap-0 p-0" showCloseButton>

        {/* ── Header (always visible) ─────────────────────── */}
        <div className="px-8 py-4 border-b bg-muted/30 grid grid-cols-[auto_1fr] items-center gap-x-6">
          <div className="flex flex-col items-center gap-0.5 border-r border-foreground/10 pr-6">
            <span className="text-base font-bold tracking-tight">Customer</span>
            <span className="font-mono text-xs text-muted-foreground">{debtorCode}</span>
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold tracking-tight">{companyName}</h1>
            <span className={`mt-1 inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold text-white ${isActive ? 'bg-emerald-600' : 'bg-red-600'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {activeView !== 'profile' ? (
          /* ── Log Table Views (header stays, body replaced) ── */
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center gap-3 px-8 py-3 border-b">
              <Button variant="ghost" size="sm" onClick={() => setActiveView('profile')} className="gap-1.5">
                <ArrowLeft className="size-3.5" /> Back to Profile
              </Button>
              <div className="h-4 w-px bg-border" />
              <span className="text-base font-semibold">
                {activeView === 'payment' ? 'Outstanding Invoices' : activeView === 'returns' ? 'Return Records' : 'Sales Transactions'}
              </span>
            </div>
            <div className="px-8 py-5">
              {activeView === 'payment' && <PaymentTab debtorCode={debtorCode} />}
              {activeView === 'returns' && <ReturnTab debtorCode={debtorCode} />}
              {activeView === 'sold-items' && <SoldItemsTab debtorCode={debtorCode} />}
            </div>
          </div>
        ) : (
          <>
            {/* ── Scrollable body ─────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

              {/* ── Customer Details (3-col, compact inline) ──── */}
              <div className="rounded-xl ring-1 ring-foreground/10 overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-foreground/10">
                  {/* Contact */}
                  <div className="px-5 py-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-2">Contact</p>
                    <div className="space-y-1.5">
                      <p className="text-sm"><span className="text-muted-foreground">Attention:</span> <span className="font-semibold">{contact.attention}</span></p>
                      <p className="text-sm"><span className="text-muted-foreground">Phone:</span> <span className="font-semibold">{contact.phone}</span></p>
                      <p className="text-sm"><span className="text-muted-foreground">Email:</span> <span className="font-semibold">{contact.email}</span></p>
                    </div>
                  </div>
                  {/* Financial */}
                  <div className="px-5 py-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-2">Financial</p>
                    <div className="space-y-1.5">
                      <p className="text-sm"><span className="text-muted-foreground">Credit Limit:</span> <span className="font-semibold">{profile ? (profile.credit_limit > 0 ? formatRM(profile.credit_limit) : 'None') : '—'}</span></p>
                      <p className="text-sm"><span className="text-muted-foreground">Overdue Limit:</span> <span className="font-semibold">{formatRM(15000)}</span></p>
                      <p className="text-sm"><span className="text-muted-foreground">Payment Terms:</span> <span className="font-semibold">{profile?.display_term || '—'}</span></p>
                    </div>
                  </div>
                  {/* Account */}
                  <div className="px-5 py-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-2">Account</p>
                    <div className="space-y-1.5">
                      <p className="text-sm"><span className="text-muted-foreground">Customer Type:</span> <span className="font-semibold">{profile?.debtor_type || '—'}</span></p>
                      <p className="text-sm"><span className="text-muted-foreground">Sales Agent:</span> <span className="font-semibold">{profile?.sales_agent || '—'}</span></p>
                      <p className="text-sm"><span className="text-muted-foreground">Join Date:</span> <span className="font-semibold">{contact.join_date !== '—' ? new Date(contact.join_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Statistics (4-col visual cards) ───────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">Statistics</p>
                  <span className="text-[11px] text-muted-foreground">— Last 12 months</span>
                </div>
                <div className="grid grid-cols-4 gap-4">

                  {/* Credit Health Gauge */}
                  <div className="rounded-xl ring-1 ring-foreground/[0.06] flex flex-col items-center pt-4 pb-3 px-4 gap-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">Credit Health</p>
                    {(() => {
                      const score = profile?.credit_score ?? 0;
                      const radius = 64, sw = 12, cx = 80, cy = 76;
                      const circ = Math.PI * radius;
                      const filled = (score / 100) * circ;
                      const arc = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;
                      return (
                        <svg viewBox="0 0 160 96" className="w-[150px] h-auto">
                          <defs><linearGradient id="gauge-g" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#ef4444" /><stop offset="50%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs>
                          <path d={arc} fill="none" stroke="#e5e7eb" strokeWidth={sw} strokeLinecap="round" />
                          <path d={arc} fill="none" stroke="url(#gauge-g)" strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${filled} ${circ}`} />
                          <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: '26px', fill: scoreColor(score), fontWeight: 700 }}>{score}</text>
                          <text x={cx} y={cy + 8} textAnchor="middle" style={{ fontSize: '10px', fill: '#94a3b8' }}>/ 100</text>
                        </svg>
                      );
                    })()}
                    {profile && (
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${riskTierBgColor(profile.risk_tier)}`}>
                        {profile.risk_tier} Risk
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Avg Pay: <span className="font-semibold text-foreground">{profile?.avg_payment_days != null ? `${profile.avg_payment_days} days` : '—'}</span>
                    </p>
                  </div>

                  {/* Credit Utilization Donut */}
                  <div className="rounded-xl ring-1 ring-foreground/[0.06] flex flex-col items-center pt-4 pb-3 px-4 gap-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">Credit Utilization</p>
                    <div className="relative w-[130px] h-[130px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Used', value: profile?.total_outstanding ?? 0 },
                              { name: 'Available', value: Math.max((profile?.credit_limit ?? 0) - (profile?.total_outstanding ?? 0), 0) },
                            ]}
                            cx="50%" cy="50%" innerRadius={42} outerRadius={56}
                            startAngle={90} endAngle={-270} dataKey="value" stroke="none" isAnimationActive={false}
                          >
                            <Cell fill={utilColorHex(utilPct)} />
                            <Cell fill="#e5e7eb" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-xl font-bold ${utilColor}`}>{utilPct != null ? `${utilPct.toFixed(0)}%` : 'N/A'}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {formatRM(profile?.total_outstanding ?? 0)} of {formatRM(profile?.credit_limit ?? 0)}
                    </p>
                  </div>

                  {/* Outstanding Invoices Aging Bar */}
                  <div className="rounded-xl ring-1 ring-foreground/[0.06] flex flex-col pt-4 pb-3 px-4 gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">Outstanding Invoices</p>
                    {/* Stacked horizontal bar */}
                    <div className="flex w-full h-5 rounded-lg overflow-hidden mt-1">
                      {agingEntries.map(([label, value]) => {
                        const pct = totalOutstanding > 0 ? (value / totalOutstanding) * 100 : 0;
                        return (
                          <div key={label} style={{ width: `${pct}%`, backgroundColor: AGING_COLORS[label], minWidth: pct > 0 ? 12 : 0 }} title={`${label}: ${formatRM(value)}`} />
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {agingEntries.map(([label, value]) => (
                        <div key={label} className="flex items-center gap-1">
                          <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: AGING_COLORS[label] }} />
                          <span className="text-[10px] text-foreground">{label}</span>
                          <span className="text-[10px] text-muted-foreground">{formatRM(value)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-auto pt-1.5 border-t">
                      <p className="text-xs">Total: <span className="font-semibold">{formatRM(totalOutstanding)}</span></p>
                      {totalOverdue > 0 && <p className="text-[11px] text-red-600 font-medium">Overdue: {formatRM(totalOverdue)}</p>}
                    </div>
                  </div>

                  {/* Returns Donut */}
                  <div className="rounded-xl ring-1 ring-foreground/[0.06] flex flex-col items-center pt-4 pb-3 px-4 gap-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">Returns</p>
                    <div className="relative w-[130px] h-[130px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Resolved', value: Math.max((returnSummary?.return_count ?? 0) - unsettledCount, 0) },
                              { name: 'Unresolved', value: unsettledCount },
                            ]}
                            cx="50%" cy="50%" innerRadius={42} outerRadius={56}
                            startAngle={90} endAngle={-270} dataKey="value" stroke="none" isAnimationActive={false}
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#ef4444" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-bold">{unsettledCount}<span className="text-muted-foreground">/{returnSummary?.return_count ?? 0}</span></span>
                      </div>
                    </div>
                    <div className="text-center">
                      {unsettledCount > 0 ? (
                        <>
                          <p className="text-xs font-semibold text-red-600">Unsettled</p>
                          <p className="text-xs text-muted-foreground">{formatRM(returnSummary?.unresolved ?? 0)}</p>
                        </>
                      ) : (
                        <p className="text-xs font-semibold text-emerald-600">All Settled</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Trends (tabbed) ───────────────────────────── */}
              <div className="border-t pt-5">
                <Tabs defaultValue="sales">
                  <div className="flex items-center justify-between mb-4">
                    <TabsList variant="default">
                      <TabsTrigger value="sales">Sales &amp; Margin</TabsTrigger>
                      <TabsTrigger value="returns">Returns</TabsTrigger>
                    </TabsList>
                    <span className="text-xs text-muted-foreground">
                      {shortMonth(last12Start.slice(0, 7))} {last12Start.slice(0, 4)} — {shortMonth(today.slice(0, 7))} {today.slice(0, 4)}
                    </span>
                  </div>

                  <TabsContent value="sales">
                    {monthlyData?.length ? (
                      <div>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={monthlyData.map(m => ({ month: shortMonth(m.period), revenue: m.revenue, margin_pct: m.margin_pct }))} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#94a3b8' }} />
                              <YAxis yAxisId="rev" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                              <YAxis yAxisId="margin" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
                              <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(value: number, name: string) => name === 'revenue' ? [formatRM(value), 'Revenue'] : [`${value.toFixed(1)}%`, 'Margin']} />
                              <Bar yAxisId="rev" dataKey="revenue" fill="#2E5090" radius={[4, 4, 0, 0]} barSize={24} isAnimationActive={false} name="revenue" />
                              <Line yAxisId="margin" dataKey="margin_pct" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} isAnimationActive={false} name="margin_pct" connectNulls />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                          <div><p className="text-xs text-muted-foreground">Net Sales</p><p className="text-lg font-bold">{formatRM(salesPerf?.totalRev ?? 0)}</p></div>
                          <div><p className="text-xs text-muted-foreground">Avg Margin</p><p className="text-lg font-bold">{salesPerf?.avgMargin.toFixed(1) ?? '0.0'}%</p></div>
                          <div><p className="text-xs text-muted-foreground">Total COGS</p><p className="text-lg font-bold">{formatRM(salesPerf?.totalCogs ?? 0)}</p></div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[300px] animate-pulse rounded bg-muted" />
                    )}
                  </TabsContent>

                  <TabsContent value="returns">
                    {returnTrend?.length ? (
                      <div>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={returnTrend.map(m => ({ month: shortMonth(m.month), count: m.count }))} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#94a3b8' }} />
                              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                              <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(value: number) => [value, 'Returns']} />
                              <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={24} isAnimationActive={false} name="count" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                          <div><p className="text-xs text-muted-foreground">Return Count</p><p className="text-lg font-bold">{returnTrend.reduce((s, m) => s + m.count, 0)}</p></div>
                          <div><p className="text-xs text-muted-foreground">Total Return Value</p><p className="text-lg font-bold">{formatRM(returnTrend.reduce((s, m) => s + m.value, 0))}</p></div>
                          <div><p className="text-xs text-muted-foreground">Unresolved Amount</p><p className="text-lg font-bold text-red-600">{formatRM(returnSummary?.unresolved ?? 0)}</p></div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[300px] animate-pulse rounded bg-muted" />
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* ── Logs (clickable links) ────────────────────── */}
              <div className="rounded-xl ring-1 ring-foreground/10 overflow-hidden divide-y divide-foreground/10">
                {([
                  { key: 'payment' as const, icon: FileText, label: 'Outstanding Invoices', badge: overdueCount > 0 ? `${overdueCount} Outstanding` : null, badgeColor: 'bg-red-100 text-red-700' },
                  { key: 'returns' as const, icon: RotateCcw, label: 'Return Records', badge: unsettledCount > 0 ? `${unsettledCount} Unsettled` : null, badgeColor: 'bg-amber-100 text-amber-700' },
                  { key: 'sold-items' as const, icon: ShoppingCart, label: 'Sales Transactions', badge: null, badgeColor: '' },
                ]).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      className="flex items-center w-full px-5 py-3.5 text-left hover:bg-muted/40 transition-colors group cursor-pointer"
                      onClick={() => setActiveView(item.key)}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted mr-3">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                      {item.badge && (
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full mr-3 ${item.badgeColor}`}>{item.badge}</span>
                      )}
                      <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </button>
                  );
                })}
              </div>

            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
