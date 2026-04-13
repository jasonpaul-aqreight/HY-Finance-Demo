import { Screenshot } from '@/components/manual/Screenshot';
import Link from 'next/link';

export default function SalesOverviewPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#1F4E79' }}>
        Sales Report &mdash; Overview
      </h1>

      <p className="text-base text-foreground">
        The Sales Report answers one question: <strong>&ldquo;How much money is coming in?&rdquo;</strong>{' '}
        It is the most important page on the dashboard. Everything else &mdash; margins, payments,
        returns &mdash; flows from what you see here.
      </p>

      <p className="text-base text-foreground">
        The page shows revenue tracking across <strong>daily</strong>, <strong>weekly</strong>, and{' '}
        <strong>monthly</strong> periods. You can adjust the date range at the top to focus on any
        time window you need.
      </p>

      <Screenshot
        src="/manual/sales/overview.png"
        alt="Sales Report page overview"
        caption="The Sales Report page showing KPI cards, trend chart, and breakdown."
      />

      <h2 className="text-xl font-semibold text-foreground">Three Sections</h2>

      <p className="text-base text-foreground">
        The Sales Report is divided into three sections, top to bottom:
      </p>

      <ol className="list-decimal list-inside space-y-3 text-base text-foreground">
        <li>
          <Link
            href="/manual/finance/sales/metrics"
            className="font-semibold underline"
            style={{ color: '#1F4E79' }}
          >
            KPI Cards
          </Link>{' '}
          &mdash; Four summary numbers at the top: Net Sales, Invoice Sales, Cash Sales, and Credit
          Notes. These give you the headline figures at a glance.
        </li>
        <li>
          <Link
            href="/manual/finance/sales/trend-chart"
            className="font-semibold underline"
            style={{ color: '#1F4E79' }}
          >
            Trend Chart
          </Link>{' '}
          &mdash; A stacked bar chart showing sales over time. Lets you spot growth, decline, and
          seasonal patterns visually.
        </li>
        <li>
          <Link
            href="/manual/finance/sales/breakdown"
            className="font-semibold underline"
            style={{ color: '#1F4E79' }}
          >
            Sales Breakdown
          </Link>{' '}
          &mdash; Slice your sales by Customer, Product, Sales Agent, or Outlet. Includes a chart
          and a detailed data table.
        </li>
      </ol>

      <p className="text-base text-foreground">
        Read each sub-article for a detailed walkthrough of that section.
      </p>
    </div>
  );
}
