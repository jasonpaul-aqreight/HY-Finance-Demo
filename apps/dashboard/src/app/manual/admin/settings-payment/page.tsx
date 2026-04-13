import { Callout } from '@/components/manual/Callout';

export default function SettingsPaymentPage() {
  return (
    <div>
      <h1
        className="text-3xl font-bold tracking-tight mb-2"
        style={{ color: '#1F4E79' }}
      >
        Payment Settings
      </h1>

      <p className="text-base leading-relaxed text-foreground mb-4">
        Payment settings control how credit terms and payment scoring work.
      </p>

      <p className="text-base leading-relaxed text-foreground mb-4">
        Navigate to the <strong>Settings</strong> page to configure payment
        thresholds and credit terms for customer scoring.
      </p>

      <Callout type="warning">
        Changes to payment settings affect how customer credit scores are
        calculated across the entire dashboard.
      </Callout>
    </div>
  );
}
