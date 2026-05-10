'use client';

import type { PromptRowView } from './PromptConfigDashboard';

interface Props {
  prompt: PromptRowView | null;
}

export function PromptTextPanel({ prompt }: Props) {
  if (!prompt) {
    return (
      <div
        data-testid="prompt-text-panel"
        className="flex h-full items-center justify-center rounded-lg border border-border bg-background p-6 text-sm text-foreground/60"
      >
        Select a prompt to view its text.
      </div>
    );
  }

  const text = prompt.promptText ?? '';
  const trimmed = text.trim();
  const versionLabel = prompt.selectedVersionLabel ?? 'Default';

  return (
    <div
      data-testid="prompt-text-panel"
      className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-background"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Prompt Text
        </div>
        <span
          data-testid="selected-version-pill"
          className="inline-flex items-center rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900"
          title="Currently selected version"
        >
          {versionLabel}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {trimmed.length === 0 ? (
          <div
            data-testid="prompt-text-empty"
            className="text-sm italic text-foreground/60"
          >
            This prompt is empty. Submit feedback from the user-facing AI insight panel
            to populate it.
          </div>
        ) : (
          <pre
            data-testid="prompt-text-body"
            className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-foreground"
          >
            {text}
          </pre>
        )}
      </div>
    </div>
  );
}
