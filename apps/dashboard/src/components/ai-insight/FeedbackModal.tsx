'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SectionKey } from '@/lib/ai-insight/types';
import { FEEDBACK_MAX_WORDS, countWords } from '@/lib/ai-insight/word-count';

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionKey: SectionKey;
  page: string;
  sectionName: string;
  submittedBy: string;
  onSubmitted: (message: string) => void;
}

export function FeedbackModal({
  open,
  onOpenChange,
  sectionKey,
  page,
  sectionName,
  submittedBy,
  onSubmitted,
}: FeedbackModalProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setError(null);
    }
  }, [open]);

  const trimmed = text.trim();
  const wordCount = countWords(text);
  const overLimit = wordCount > FEEDBACK_MAX_WORDS;
  const nearLimit = wordCount > FEEDBACK_MAX_WORDS - 10 && !overLimit;
  const canSubmit = wordCount > 0 && !overLimit && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-insight/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_key: sectionKey,
          page,
          raw_feedback: trimmed,
          submitted_by: submittedBy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit feedback');
        return;
      }
      onOpenChange(false);
      onSubmitted('Feedback sent. Thank you.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send feedback on this insight</DialogTitle>
          <DialogDescription className="text-foreground/80">
            {sectionName} · {page}. Tell us what was wrong, missing, or
            confusing. An admin will review and update the prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Up to ${FEEDBACK_MAX_WORDS} words. e.g. Drop the collection-days metric. Focus only on the shortfall amount.`}
            rows={6}
            disabled={submitting}
            className="text-sm"
          />
          <div className="flex items-center justify-between text-xs">
            <span
              className={
                overLimit
                  ? 'text-red-600 font-medium'
                  : nearLimit
                    ? 'text-amber-600 font-medium'
                    : 'text-foreground'
              }
            >
              {wordCount} / {FEEDBACK_MAX_WORDS} words
            </span>
            {error && <span className="text-red-700 font-medium">{error}</span>}
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" disabled={submitting} />}>
            Cancel
          </DialogClose>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {submitting ? 'Sending…' : 'Send feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
