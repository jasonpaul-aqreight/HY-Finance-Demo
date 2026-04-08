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
      <DialogContent className="sm:max-w-[90vw] h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div
            className={`-mx-4 -mt-4 px-4 py-3 rounded-t-xl ${
              sentiment === 'good'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            <DialogTitle className="text-white text-base font-semibold">
              {sentiment === 'good' ? '👍 ' : '👎 '}
              {title}
            </DialogTitle>
          </div>
        </DialogHeader>
        <div className="mt-2">
          <MarkdownRenderer content={detail} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
