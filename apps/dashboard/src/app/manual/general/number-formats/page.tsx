import { Callout } from '@/components/manual/Callout';

export default function NumberFormatsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#1F4E79' }}>
        Understanding Number Formats
      </h1>

      <p className="text-base text-foreground">
        All currency values are in <strong>Malaysian Ringgit (RM)</strong> with no decimal places.
      </p>

      <ul className="list-disc pl-6 space-y-2 text-base text-foreground">
        <li>
          <strong>K</strong> = thousands &mdash; 500K means RM 500,000
        </li>
        <li>
          <strong>M</strong> = millions &mdash; 1.2M means RM 1,200,000
        </li>
      </ul>

      <Callout type="info">
        Negative values (e.g., Credit Notes) are shown in <strong style={{ color: '#DC2626' }}>red</strong>.
        This makes it easy to spot deductions at a glance.
      </Callout>
    </div>
  );
}
