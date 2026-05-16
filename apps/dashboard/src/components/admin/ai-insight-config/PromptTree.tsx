'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
  components: PromptRowView[];
}

interface Page {
  page: string;
  sections: Section[];
}

const SYSTEM_PROMPT_GROUPS = {
  finance: [
    { key: 'component_analysis', label: 'Component Analysis' },
    { key: 'summary_analysis', label: 'Summary Analysis' },
  ],
  hr: [
    { key: 'hr_component_analysis', label: 'Component Analysis' },
    { key: 'hr_summary_analysis', label: 'Summary Analysis' },
  ],
} as const;

function groupByPage(rows: PromptRowView[]): Page[] {
  const byPage = new Map<string, Map<string, Section>>();
  for (const row of rows) {
    if (row.category !== 'component' || !row.page || !row.sectionKey) continue;
    if (!byPage.has(row.page)) byPage.set(row.page, new Map());
    const sectionMap = byPage.get(row.page)!;
    if (!sectionMap.has(row.sectionKey)) {
      sectionMap.set(row.sectionKey, {
        sectionKey: row.sectionKey,
        sectionName: row.sectionName ?? row.sectionKey,
        components: [],
      });
    }
    sectionMap.get(row.sectionKey)!.components.push(row);
  }

  const pages: Page[] = [];
  for (const [page, sectionMap] of byPage.entries()) {
    pages.push({
      page,
      sections: Array.from(sectionMap.values()).map((section) => ({
        ...section,
        components: [...section.components].sort((a, b) => a.sortOrder - b.sortOrder),
      })),
    });
  }

  return pages.sort((a, b) => {
    if (a.page === 'hr') return 1;
    if (b.page === 'hr') return -1;
    return a.page.localeCompare(b.page);
  });
}

function pageLabel(page: string): string {
  if (page === 'hr') return 'HR';
  if (page === 'finance') return 'Finance';
  return page
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function PromptTree({ prompts, selectedKey, onSelect }: Props) {
  const systemPrompts = useMemo(
    () => prompts.filter((prompt) => prompt.category === 'system').sort((a, b) => a.sortOrder - b.sortOrder),
    [prompts],
  );
  const systemByKey = useMemo(() => {
    const byKey = new Map<string, PromptRowView>();
    for (const prompt of systemPrompts) byKey.set(prompt.promptKey, prompt);
    return byKey;
  }, [systemPrompts]);
  const pages = useMemo(() => groupByPage(prompts), [prompts]);

  const [openPages, setOpenPages] = useState<Record<string, boolean>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openSystemFinance, setOpenSystemFinance] = useState(true);
  const [openSystemHr, setOpenSystemHr] = useState(true);
  const [openFinance, setOpenFinance] = useState(true);

  const financePages = useMemo(() => pages.filter((page) => page.page !== 'hr'), [pages]);

  function renderSystemLeaf(item: { key: string; label: string }) {
    const prompt = systemByKey.get(item.key);
    if (!prompt) return null;
    return (
      <li key={item.key}>
        <button
          onClick={() => onSelect(prompt.promptKey)}
          data-testid="prompt-tree-leaf"
          data-prompt-key={prompt.promptKey}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
            selectedKey === prompt.promptKey
              ? 'bg-primary/10 text-primary font-medium'
              : 'hover:bg-accent',
          )}
        >
          <span className="truncate">{item.label}</span>
        </button>
      </li>
    );
  }

  function renderSections(sections: Section[]) {
    return sections.map((section) => {
      const sectionOpen = openSections[section.sectionKey] ?? true;
      return (
        <li key={section.sectionKey}>
          <button
            onClick={() => toggleSection(section.sectionKey)}
            className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm text-foreground hover:bg-accent"
          >
            {sectionOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className="truncate">{section.sectionName}</span>
          </button>
          {sectionOpen && (
            <ul className="ml-3 space-y-0.5">
              {section.components.map((component) => {
                const active = selectedKey === component.promptKey;
                return (
                  <li key={component.promptKey}>
                    <button
                      onClick={() => onSelect(component.promptKey)}
                      data-testid="prompt-tree-leaf"
                      data-prompt-key={component.promptKey}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors',
                        active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent',
                      )}
                    >
                      <span className="truncate">{component.displayName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      );
    });
  }

  function togglePage(page: string) {
    setOpenPages((prev) => ({ ...prev, [page]: !(prev[page] ?? false) }));
  }

  function toggleSection(sectionKey: string) {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !(prev[sectionKey] ?? true) }));
  }

  return (
    <Card data-testid="prompt-tree" className="h-full">
      <CardContent className="h-full overflow-y-auto p-2">
        <div className="px-2 pt-1 pb-1.5 text-sm font-bold text-blue-700">
          System Prompt
        </div>
        <ul className="space-y-0.5">
          <li key="__system_finance__">
            <button
              onClick={() => setOpenSystemFinance((value) => !value)}
              data-testid="prompt-tree-system-group"
              data-system-group="finance"
              className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              {openSystemFinance ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="font-medium truncate">Finance</span>
            </button>
            {openSystemFinance && (
              <ul className="ml-4 mt-0.5 space-y-0.5">
                {SYSTEM_PROMPT_GROUPS.finance.map((item) => renderSystemLeaf(item))}
              </ul>
            )}
          </li>

          <li key="__system_hr__">
            <button
              onClick={() => setOpenSystemHr((value) => !value)}
              data-testid="prompt-tree-system-group"
              data-system-group="hr"
              className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              {openSystemHr ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="font-medium truncate">HR</span>
            </button>
            {openSystemHr && (
              <ul className="ml-4 mt-0.5 space-y-0.5">
                {SYSTEM_PROMPT_GROUPS.hr.map((item) => renderSystemLeaf(item))}
              </ul>
            )}
          </li>
        </ul>

        <div className="mt-3 px-2 pb-1.5 text-sm font-bold text-blue-700">
          User Prompt
        </div>
        <ul className="space-y-0.5">
          {financePages.length > 0 && (
            <li key="__finance__">
              <button
                onClick={() => setOpenFinance((value) => !value)}
                data-testid="prompt-tree-page"
                data-page="finance"
                className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {openFinance ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="font-medium truncate">Finance</span>
              </button>
              {openFinance && (
                <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                  {financePages.map((page) => {
                    const pageOpen = openPages[page.page] ?? false;
                    return (
                      <li key={page.page}>
                        <button
                          onClick={() => togglePage(page.page)}
                          data-testid="prompt-tree-page"
                          data-page={page.page}
                          className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm hover:bg-accent"
                        >
                          {pageOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          <span className="font-medium truncate">{pageLabel(page.page)}</span>
                        </button>
                        {pageOpen && (
                          <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                            {renderSections(page.sections)}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
