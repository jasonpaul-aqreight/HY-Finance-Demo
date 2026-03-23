import Link from 'next/link';
import { SettingsIcon } from 'lucide-react';
import { DashboardShellV2 } from '@/components/payment/dashboard-v2/DashboardShellV2';

export function PaymentVersionRouter() {
  return (
    <div className="relative">
      <div className="absolute top-4 right-6 z-50 flex items-center gap-2">
        <Link
          href="/payment/settings"
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <SettingsIcon className="size-4" />
          Settings
        </Link>
      </div>
      <DashboardShellV2 />
    </div>
  );
}
