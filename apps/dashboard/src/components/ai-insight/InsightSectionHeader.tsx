'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiInsightPanel } from './AiInsightPanel';
import { useInsightAnalysis } from '@/hooks/ai-insight/useInsightAnalysis';
import type { SectionKey, PageKey, DateRange, FiscalPeriod } from '@/lib/ai-insight/types';

interface InsightSectionHeaderProps {
  title: string;
  subtitle?: string;
  page: PageKey;
  sectionKey: SectionKey;
  // Deprecated Phase 4 compatibility props. Keep the shell call sites stable for now.
  dateRange: DateRange | null;
  fiscalPeriod?: FiscalPeriod | null;
  userName?: string;
}

export function InsightSectionHeader({
  title,
  subtitle,
  page,
  sectionKey,
}: InsightSectionHeaderProps) {
  const [expanded, setExpanded] = useState(true);
  const insight = useInsightAnalysis(page, sectionKey);

  return (
    <div>
      {/* Header bar */}
      <div className="rounded-md bg-primary/5 border border-primary/10 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {subtitle && <span className="text-xs font-medium text-foreground">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary"
          >
            Get Insight
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Collapsible AI Panel */}
      {expanded && (
        <AiInsightPanel
          status={insight.status}
          data={insight.data}
          error={insight.error}
        />
      )}
    </div>
  );
}
