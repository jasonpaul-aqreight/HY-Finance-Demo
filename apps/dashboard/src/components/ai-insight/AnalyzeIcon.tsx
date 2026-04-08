'use client';

import { useState } from 'react';
import { SearchCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComponentInsightDialog } from './ComponentInsightDialog';
import type { SectionKey } from '@/lib/ai-insight/types';

interface AnalyzeIconProps {
  sectionKey: SectionKey;
  componentKey: string;
}

export function AnalyzeIcon({ sectionKey, componentKey }: AnalyzeIconProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => setOpen(true)}
        title="View AI insight"
        className="text-foreground/40 hover:text-primary"
      >
        <SearchCheck className="h-3.5 w-3.5" />
      </Button>
      <ComponentInsightDialog
        open={open}
        onClose={() => setOpen(false)}
        sectionKey={sectionKey}
        componentKey={componentKey}
      />
    </>
  );
}
