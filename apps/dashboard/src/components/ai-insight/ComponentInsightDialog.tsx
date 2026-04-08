'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { COMPONENT_INFO } from '@/lib/ai-insight/component-info';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Loader2 } from 'lucide-react';
import type { SectionKey } from '@/lib/ai-insight/types';

interface ComponentInsightDialogProps {
  open: boolean;
  onClose: () => void;
  sectionKey: SectionKey;
  componentKey: string;
}

interface ComponentData {
  analysis_md: string;
  generated_by: string;
  generated_at?: string;
  date_range_start?: string;
  date_range_end?: string;
}

export function ComponentInsightDialog({
  open,
  onClose,
  sectionKey,
  componentKey,
}: ComponentInsightDialogProps) {
  const [loading, setLoading] = useState(false);
  const [componentData, setComponentData] = useState<ComponentData | null>(null);

  const info = COMPONENT_INFO[componentKey];

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/ai-insight/component/${sectionKey}/${componentKey}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setComponentData(data);
        setLoading(false);
      })
      .catch(() => {
        setComponentData(null);
        setLoading(false);
      });
  }, [open, sectionKey, componentKey]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[90vw] h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>About: {info?.name || componentKey}</DialogTitle>
        </DialogHeader>

        {/* Static info section */}
        {info && (
          <div className="space-y-3 text-sm text-foreground">
            <div>
              <p className="font-semibold mb-1">What it measures:</p>
              <p>{info.whatItMeasures}</p>
            </div>
            {info.formula && (
              <div>
                <p className="font-semibold mb-1">Formula:</p>
                <p>{info.formula}</p>
              </div>
            )}
            {info.indicator && (
              <div>
                <p className="font-semibold mb-1">Indicator:</p>
                <p className="whitespace-pre-line">{info.indicator}</p>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <hr className="border-foreground/10" />

        {/* AI analysis section */}
        <div>
          <p className="font-semibold text-sm mb-2 text-foreground">Analysis:</p>
          {loading && (
            <div className="flex items-center gap-2 py-4 text-foreground/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading analysis...</span>
            </div>
          )}
          {!loading && componentData?.analysis_md && (
            <MarkdownRenderer content={componentData.analysis_md} />
          )}
          {!loading && !componentData && (
            <p className="text-sm text-foreground/60 py-2">
              No analysis available. Run &quot;Analyze&quot; from the section panel.
            </p>
          )}
        </div>

        {/* Footer metadata */}
        {componentData && (
          <DialogFooter>
            <div className="flex gap-4 text-xs text-foreground/50 w-full">
              {componentData.generated_at && (
                <span>Last Updated: {new Date(componentData.generated_at).toLocaleString()}</span>
              )}
              {componentData.generated_by && (
                <span>By: {componentData.generated_by}</span>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
