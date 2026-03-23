import { Suspense } from 'react';
import SettingsForm from '@/components/payment/settings/SettingsForm';

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    }>
      <SettingsForm />
    </Suspense>
  );
}
