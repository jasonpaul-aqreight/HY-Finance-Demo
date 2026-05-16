'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ShieldAlert } from 'lucide-react';
import { PromptTree } from './PromptTree';
import { BreadcrumbBar } from './BreadcrumbBar';
import { PromptTextPanel } from './PromptTextPanel';
import { ConfigurationPanel } from './ConfigurationPanel';
import { useRole } from '@/components/layout/RoleProvider';
import { Toast } from '@/components/ai-insight/Toast';

export interface PromptRowView {
  promptKey: string;
  promptText: string;
  renderedPromptText?: string;
  category: 'system' | 'component';
  page: string | null;
  sectionKey: string | null;
  sectionName: string | null;
  componentType: 'kpi' | 'chart' | 'table' | 'breakdown' | null;
  displayName: string;
  sortOrder: number;
  updatedAt: string;
  updatedBy: string | null;
  thresholdGroups?: ThresholdGroupView[];
  thresholdPresentation?: ThresholdComponentPresentationView | null;
}

export interface ThresholdTokenView {
  token: string;
  label: string;
  unit: 'days' | 'pct' | 'RM' | 'count' | 'ratio';
  valueType: 'int' | `decimal(${number})`;
  value: number;
  formattedValue: string;
  min: number;
  max: number;
  description?: string;
}

export interface ThresholdGroupView {
  id: string;
  label: string;
  direction: 'ascending' | 'descending';
  description?: string;
  enforceMonotonic?: boolean;
  tokens: ThresholdTokenView[];
}

export interface ThresholdBusinessSettingView {
  token: string;
  displayLabel: string;
  sentencePrefix: string;
  sentenceSuffix: string;
  helpText?: string;
  validationLabel?: string;
}

export interface ThresholdRangeSegmentView {
  text?: string;
  token?: string;
  offset?: number;
  editable?: boolean;
}

export interface ThresholdBusinessRangeView {
  label: string;
  segments: ThresholdRangeSegmentView[];
  unit: string;
}

export interface ThresholdValidationConstraintView {
  leftToken: string;
  relation: 'greaterThan' | 'lessThan';
  rightToken: string;
  message: string;
}

export interface ThresholdBusinessRuleView {
  id: string;
  title: string;
  description?: string;
  settings: ThresholdBusinessSettingView[];
  ranges?: ThresholdBusinessRangeView[];
  derivedBands?: string[];
  validationConstraints?: ThresholdValidationConstraintView[];
}

export interface ThresholdComponentPresentationView {
  title: string;
  description: string;
  appliesToPromptLabel: string;
  searchAliases?: string[];
  rules: ThresholdBusinessRuleView[];
}

interface PromptConfigResponse {
  prompts: PromptRowView[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
};

export function PromptConfigDashboard() {
  const { role, isAdmin } = useRole();
  const { data, error, isLoading, mutate } = useSWR<PromptConfigResponse>(
    '/api/admin/ai-insight-config',
    fetcher,
    { revalidateOnFocus: false },
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const prompts = useMemo(() => data?.prompts ?? [], [data]);
  const fallbackKey =
    prompts.find((p) => (p.thresholdPresentation?.rules.length ?? 0) > 0)?.promptKey ??
    prompts.find((p) => (p.thresholdGroups?.length ?? 0) > 0)?.promptKey ??
    prompts.find((p) => p.promptKey === 'component_analysis')?.promptKey ??
    prompts.find((p) => p.promptKey === 'global_system')?.promptKey ??
    prompts[0]?.promptKey ??
    null;
  const activeKey = prompts.some((p) => p.promptKey === selectedKey) ? selectedKey : fallbackKey;

  const selected = useMemo(
    () => prompts.find((p) => p.promptKey === activeKey) ?? null,
    [prompts, activeKey],
  );

  function handlePromptSaved(nextPrompt: PromptRowView) {
    void mutate((current) => {
      if (!current) return current;
      return {
        ...current,
        prompts: current.prompts.map((prompt) =>
          prompt.promptKey === nextPrompt.promptKey ? nextPrompt : prompt,
        ),
      };
    }, false);
    setToast('Your values are saved!');
  }

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
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          <ShieldAlert className="size-4 shrink-0" />
          Superadmin/Admin only — switch to Admin role to edit threshold values.
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <PromptTree
          prompts={prompts}
          selectedKey={activeKey}
          onSelect={setSelectedKey}
        />

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
          <BreadcrumbBar prompt={selected} />
          <div className="grid min-h-0 grid-cols-1 gap-2 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.35fr)]">
            <ConfigurationPanel
              prompt={selected}
              isAdmin={isAdmin}
              role={role}
              onSaved={handlePromptSaved}
            />
            <PromptTextPanel prompt={selected} />
          </div>
        </div>
      </div>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
