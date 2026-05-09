'use client';

// Per-prompt two-step history viewer + revert.
// Lists Current / Previous / Previous-2; clicking a non-current entry opens a
// wide preview modal (current vs target) with a Revert button. Disabled when
// the corresponding snapshot is NULL.
//
// Per Phase-2 lessons-learned: reuses the same wide modal pattern
// (sm:max-w-5xl + h-[60vh]) and the same set-based diff helpers as DiffModal.
// Triggers a SWR revalidate of /api/admin/ai-insight-prompts on revert so the
// editor and tree pick up the rotated state.

import { useMemo, useState } from 'react';
import { mutate } from 'swr';
import { History, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { diffLines, DiffPane } from './prompt-diff';

const PROMPTS_URL = '/api/admin/ai-insight-prompts';

type Slot = 'previous' | 'previous_2';

interface Props {
  promptKey: string;
  promptDisplayName: string;
  currentText: string;
  previousText: string | null;
  previousText2: string | null;
}

function snippet(text: string | null): string {
  if (!text) return '—';
  const firstLine = text.split('\n').find((l) => l.trim().length > 0) ?? '';
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
}

export function HistoryDropdown({
  promptKey,
  promptDisplayName,
  currentText,
  previousText,
  previousText2,
}: Props) {
  const [previewSlot, setPreviewSlot] = useState<Slot | null>(null);
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  const targetText = previewSlot === 'previous'
    ? previousText
    : previewSlot === 'previous_2'
      ? previousText2
      : null;

  const diff = useMemo(() => {
    if (!targetText) return null;
    return diffLines(currentText, targetText);
  }, [currentText, targetText]);

  function openPreview(slot: Slot) {
    setRevertError(null);
    setPreviewSlot(slot);
  }

  function closePreview(open: boolean) {
    if (reverting) return;
    if (!open) {
      setPreviewSlot(null);
      setRevertError(null);
    }
  }

  async function handleRevert() {
    if (!previewSlot) return;
    setReverting(true);
    setRevertError(null);
    try {
      const res = await fetch(
        `${PROMPTS_URL}/${encodeURIComponent(promptKey)}/revert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: previewSlot }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        setRevertError(body.error ?? 'Revert failed');
        return;
      }
      setPreviewSlot(null);
      await mutate(PROMPTS_URL);
    } catch (err) {
      setRevertError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setReverting(false);
    }
  }

  const slotLabel = previewSlot === 'previous' ? 'Previous' : 'Previous-2';

  return (
    <>
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" type="button">
              <History className="size-4" />
              History
            </Button>
          }
        />
        <PopoverContent align="end" className="w-80">
          <div className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Prompt history
          </div>

          <ul className="space-y-1.5">
            <li className="rounded-md border border-blue-200 bg-blue-50 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-blue-900">Current</span>
                <span className="text-[10px] uppercase tracking-wider text-blue-800">
                  Active
                </span>
              </div>
              <div className="mt-1 truncate font-mono text-xs text-foreground">
                {snippet(currentText)}
              </div>
            </li>

            <li className="rounded-md border border-border bg-background p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">Previous</span>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={previousText == null}
                  onClick={() => openPreview('previous')}
                  className="h-6 px-2 text-xs"
                >
                  <RotateCcw className="size-3" />
                  Revert
                </Button>
              </div>
              <div className="mt-1 truncate font-mono text-xs text-foreground">
                {snippet(previousText)}
              </div>
            </li>

            <li className="rounded-md border border-border bg-background p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">Previous-2</span>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={previousText2 == null}
                  onClick={() => openPreview('previous_2')}
                  className="h-6 px-2 text-xs"
                >
                  <RotateCcw className="size-3" />
                  Revert
                </Button>
              </div>
              <div className="mt-1 truncate font-mono text-xs text-foreground">
                {snippet(previousText2)}
              </div>
            </li>
          </ul>

          <div className="text-xs text-foreground/80">
            Reverting moves the current prompt into Previous and brings the chosen
            snapshot back. The action is itself reversible.
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={previewSlot != null} onOpenChange={closePreview}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              Revert to {slotLabel} — {promptDisplayName}
            </DialogTitle>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              The current prompt will move into Previous. The {slotLabel} snapshot
              shown on the right will become the new active prompt.
            </div>
          </DialogHeader>

          {revertError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {revertError}
            </div>
          )}

          {diff && (
            <div className="grid h-[60vh] gap-3 sm:grid-cols-2 min-h-0">
              <DiffPane title="Current" lines={diff.left} changeColor="red" />
              <DiffPane title={slotLabel} lines={diff.right} changeColor="green" />
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" disabled={reverting} />}>
              Cancel
            </DialogClose>
            <Button size="sm" onClick={handleRevert} disabled={reverting}>
              {reverting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {reverting ? 'Reverting…' : `Confirm revert to ${slotLabel}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
