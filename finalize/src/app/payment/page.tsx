import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { PaymentVersionRouter } from '@/components/payment/PaymentVersionRouter';
import { RoleDropdown } from '@/components/payment/RoleDropdown';

export default function PaymentPage() {
  return (
    <>
      <PageBanner
        title="Payment Collection"
        description="Tracks customer payment health, including payment aging, outstanding amounts, and credit scoring to assess risk and improve cash flow management."
        actions={<RoleDropdown />}
      />
      <Suspense fallback={<div className="p-8 text-muted-foreground">Loading dashboard...</div>}>
        <PaymentVersionRouter />
      </Suspense>
    </>
  );
}
