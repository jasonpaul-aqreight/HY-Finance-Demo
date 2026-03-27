"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ChevronRight,
  FileText,
  RotateCcw,
  ShoppingCart,
  Info,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════ */

const mockCustomer = {
  company_name: "SYARIKAT BUAH SEGAR SDN BHD",
  debtor_code: "300-A0023",
  is_active: true,
  attention: "Ahmad bin Ibrahim",
  phone: "03-8920 4455",
  email: "ahmad@buahsegar.com.my",
  credit_limit: 80000,
  overdue_limit: 15000,
  display_term: "30 Days",
  debtor_type: "Fruit Shop",
  sales_agent: "AGT03 - Lim Wei",
  join_date: "2019-06-15",
  credit_score: 72,
  risk_tier: "Moderate" as const,
  avg_payment_days: 38,
  utilization_pct: 65,
  total_outstanding: 52000,
  aging_buckets: {
    not_due: 20000,
    d1_30: 15000,
    d31_60: 10000,
    d61_90: 5000,
    d91_120: 2000,
    d120_plus: 0,
  },
  return_count: 7,
  unsettled_returns: 3,
  unresolved_amount: 4850,
  monthly_sales: [
    { month: "2025-01", revenue: 42000, margin_pct: 21.5 },
    { month: "2025-02", revenue: 38500, margin_pct: 19.8 },
    { month: "2025-03", revenue: 45200, margin_pct: 23.1 },
    { month: "2025-04", revenue: 41000, margin_pct: 20.4 },
    { month: "2025-05", revenue: 47800, margin_pct: 22.7 },
    { month: "2025-06", revenue: 39500, margin_pct: 18.9 },
    { month: "2025-07", revenue: 51200, margin_pct: 24.3 },
    { month: "2025-08", revenue: 48300, margin_pct: 22.1 },
    { month: "2025-09", revenue: 44600, margin_pct: 21.0 },
    { month: "2025-10", revenue: 50100, margin_pct: 23.5 },
    { month: "2025-11", revenue: 46700, margin_pct: 22.8 },
    { month: "2025-12", revenue: 53400, margin_pct: 25.1 },
  ],
  monthly_returns: [
    { month: "2025-01", count: 1, value: 1200 },
    { month: "2025-02", count: 0, value: 0 },
    { month: "2025-03", count: 1, value: 850 },
    { month: "2025-04", count: 0, value: 0 },
    { month: "2025-05", count: 2, value: 3100 },
    { month: "2025-06", count: 0, value: 0 },
    { month: "2025-07", count: 1, value: 1500 },
    { month: "2025-08", count: 0, value: 0 },
    { month: "2025-09", count: 1, value: 2200 },
    { month: "2025-10", count: 0, value: 0 },
    { month: "2025-11", count: 1, value: 1800 },
    { month: "2025-12", count: 0, value: 0 },
  ],
  outstanding_invoices: [
    { doc_no: "IV-24-00891", doc_date: "2025-10-15", due_date: "2025-11-14", total: 12500, outstanding: 12500, days_overdue: 133 },
    { doc_no: "IV-24-00923", doc_date: "2025-11-02", due_date: "2025-12-02", total: 9800, outstanding: 9800, days_overdue: 115 },
    { doc_no: "IV-24-00967", doc_date: "2025-11-28", due_date: "2025-12-28", total: 15200, outstanding: 15200, days_overdue: 89 },
    { doc_no: "IV-24-01015", doc_date: "2025-12-10", due_date: "2026-01-09", total: 8300, outstanding: 8300, days_overdue: 77 },
    { doc_no: "IV-25-00042", doc_date: "2026-01-18", due_date: "2026-02-17", total: 6200, outstanding: 6200, days_overdue: 38 },
  ],
  return_records: [
    { doc_no: "CN-25-00112", doc_date: "2025-09-20", net_total: 2200, knocked_off: 2200, refunded: 0, unresolved: 0, reason: "Quality issue" },
    { doc_no: "CN-25-00158", doc_date: "2025-11-05", net_total: 1800, knocked_off: 0, refunded: 0, unresolved: 1800, reason: "Overripe goods" },
    { doc_no: "CN-25-00189", doc_date: "2025-12-12", net_total: 1500, knocked_off: 1500, refunded: 0, unresolved: 0, reason: "Short delivery" },
    { doc_no: "CN-26-00015", doc_date: "2026-01-08", net_total: 2100, knocked_off: 0, refunded: 0, unresolved: 2100, reason: "Damaged packaging" },
    { doc_no: "CN-26-00031", doc_date: "2026-02-14", net_total: 950, knocked_off: 0, refunded: 0, unresolved: 950, reason: "Wrong item delivered" },
  ],
  sales_transactions: [
    { item_code: "FRT-001", description: "Cavendish Banana (Grade A)", product_group: "Banana", qty: 520, revenue: 15600, cost: 11700, margin_pct: 25.0 },
    { item_code: "FRT-015", description: "Musang King Durian", product_group: "Durian", qty: 85, revenue: 42500, cost: 34000, margin_pct: 20.0 },
    { item_code: "FRT-023", description: "Harumanis Mango", product_group: "Mango", qty: 310, revenue: 18600, cost: 14880, margin_pct: 20.0 },
    { item_code: "FRT-008", description: "Red Watermelon", product_group: "Melon", qty: 450, revenue: 9000, cost: 7200, margin_pct: 20.0 },
    { item_code: "FRT-031", description: "Zespri Kiwi (Green)", product_group: "Imported", qty: 200, revenue: 12000, cost: 10200, margin_pct: 15.0 },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function formatRM(value: number): string {
  return `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

function shortMonth(monthStr: string): string {
  const [, m] = monthStr.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[parseInt(m, 10) - 1] ?? m;
}

function scoreColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function tierColors(tier: string): { bg: string; text: string } {
  switch (tier) {
    case "Low":
      return { bg: "bg-emerald-600", text: "text-white" };
    case "Moderate":
      return { bg: "bg-amber-500", text: "text-white" };
    case "High":
      return { bg: "bg-red-600", text: "text-white" };
    default:
      return { bg: "bg-gray-500", text: "text-white" };
  }
}

function utilColor(pct: number): string {
  if (pct > 100) return "#ef4444";
  if (pct >= 80) return "#f59e0b";
  return "#10b981";
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 1: HEADER
   ═══════════════════════════════════════════════════════════════ */

function ProfileHeader({ onClose }: { onClose?: () => void }) {
  const d = mockCustomer;
  return (
    <div className="relative flex items-center justify-between px-8 py-5 border-b bg-gradient-to-r from-slate-50 to-white">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-md bg-indigo-600 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-white uppercase">
            Customer
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {d.company_name}
        </h1>
        <p className="font-mono text-sm text-foreground/60">{d.debtor_code}</p>
      </div>
      <div className="flex items-center gap-4">
        {d.is_active ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm">
            <CheckCircle2 className="size-4" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm">
            <XCircle className="size-4" />
            Inactive
          </span>
        )}
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <XCircle className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 2: CUSTOMER DETAILS
   ═══════════════════════════════════════════════════════════════ */

function CustomerDetails() {
  const d = mockCustomer;
  const pairs: { label: string; value: string }[][] = [
    [
      { label: "PIC", value: d.attention },
      { label: "Phone", value: d.phone },
      { label: "Email", value: d.email },
    ],
    [
      { label: "Credit Limit", value: formatRM(d.credit_limit) },
      { label: "Overdue Limit", value: formatRM(d.overdue_limit) },
      { label: "Payment Terms", value: d.display_term },
    ],
    [
      { label: "Customer Type", value: d.debtor_type },
      { label: "Sales Agent", value: d.sales_agent },
      { label: "Join Date", value: formatDate(d.join_date) },
    ],
  ];
  const colTitles = ["Contact", "Financial", "Account"];

  return (
    <Card className="border-0 shadow-none ring-1 ring-foreground/[0.06]">
      <CardContent className="p-0">
        <div className="grid grid-cols-3 divide-x divide-foreground/[0.06]">
          {pairs.map((col, ci) => (
            <div key={ci} className="px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-4">
                {colTitles[ci]}
              </p>
              <div className="space-y-3.5">
                {col.map((item) => (
                  <div key={item.label}>
                    <p className="text-xs font-medium text-foreground/50 mb-0.5">{item.label}</p>
                    <p className="text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3: STATISTICS — CREDIT HEALTH GAUGE
   ═══════════════════════════════════════════════════════════════ */

function CreditHealthGauge() {
  const { credit_score, risk_tier, avg_payment_days } = mockCustomer;
  const tier = tierColors(risk_tier);

  // Semi-circle gauge using stroke-dasharray
  const radius = 64;
  const strokeWidth = 12;
  const cx = 80;
  const cy = 76;
  const circumference = Math.PI * radius; // half-circle length
  const filled = (credit_score / 100) * circumference;

  // Arc path: semi-circle from left to right
  const arcPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;

  return (
    <Card className="flex flex-col items-center border-0 shadow-none ring-1 ring-foreground/[0.06] overflow-hidden">
      <CardContent className="flex flex-col items-center pt-5 pb-4 px-4 gap-2 w-full">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-1">
          Credit Health
        </p>
        <svg viewBox="0 0 160 96" className="w-[180px] h-auto">
          <defs>
            <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          {/* Background track */}
          <path
            d={arcPath}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d={arcPath}
            fill="none"
            stroke="url(#gauge-gradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
          />
          {/* Score text */}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            className="font-bold"
            style={{ fontSize: "28px", fill: scoreColor(credit_score), fontFamily: "var(--font-sans)" }}
          >
            {credit_score}
          </text>
          <text
            x={cx}
            y={cy + 8}
            textAnchor="middle"
            style={{ fontSize: "10px", fill: "#94a3b8", fontFamily: "var(--font-sans)" }}
          >
            / 100
          </text>
        </svg>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${tier.bg} ${tier.text}`}>
          {risk_tier} Risk
        </span>
        <p className="text-sm font-medium text-foreground">
          Avg Pay: <span className="font-bold">{avg_payment_days} days</span>
        </p>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3: STATISTICS — CREDIT UTILIZATION RING
   ═══════════════════════════════════════════════════════════════ */

function CreditUtilizationRing() {
  const { utilization_pct, total_outstanding, credit_limit } = mockCustomer;
  const color = utilColor(utilization_pct);
  const available = Math.max(credit_limit - total_outstanding, 0);
  const data = [
    { name: "Used", value: total_outstanding },
    { name: "Available", value: available },
  ];

  return (
    <Card className="flex flex-col items-center border-0 shadow-none ring-1 ring-foreground/[0.06] overflow-hidden">
      <CardContent className="flex flex-col items-center pt-5 pb-4 px-4 gap-2 w-full">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-1">
          Credit Utilization
        </p>
        <div className="relative w-[150px] h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={64}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
                isAnimationActive={false}
              >
                <Cell fill={color} />
                <Cell fill="#e5e7eb" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color }}>
              {utilization_pct}%
            </span>
          </div>
        </div>
        <p className="text-sm font-medium text-foreground text-center">
          {formatRM(total_outstanding)} of {formatRM(credit_limit)}
        </p>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3: STATISTICS — OUTSTANDING INVOICES (AGING BAR)
   ═══════════════════════════════════════════════════════════════ */

const agingConfig = [
  { key: "not_due", label: "Not Due", color: "#3b82f6" },
  { key: "d1_30", label: "1-30", color: "#22c55e" },
  { key: "d31_60", label: "31-60", color: "#f59e0b" },
  { key: "d61_90", label: "61-90", color: "#f97316" },
  { key: "d91_120", label: "91-120", color: "#ef4444" },
  { key: "d120_plus", label: "120+", color: "#991b1b" },
] as const;

function AgingBarCard() {
  const { aging_buckets, total_outstanding } = mockCustomer;
  const total = Object.values(aging_buckets).reduce((s, v) => s + v, 0);
  const overdue = total - aging_buckets.not_due;

  return (
    <Card className="flex flex-col border-0 shadow-none ring-1 ring-foreground/[0.06] overflow-hidden">
      <CardContent className="flex flex-col pt-5 pb-4 px-5 gap-3 w-full h-full">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">
          Outstanding Invoices
        </p>

        {/* Stacked horizontal bar */}
        <div className="flex w-full h-7 rounded-lg overflow-hidden mt-2">
          {agingConfig.map(({ key, color }) => {
            const value = aging_buckets[key as keyof typeof aging_buckets];
            if (value === 0) return null;
            const pct = (value / total) * 100;
            return (
              <div
                key={key}
                className="relative flex items-center justify-center transition-all"
                style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 0 ? 16 : 0 }}
                title={`${agingConfig.find((a) => a.key === key)?.label}: ${formatRM(value)}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1">
          {agingConfig.map(({ key, label, color }) => {
            const value = aging_buckets[key as keyof typeof aging_buckets];
            if (value === 0) return null;
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-[11px] font-medium text-foreground">{label}</span>
                <span className="text-[11px] text-foreground/60">{formatRM(value)}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-2 border-t border-foreground/[0.06]">
          <p className="text-sm text-foreground">
            Total Outstanding: <span className="font-bold">{formatRM(total_outstanding)}</span>
          </p>
          {overdue > 0 && (
            <p className="text-xs text-red-600 font-medium mt-0.5">
              Overdue: {formatRM(overdue)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3: STATISTICS — RETURNS DONUT
   ═══════════════════════════════════════════════════════════════ */

function ReturnsDonut() {
  const { return_count, unsettled_returns, unresolved_amount } = mockCustomer;
  const resolved = return_count - unsettled_returns;
  const data = [
    { name: "Resolved", value: resolved },
    { name: "Unresolved", value: unsettled_returns },
  ];

  return (
    <Card className="flex flex-col items-center border-0 shadow-none ring-1 ring-foreground/[0.06] overflow-hidden">
      <CardContent className="flex flex-col items-center pt-5 pb-4 px-4 gap-2 w-full">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-1">
          Returns
        </p>
        <div className="relative w-[150px] h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={64}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
                isAnimationActive={false}
              >
                <Cell fill="#10b981" />
                <Cell fill="#ef4444" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-foreground">
              {unsettled_returns}<span className="text-foreground/40">/{return_count}</span>
            </span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-red-600">Unsettled</p>
          <p className="text-sm font-medium text-foreground">{formatRM(unresolved_amount)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3: STATISTICS ROW
   ═══════════════════════════════════════════════════════════════ */

function StatisticsRow() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-4">
        <CreditHealthGauge />
        <CreditUtilizationRing />
        <AgingBarCard />
        <ReturnsDonut />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-foreground/50">
        <Info className="size-3" />
        Statistics based on last 12 months unless otherwise noted
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4: TRENDS — SALES & MARGIN COMBO CHART
   ═══════════════════════════════════════════════════════════════ */

function SalesMarginChart() {
  const data = mockCustomer.monthly_sales.map((m) => ({
    month: shortMonth(m.month),
    revenue: m.revenue,
    margin_pct: m.margin_pct,
  }));

  const totalRevenue = mockCustomer.monthly_sales.reduce((s, m) => s + m.revenue, 0);
  const avgMargin =
    mockCustomer.monthly_sales.reduce((s, m) => s + m.margin_pct, 0) /
    mockCustomer.monthly_sales.length;
  const totalCogs = mockCustomer.monthly_sales.reduce(
    (s, m) => s + m.revenue * (1 - m.margin_pct / 100),
    0
  );

  return (
    <div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              yAxisId="revenue"
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
            />
            <YAxis
              yAxisId="margin"
              orientation="right"
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
              domain={[0, 40]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "13px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
              }}
              formatter={(value, name) =>
                name === "revenue"
                  ? [formatRM(Number(value)), "Revenue"]
                  : [`${Number(value).toFixed(1)}%`, "Margin"]
              }
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value: string) =>
                value === "revenue" ? "Revenue" : "Margin %"
              }
            />
            <Bar
              yAxisId="revenue"
              dataKey="revenue"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
              barSize={28}
              isAnimationActive={false}
            />
            <Line
              yAxisId="margin"
              dataKey="margin_pct"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-foreground/[0.06]">
        <div>
          <p className="text-xs font-medium text-foreground/50">Net Sales</p>
          <p className="text-lg font-bold text-foreground">{formatRM(totalRevenue)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-foreground/50">Avg Margin</p>
          <p className="text-lg font-bold text-foreground">{avgMargin.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs font-medium text-foreground/50">Total COGS</p>
          <p className="text-lg font-bold text-foreground">{formatRM(Math.round(totalCogs))}</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4: TRENDS — RETURNS CHART
   ═══════════════════════════════════════════════════════════════ */

function ReturnsTrendChart() {
  const data = mockCustomer.monthly_returns.map((m) => ({
    month: shortMonth(m.month),
    count: m.count,
    value: m.value,
  }));

  const totalCount = mockCustomer.monthly_returns.reduce((s, m) => s + m.count, 0);
  const totalValue = mockCustomer.monthly_returns.reduce((s, m) => s + m.value, 0);

  return (
    <div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "13px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
              }}
              formatter={(value, name) =>
                name === "count" ? [value, "Count"] : [formatRM(Number(value)), "Value"]
              }
            />
            <Legend verticalAlign="top" height={36} />
            <Bar
              dataKey="count"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              barSize={24}
              isAnimationActive={false}
              name="Count"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-foreground/[0.06]">
        <div>
          <p className="text-xs font-medium text-foreground/50">Return Count</p>
          <p className="text-lg font-bold text-foreground">{totalCount}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-foreground/50">Total Return Value</p>
          <p className="text-lg font-bold text-foreground">{formatRM(totalValue)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-foreground/50">Unresolved Amount</p>
          <p className="text-lg font-bold text-red-600">{formatRM(mockCustomer.unresolved_amount)}</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4: TRENDS SECTION
   ═══════════════════════════════════════════════════════════════ */

function TrendsSection() {
  return (
    <Card className="border-0 shadow-none ring-1 ring-foreground/[0.06]">
      <CardContent className="p-6">
        <Tabs defaultValue="sales">
          <div className="flex items-center justify-between mb-5">
            <TabsList variant="default">
              <TabsTrigger value="sales">Sales &amp; Margin</TabsTrigger>
              <TabsTrigger value="returns">Returns</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2 text-xs font-medium text-foreground/50 bg-muted px-3 py-1.5 rounded-lg">
              <span>Jan 2025</span>
              <span>—</span>
              <span>Dec 2025</span>
            </div>
          </div>
          <TabsContent value="sales">
            <SalesMarginChart />
          </TabsContent>
          <TabsContent value="returns">
            <ReturnsTrendChart />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5: LOG TABLE VIEWS
   ═══════════════════════════════════════════════════════════════ */

function InvoiceTableView({ onBack }: { onBack: () => void }) {
  const rows = mockCustomer.outstanding_invoices;
  return (
    <div>
      <div className="flex items-center gap-3 px-8 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-3.5" />
          Back to Profile
        </Button>
        <div className="h-4 w-px bg-foreground/10" />
        <h2 className="text-base font-bold text-foreground">Outstanding Invoices</h2>
        <span className="text-sm text-foreground/50">— {mockCustomer.company_name}</span>
      </div>
      <div className="px-8 py-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doc No</TableHead>
              <TableHead>Doc Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total (RM)</TableHead>
              <TableHead className="text-right">Outstanding (RM)</TableHead>
              <TableHead className="text-right">Days Overdue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.doc_no}>
                <TableCell className="font-mono font-medium">{r.doc_no}</TableCell>
                <TableCell>{formatDate(r.doc_date)}</TableCell>
                <TableCell>{formatDate(r.due_date)}</TableCell>
                <TableCell className="text-right">{formatRM(r.total)}</TableCell>
                <TableCell className="text-right font-semibold">{formatRM(r.outstanding)}</TableCell>
                <TableCell className="text-right">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                      r.days_overdue > 90
                        ? "bg-red-100 text-red-700"
                        : r.days_overdue > 30
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {r.days_overdue}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ReturnTableView({ onBack }: { onBack: () => void }) {
  const rows = mockCustomer.return_records;
  return (
    <div>
      <div className="flex items-center gap-3 px-8 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-3.5" />
          Back to Profile
        </Button>
        <div className="h-4 w-px bg-foreground/10" />
        <h2 className="text-base font-bold text-foreground">Return Records</h2>
        <span className="text-sm text-foreground/50">— {mockCustomer.company_name}</span>
      </div>
      <div className="px-8 py-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doc No</TableHead>
              <TableHead>Doc Date</TableHead>
              <TableHead className="text-right">Net Total (RM)</TableHead>
              <TableHead className="text-right">Knocked Off</TableHead>
              <TableHead className="text-right">Refunded</TableHead>
              <TableHead className="text-right">Unresolved</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.doc_no}>
                <TableCell className="font-mono font-medium">{r.doc_no}</TableCell>
                <TableCell>{formatDate(r.doc_date)}</TableCell>
                <TableCell className="text-right">{formatRM(r.net_total)}</TableCell>
                <TableCell className="text-right">{r.knocked_off > 0 ? formatRM(r.knocked_off) : "—"}</TableCell>
                <TableCell className="text-right">{r.refunded > 0 ? formatRM(r.refunded) : "—"}</TableCell>
                <TableCell className="text-right">
                  {r.unresolved > 0 ? (
                    <span className="font-semibold text-red-600">{formatRM(r.unresolved)}</span>
                  ) : (
                    <span className="text-emerald-600 font-medium">Settled</span>
                  )}
                </TableCell>
                <TableCell>{r.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SalesTableView({ onBack }: { onBack: () => void }) {
  const rows = mockCustomer.sales_transactions;
  return (
    <div>
      <div className="flex items-center gap-3 px-8 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-3.5" />
          Back to Profile
        </Button>
        <div className="h-4 w-px bg-foreground/10" />
        <h2 className="text-base font-bold text-foreground">Sales Transactions</h2>
        <span className="text-sm text-foreground/50">— {mockCustomer.company_name}</span>
      </div>
      <div className="px-8 py-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Product Group</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Revenue (RM)</TableHead>
              <TableHead className="text-right">Cost (RM)</TableHead>
              <TableHead className="text-right">Margin %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.item_code}>
                <TableCell className="font-mono font-medium">{r.item_code}</TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.product_group}</Badge>
                </TableCell>
                <TableCell className="text-right">{r.qty.toLocaleString()}</TableCell>
                <TableCell className="text-right">{formatRM(r.revenue)}</TableCell>
                <TableCell className="text-right">{formatRM(r.cost)}</TableCell>
                <TableCell className="text-right">
                  <span
                    className={`font-bold ${
                      r.margin_pct >= 20
                        ? "text-emerald-600"
                        : r.margin_pct >= 10
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {r.margin_pct.toFixed(1)}%
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5: LOGS SECTION
   ═══════════════════════════════════════════════════════════════ */

function LogsSection({
  onNavigate,
}: {
  onNavigate: (view: "invoices" | "returns" | "sales") => void;
}) {
  const overdueCount = mockCustomer.outstanding_invoices.length;
  const unsettledCount = mockCustomer.unsettled_returns;

  const items: {
    key: "invoices" | "returns" | "sales";
    icon: typeof FileText;
    label: string;
    badge: string | null;
    badgeColor: string;
  }[] = [
    {
      key: "invoices",
      icon: FileText,
      label: "Outstanding Invoices",
      badge: `${overdueCount} Outstanding`,
      badgeColor: "bg-red-100 text-red-700",
    },
    {
      key: "returns",
      icon: RotateCcw,
      label: "Return Records",
      badge: `${unsettledCount} Unsettled`,
      badgeColor: "bg-amber-100 text-amber-700",
    },
    {
      key: "sales",
      icon: ShoppingCart,
      label: "Sales Transactions",
      badge: null,
      badgeColor: "",
    },
  ];

  return (
    <Card className="border-0 shadow-none ring-1 ring-foreground/[0.06]">
      <CardContent className="p-0 divide-y divide-foreground/[0.06]">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className="flex items-center w-full px-6 py-4 text-left hover:bg-muted/40 transition-colors group cursor-pointer"
              onClick={() => onNavigate(item.key)}
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted mr-4">
                <Icon className="size-4 text-foreground/60" />
              </div>
              <span className="text-sm font-semibold text-foreground flex-1">{item.label}</span>
              {item.badge && (
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full mr-3 ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
              <ChevronRight className="size-4 text-foreground/30 group-hover:text-foreground/60 transition-colors" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function CustomerProfileRevamp() {
  const [activeView, setActiveView] = useState<"profile" | "invoices" | "returns" | "sales">(
    "profile"
  );

  // Simulate the dialog at ~90vw × 90vh
  return (
    <div className="flex items-center justify-center min-h-screen bg-black/5 p-6">
      <div className="w-[90vw] max-h-[90vh] bg-background rounded-xl ring-1 ring-foreground/10 shadow-2xl flex flex-col overflow-hidden">
        {activeView !== "profile" ? (
          // Log table views replace the entire dialog content
          <div className="flex-1 overflow-y-auto">
            {activeView === "invoices" && (
              <InvoiceTableView onBack={() => setActiveView("profile")} />
            )}
            {activeView === "returns" && (
              <ReturnTableView onBack={() => setActiveView("profile")} />
            )}
            {activeView === "sales" && (
              <SalesTableView onBack={() => setActiveView("profile")} />
            )}
          </div>
        ) : (
          <>
            <ProfileHeader />
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
              <CustomerDetails />
              <StatisticsRow />
              <TrendsSection />
              <LogsSection onNavigate={(v) => setActiveView(v)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
