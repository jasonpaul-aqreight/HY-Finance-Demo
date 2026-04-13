import { MetricCard, MetricGrid } from '@/components/manual/MetricCard';
import { Callout } from '@/components/manual/Callout';
import { Screenshot } from '@/components/manual/Screenshot';

export default function SalesMetricsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#1F4E79' }}>
        Net Sales, Invoice, Cash &amp; Credit Notes
      </h1>

      <p className="text-base text-foreground">
        At the top of the Sales page you will find four KPI cards. Together they tell you exactly
        how much revenue came in and what reduced it.
      </p>

      <Screenshot
        src="/manual/sales/date-filter-kpi.png"
        alt="KPI cards"
        caption="The four KPI cards showing Net Sales, Invoice Sales, Cash Sales, and Credit Notes."
      />

      <MetricGrid>
        <MetricCard
          name="Net Sales"
          formula="Invoice Sales + Cash Sales − Credit Notes"
          description="Your actual revenue. This is the headline number reported to management. It accounts for everything — credit sales, cash sales, and any returns or adjustments."
          color="#1F4E79"
        />

        <MetricCard
          name="Invoice Sales"
          formula="Total value of invoices issued"
          description="Sales on credit terms. This typically makes up around 95% of total revenue. Customers receive goods now and pay later according to agreed terms."
          color="#3B82F6"
        />

        <MetricCard
          name="Cash Sales"
          formula="Total cash and POS transactions"
          description="Immediate payment at the point of sale. Usually around 6% of revenue. This is the safest type of sale — zero risk of non-payment."
          color="#22C55E"
        />

        <MetricCard
          name="Credit Notes"
          formula="Total returns and adjustments"
          description="Shown in red because it reduces your revenue. A small, steady amount is normal for perishable goods (damaged items, short deliveries, expired stock). Watch for sudden spikes."
          color="#EF4444"
        />
      </MetricGrid>

      <Callout type="insight">
        Net Sales is the number reported to management. If it is shrinking month over month, that is
        a serious conversation.
      </Callout>
    </div>
  );
}
