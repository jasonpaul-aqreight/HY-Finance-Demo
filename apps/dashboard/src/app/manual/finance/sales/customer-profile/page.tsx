import { Callout } from '@/components/manual/Callout';

export default function CustomerProfilePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#1F4E79' }}>
        Customer Profile Popup
      </h1>

      <p className="text-base text-foreground">
        When viewing the Sales Breakdown by <strong>Customer</strong>, every customer name in the
        table appears as a <strong>blue clickable link</strong>. Click any name to open the
        Customer Profile popup.
      </p>

      <h2 className="text-xl font-semibold text-foreground">What the Popup Shows</h2>

      <p className="text-base text-foreground">
        The profile popup gives you a focused view of a single customer. It includes:
      </p>

      <ul className="list-disc list-inside space-y-2 text-base text-foreground">
        <li>
          <strong>Payment Health</strong> &mdash; How reliably this customer pays. Are they on time,
          late, or consistently overdue?
        </li>
        <li>
          <strong>Return History</strong> &mdash; How many returns this customer has made. A high
          return rate may signal quality issues or ordering mistakes.
        </li>
        <li>
          <strong>Monthly Sales Trend</strong> &mdash; A chart showing this customer&rsquo;s
          purchases over time. Look for upward or downward trends.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-foreground">When to Use It</h2>

      <p className="text-base text-foreground">
        The Customer Profile popup is most useful for deep-diving into individual customer
        performance. Use it when you notice something unusual in the breakdown table &mdash; a big
        customer suddenly dropping in rank, or a customer with unusually high credit notes.
      </p>

      <Callout type="tip">
        Use this to investigate why a customer&rsquo;s purchases are declining or if their returns
        are unusually high.
      </Callout>
    </div>
  );
}
