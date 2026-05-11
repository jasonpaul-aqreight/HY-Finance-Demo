'use client';

import type { PromptRowView } from './PromptConfigDashboard';

interface Props {
  prompt: PromptRowView | null;
}

function pageLabel(page: string | null): string {
  if (!page) return '';
  if (page === 'hr') return 'HR';
  return page;
}

function systemDisplayName(prompt: PromptRowView): string {
  if (prompt.promptKey === 'component_analysis' || prompt.promptKey === 'global_system') {
    return 'Component Analysis';
  }
  if (prompt.promptKey === 'summary_analysis' || prompt.promptKey === 'summary_system') {
    return 'Summary Analysis';
  }
  if (prompt.promptKey === 'feedback_router' || prompt.promptKey === 'feedback_router_system') {
    return 'Feedback Router';
  }
  if (prompt.promptKey === 'surgical_editor' || prompt.promptKey === 'surgical_editor_system') {
    return 'Surgical Editor';
  }
  return prompt.displayName;
}

function buildCrumbs(prompt: PromptRowView): string[] {
  if (prompt.category === 'system') {
    const displayName = systemDisplayName(prompt);
    if (
      prompt.page === 'finance' ||
      prompt.promptKey === 'component_analysis' ||
      prompt.promptKey === 'summary_analysis' ||
      prompt.promptKey === 'global_system' ||
      prompt.promptKey === 'summary_system'
    ) {
      return ['System Prompt', 'Finance', displayName];
    }
    if (prompt.page === 'hr') {
      return ['System Prompt', 'HR', displayName];
    }
    return ['System Prompt', displayName];
  }

  const isHr = prompt.page === 'hr';
  const tail =
    prompt.category === 'section_guidance' ? 'Guidance' : prompt.displayName;
  const sectionName = prompt.sectionName ?? prompt.sectionKey ?? '';

  if (isHr) {
    return ['User Prompt', 'HR', sectionName, tail];
  }

  return [
    'User Prompt',
    'Finance',
    pageLabel(prompt.page),
    sectionName,
    tail,
  ].filter(Boolean);
}

export function BreadcrumbBar({ prompt }: Props) {
  if (!prompt) {
    return (
      <nav
        data-testid="ai-insight-breadcrumb"
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground/60"
        aria-label="Prompt path"
      >
        Select a prompt from the tree
      </nav>
    );
  }

  const crumbs = buildCrumbs(prompt);
  return (
    <nav
      data-testid="ai-insight-breadcrumb"
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground"
      aria-label="Prompt path"
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={`${i}-${crumb}`} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-foreground/40">/</span>
            )}
            <span className={isLast ? 'font-semibold text-foreground' : 'text-foreground/70'}>
              {crumb}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
