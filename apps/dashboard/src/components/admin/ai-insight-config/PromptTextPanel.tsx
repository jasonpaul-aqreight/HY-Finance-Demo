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
        className="flex h-full items-center justify-center rounded-lg border border-border bg-background p-6 text-sm font-medium text-foreground"
      >
        Select a prompt to view the AI Prompt Preview.
      </div>
    );
  }

  const text = prompt.renderedPromptText ?? prompt.promptText ?? '';
  const trimmed = text.trim();

  return (
    <div
      data-testid="prompt-text-panel"
      className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-background"
    >
      <div className="shrink-0 border-b border-border px-4 py-2.5">
        <div className="text-sm font-bold text-foreground">
          AI Prompt Preview
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {trimmed.length === 0 ? (
          <div
            data-testid="prompt-text-empty"
            className="text-sm font-medium text-foreground"
          >
            This prompt is empty.
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
