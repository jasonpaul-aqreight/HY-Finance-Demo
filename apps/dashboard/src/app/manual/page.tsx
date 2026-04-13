import { TrendingUp, CreditCard, RotateCcw, BarChart3, Receipt, Users, Truck, Compass, Settings, RefreshCw } from 'lucide-react';
import { ManualCard, ManualCardGrid } from '@/components/manual';

export default function WikiHome() {
  return (
    <div>
      <h1
        className="text-3xl font-bold tracking-tight mb-2"
        style={{ color: '#1F4E79' }}
      >
        Wiki
      </h1>
      <p className="text-base leading-relaxed text-foreground mb-8">
        Welcome to the Hoi-Yong Finance Dashboard wiki. Find answers about
        any feature, metric, or control on the dashboard.
      </p>

      <h2 className="text-lg font-semibold text-foreground mb-3">General</h2>
      <ManualCardGrid>
        <ManualCard
          href="/manual/general/date-range"
          icon={Compass}
          title="Date Range"
          description="How to change the date filter and use quick presets."
        />
        <ManualCard
          href="/manual/general/export-excel"
          icon={Receipt}
          title="Export to Excel"
          description="Download table data as an Excel spreadsheet."
        />
        <ManualCard
          href="/manual/general/sort-filter"
          icon={BarChart3}
          title="Sort & Filter"
          description="Sort columns, search rows, and apply filters."
        />
      </ManualCardGrid>

      <h2 className="text-lg font-semibold text-foreground mb-3 mt-8">Admin</h2>
      <ManualCardGrid>
        <ManualCard
          href="/manual/admin/sync-data"
          icon={RefreshCw}
          title="Sync Data"
          description="How data flows from AutoCount to the dashboard."
        />
        <ManualCard
          href="/manual/admin/settings-payment"
          icon={Settings}
          title="Settings"
          description="Configure payment terms and other settings."
        />
      </ManualCardGrid>

      <h2 className="text-lg font-semibold text-foreground mb-3 mt-8">Finance</h2>
      <ManualCardGrid>
        <ManualCard
          href="/manual/finance/sales/overview"
          icon={TrendingUp}
          title="Sales"
          description="Revenue tracking — Net Sales, trends, and breakdowns."
        />
        <ManualCard
          href="/manual/finance/payment"
          icon={CreditCard}
          title="Payment Collection"
          description="Outstanding payments, aging, and credit health."
        />
        <ManualCard
          href="/manual/finance/return"
          icon={RotateCcw}
          title="Returns"
          description="Credit notes, refunds, and return trends."
        />
        <ManualCard
          href="/manual/finance/financial"
          icon={BarChart3}
          title="Financial Statements"
          description="Profit & Loss and Balance Sheet."
        />
        <ManualCard
          href="/manual/finance/expenses"
          icon={Receipt}
          title="Expenses"
          description="Where the money is going."
        />
        <ManualCard
          href="/manual/finance/customer-margin"
          icon={Users}
          title="Customer Margin"
          description="Profitability per customer."
        />
        <ManualCard
          href="/manual/finance/supplier-performance"
          icon={Truck}
          title="Supplier Performance"
          description="Supplier margins and performance."
        />
      </ManualCardGrid>
    </div>
  );
}
