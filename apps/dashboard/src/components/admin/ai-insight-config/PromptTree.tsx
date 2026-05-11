'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
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
  // HR last (so Finance pages stay grouped on top); otherwise alphabetical.
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
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const SYSTEM_PROMPT_GROUPS = {
  finance: [
    { key: 'component_analysis', legacyKey: 'global_system', label: 'Component Analysis' },
    { key: 'summary_analysis', legacyKey: 'summary_system', label: 'Summary Analysis' },
  ],
  hr: [
    { key: 'hr_component_analysis', label: 'Component Analysis' },
    { key: 'hr_summary_analysis', label: 'Summary Analysis' },
  ],
  standalone: [
    { key: 'feedback_router', legacyKey: 'feedback_router_system', label: 'Feedback Router' },
    { key: 'surgical_editor', legacyKey: 'surgical_editor_system', label: 'Surgical Editor' },
  ],
} as const;

export function PromptTree({ prompts, selectedKey, onSelect }: Props) {
  const systemPrompts = useMemo(
    () => prompts.filter((p) => p.category === 'system').sort((a, b) => a.sortOrder - b.sortOrder),
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
  const [openHr, setOpenHr] = useState(false);

  const financePages = useMemo(() => pages.filter((p) => p.page !== 'hr'), [pages]);
  const hrPage = useMemo(() => pages.find((p) => p.page === 'hr') ?? null, [pages]);

  function getSystemPrompt(item: { key: string; legacyKey?: string }): PromptRowView | null {
    return systemByKey.get(item.key) ?? (item.legacyKey ? systemByKey.get(item.legacyKey) : null) ?? null;
  }

  function systemFeedback(items: readonly { key: string; legacyKey?: string }[]) {
    return items.reduce((sum, item) => sum + (getSystemPrompt(item)?.feedbackCount ?? 0), 0);
  }

  function renderSystemLeaf(
    item: { key: string; legacyKey?: string; label: string },
    extraClassName = '',
  ) {
    const prompt = getSystemPrompt(item);
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
            extraClassName,
          )}
        >
          <span className="truncate">{item.label}</span>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {feedbackBadge(prompt.feedbackCount)}
          </div>
        </button>
      </li>
    );
  }

  function renderSections(sections: Section[]) {
    return sections.map((s) => {
      const sectionOpen = openSections[s.sectionKey] ?? true;
      const sectionFeedback =
        s.components.reduce((sum, c) => sum + (c.feedbackCount ?? 0), 0) +
        (s.guidance?.feedbackCount ?? 0);
      return (
        <li key={s.sectionKey}>
          <button
            onClick={() => toggleSection(s.sectionKey)}
            className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm text-foreground hover:bg-accent"
          >
            {sectionOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className="truncate">{s.sectionName}</span>
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {!sectionOpen && feedbackBadge(sectionFeedback)}
            </div>
          </button>
          {sectionOpen && (
            <ul className="ml-3 space-y-0.5">
              {s.guidance && (() => {
                const g = s.guidance!;
                const active = selectedKey === g.promptKey;
                return (
                  <li key={g.promptKey}>
                    <button
                      onClick={() => onSelect(g.promptKey)}
                      data-testid="prompt-tree-leaf"
                      data-prompt-key={g.promptKey}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors',
                        active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent',
                      )}
                    >
                      <span className="truncate">Guidance</span>
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
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
                      data-testid="prompt-tree-leaf"
                      data-prompt-key={c.promptKey}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors',
                        active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent',
                      )}
                    >
                      <span className="truncate">{c.displayName}</span>
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
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
    });
  }

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
    setOpenPages((prev) => ({ ...prev, [page]: !(prev[page] ?? false) }));
  }
  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  }

  return (
    <Card data-testid="prompt-tree" className="h-full">
      <CardContent className="h-full overflow-y-auto p-2">
        {/* System group */}
        <div className="px-2 pt-1 pb-1.5 text-sm font-bold text-blue-700">
          System Prompt
        </div>
        <ul className="space-y-0.5">
          <li key="__system_finance__">
            <button
              onClick={() => setOpenSystemFinance((v) => !v)}
              data-testid="prompt-tree-system-group"
              data-system-group="finance"
              className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              {openSystemFinance ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="font-medium truncate">Finance</span>
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                {!openSystemFinance && feedbackBadge(systemFeedback(SYSTEM_PROMPT_GROUPS.finance))}
              </div>
            </button>
            {openSystemFinance && (
              <ul className="ml-4 mt-0.5 space-y-0.5">
                {SYSTEM_PROMPT_GROUPS.finance.map((item) => renderSystemLeaf(item))}
              </ul>
            )}
          </li>

          <li key="__system_hr__">
            <button
              onClick={() => setOpenSystemHr((v) => !v)}
              data-testid="prompt-tree-system-group"
              data-system-group="hr"
              className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              {openSystemHr ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="font-medium truncate">HR</span>
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                {!openSystemHr && feedbackBadge(systemFeedback(SYSTEM_PROMPT_GROUPS.hr))}
              </div>
            </button>
            {openSystemHr && (
              <ul className="ml-4 mt-0.5 space-y-0.5">
                {SYSTEM_PROMPT_GROUPS.hr.map((item) => renderSystemLeaf(item))}
              </ul>
            )}
          </li>

          {SYSTEM_PROMPT_GROUPS.standalone.map((item) => renderSystemLeaf(item))}
        </ul>

        {/* Pages */}
        <div className="mt-3 px-2 pb-1.5 text-sm font-bold text-blue-700">
          User Prompt
        </div>
        <ul className="space-y-0.5">
          {/* Finance top-level group */}
          {financePages.length > 0 && (() => {
            const financeFeedback = financePages.reduce(
              (sum, p) =>
                sum +
                p.sections.reduce(
                  (s2, s) =>
                    s2 +
                    s.components.reduce((ss, c) => ss + (c.feedbackCount ?? 0), 0) +
                    (s.guidance?.feedbackCount ?? 0),
                  0,
                ),
              0,
            );
            return (
              <li key="__finance__">
                <button
                  onClick={() => setOpenFinance((v) => !v)}
                  data-testid="prompt-tree-page"
                  data-page="finance"
                  className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  {openFinance ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="font-medium truncate">Finance</span>
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    {!openFinance && feedbackBadge(financeFeedback)}
                  </div>
                </button>
                {openFinance && (
                  <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                    {financePages.map((p) => {
                      const pageOpen = openPages[p.page] ?? false;
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
                            data-testid="prompt-tree-page"
                            data-page={p.page}
                            className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm hover:bg-accent"
                          >
                            {pageOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            <span className="font-medium truncate">{pageLabel(p.page)}</span>
                            <div className="ml-auto flex items-center gap-1.5 shrink-0">
                              {!pageOpen && feedbackBadge(pageFeedback)}
                            </div>
                          </button>
                          {pageOpen && (
                            <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                              {renderSections(p.sections)}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })()}

          {/* HR top-level group */}
          {hrPage && (() => {
            const hrFeedback = hrPage.sections.reduce(
              (sum, s) =>
                sum +
                s.components.reduce((ss, c) => ss + (c.feedbackCount ?? 0), 0) +
                (s.guidance?.feedbackCount ?? 0),
              0,
            );
            return (
              <li key="__hr__">
                <button
                  onClick={() => setOpenHr((v) => !v)}
                  data-testid="prompt-tree-page"
                  data-page="hr"
                  className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  {openHr ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="font-medium truncate">HR</span>
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    {!openHr && feedbackBadge(hrFeedback)}
                  </div>
                </button>
                {openHr && (
                  <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                    {renderSections(hrPage.sections)}
                  </ul>
                )}
              </li>
            );
          })()}
        </ul>
      </CardContent>
    </Card>
  );
}
