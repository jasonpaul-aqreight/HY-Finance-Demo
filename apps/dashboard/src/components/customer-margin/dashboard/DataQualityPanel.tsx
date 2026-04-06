'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDataQuality } from '@/hooks/customer-margin/useMarginData';
import type { MarginDashboardFilters } from '@/hooks/customer-margin/useDashboardFilters';
import { formatRM, formatCount } from '@/lib/customer-margin/format';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  filters: MarginDashboardFilters;
}

export function DataQualityPanel({ filters }: Props) {
  const [open, setOpen] = useState(false);
  const { data } = useDataQuality(filters);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer flex-row items-center gap-2"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <AlertTriangle className="size-4 text-amber-500" />
        <CardTitle className="text-sm">
          Data Quality
          {data && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {data.anomalous_lines} cost anomalies detected
            </span>
          )}
        </CardTitle>
      </CardHeader>
      {open && data && (
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Cost Anomalies (cost &gt; 5x revenue)</div>
              <div className="text-lg font-bold text-amber-600">{formatCount(data.anomalous_lines)} lines</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Excess Cost Capped</div>
              <div className="text-lg font-bold">{formatRM(data.anomalous_cost_total)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Missing ItemGroup</div>
              <div className="text-lg font-bold">{data.missing_item_group_pct}% of lines</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Missing ItemCode (text lines)</div>
              <div className="text-lg font-bold">{formatCount(data.missing_item_code_lines)} lines</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Invoices Without Agent</div>
              <div className="text-lg font-bold">{formatCount(data.invoices_no_agent)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Date Coverage</div>
              <div className="text-lg font-bold">{data.date_range.first} to {data.date_range.last}</div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
