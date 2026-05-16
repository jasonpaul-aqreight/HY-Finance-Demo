'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { COMPONENT_INFO, type ComponentInfo } from '@/lib/ai-insight/component-info';
import { MarkdownRenderer } from './MarkdownRenderer';
import { BookOpen, BrainCircuit, Loader2 } from 'lucide-react';
import type { SectionKey } from '@/lib/ai-insight/types';

interface ComponentInsightDialogProps {
  open: boolean;
  onClose: () => void;
  sectionKey: SectionKey;
  componentKey: string;
}

interface ComponentData {
  exists?: boolean;
  analysis_md?: string;
  generated_by?: string;
  generated_at?: string;
  date_range_start?: string;
  date_range_end?: string;
  componentInfo?: ComponentInfo | null;
  requestKey: string;
}

export function ComponentInsightDialog({
  open,
  onClose,
  sectionKey,
  componentKey,
}: ComponentInsightDialogProps) {
  const [componentData, setComponentData] = useState<ComponentData | null>(null);
  const requestKey = `${sectionKey}/${componentKey}`;
  const loading = open && componentData?.requestKey !== requestKey;

  const info = (!loading ? componentData?.componentInfo : null) ?? COMPONENT_INFO[componentKey];

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    fetch(`/api/ai-insight/component/${sectionKey}/${componentKey}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setComponentData({ ...(data ?? { exists: false }), requestKey });
      })
      .catch(() => {
        if (cancelled) return;
        setComponentData({ exists: false, requestKey });
      });

    return () => {
      cancelled = true;
    };
  }, [open, sectionKey, componentKey, requestKey]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[60vw] max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header — sticky branded blue bar */}
        <DialogHeader className="bg-[#1F4E79] px-6 py-4 rounded-t-xl shrink-0">
          <DialogTitle className="text-white text-base font-semibold">
            {info?.name || componentKey}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 space-y-5">
          {/* About section — card with icon */}
          {info?.about && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-[#1F4E79]" />
                <p className="text-sm font-semibold text-[#1F4E79]">About</p>
              </div>
              <div className="text-sm text-foreground leading-[1.5] space-y-0">
                {info.about.split('\n\n').map((block, i) => (
                  <p key={i} className="whitespace-pre-line my-0 first:mt-0 [&:not(:first-child)]:mt-3">
                    {block}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* AI analysis section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BrainCircuit className="h-4 w-4 text-[#1F4E79]" />
              <p className="text-sm font-semibold text-[#1F4E79]">AI Analysis</p>
            </div>
            {loading && (
              <div className="flex items-center gap-2 py-4 text-foreground/60">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading analysis...</span>
              </div>
            )}
            {!loading && componentData?.exists !== false && componentData?.analysis_md && (
              <MarkdownRenderer content={componentData.analysis_md} />
            )}
            {!loading && (!componentData || componentData.exists === false || !componentData.analysis_md) && (
              <p className="text-sm text-foreground/60 py-2">
                No analysis available. Run &quot;Analyze&quot; from the section panel.
              </p>
            )}
          </div>
        </div>

        {/* Footer metadata — sticky at bottom */}
        {componentData && (
          <div className="border-t bg-background px-6 py-3 flex gap-4 text-xs text-foreground/50 shrink-0">
            {componentData.generated_at && (
              <span>Last Updated: {new Date(componentData.generated_at).toLocaleString()}</span>
            )}
            {componentData.generated_by && (
              <span>By: {componentData.generated_by}</span>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
