'use client';

// Side-by-side current vs. proposed prompt with a one-line change summary.
// Used by FeedbackList's Apply flow: it passes the LLM's preview payload here,
// admin confirms or cancels.

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { diffLines, DiffPane } from './prompt-diff';

interface DiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** May be null while preview is loading. */
  data: {
    promptDisplayName: string;
    currentText: string;
    proposedText: string;
    changeSummary: string;
  } | null;
  loading: boolean;
  applying: boolean;
  error: string | null;
  onConfirm: () => void;
}


export function DiffModal({
  open,
  onOpenChange,
  data,
  loading,
  applying,
  error,
  onConfirm,
}: DiffModalProps) {
  const diff = useMemo(() => {
    if (!data) return null;
    return diffLines(data.currentText, data.proposedText);
  }, [data]);

  const canConfirm = !!data && !loading && !applying;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-5xl"
        // Allow the dialog to stretch wider than the default sm:max-w-sm and
        // keep the inner panes scrollable. The Popup default centers and
        // crops; we want a roomy, fixed-height review surface.
      >
        <DialogHeader>
          <DialogTitle>
            {data ? `Review surgical edit — ${data.promptDisplayName}` : 'Loading edit preview…'}
          </DialogTitle>
          {data && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <span className="font-semibold">Change summary:</span> {data.changeSummary}
            </div>
          )}
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-background p-4 text-sm text-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating proposed edit…
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {data && diff && (
          <div className="grid h-[60vh] gap-3 sm:grid-cols-2 min-h-0">
            <DiffPane title="Current" lines={diff.left} changeColor="red" />
            <DiffPane title="Proposed" lines={diff.right} changeColor="green" />
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" disabled={applying} />}>
            Cancel
          </DialogClose>
          <Button size="sm" onClick={onConfirm} disabled={!canConfirm}>
            {applying && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {applying ? 'Applying…' : 'Confirm & apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
