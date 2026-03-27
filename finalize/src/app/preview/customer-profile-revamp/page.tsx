'use client';

import { useState } from 'react';
import { CustomerProfileRevamp } from '@/components/profiles/CustomerProfileRevampPreview';

export default function Page() {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex items-center justify-center min-h-screen">
      {!open && (
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => setOpen(true)}
        >
          Open Customer Profile
        </button>
      )}
      <CustomerProfileRevamp
        open={open}
        onClose={() => setOpen(false)}
        debtorCode="300-L006"
        companyName="LUEN SENG FRUITS STALL"
      />
    </div>
  );
}
