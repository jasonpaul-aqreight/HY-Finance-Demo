'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Ban } from 'lucide-react';
import type { InsightStatus, ProgressLine, SectionInsightData } from '@/hooks/ai-insight/useInsightAnalysis';
import type { SummaryInsight } from '@/lib/ai-insight/types';
import { InsightDetailDialog } from './InsightDetailDialog';

interface AiInsightPanelProps {
  status: InsightStatus;
  data: SectionInsightData | null;
  progress: ProgressLine[];
  error: string | null;
  lockedBy?: string | null;
  onAnalyze: () => void;
  onCancel: () => void;
}

export function AiInsightPanel({
  status,
  data,
  progress,
  error,
  lockedBy,
  onAnalyze,
  onCancel,
}: AiInsightPanelProps) {
  const [selectedInsight, setSelectedInsight] = useState<{ insight: SummaryInsight; sentiment: 'good' | 'bad' } | null>(null);

  const isAnalyzing = status === 'analyzing';
  const isBlocked = status === 'blocked';
  const hasResults = status === 'complete' && data;

  return (
    <div className="rounded-b-md border border-t-0 border-primary/10 bg-background">
      {/* Main content area */}
      <div className="px-4 py-3 min-h-[80px]">
        {/* State 1: Never generated */}
        {status === 'idle' && !data && (
          <div className="flex flex-col items-center justify-center py-4 text-foreground/70">
            <p className="text-sm font-medium">No insights generated yet.</p>
            <p className="text-sm">Click &quot;Analyze&quot; to generate AI insights.</p>
          </div>
        )}

        {/* Loading stored data */}
        {status === 'loading' && (
          <div className="flex items-center justify-center py-4 text-foreground/70">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        )}

        {/* State 2: Analyzing */}
        {isAnalyzing && (
          <div className="space-y-1.5 py-1">
            {progress.map((line) => (
              <div key={line.component} className="flex items-center gap-2 text-sm">
                {line.status === 'analyzing' && (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                    <span className="text-foreground">Analyzing {line.component}...</span>
                  </>
                )}
                {line.status === 'complete' && (
                  <>
                    <span className="text-green-600 text-xs font-bold">✓</span>
                    <span className="text-foreground">{line.component} — done</span>
                  </>
                )}
                {line.status === 'error' && (
                  <>
                    <span className="text-red-600 text-xs font-bold">✗</span>
                    <span className="text-red-700">{line.component} — {line.message || 'error'}</span>
                  </>
                )}
              </div>
            ))}
            {progress.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-foreground/70">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Starting analysis...</span>
              </div>
            )}
          </div>
        )}

        {/* State 3: Results */}
        {hasResults && data.summary_json && (
          <div className="space-y-1 py-1">
            <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase mb-2">High-Level Summary</p>
            {data.summary_json.good.slice(0, 3).map((item, i) => (
              <button
                key={`good-${i}`}
                onClick={() => setSelectedInsight({ insight: item, sentiment: 'good' })}
                className="flex items-start gap-2 text-sm text-left w-full hover:bg-green-50 rounded px-1 py-0.5 transition-colors cursor-pointer"
              >
                <span className="shrink-0">👍</span>
                <span className="text-green-700 font-medium">{item.title}</span>
              </button>
            ))}
            {data.summary_json.bad.slice(0, 3).map((item, i) => (
              <button
                key={`bad-${i}`}
                onClick={() => setSelectedInsight({ insight: item, sentiment: 'bad' })}
                className="flex items-start gap-2 text-sm text-left w-full hover:bg-red-50 rounded px-1 py-0.5 transition-colors cursor-pointer"
              >
                <span className="shrink-0">👎</span>
                <span className="text-red-700 font-medium">{item.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* State 4: Blocked */}
        {isBlocked && (
          <div className="flex items-center gap-2 py-4 text-foreground/70">
            <Ban className="h-4 w-4 text-orange-500" />
            <span className="text-sm">
              Analysis is currently running by <strong>{lockedBy || 'another user'}</strong>. Please wait for it to complete.
            </span>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center py-4">
            <p className="text-sm text-red-700 font-medium">{error || 'Analysis failed'}</p>
          </div>
        )}
      </div>

      {/* Footer — metadata + action button */}
      <div className="border-t border-primary/10 px-4 py-2.5 flex items-center justify-between text-xs text-foreground/60">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {hasResults ? (
            <>
              <span>
                {data.date_range_start && data.date_range_end
                  ? `Analyzed: ${new Date(data.date_range_start).toLocaleDateString()} – ${new Date(data.date_range_end).toLocaleDateString()}`
                  : 'Snapshot — current state'}
              </span>
              <span>Analysis Time: {Number(data.analysis_time_s)}s</span>
              <span>Tokens: {Number(data.token_count).toLocaleString()}</span>
              <span>Cost: ${Number(data.cost_usd).toFixed(2)}</span>
              <span>Last Updated: {new Date(data.generated_at).toLocaleString()}</span>
              <span>By: {data.generated_by}</span>
            </>
          ) : (
            <>
              <span>Analysis Time: -</span>
              <span>Tokens: -</span>
              <span>Cost: -</span>
              <span>Last Updated: -</span>
              <span>By: -</span>
            </>
          )}
        </div>
        <div>
          {isAnalyzing ? (
            <Button variant="destructive" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onAnalyze}
              disabled={isBlocked || status === 'loading'}
            >
              Analyze
            </Button>
          )}
        </div>
      </div>

      {/* Insight Detail Dialog */}
      {selectedInsight && (
        <InsightDetailDialog
          open={!!selectedInsight}
          onClose={() => setSelectedInsight(null)}
          title={selectedInsight.insight.title}
          detail={selectedInsight.insight.detail}
          sentiment={selectedInsight.sentiment}
        />
      )}
    </div>
  );
}
