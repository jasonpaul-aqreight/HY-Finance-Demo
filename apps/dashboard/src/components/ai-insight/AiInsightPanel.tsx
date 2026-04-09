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

function InsightCard({
  insight,
  sentiment,
  onClick,
}: {
  insight: SummaryInsight;
  sentiment: 'good' | 'bad';
  onClick: () => void;
}) {
  const isGood = sentiment === 'good';
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 text-left w-full rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
        isGood
          ? 'border-green-200 hover:bg-green-50'
          : 'border-red-200 hover:bg-red-50'
      }`}
    >
      <span
        className={`mt-1 shrink-0 h-3 w-3 rounded-full ${
          isGood ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-base font-semibold ${isGood ? 'text-green-800' : 'text-red-800'}`}>
            {insight.title}
          </span>
          {insight.metric && (
            <span
              className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${
                isGood
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {insight.metric}
            </span>
          )}
        </div>
        {insight.detail && (
          <p className="text-sm text-foreground mt-1 line-clamp-1">
            {(() => {
              // Strip bold headers like "**Overall Performance:**" and get first content sentence
              const cleaned = insight.detail
                .replace(/\*\*[^*]+:\*\*/g, '')  // remove bold headers
                .replace(/[#|`\n]/g, ' ')         // strip markdown chars
                .replace(/\s+/g, ' ')
                .trim();
              // Split on period followed by space or end — avoids cutting "84.3%"
              const match = cleaned.match(/^(.+?\.\s)/);
              return match ? match[1].trim() : cleaned.slice(0, 120);
            })()}
          </p>
        )}
      </div>
    </button>
  );
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

  const goodInsights = hasResults ? (data.summary_json?.good ?? []).slice(0, 3) : [];
  const badInsights = hasResults ? (data.summary_json?.bad ?? []).slice(0, 3) : [];

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

        {/* State 3: Results — Two-column layout */}
        {hasResults && data.summary_json && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* POSITIVE column */}
              <div>
                <p className="text-xs font-semibold tracking-wide text-green-700 uppercase mb-2">Positive</p>
                {goodInsights.length > 0 ? (
                  <div className="space-y-2">
                    {goodInsights.map((item, i) => (
                      <InsightCard
                        key={`good-${i}`}
                        insight={item}
                        sentiment="good"
                        onClick={() => setSelectedInsight({ insight: item, sentiment: 'good' })}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-foreground/50 py-2">No positive highlights found.</p>
                )}
              </div>

              {/* NEGATIVE column */}
              <div>
                <p className="text-xs font-semibold tracking-wide text-red-700 uppercase mb-2">Negative</p>
                {badInsights.length > 0 ? (
                  <div className="space-y-2">
                    {badInsights.map((item, i) => (
                      <InsightCard
                        key={`bad-${i}`}
                        insight={item}
                        sentiment="bad"
                        onClick={() => setSelectedInsight({ insight: item, sentiment: 'bad' })}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-foreground/50 py-2">No concerns found.</p>
                )}
              </div>
            </div>
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
