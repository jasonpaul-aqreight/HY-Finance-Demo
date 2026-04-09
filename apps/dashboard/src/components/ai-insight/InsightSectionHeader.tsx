'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiInsightPanel } from './AiInsightPanel';
import { useInsightAnalysis } from '@/hooks/ai-insight/useInsightAnalysis';
import { useRole } from '@/components/layout/RoleProvider';
import type { SectionKey, PageKey, DateRange } from '@/lib/ai-insight/types';

interface InsightSectionHeaderProps {
  title: string;
  subtitle?: string;
  page: PageKey;
  sectionKey: SectionKey;
  dateRange: DateRange | null;
  userName?: string;
}

export function InsightSectionHeader({
  title,
  subtitle,
  page,
  sectionKey,
  dateRange,
  userName = 'User',
}: InsightSectionHeaderProps) {
  const [expanded, setExpanded] = useState(false);
  const { isAdmin } = useRole();
  const insight = useInsightAnalysis(page, sectionKey);

  const handleAnalyze = () => {
    insight.analyze(dateRange, userName);
  };

  return (
    <div>
      {/* Header bar */}
      <div className="rounded-md bg-primary/5 border border-primary/10 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {subtitle && <span className="text-xs font-medium text-foreground/50">{subtitle}</span>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground"
        >
          Get Insight
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Collapsible AI Panel */}
      {expanded && (
        <AiInsightPanel
          status={insight.status}
          data={insight.data}
          progress={insight.progress}
          error={insight.error}
          lockedBy={insight.lockStatus?.locked_by}
          onAnalyze={handleAnalyze}
          onCancel={insight.cancel}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
