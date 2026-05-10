'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ShieldAlert } from 'lucide-react';
import { PromptTree } from './PromptTree';
import { PromptEditor } from './PromptEditor';
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
  // Phase 2 transitional: backend no longer emits these. Phase 3 (task 3.5)
  // removes the modified-dot rendering in PromptTree.tsx along with these
  // optional fields. Runtime value is always undefined → falsy → no dot.
  isModified?: boolean;
  defaultText?: string | null;
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
  const fallbackKey = prompts.find((p) => p.promptKey === 'global_system')?.promptKey ?? prompts[0]?.promptKey ?? null;
  const activeKey = prompts.some((p) => p.promptKey === selectedKey) ? selectedKey : fallbackKey;

  const selected = useMemo(
    () => prompts.find((p) => p.promptKey === activeKey) ?? null,
    [prompts, activeKey],
  );

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          Failed to load prompts: {error.message}
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="text-foreground">Loading prompts…</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">
      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <ShieldAlert className="size-4 shrink-0" />
          Admin only — Save and Reset are hidden.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-4 lg:items-start">
        <PromptTree
          prompts={prompts}
          selectedKey={activeKey}
          onSelect={setSelectedKey}
        />
        <PromptEditor
          prompt={selected}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
