'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface VersionRowView {
  id: number;
  label: string;
  isDefault: boolean;
  isSelected: boolean;
  createdAt: string;
  createdBy: string | null;
}

interface Props {
  promptKey: string;
}

const PROMPTS_URL = '/api/admin/ai-insight-prompts';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
};

const MAX_VERSIONS = 6;

export function VersionPanel({ promptKey }: Props) {
  const versionsUrl = `/api/admin/ai-insight-prompts/${encodeURIComponent(promptKey)}/versions`;
  const { data, error, isLoading } = useSWR<{ versions: VersionRowView[] }>(
    versionsUrl,
    fetcher,
    { revalidateOnFocus: false },
  );

  const [selectingId, setSelectingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VersionRowView | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const versions = data?.versions ?? [];
  const atCap = versions.length >= MAX_VERSIONS;

  async function handleSelect(v: VersionRowView) {
    if (v.isSelected || selectingId != null) return;
    setSelectingId(v.id);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/admin/ai-insight-prompts/${encodeURIComponent(promptKey)}/versions/${v.id}/select`,
        { method: 'POST' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(body.error ?? 'Failed to select version');
        return;
      }
      await Promise.all([mutate(versionsUrl), mutate(PROMPTS_URL)]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSelectingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setDeletingId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/admin/ai-insight-prompts/${encodeURIComponent(promptKey)}/versions/${id}`,
        { method: 'DELETE' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(body.error ?? 'Failed to delete version');
        return;
      }
      await Promise.all([mutate(versionsUrl), mutate(PROMPTS_URL)]);
      setConfirmDelete(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      data-testid="version-panel"
      className="flex flex-col rounded-lg border border-border bg-background"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        <div className="text-sm font-semibold text-foreground">Version:</div>
        {!isLoading && (
          <span className="text-xs text-foreground/60">
            {versions.length}/{MAX_VERSIONS}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 px-3 py-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-foreground/70">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading versions…
          </div>
        )}
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
            Failed to load versions.
          </div>
        )}
        {errorMsg && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {atCap && (
          <div
            data-testid="version-cap-notice"
            className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              The prompt version section is full. Please clear unwanted versions before
              proceeding with feedback Apply.
            </div>
          </div>
        )}

        {versions.map((v) => {
          const isBusy = selectingId === v.id || deletingId === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => handleSelect(v)}
              disabled={selectingId != null}
              data-testid={v.isDefault ? 'version-card-default' : 'version-card'}
              data-version-id={v.id}
              data-selected={v.isSelected ? 'true' : 'false'}
              className={cn(
                'group/card flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                v.isDefault
                  ? 'border-amber-400 bg-amber-50/60'
                  : 'border-border bg-background hover:bg-accent/40',
                v.isSelected && 'ring-2 ring-blue-500 ring-offset-1',
                selectingId != null && !isBusy && 'opacity-60',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {v.label}
                </div>
              </div>
              {!v.isDefault && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDelete(v);
                    }
                  }}
                  data-testid="version-delete-button"
                  aria-label={`Delete version ${v.label}`}
                  title="Delete version"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-red-700 hover:bg-red-100"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog
        open={confirmDelete != null}
        onOpenChange={(open) => {
          if (!open && deletingId == null) setConfirmDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this version?</DialogTitle>
            <DialogDescription>
              {confirmDelete?.label} will be removed permanently. If it is currently
              selected, the next-newer version (or Default) becomes selected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={deletingId != null}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              size="sm"
              type="button"
              onClick={handleConfirmDelete}
              disabled={deletingId != null}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deletingId != null ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {deletingId != null ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
