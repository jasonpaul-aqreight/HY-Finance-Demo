'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ShieldAlert } from 'lucide-react';
import { PromptTree } from './PromptTree';
import { BreadcrumbBar } from './BreadcrumbBar';
import { PromptTextPanel } from './PromptTextPanel';
import { VersionPanel } from './VersionPanel';
import { FeedbackList } from './FeedbackList';
import { useRole } from '@/components/layout/RoleProvider';

export interface PromptRowView {
  promptKey: string;
  promptText: string;
  selectedVersionId: number | null;
  selectedVersionLabel: string | null;
  category: 'system' | 'component' | 'section_guidance';
  page: string | null;
  sectionKey: string | null;
  sectionName: string | null;
  componentType: 'kpi' | 'chart' | 'table' | 'breakdown' | null;
  displayName: string;
  sortOrder: number;
  updatedAt: string;
  updatedBy: string | null;
  feedbackCount: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
};

export function PromptConfigDashboard() {
  const { isAdmin } = useRole();
  const { data, error, isLoading } = useSWR<{ prompts: PromptRowView[] }>(
    '/api/admin/ai-insight-prompts',
    fetcher,
    { revalidateOnFocus: false },
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const prompts = useMemo(() => data?.prompts ?? [], [data]);
  const fallbackKey =
    prompts.find((p) => p.promptKey === 'component_analysis')?.promptKey ??
    prompts.find((p) => p.promptKey === 'global_system')?.promptKey ??
    prompts[0]?.promptKey ??
    null;
  const activeKey = prompts.some((p) => p.promptKey === selectedKey) ? selectedKey : fallbackKey;

  const selected = useMemo(
    () => prompts.find((p) => p.promptKey === activeKey) ?? null,
    [prompts, activeKey],
  );

  if (error) {
    return (
      <div className="w-full px-6 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          Failed to load prompts: {error.message}
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="w-full px-6 py-6">
        <div className="text-foreground">Loading prompts…</div>
      </div>
    );
  }

  return (
    <div
      data-testid="ai-insight-config-dashboard"
      className="flex h-[calc(100vh-6rem)] w-full flex-col gap-2 px-6 py-4"
    >
      {!isAdmin && (
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <ShieldAlert className="size-4 shrink-0" />
          Admin only — version controls are hidden.
        </div>
      )}

      {/* Outer 2-column grid: tree (fixed width) | right column (fills rest) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <PromptTree
          prompts={prompts}
          selectedKey={activeKey}
          onSelect={setSelectedKey}
        />

        {/* Right column: breadcrumb (auto) | text+versions row (1fr) | feedback (auto) */}
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_minmax(0,18rem)] gap-1">
          <BreadcrumbBar prompt={selected} />

          {/* Middle row: text panel (fills) | version panel (intrinsic) */}
          <div className="grid min-h-0 grid-cols-1 gap-1 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <PromptTextPanel prompt={selected} />
            {selected ? (
              <VersionPanel promptKey={selected.promptKey} />
            ) : (
              <div className="rounded-lg border border-border bg-background p-4 text-sm text-foreground/60">
                Select a prompt to see versions.
              </div>
            )}
          </div>

          {selected && isAdmin ? (
            <FeedbackList
              promptKey={selected.promptKey}
              promptDisplayName={selected.displayName}
            />
          ) : (
            <div className="rounded-lg border border-border bg-background p-4 text-sm text-foreground/60">
              {selected ? 'Admin only.' : 'Select a prompt to see feedback.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
