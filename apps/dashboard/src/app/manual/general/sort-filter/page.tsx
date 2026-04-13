import { Callout } from '@/components/manual/Callout';
import { Screenshot } from '@/components/manual/Screenshot';

export default function SortFilterPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#1F4E79' }}>
        How to Sort and Filter Tables
      </h1>

      <p className="text-base text-foreground">
        Click any <strong>column header</strong> to sort by that column. Click again to reverse the
        order.
      </p>

      <p className="text-base text-foreground">
        Use the <strong>search box</strong> above the table to find specific rows. Some views also
        have dropdown filters (e.g., customer category).
      </p>

      <Screenshot
        src="/manual/sales/table.png"
        alt="Data table with search and sort"
        caption="The data table with search, sort, checkboxes, and Export Excel."
      />

      <Callout type="tip">
        Click <strong>&quot;Clear&quot;</strong> to reset all filters and return to the default view.
      </Callout>
    </div>
  );
}
