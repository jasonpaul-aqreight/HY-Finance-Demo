'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MarkdownRenderer } from './MarkdownRenderer';

interface InsightDetailDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  detail: string;
  sentiment: 'good' | 'bad';
}

export function InsightDetailDialog({
  open,
  onClose,
  title,
  detail,
  sentiment,
}: InsightDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[60vw] max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header — sticky colored banner */}
        <DialogHeader
          className={`px-6 py-4 rounded-t-xl shrink-0 ${
            sentiment === 'good'
              ? 'bg-green-600'
              : 'bg-red-600'
          }`}
        >
          <DialogTitle className="text-white text-base font-semibold">
            {sentiment === 'good' ? '👍 ' : '👎 '}
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5">
          <MarkdownRenderer content={detail} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
