'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import {
  Check,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DiffModal } from './DiffModal';

interface FeedbackRow {
  id: number;
  sectionKey: string;
  page: string;
  rawFeedback: string;
  compactFeedback: string;
  targetPromptKey: string;
  submittedBy: string | null;
  submittedAt: string;
}

interface DiffPayload {
  feedbackId: number;
  promptDisplayName: string;
  currentText: string;
  proposedText: string;
  changeSummary: string;
}

interface Props {
  promptKey: string;
  promptDisplayName: string;
}

const PROMPTS_URL = '/api/admin/ai-insight-prompts';
const ALL_FEEDBACK_URL = '/api/admin/ai-insight-feedback';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function FeedbackItem({
  row,
  onDiscard,
  onApply,
  discarding,
  previewing,
  busy,
}: {
  row: FeedbackRow;
  onDiscard: (id: number) => void;
  onApply: (id: number) => void;
  discarding: boolean;
  previewing: boolean;
  busy: boolean;
}) {
  return (
    <li
      data-testid="feedback-item"
      data-feedback-id={row.id}
      className="rounded-md border border-blue-200 bg-blue-50/40 p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-xs text-foreground/80">
            From <span className="font-medium">{row.submittedBy || 'anonymous'}</span>
            <> · </>
            <span>{formatTimestamp(row.submittedAt)}</span>
          </div>

          <div
            data-testid="feedback-raw"
            className="whitespace-pre-line text-sm text-foreground"
          >
            {row.rawFeedback}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApply(row.id)}
            disabled={busy}
            title="Review surgical edit"
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
          >
            {previewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Apply
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDiscard(row.id)}
            disabled={busy}
            title="Discard"
            className="border-red-300 text-red-800 hover:bg-red-50"
          >
            {discarding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            Discard
          </Button>
        </div>
      </div>
    </li>
  );
}

export function FeedbackList({ promptKey, promptDisplayName }: Props) {
  const url = `/api/admin/ai-insight-feedback?prompt_key=${encodeURIComponent(promptKey)}`;
  const { data, error, isLoading } = useSWR<{ feedback: FeedbackRow[] }>(url, fetcher, {
    revalidateOnFocus: false,
  });
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pendingPreview, setPendingPreview] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [diffOpen, setDiffOpen] = useState(false);
  const [diffPayload, setDiffPayload] = useState<DiffPayload | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  async function handleDiscard(id: number) {
    setPendingDelete(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/ai-insight-feedback/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error ?? 'Failed to discard feedback');
        return;
      }
      await mutate(url);
      await mutate(PROMPTS_URL);
      await mutate(ALL_FEEDBACK_URL);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setPendingDelete(null);
    }
  }

  async function handleApply(id: number) {
    setPendingPreview(id);
    setErrorMsg(null);
    setDiffError(null);
    setDiffPayload(null);
    setDiffOpen(true);
    try {
      const res = await fetch(`/api/admin/ai-insight-feedback/${id}/preview`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) {
        setDiffError(body.error ?? 'Failed to generate preview');
        return;
      }
      setDiffPayload({
        feedbackId: id,
        promptDisplayName,
        currentText: body.currentText,
        proposedText: body.proposedText,
        changeSummary: body.changeSummary,
      });
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setPendingPreview(null);
    }
  }

  async function handleConfirm() {
    if (!diffPayload) return;
    setApplying(true);
    setDiffError(null);
    try {
      const res = await fetch(
        `/api/admin/ai-insight-feedback/${diffPayload.feedbackId}/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposedText: diffPayload.proposedText }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        // VERSION_CAP_REACHED ships a friendlier `message`; fall back to `error`.
        setDiffError(body.message ?? body.error ?? 'Failed to apply edit');
        return;
      }
      setDiffOpen(false);
      setDiffPayload(null);
      await mutate(url);
      await mutate(PROMPTS_URL);
      await mutate(ALL_FEEDBACK_URL);
      await mutate(`/api/admin/ai-insight-prompts/${encodeURIComponent(promptKey)}/versions`);
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setApplying(false);
    }
  }

  function handleDiffOpenChange(next: boolean) {
    if (applying) return; // ignore close while a write is in flight
    setDiffOpen(next);
    if (!next) {
      setDiffPayload(null);
      setDiffError(null);
    }
  }

  const rows = data?.feedback ?? [];

  return (
    <div
      data-testid="feedback-list"
      className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-background"
    >
      <div className="flex shrink-0 items-center border-b border-border px-4 py-2.5">
        <div className="text-sm font-semibold text-foreground">Feedback:</div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-foreground/80">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading feedback…
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
            Failed to load feedback.
          </div>
        )}

        {errorMsg && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {!isLoading && !error && rows.length === 0 && (
          <div className="text-sm text-foreground/70">No pending feedback for this prompt.</div>
        )}

        {rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((r) => {
              const discarding = pendingDelete === r.id;
              const previewing = pendingPreview === r.id;
              return (
                <FeedbackItem
                  key={r.id}
                  row={r}
                  onDiscard={handleDiscard}
                  onApply={handleApply}
                  discarding={discarding}
                  previewing={previewing}
                  busy={discarding || previewing || applying}
                />
              );
            })}
          </ul>
        )}
      </div>

      <DiffModal
        open={diffOpen}
        onOpenChange={handleDiffOpenChange}
        data={diffPayload}
        loading={pendingPreview != null}
        applying={applying}
        error={diffError}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
