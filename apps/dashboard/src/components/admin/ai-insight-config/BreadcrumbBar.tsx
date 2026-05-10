'use client';

import { ChevronRight } from 'lucide-react';
import type { PromptRowView } from './PromptConfigDashboard';

interface Props {
  prompt: PromptRowView | null;
}

function pageLabel(page: string | null): string {
  if (!page) return '';
  if (page === 'hr') return 'HR';
  return page;
}

function buildCrumbs(prompt: PromptRowView): string[] {
  if (prompt.category === 'system') {
    return ['System Prompt', prompt.displayName];
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
            <span className={isLast ? 'font-semibold text-foreground' : 'text-foreground/70'}>
              {crumb}
            </span>
            {!isLast && (
              <ChevronRight size={14} className="shrink-0 text-foreground/40" />
            )}
          </span>
        );
      })}
    </nav>
  );
}
