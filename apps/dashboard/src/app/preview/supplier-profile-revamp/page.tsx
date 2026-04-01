'use client';

import { useState } from 'react';
import { SupplierProfileRevamp } from '@/components/profiles/SupplierProfileRevampPreview';

export default function Page() {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex items-center justify-center min-h-screen">
      {!open && (
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => setOpen(true)}
        >
          Open Supplier Profile
        </button>
      )}
      <SupplierProfileRevamp
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
