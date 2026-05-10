'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Cog, Compass } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PromptRowView } from './PromptConfigDashboard';

interface Props {
  prompts: PromptRowView[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

interface Section {
  sectionKey: string;
  sectionName: string;
  guidance: PromptRowView | null;
  components: PromptRowView[];
}

interface Page {
  page: string;
  sections: Section[];
}

function groupByPage(rows: PromptRowView[]): Page[] {
  const byPage = new Map<string, Map<string, Section>>();
  for (const r of rows) {
    if (!r.page || !r.sectionKey) continue;
    if (r.category !== 'component' && r.category !== 'section_guidance') continue;
    if (!byPage.has(r.page)) byPage.set(r.page, new Map());
    const sectionMap = byPage.get(r.page)!;
    if (!sectionMap.has(r.sectionKey)) {
      sectionMap.set(r.sectionKey, {
        sectionKey: r.sectionKey,
        sectionName: r.sectionName ?? r.sectionKey,
        guidance: null,
        components: [],
      });
    }
    const section = sectionMap.get(r.sectionKey)!;
    if (r.category === 'section_guidance') {
      section.guidance = r;
    } else {
      section.components.push(r);
    }
  }
  const pages: Page[] = [];
  for (const [page, sectionMap] of byPage.entries()) {
    pages.push({
      page,
      sections: Array.from(sectionMap.values()).map((s) => ({
        ...s,
        components: [...s.components].sort((a, b) => a.sortOrder - b.sortOrder),
      })),
    });
  }
  return pages.sort((a, b) => a.page.localeCompare(b.page));
}

function pageLabel(page: string): string {
  return page
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function PromptTree({ prompts, selectedKey, onSelect }: Props) {
  const systemPrompts = useMemo(
    () => prompts.filter((p) => p.category === 'system').sort((a, b) => a.sortOrder - b.sortOrder),
    [prompts],
  );
  const pages = useMemo(() => groupByPage(prompts), [prompts]);

  const [openPages, setOpenPages] = useState<Record<string, boolean>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  function feedbackBadge(count: number) {
    if (count <= 0) return null;
    return (
      <span
        className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white"
        title={`${count} pending feedback`}
      >
        {count}
      </span>
    );
  }

  function togglePage(page: string) {
    setOpenPages((prev) => ({ ...prev, [page]: !prev[page] }));
  }
  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <Card className="lg:sticky lg:top-4">
      <CardContent className="p-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
        {/* System group */}
        <div className="px-2 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
          System Prompts
        </div>
        <ul className="space-y-0.5">
          {systemPrompts.map((p) => (
            <li key={p.promptKey}>
              <button
                onClick={() => onSelect(p.promptKey)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  selectedKey === p.promptKey
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-accent',
                )}
              >
                <Cog size={14} className="shrink-0" />
                <span className="truncate">{p.displayName}</span>
                <div className="ml-auto flex items-center gap-1.5 shrink-0">
                  {p.isModified && (
                    <span
                      className="size-1.5 rounded-full bg-amber-500"
                      title="Modified from default"
                    />
                  )}
                  {feedbackBadge(p.feedbackCount)}
                </div>
              </button>
            </li>
          ))}
        </ul>

        {/* Pages */}
        <div className="mt-3 px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
          User Prompt
        </div>
        <ul className="space-y-0.5">
          {pages.map((p) => {
            const pageOpen = openPages[p.page] ?? false;
            const pageHasModified = p.sections.some((s) =>
              s.components.some((c) => c.isModified) || (s.guidance?.isModified ?? false),
            );
            const pageFeedback = p.sections.reduce(
              (sum, s) =>
                sum +
                s.components.reduce((ss, c) => ss + (c.feedbackCount ?? 0), 0) +
                (s.guidance?.feedbackCount ?? 0),
              0,
            );
            return (
              <li key={p.page}>
                <button
                  onClick={() => togglePage(p.page)}
                  className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  {pageOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="font-medium truncate">{pageLabel(p.page)}</span>
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    {pageHasModified && (
                      <span
                        className="size-1.5 rounded-full bg-amber-500"
                        title="Has modified prompts"
                      />
                    )}
                    {feedbackBadge(pageFeedback)}
                  </div>
                </button>

                {pageOpen && (
                  <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                    {p.sections.map((s) => {
                      const sectionOpen = openSections[s.sectionKey] ?? true;
                      const sectionHasModified =
                        s.components.some((c) => c.isModified) || (s.guidance?.isModified ?? false);
                      const sectionFeedback =
                        s.components.reduce((sum, c) => sum + (c.feedbackCount ?? 0), 0) +
                        (s.guidance?.feedbackCount ?? 0);
                      return (
                        <li key={s.sectionKey}>
                          <button
                            onClick={() => toggleSection(s.sectionKey)}
                            className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-xs uppercase tracking-wider text-foreground hover:bg-accent"
                          >
                            {sectionOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <span className="truncate">{s.sectionName}</span>
                            <div className="ml-auto flex items-center gap-1.5 shrink-0">
                              {sectionHasModified && (
                                <span className="size-1.5 rounded-full bg-amber-500" />
                              )}
                              {feedbackBadge(sectionFeedback)}
                            </div>
                          </button>
                          {sectionOpen && (
                            <ul className="ml-3 space-y-0.5">
                              {s.guidance && (() => {
                                const g = s.guidance;
                                const active = selectedKey === g.promptKey;
                                return (
                                  <li key={g.promptKey}>
                                    <button
                                      onClick={() => onSelect(g.promptKey)}
                                      className={cn(
                                        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors',
                                        active
                                          ? 'bg-primary/10 text-primary font-medium'
                                          : 'hover:bg-accent',
                                      )}
                                    >
                                      <Compass size={13} className="shrink-0 text-foreground/70" />
                                      <span className="truncate">Guidance</span>
                                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] uppercase tracking-wider text-foreground/50">
                                          guidance
                                        </span>
                                        {g.isModified && (
                                          <span
                                            className="size-1.5 rounded-full bg-amber-500"
                                            title="Modified from default"
                                          />
                                        )}
                                        {g.feedbackCount > 0 && feedbackBadge(g.feedbackCount)}
                                      </div>
                                    </button>
                                  </li>
                                );
                              })()}
                              {s.components.map((c) => {
                                const active = selectedKey === c.promptKey;
                                return (
                                  <li key={c.promptKey}>
                                    <button
                                      onClick={() => onSelect(c.promptKey)}
                                      className={cn(
                                        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors',
                                        active
                                          ? 'bg-primary/10 text-primary font-medium'
                                          : 'hover:bg-accent',
                                      )}
                                    >
                                      <span className="truncate">{c.displayName}</span>
                                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                                        {c.componentType && (
                                          <span className="text-[10px] uppercase tracking-wider text-foreground/50">
                                            {c.componentType}
                                          </span>
                                        )}
                                        {c.isModified && (
                                          <span
                                            className="size-1.5 rounded-full bg-amber-500"
                                            title="Modified from default"
                                          />
                                        )}
                                        {c.feedbackCount > 0 && feedbackBadge(c.feedbackCount)}
                                      </div>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
