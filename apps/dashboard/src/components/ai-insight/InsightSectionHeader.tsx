'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiInsightPanel } from './AiInsightPanel';
import { useInsightAnalysis } from '@/hooks/ai-insight/useInsightAnalysis';
import { useRole } from '@/components/layout/RoleProvider';
import type { SectionKey, PageKey, DateRange, FiscalPeriod } from '@/lib/ai-insight/types';

interface InsightSectionHeaderProps {
  title: string;
  subtitle?: string;
  page: PageKey;
  sectionKey: SectionKey;
  dateRange: DateRange | null;
  fiscalPeriod?: FiscalPeriod | null;
  userName?: string;
}

export function InsightSectionHeader({
  title,
  subtitle,
  page,
  sectionKey,
  dateRange,
  fiscalPeriod = null,
  userName = 'User',
}: InsightSectionHeaderProps) {
  const [expanded, setExpanded] = useState(false);
  const { isAdmin } = useRole();
  const insight = useInsightAnalysis(page, sectionKey);

  // Budget approval state (only used for financial_variance section)
  const [budgetStatus, setBudgetStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleAnalyze = () => {
    insight.analyze(dateRange, userName, fiscalPeriod);
  };

  const handleApproveBudget = async () => {
    if (!fiscalPeriod?.fiscalYear) return;
    setBudgetStatus('saving');
    try {
      const res = await fetch('/api/budget/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscalYear: fiscalPeriod.fiscalYear }),
      });
      if (!res.ok) throw new Error('Failed to save budget');
      setBudgetStatus('saved');
    } catch {
      setBudgetStatus('error');
    }
  };

  const showBudgetButton =
    sectionKey === 'financial_variance' &&
    insight.status === 'complete' &&
    insight.data &&
    expanded;

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

      {/* Budget approval — only for §12 after analysis completes */}
      {showBudgetButton && (
        <div className="rounded-b-md border border-t-0 border-primary/10 bg-blue-50 px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm text-foreground">
            Save the AI-generated budget suggestions as the approved budget for {fiscalPeriod?.fiscalYear}?
          </span>
          <Button
            size="sm"
            onClick={handleApproveBudget}
            disabled={budgetStatus === 'saving' || budgetStatus === 'saved'}
          >
            {budgetStatus === 'saving' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {budgetStatus === 'saved' && <Check className="mr-1.5 h-3.5 w-3.5" />}
            {budgetStatus === 'idle' && 'Approve as Budget'}
            {budgetStatus === 'saving' && 'Saving...'}
            {budgetStatus === 'saved' && 'Budget Saved'}
            {budgetStatus === 'error' && 'Retry'}
          </Button>
        </div>
      )}
    </div>
  );
}
