'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Toast } from './Toast';

const BUDGET_LINE_ITEMS = [
  'Net Sales',
  'Cost of Sales',
  'Operating Costs',
] as const;

const NOTE_WORD_LIMIT = 50;

type BudgetLineItem = (typeof BUDGET_LINE_ITEMS)[number];

interface BudgetRow {
  line_item: string;
  monthly_budget: number;
  annual_budget: number;
  approved_by: string | null;
  note: string | null;
  updated_at: string;
}

interface FormLine {
  line_item: BudgetLineItem;
  monthly_budget: string;
  annual_budget: string;
}

interface BudgetSettingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  userName: string;
}

function emptyForm(): FormLine[] {
  return BUDGET_LINE_ITEMS.map((line_item) => ({
    line_item,
    monthly_budget: '',
    annual_budget: '',
  }));
}

function rowsToForm(rows: BudgetRow[]): FormLine[] {
  const byItem = new Map(rows.map((r) => [r.line_item, r]));
  return BUDGET_LINE_ITEMS.map((line_item) => {
    const row = byItem.get(line_item);
    return {
      line_item,
      monthly_budget: row ? String(Math.round(row.monthly_budget)) : '',
      annual_budget: row ? String(Math.round(row.annual_budget)) : '',
    };
  });
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function clampToWordLimit(text: string, limit: number): string {
  const words = text.split(/(\s+)/);
  let count = 0;
  const out: string[] = [];
  for (const token of words) {
    if (/^\s+$/.test(token)) {
      out.push(token);
      continue;
    }
    if (token.length === 0) continue;
    if (count >= limit) break;
    out.push(token);
    count++;
  }
  return out.join('');
}

export function BudgetSettingDialog({
  open,
  onOpenChange,
  isAdmin,
  userName,
}: BudgetSettingDialogProps) {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [form, setForm] = useState<FormLine[]>(emptyForm);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/budget')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load budget');
        if (cancelled) return;
        const budget: BudgetRow[] = json.budget ?? [];
        setRows(budget);
        setForm(rowsToForm(budget));
        const initialNote = budget[0]?.note ?? '';
        setNote(clampToWordLimit(initialNote, NOTE_WORD_LIMIT));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load budget');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  function updateLine(index: number, field: 'monthly_budget' | 'annual_budget', value: string) {
    setForm((current) =>
      current.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
    );
  }

  function updateNote(value: string) {
    setNote(clampToWordLimit(value, NOTE_WORD_LIMIT));
  }

  const noteWordCount = useMemo(() => countWords(note), [note]);

  async function handleSave() {
    if (!isAdmin) return;

    const lines = form.map((line) => ({
      line_item: line.line_item,
      monthly_budget: Number(line.monthly_budget),
      annual_budget: Number(line.annual_budget),
    }));

    if (
      lines.some(
        (line) =>
          !Number.isFinite(line.monthly_budget) ||
          !Number.isFinite(line.annual_budget),
      )
    ) {
      setError('Enter valid monthly and annual budget values for every line.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/budget', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': isAdmin ? 'admin' : '',
        },
        body: JSON.stringify({ lines, userName, note: note.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save budget baseline');
      const next: BudgetRow[] = json.budget ?? [];
      setRows(next);
      setForm(rowsToForm(next));
      setNote(clampToWordLimit(next[0]?.note ?? '', NOTE_WORD_LIMIT));
      setToast('Budget baseline saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save budget baseline');
    } finally {
      setSaving(false);
    }
  }

  const meta = rows[0];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-base font-semibold text-foreground">
              Budget Setting
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            {!isAdmin && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Contact an admin to update the budget baseline.
              </p>
            )}

            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading budget baseline…
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="bg-muted/50 text-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Line Item</th>
                        <th className="px-3 py-2 text-right font-semibold">Monthly Budget</th>
                        <th className="px-3 py-2 text-right font-semibold">Annual Budget</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.map((line, index) => (
                        <tr key={line.line_item} className="border-t">
                          <td className="px-3 py-2 font-medium text-foreground">{line.line_item}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={line.monthly_budget}
                              disabled={!isAdmin || saving}
                              onChange={(event) => updateLine(index, 'monthly_budget', event.target.value)}
                              className="text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={line.annual_budget}
                              disabled={!isAdmin || saving}
                              onChange={(event) => updateLine(index, 'annual_budget', event.target.value)}
                              className="text-right font-semibold"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="budget-note" className="text-sm font-semibold text-foreground">
                      Note (optional)
                    </label>
                    <span
                      className={`text-xs font-medium ${noteWordCount >= NOTE_WORD_LIMIT ? 'text-red-700' : 'text-foreground/70'}`}
                    >
                      {noteWordCount} / {NOTE_WORD_LIMIT} words
                    </span>
                  </div>
                  <Textarea
                    id="budget-note"
                    value={note}
                    onChange={(event) => updateNote(event.target.value)}
                    disabled={!isAdmin || saving}
                    placeholder="Add context for this baseline (e.g. board-approved FY27 target)"
                    rows={4}
                    className="min-h-[110px]"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t bg-background px-5 py-3">
            <div className="text-xs text-foreground/80">
              {error ? (
                <span className="font-medium text-red-700">{error}</span>
              ) : meta ? (
                <>
                  Last updated by{' '}
                  <span className="font-semibold">{meta.approved_by || 'Admin'}</span> on{' '}
                  <span className="font-semibold">{new Date(meta.updated_at).toLocaleString()}</span>
                </>
              ) : null}
            </div>
            {isAdmin && (
              <Button onClick={handleSave} disabled={saving || loading}>
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Toast message={toast} onClose={() => setToast(null)} />
    </>
  );
}
