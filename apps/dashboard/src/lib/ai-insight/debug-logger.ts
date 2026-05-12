import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { estimateCost } from './client';
import type { AiModelResponse } from './model-provider';
import type { AiProviderMetadata } from './types';

export const DEBUG_FILE_ENABLED = process.env.AI_INSIGHT_DEBUG_FILE === 'true';

const DIVIDER = '═'.repeat(80);
const SUB_DIVIDER = '─'.repeat(80);

// ─── Session lifecycle ──────────────────────────────────────────────────────

export function initDebugSession(
  sectionKey: string,
  model: string,
  dateRange: { start: string; end: string } | null,
): string | null {
  if (!DEBUG_FILE_ENABLED) return null;

  const logsDir = path.join(process.cwd(), 'logs');
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logFile = path.join(logsDir, `ai-debug-${sectionKey}-${ts}.log`);

  writeFileSync(logFile, [
    DIVIDER,
    'AI INSIGHT ENGINE — DEBUG LOG',
    DIVIDER,
    `Timestamp  : ${new Date().toISOString()}`,
    `Section    : ${sectionKey}`,
    `Model      : ${model}`,
    `Date Range : ${dateRange ? `${dateRange.start} → ${dateRange.end}` : 'snapshot (all data)'}`,
    DIVIDER,
    '',
  ].join('\n'));

  return logFile;
}

// ─── Component-level logging ────────────────────────────────────────────────

export function logComponentStart(
  logFile: string | null,
  componentKey: string,
  componentName: string,
  systemPrompt: string,
  userPrompt: string,
) {
  if (!logFile) return;
  append(logFile, [
    '',
    DIVIDER,
    `COMPONENT: ${componentName} (${componentKey})`,
    `Started at : ${new Date().toISOString()}`,
    DIVIDER,
    '',
    `${SUB_DIVIDER}`,
    'TURN 0 — Initial Request',
    `${SUB_DIVIDER}`,
    '',
    '[SYSTEM PROMPT]',
    systemPrompt,
    '',
    '[USER PROMPT]',
    userPrompt,
    '',
  ]);
}

export function logApiResponse(
  logFile: string | null,
  turnNumber: number,
  response: AiModelResponse,
  model?: string,
) {
  if (!logFile) return;

  const usage = response.usage;
  const inputTokens = usage.inputTokens;
  const outputTokens = usage.outputTokens;
  const cacheCreation = usage.cacheCreationInputTokens ?? 0;
  const cacheRead = usage.cacheReadInputTokens ?? 0;
  const cost = usage.costUsd ?? estimateCost(inputTokens, outputTokens, model);

  const lines: string[] = [
    `${SUB_DIVIDER}`,
    `TURN ${turnNumber} — ${response.providerMeta.providerLabel} Response`,
    `${SUB_DIVIDER}`,
    `sdk        : ${response.providerMeta.providerLabel}`,
    `model      : ${response.model}`,
    ...(response.providerMeta.requestedModel && response.providerMeta.requestedModel !== response.model
      ? [`requested  : ${response.providerMeta.requestedModel}`]
      : []),
    ...(response.providerMeta.upstreamProvider ? [`route      : ${response.providerMeta.upstreamProvider}`] : []),
    ...(response.providerMeta.providerOrder?.length
      ? [`order      : ${response.providerMeta.providerOrder.join(' -> ')}`]
      : []),
    ...(response.providerMeta.providerFallbackPath?.length
      ? [`providers  : ${response.providerMeta.providerFallbackPath.join(' -> ')}`]
      : []),
    ...(response.providerMeta.modelFallbackPath?.length
      ? [`models     : ${response.providerMeta.modelFallbackPath.join(' -> ')}`]
      : []),
    ...(response.providerMeta.fallbackReason ? [`fallback   : ${response.providerMeta.fallbackReason}`] : []),
    `stop_reason: ${response.stopReason}`,
    `tokens     : input=${inputTokens}, output=${outputTokens}, total=${inputTokens + outputTokens}`,
    `cache      : created=${cacheCreation}, read=${cacheRead}`,
    ...(usage.reasoningTokens !== undefined ? [`reasoning  : ${usage.reasoningTokens}`] : []),
    `cost       : $${cost.toFixed(6)} (${usage.costSource})`,
    '',
  ];

  for (const block of response.content) {
    if (block.type === 'text') {
      lines.push('[TEXT]', block.text, '');
    } else if (block.type === 'tool_use') {
      lines.push(
        `[TOOL_USE] id=${block.id}`,
        `  tool : ${block.name}`,
        `  input: ${JSON.stringify(block.input, null, 2)}`,
        '',
      );
    }
  }

  append(logFile, lines);
}

export function logToolResult(
  logFile: string | null,
  turnNumber: number,
  toolName: string,
  toolId: string,
  result: string,
) {
  if (!logFile) return;

  // Truncate very large results for readability (keep first 3000 chars)
  const displayResult = result.length > 3000
    ? result.slice(0, 3000) + `\n... (truncated, ${result.length} total chars)`
    : result;

  append(logFile, [
    `[TOOL_RESULT] turn=${turnNumber}, id=${toolId}`,
    `  tool  : ${toolName}`,
    `  result:`,
    displayResult,
    '',
  ]);
}

export function logComponentEnd(
  logFile: string | null,
  componentKey: string,
  finalAnalysis: string,
  inputTokens: number,
  outputTokens: number,
  toolCallCount: number,
  model?: string,
  providerMeta?: AiProviderMetadata,
  costUsd?: number,
) {
  if (!logFile) return;
  const cost = costUsd ?? estimateCost(inputTokens, outputTokens, model);
  append(logFile, [
    `${SUB_DIVIDER}`,
    `COMPONENT COMPLETE: ${componentKey}`,
    `${SUB_DIVIDER}`,
    `Finished at: ${new Date().toISOString()}`,
    ...(providerMeta ? [`SDK       : ${providerMeta.providerLabel}`, `Model     : ${providerMeta.model}`] : []),
    ...(providerMeta?.requestedModel && providerMeta.requestedModel !== providerMeta.model ? [`Requested : ${providerMeta.requestedModel}`] : []),
    ...(providerMeta?.upstreamProvider ? [`Route     : ${providerMeta.upstreamProvider}`] : []),
    ...(providerMeta?.providerOrder?.length ? [`Order     : ${providerMeta.providerOrder.join(' -> ')}`] : []),
    ...(providerMeta?.providerFallbackPath?.length ? [`Providers : ${providerMeta.providerFallbackPath.join(' -> ')}`] : []),
    ...(providerMeta?.modelFallbackPath?.length ? [`Models    : ${providerMeta.modelFallbackPath.join(' -> ')}`] : []),
    ...(providerMeta?.fallbackReason ? [`Fallback  : ${providerMeta.fallbackReason}`] : []),
    `Tool calls : ${toolCallCount}`,
    `Tokens     : input=${inputTokens}, output=${outputTokens}, total=${inputTokens + outputTokens}`,
    `Cost       : $${cost.toFixed(6)}${providerMeta ? ` (${providerMeta.costSource})` : ''}`,
    '',
    '[FINAL ANALYSIS]',
    finalAnalysis,
    '',
    DIVIDER,
    '',
  ]);
}

// ─── Summary-level logging ──────────────────────────────────────────────────

export function logSummaryStart(
  logFile: string | null,
  sectionKey: string,
  systemPrompt: string,
  userPrompt: string,
  summaryModel?: string,
) {
  if (!logFile) return;
  append(logFile, [
    '',
    DIVIDER,
    `SUMMARY GENERATION: ${sectionKey}`,
    ...(summaryModel ? [`Summary Model: ${summaryModel}`] : []),
    `Started at : ${new Date().toISOString()}`,
    DIVIDER,
    '',
    '[SYSTEM PROMPT]',
    systemPrompt,
    '',
    '[USER PROMPT]',
    userPrompt,
    '',
  ]);
}

export function logSummaryResponse(
  logFile: string | null,
  response: AiModelResponse,
  parsedText: string,
) {
  if (!logFile) return;

  const usage = response.usage;
  const cacheCreation = usage.cacheCreationInputTokens ?? 0;
  const cacheRead = usage.cacheReadInputTokens ?? 0;

  append(logFile, [
    `${SUB_DIVIDER}`,
    'SUMMARY RESPONSE',
    `${SUB_DIVIDER}`,
    `sdk    : ${response.providerMeta.providerLabel}`,
    `model  : ${response.model}`,
    ...(response.providerMeta.requestedModel && response.providerMeta.requestedModel !== response.model
      ? [`request: ${response.providerMeta.requestedModel}`]
      : []),
    ...(response.providerMeta.upstreamProvider ? [`route  : ${response.providerMeta.upstreamProvider}`] : []),
    ...(response.providerMeta.providerOrder?.length ? [`order  : ${response.providerMeta.providerOrder.join(' -> ')}`] : []),
    ...(response.providerMeta.providerFallbackPath?.length ? [`routes : ${response.providerMeta.providerFallbackPath.join(' -> ')}`] : []),
    ...(response.providerMeta.modelFallbackPath?.length ? [`models : ${response.providerMeta.modelFallbackPath.join(' -> ')}`] : []),
    ...(response.providerMeta.fallbackReason ? [`fallback: ${response.providerMeta.fallbackReason}`] : []),
    `tokens : input=${usage.inputTokens}, output=${usage.outputTokens}`,
    `cache  : created=${cacheCreation}, read=${cacheRead}`,
    ...(usage.reasoningTokens !== undefined ? [`reasoning: ${usage.reasoningTokens}`] : []),
    `cost   : $${usage.costUsd.toFixed(6)} (${usage.costSource})`,
    '',
    '[RAW RESPONSE]',
    parsedText,
    '',
    DIVIDER,
    '',
  ]);
}

// ─── Numeric guard logging ──────────────────────────────────────────────────

export function logNumericGuard(
  logFile: string | null,
  attempt: number,
  passed: boolean,
  unmatched: { raw: string; value: number; unit: string }[],
) {
  if (!logFile) return;
  append(logFile, [
    `${SUB_DIVIDER}`,
    `NUMERIC GUARD — Attempt ${attempt}`,
    `${SUB_DIVIDER}`,
    `Passed    : ${passed}`,
    `Unmatched : ${unmatched.length}`,
    ...(unmatched.length > 0 ? unmatched.map(u => `  - "${u.raw}" (${u.value} ${u.unit})`) : []),
    '',
  ]);
}

// ─── Session end ────────────────────────────────────────────────────────────

export function logSessionEnd(
  logFile: string | null,
  totalTokens: number,
  totalCost: number,
  componentCount: number,
  providerMeta?: AiProviderMetadata,
) {
  if (!logFile) return;
  append(logFile, [
    '',
    DIVIDER,
    'SESSION COMPLETE',
    DIVIDER,
    `Components analyzed : ${componentCount}`,
    ...(providerMeta ? [
      `Summary SDK         : ${providerMeta.providerLabel}`,
      `Summary model       : ${providerMeta.model}`,
      ...(providerMeta.requestedModel && providerMeta.requestedModel !== providerMeta.model ? [`Requested model     : ${providerMeta.requestedModel}`] : []),
      ...(providerMeta.upstreamProvider ? [`Summary route       : ${providerMeta.upstreamProvider}`] : []),
      ...(providerMeta.providerOrder?.length ? [`Provider order      : ${providerMeta.providerOrder.join(' -> ')}`] : []),
      ...(providerMeta.providerFallbackPath?.length ? [`Provider path       : ${providerMeta.providerFallbackPath.join(' -> ')}`] : []),
      ...(providerMeta.modelFallbackPath?.length ? [`Model path          : ${providerMeta.modelFallbackPath.join(' -> ')}`] : []),
      ...(providerMeta.fallbackReason ? [`Fallback reason     : ${providerMeta.fallbackReason}`] : []),
    ] : []),
    `Total tokens        : ${totalTokens}`,
    `Cost                : $${totalCost.toFixed(4)} USD`,
    `Finished at         : ${new Date().toISOString()}`,
    DIVIDER,
  ]);
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function append(logFile: string, lines: string[]) {
  appendFileSync(logFile, lines.join('\n') + '\n');
}
