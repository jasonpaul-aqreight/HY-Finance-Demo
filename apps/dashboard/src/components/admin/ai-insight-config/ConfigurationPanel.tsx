'use client';

import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  PromptRowView,
  ThresholdBusinessRangeView,
  ThresholdBusinessRuleView,
  ThresholdBusinessSettingView,
  ThresholdComponentPresentationView,
  ThresholdGroupView,
  ThresholdRangeSegmentView,
  ThresholdTokenView,
  ThresholdValidationConstraintView,
} from './PromptConfigDashboard';

interface Props {
  prompt: PromptRowView | null;
  isAdmin: boolean;
  role: 'admin' | 'viewer';
  onSaved: (prompt: PromptRowView) => void;
}

interface ValidationState {
  tokenErrors: Record<string, string>;
  formErrors: string[];
  values: Record<string, number>;
}

function makeDraft(prompt: PromptRowView | null): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const group of prompt?.thresholdGroups ?? []) {
    for (const token of group.tokens) {
      draft[token.token] = String(token.value);
    }
  }
  return draft;
}

function precisionFromType(valueType: ThresholdTokenView['valueType']) {
  const match = /^decimal\((\d+)\)$/.exec(valueType);
  return match ? Number(match[1]) : 0;
}

function inputStep(token: ThresholdTokenView) {
  if (token.valueType === 'int') return 1;
  return 1 / 10 ** precisionFromType(token.valueType);
}

function settingMap(presentation: ThresholdComponentPresentationView | null | undefined) {
  const map = new Map<string, ThresholdBusinessSettingView>();
  for (const rule of presentation?.rules ?? []) {
    for (const setting of rule.settings) map.set(setting.token, setting);
  }
  return map;
}

function tokenMap(groups: ThresholdGroupView[]) {
  const map = new Map<string, ThresholdTokenView>();
  for (const group of groups) {
    for (const token of group.tokens) map.set(token.token, token);
  }
  return map;
}

function constraintKey(leftToken: string, rightToken: string) {
  return `${leftToken}:${rightToken}`;
}

function relationIsValid(
  relation: ThresholdValidationConstraintView['relation'],
  leftValue: number,
  rightValue: number,
) {
  return relation === 'greaterThan' ? leftValue > rightValue : leftValue < rightValue;
}

function validationLabel(
  token: ThresholdTokenView,
  settingsByToken: Map<string, ThresholdBusinessSettingView>,
) {
  const setting = settingsByToken.get(token.token);
  return setting?.validationLabel ?? setting?.displayLabel.toLowerCase() ?? token.label;
}

function validateDraft(
  groups: ThresholdGroupView[],
  draft: Record<string, string>,
  presentation: ThresholdComponentPresentationView | null | undefined,
): ValidationState {
  const tokenErrors: Record<string, string> = {};
  const formErrors: string[] = [];
  const values: Record<string, number> = {};
  const invalidTokens = new Set<string>();
  const settingsByToken = settingMap(presentation);
  const presentationConstraints = (presentation?.rules ?? []).flatMap((rule) => rule.validationConstraints ?? []);
  const constraintsByPair = new Map(
    presentationConstraints.map((constraint) => [
      constraintKey(constraint.leftToken, constraint.rightToken),
      constraint,
    ]),
  );
  const checkedConstraintKeys = new Set<string>();

  for (const group of groups) {
    for (const token of group.tokens) {
      const raw = draft[token.token];
      const value = Number(raw);
      const label = validationLabel(token, settingsByToken);
      values[token.token] = value;

      if (raw === '' || !Number.isFinite(value)) {
        tokenErrors[token.token] = `The ${label} value must be numeric.`;
        invalidTokens.add(token.token);
        continue;
      }

      if (token.valueType === 'int' && !Number.isInteger(value)) {
        tokenErrors[token.token] = `The ${label} value must be a whole number.`;
        invalidTokens.add(token.token);
        continue;
      }

      if (token.unit === 'pct' && token.min >= 0 && value > 100) {
        tokenErrors[token.token] = `The ${label} value must be 100% or less.`;
        invalidTokens.add(token.token);
        continue;
      }

      if (value < token.min || value > token.max) {
        tokenErrors[token.token] = `The ${label} value must be between ${token.min} and ${token.max}.`;
        invalidTokens.add(token.token);
      }
    }
  }

  for (const group of groups) {
    if (group.enforceMonotonic === false || group.tokens.length < 2) continue;
    for (let i = 0; i < group.tokens.length - 1; i += 1) {
      const left = group.tokens[i];
      const right = group.tokens[i + 1];
      if (invalidTokens.has(left.token) || invalidTokens.has(right.token)) continue;

      const defaultRelation = group.direction === 'ascending' ? 'greaterThan' : 'lessThan';
      const key = constraintKey(left.token, right.token);
      const presentationConstraint = constraintsByPair.get(key);
      const relation = presentationConstraint?.relation ?? defaultRelation;
      checkedConstraintKeys.add(key);

      if (!relationIsValid(relation, values[left.token], values[right.token])) {
        const comparator = defaultRelation === 'greaterThan' ? 'greater than' : 'less than';
        const message =
          presentationConstraint?.message ??
          `${validationLabel(left, settingsByToken)} must be ${comparator} ${validationLabel(right, settingsByToken)}.`;
        formErrors.push(message);
        tokenErrors[left.token] = message;
        tokenErrors[right.token] = message;
      }
    }
  }

  for (const constraint of presentationConstraints) {
    const key = constraintKey(constraint.leftToken, constraint.rightToken);
    if (checkedConstraintKeys.has(key)) continue;
    if (invalidTokens.has(constraint.leftToken) || invalidTokens.has(constraint.rightToken)) continue;
    if (!relationIsValid(constraint.relation, values[constraint.leftToken], values[constraint.rightToken])) {
      formErrors.push(constraint.message);
      tokenErrors[constraint.leftToken] = constraint.message;
      tokenErrors[constraint.rightToken] = constraint.message;
    }
  }

  return { tokenErrors, formErrors, values };
}

function ReadOnlyState({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div
      data-testid="no-configurable-thresholds"
      className="rounded-lg border border-dashed border-slate-400 bg-slate-50 p-4"
    >
      <div className="text-sm font-bold text-slate-950">{title}</div>
      {body && <div className="mt-1 text-sm font-medium text-slate-950">{body}</div>}
    </div>
  );
}

function segmentValue(
  segment: ThresholdRangeSegmentView,
  tokensByName: Map<string, ThresholdTokenView>,
  draft: Record<string, string>,
) {
  if (segment.text) return segment.text;
  if (!segment.token) return '';
  const token = tokensByName.get(segment.token);
  if (!token) return '';

  const rawValue = Number(draft[token.token] ?? token.value);
  const nextValue = rawValue + (segment.offset ?? 0);
  if (token.valueType === 'int') return String(Math.trunc(nextValue));
  return nextValue.toFixed(precisionFromType(token.valueType));
}

function RangeSegment({
  segment,
  tokensByName,
  draft,
  validation,
  disabled,
  saving,
  onChange,
}: {
  segment: ThresholdRangeSegmentView;
  tokensByName: Map<string, ThresholdTokenView>;
  draft: Record<string, string>;
  validation: ValidationState;
  disabled: boolean;
  saving: boolean;
  onChange: (token: ThresholdTokenView, value: string) => void;
}) {
  const token = segment.token ? tokensByName.get(segment.token) : null;

  if (segment.editable && token) {
    const tokenError = validation.tokenErrors[token.token];
    return (
      <input
        id={`threshold-${token.token}`}
        type="number"
        min={token.min}
        max={token.max}
        step={inputStep(token)}
        value={draft[token.token] ?? ''}
        onChange={(event) => onChange(token, event.target.value)}
        disabled={disabled || saving}
        aria-label={token.label}
        aria-invalid={tokenError ? true : undefined}
        data-testid={`threshold-input-${token.token}`}
        className={`mx-1 inline-flex h-7 w-16 rounded-lg border bg-background px-2 text-center font-semibold outline-none transition-colors focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 ${
          tokenError
            ? 'border-red-600 focus-visible:ring-red-200'
            : 'border-input focus-visible:border-ring focus-visible:ring-ring/50'
        }`}
      />
    );
  }

  return <span className="mx-0.5 inline-flex min-w-5 justify-center">{segmentValue(segment, tokensByName, draft)}</span>;
}

function BusinessRangeTable({
  ranges,
  tokensByName,
  draft,
  validation,
  disabled,
  saving,
  onChange,
}: {
  ranges: ThresholdBusinessRangeView[];
  tokensByName: Map<string, ThresholdTokenView>;
  draft: Record<string, string>;
  validation: ValidationState;
  disabled: boolean;
  saving: boolean;
  onChange: (token: ThresholdTokenView, value: string) => void;
}) {
  return (
    <div className="mt-4 space-y-1">
      {ranges.map((range) => (
        <div
          key={`${range.label}-${range.unit}`}
          className="grid grid-cols-[minmax(8rem,1fr)_minmax(10rem,max-content)_auto] items-center gap-2 text-sm font-medium text-foreground"
        >
          <div className="font-semibold">{range.label}</div>
          <div className="flex min-h-8 flex-nowrap items-center justify-self-end whitespace-nowrap">
            {range.segments.map((segment, index) => (
              <RangeSegment
                key={`${range.label}-${index}`}
                segment={segment}
                tokensByName={tokensByName}
                draft={draft}
                validation={validation}
                disabled={disabled}
                saving={saving}
                onChange={onChange}
              />
            ))}
          </div>
          <div className="justify-self-end whitespace-nowrap font-medium">{range.unit}</div>
        </div>
      ))}
    </div>
  );
}

function BusinessRuleCard({
  rule,
  tokensByName,
  draft,
  validation,
  disabled,
  saving,
  onChange,
}: {
  rule: ThresholdBusinessRuleView;
  tokensByName: Map<string, ThresholdTokenView>;
  draft: Record<string, string>;
  validation: ValidationState;
  disabled: boolean;
  saving: boolean;
  onChange: (token: ThresholdTokenView, value: string) => void;
}) {
  const ruleErrors = Array.from(new Set(
    rule.settings
      .map((setting) => validation.tokenErrors[setting.token])
      .filter((error): error is string => Boolean(error)),
  ));

  return (
    <div
      data-testid="threshold-business-rule"
      data-business-rule={rule.id}
      className="border-b border-border px-4 py-4"
    >
      <h3 className="text-base font-bold text-foreground">{rule.title}</h3>
      {rule.ranges && (
        <BusinessRangeTable
          ranges={rule.ranges}
          tokensByName={tokensByName}
          draft={draft}
          validation={validation}
          disabled={disabled}
          saving={saving}
          onChange={onChange}
        />
      )}
      {ruleErrors.map((error) => (
        <div
          key={error}
          className="mt-3 text-sm font-semibold text-red-700"
          data-testid="threshold-validation-error"
        >
          {error}
        </div>
      ))}
    </div>
  );
}

export function ConfigurationPanel({ prompt, isAdmin, role, onSaved }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>(() => makeDraft(prompt));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const groups = useMemo(() => prompt?.thresholdGroups ?? [], [prompt]);
  const presentation = prompt?.thresholdPresentation ?? null;
  const tokensByName = useMemo(() => tokenMap(groups), [groups]);
  const hasRuntimeConfig = prompt?.category === 'component' && groups.length > 0;
  const hasClientReadyConfig = hasRuntimeConfig && Boolean(presentation?.rules.length);

  useEffect(() => {
    setDraft(makeDraft(prompt));
    setSaveError(null);
  }, [prompt]);

  const validation = useMemo(
    () => validateDraft(groups, draft, presentation),
    [groups, draft, presentation],
  );
  const dirty = useMemo(() => {
    for (const group of groups) {
      for (const token of group.tokens) {
        if (Number(draft[token.token]) !== token.value) return true;
      }
    }
    return false;
  }, [groups, draft]);
  const valid = Object.keys(validation.tokenErrors).length === 0 && validation.formErrors.length === 0;
  const canSave = hasClientReadyConfig && isAdmin && dirty && valid && !saving;

  function setTokenValue(token: ThresholdTokenView, value: string) {
    setDraft((current) => ({ ...current, [token.token]: value }));
  }

  async function saveValues() {
    if (!prompt || !canSave) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/admin/ai-insight-thresholds', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role,
        },
        body: JSON.stringify({
          componentKey: prompt.promptKey,
          values: validation.values,
          updatedBy: 'Admin',
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        const details = Array.isArray(body?.details) ? body.details.join(' ') : body?.error;
        throw new Error(details || `Save failed with status ${res.status}`);
      }

      onSaved(body.prompt as PromptRowView);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save values.');
    } finally {
      setSaving(false);
    }
  }

  function resetValues() {
    setDraft(makeDraft(prompt));
    setSaveError(null);
  }

  if (!prompt) {
    return (
      <section
        data-testid="configuration-panel"
        className="flex h-full min-h-[18rem] items-center justify-center rounded-lg border border-border bg-background p-6 text-sm font-medium text-foreground"
      >
        Select a prompt to view configuration.
      </section>
    );
  }

  return (
    <section
      data-testid="configuration-panel"
      className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-background"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Business Rule</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetValues}
            disabled={!dirty || saving || !hasClientReadyConfig}
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={saveValues}
            disabled={!canSave}
            data-testid="threshold-save-button"
          >
            <Save className="size-3.5" />
            {saving ? 'Saving' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {!hasRuntimeConfig ? (
          <ReadOnlyState
            title={
              prompt.category === 'system'
                ? 'AI instruction is read-only'
                : 'This prompt does not have business threshold settings'
            }
            body={prompt.category === 'system' ? 'System prompts can be reviewed in the AI Prompt Preview.' : undefined}
          />
        ) : !hasClientReadyConfig || !presentation ? (
          <ReadOnlyState
            title="Business settings for this prompt are not client-ready yet"
            body="This session only exposes approved business-rule settings. The runtime prompt remains available in the AI Prompt Preview."
          />
        ) : (
          <div>
            {presentation.rules.length > 1 && (
              <h3 className="border-b border-border px-4 pb-3 text-base font-bold text-foreground">
                {presentation.title}
              </h3>
            )}
            {presentation.rules.map((rule) => (
              <BusinessRuleCard
                key={rule.id}
                rule={rule}
                tokensByName={tokensByName}
                draft={draft}
                validation={validation}
                disabled={!isAdmin}
                saving={saving}
                onChange={setTokenValue}
              />
            ))}

            {validation.formErrors.length > 0 && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">
                {validation.formErrors[0]}
              </div>
            )}
            {saveError && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">
                {saveError}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
