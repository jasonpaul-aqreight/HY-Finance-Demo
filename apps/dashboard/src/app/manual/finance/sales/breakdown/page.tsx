import { Callout } from '@/components/manual/Callout';
import { Screenshot } from '@/components/manual/Screenshot';

export default function SalesBreakdownPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#1F4E79' }}>
        Sales Breakdown (Group By)
      </h1>

      <p className="text-base text-foreground">
        The bottom section of the Sales page lets you slice your sales data by different dimensions.
        Use the <strong>&ldquo;Group by&rdquo;</strong> dropdown to switch between:
      </p>

      <ul className="list-disc list-inside space-y-2 text-base text-foreground">
        <li><strong>Customer</strong> &mdash; Which customers are buying the most?</li>
        <li><strong>Product</strong> &mdash; Which products are driving revenue?</li>
        <li><strong>Sales Agent</strong> &mdash; Which agents are performing best?</li>
        <li><strong>Outlet</strong> &mdash; Which locations are selling the most?</li>
      </ul>

      <Screenshot
        src="/manual/sales/breakdown.png"
        alt="Sales Breakdown section"
        caption="Sales Breakdown showing the horizontal bar chart grouped by Customer."
      />

      <h2 className="text-xl font-semibold text-foreground">Horizontal Bar Chart</h2>

      <p className="text-base text-foreground">
        The chart shows the <strong>top 10</strong> entries by default as horizontal bars. This gives
        you a quick visual comparison of your biggest customers, products, agents, or outlets.
      </p>

      <h2 className="text-xl font-semibold text-foreground">Data Table</h2>

      <p className="text-base text-foreground">
        Below the chart is a detailed data table. Each &ldquo;Group by&rdquo; view has its own set
        of columns and filters. The table includes these features:
      </p>

      <ul className="list-disc list-inside space-y-2 text-base text-foreground">
        <li><strong>Search</strong> &mdash; Type to filter the table instantly.</li>
        <li><strong>Sort by column</strong> &mdash; Click any column header to sort.</li>
        <li>
          <strong>Checkboxes</strong> &mdash; Tick rows to highlight them on the chart (maximum 10
          at a time).
        </li>
        <li><strong>Top 10 button</strong> &mdash; Quickly select the top 10 entries.</li>
        <li><strong>Untick All</strong> &mdash; Clear all checkbox selections at once.</li>
        <li><strong>Export Excel</strong> &mdash; Download the current view as an Excel file.</li>
        <li>
          <strong>Pagination</strong> &mdash; Choose to show 25, 50, or 100 rows per page.
        </li>
      </ul>

      <Screenshot
        src="/manual/sales/table.png"
        alt="Sales data table"
        caption="The data table with search, sort, checkboxes, and Export Excel."
      />

      <Callout type="tip">
        Use the checkboxes to compare specific entries on the chart. For example, tick your top 5
        customers and one that you suspect is declining to see the difference visually.
      </Callout>
    </div>
  );
}
