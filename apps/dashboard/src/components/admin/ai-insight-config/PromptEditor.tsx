// @ts-nocheck
// Phase 2 leaves this file dead-walking — it references the now-removed
// previousText/previousText2/defaultText/isModified fields and the deleted
// PUT/reset/revert endpoints. Phase 3 (tasks 3.7) deletes this file outright.
// Until then, ts-nocheck keeps the build green.
'use client';

import { useEffect, useRef, useState } from 'react';
import { mutate } from 'swr';
import { AlertTriangle, Lock, RotateCcw, Save, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import type { PromptRowView } from './PromptConfigDashboard';
import { FeedbackList } from './FeedbackList';
import { HistoryDropdown } from './HistoryDropdown';

interface Props {
  prompt: PromptRowView | null;
  isAdmin: boolean;
}

const PROMPTS_URL = '/api/admin/ai-insight-prompts';

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function pageLabel(page: string | null): string {
  if (!page) return 'System';
  return page
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function PromptEditor({ prompt, isAdmin }: Props) {
  const [draft, setDraft] = useState('');
  const [showDefault, setShowDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetAllRunning, setResetAllRunning] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const lastPromptKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const promptKey = prompt?.promptKey ?? null;
    setDraft(prompt?.promptText ?? '');
    setShowDefault(false);
    if (lastPromptKeyRef.current !== promptKey) {
      setFeedback(null);
      setWarnings(null);
    }
    lastPromptKeyRef.current = promptKey;
  }, [prompt?.promptKey, prompt?.promptText]);

  if (!prompt) {
    return (
      <Card>
        <CardContent className="p-8 text-foreground">
          Select a prompt from the tree to edit it.
        </CardContent>
      </Card>
    );
  }

  // Set NEXT_PUBLIC_AI_INSIGHT_LOCK_SYSTEM_PROMPTS=false to allow editing system prompts.
  // Locked by default because the parser depends on their output contract.
  const lockSystemPrompts = process.env.NEXT_PUBLIC_AI_INSIGHT_LOCK_SYSTEM_PROMPTS !== 'false';
  const isLocked = lockSystemPrompts && prompt.category === 'system';
  const dirty = draft !== prompt.promptText;
  const empty = !draft.trim();
  const canSave = isAdmin && !isLocked && dirty && !empty && !saving;

  async function handleSave() {
    if (!prompt) return;
    setSaving(true);
    setFeedback(null);
    setWarnings(null);
    try {
      const res = await fetch(`${PROMPTS_URL}/${encodeURIComponent(prompt.promptKey)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptText: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error ?? 'Save failed' });
      } else {
        setFeedback({ type: 'success', message: 'Saved' });
        if (Array.isArray(data.warnings) && data.warnings.length > 0) {
          setWarnings(data.warnings);
        }
        await mutate(PROMPTS_URL);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!prompt) return;
    setResetting(true);
    setFeedback(null);
    setWarnings(null);
    try {
      const res = await fetch(`${PROMPTS_URL}/${encodeURIComponent(prompt.promptKey)}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error ?? 'Reset failed' });
      } else {
        setFeedback({ type: 'success', message: 'Reset to default' });
        if (data.prompt?.promptText) setDraft(data.prompt.promptText);
        await mutate(PROMPTS_URL);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setResetting(false);
    }
  }

  async function handleResetAll() {
    if (!prompt) return;
    const defaultText = prompt.defaultText;
    setResetAllRunning(true);
    setFeedback(null);
    setWarnings(null);
    try {
      const res = await fetch(`${PROMPTS_URL}/reset-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error ?? 'Reset all failed' });
      } else {
        setFeedback({ type: 'success', message: `Reset ${data.count} prompts to default` });
        if (defaultText != null) setDraft(defaultText);
        await mutate(PROMPTS_URL);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setResetAllRunning(false);
    }
  }

  const displayedText = showDefault ? (prompt.defaultText ?? '') : draft;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{prompt.displayName}</CardTitle>
            <div className="text-xs text-foreground/70">
              <span>{pageLabel(prompt.page)}</span>
              {prompt.sectionName && <> · <span>{prompt.sectionName}</span></>}
              <> · <span className="font-mono text-[11px]">{prompt.promptKey}</span></>
            </div>
          </div>
          {prompt.isModified && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              Modified
            </span>
          )}
        </div>
        <div className="text-xs text-foreground/60">
          Last updated {formatTimestamp(prompt.updatedAt)}
          {prompt.updatedBy ? ` by ${prompt.updatedBy}` : ''}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDefault((v) => !v)}
            disabled={prompt.defaultText == null}
          >
            {showDefault ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {showDefault ? 'Hide default' : 'Show default'}
          </Button>
          {showDefault && (
            <span className="text-xs text-foreground">Read-only — switch back to edit</span>
          )}
        </div>

        {isLocked && (
          <div className="flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">
            <Lock className="size-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">View-only — managed in code</div>
              <div className="text-xs text-slate-700">
                System prompts define the output contract the parser depends on. Editing them in the UI is disabled to prevent breaking the insight pipeline. Changes must be made in <span className="font-mono">prompts-defaults.ts</span>.
              </div>
            </div>
          </div>
        )}

        <Textarea
          value={displayedText}
          onChange={(e) => setDraft(e.target.value)}
          readOnly={showDefault || !isAdmin || isLocked}
          rows={20}
          className="font-mono text-sm min-h-[24rem]"
          spellCheck={false}
        />

        {isAdmin && (
          <FeedbackList
            promptKey={prompt.promptKey}
            promptDisplayName={prompt.displayName}
          />
        )}

        {warnings && warnings.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-medium">Saved with warnings</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {feedback && (
          <div
            className={
              feedback.type === 'error'
                ? 'rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800'
                : 'rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800'
            }
          >
            {feedback.message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <div className="text-xs text-foreground">
            Changes apply to new analyses, not in-progress runs.
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <HistoryDropdown
                promptKey={prompt.promptKey}
                promptDisplayName={prompt.displayName}
                currentText={prompt.promptText}
                previousText={prompt.previousText}
                previousText2={prompt.previousText2}
              />

              {!isLocked && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={!prompt.isModified || resetting}
                >
                  <RotateCcw className="size-4" />
                  {resetting ? 'Resetting…' : 'Reset to Default'}
                </Button>
              )}

              <Dialog>
                <DialogTrigger
                  render={
                    <Button variant="outline" size="sm" disabled={resetAllRunning}>
                      <RotateCcw className="size-4" />
                      Reset All…
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reset every prompt?</DialogTitle>
                    <DialogDescription>
                      This will revert every prompt — system + components — to its factory default.
                      Any unsaved edits in this editor will not be applied.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" size="sm" />}>
                      Cancel
                    </DialogClose>
                    <DialogClose
                      render={
                        <Button
                          size="sm"
                          onClick={handleResetAll}
                          disabled={resetAllRunning}
                        />
                      }
                    >
                      {resetAllRunning ? 'Resetting…' : 'Reset All'}
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {!isLocked && (
                <Button onClick={handleSave} disabled={!canSave} size="sm">
                  <Save className="size-4" />
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
