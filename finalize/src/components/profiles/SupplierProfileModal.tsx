'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { PurchaseItemsTab } from './PurchaseItemsTab';
import { useSupplierProfileSummary } from '@/hooks/supplier-margin/useMarginData';

interface SupplierProfileModalProps {
  open: boolean;
  onClose: () => void;
  creditorCode: string;
  companyName: string;
  initialStartDate?: string;
  initialEndDate?: string;
  supplierMetrics?: {
    attributed_revenue: number;
    attributed_cogs: number;
    attributed_profit: number;
    margin_pct: number | null;
    items_supplied: number;
  };
}

export function SupplierProfileModal({
  open, onClose, creditorCode, companyName,
  initialStartDate, initialEndDate, supplierMetrics,
}: SupplierProfileModalProps) {
  const sm = supplierMetrics;

  const { data: profileSummary } = useSupplierProfileSummary(
    open ? creditorCode : null,
    initialStartDate ?? '2025-01-01',
    initialEndDate ?? '2025-12-31',
  );

  const isActive = profileSummary?.is_active ?? true;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] flex flex-col gap-0 p-0" showCloseButton>

        {/* ── Profile Header ──────────────────────────────────── */}
        <div className="px-8 pt-6 pb-5 border-b bg-muted/30">
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-2xl font-bold tracking-tight">{companyName}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
            <span className="font-medium text-foreground/70">Supplier</span>
            <span className="text-muted-foreground/30">|</span>
            <span className="font-mono">{creditorCode}</span>
          </div>

          {/* Period-independent KPI cards */}
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Items Supplied</p>
                <p className="text-2xl font-semibold mt-1">{profileSummary ? String(profileSummary.items_supplied_count) : '—'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  Single Supplier Items
                </p>
                <p className="text-2xl font-semibold text-amber-600 mt-1">
                  {profileSummary ? String(profileSummary.single_supplier_count) : '—'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <PurchaseItemsTab
            creditorCode={creditorCode}
            initialStartDate={initialStartDate}
            initialEndDate={initialEndDate}
            supplierMetrics={sm}
            singleSupplierItems={profileSummary?.single_supplier_items}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
