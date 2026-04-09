import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import type Anthropic from '@anthropic-ai/sdk';

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
  response: Anthropic.Message,
) {
  if (!logFile) return;

  const lines: string[] = [
    `${SUB_DIVIDER}`,
    `TURN ${turnNumber} — Claude Response`,
    `${SUB_DIVIDER}`,
    `stop_reason: ${response.stop_reason}`,
    `tokens: input=${response.usage?.input_tokens ?? 0}, output=${response.usage?.output_tokens ?? 0}`,
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
) {
  if (!logFile) return;
  append(logFile, [
    `${SUB_DIVIDER}`,
    `COMPONENT COMPLETE: ${componentKey}`,
    `${SUB_DIVIDER}`,
    `Tool calls : ${toolCallCount}`,
    `Tokens     : input=${inputTokens}, output=${outputTokens}, total=${inputTokens + outputTokens}`,
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
) {
  if (!logFile) return;
  append(logFile, [
    '',
    DIVIDER,
    `SUMMARY GENERATION: ${sectionKey}`,
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
  response: Anthropic.Message,
  parsedText: string,
) {
  if (!logFile) return;
  append(logFile, [
    `${SUB_DIVIDER}`,
    'SUMMARY RESPONSE',
    `${SUB_DIVIDER}`,
    `tokens: input=${response.usage?.input_tokens ?? 0}, output=${response.usage?.output_tokens ?? 0}`,
    '',
    '[RAW RESPONSE]',
    parsedText,
    '',
    DIVIDER,
    '',
  ]);
}

// ─── Session end ────────────────────────────────────────────────────────────

export function logSessionEnd(
  logFile: string | null,
  totalTokens: number,
  totalCost: number,
  componentCount: number,
) {
  if (!logFile) return;
  append(logFile, [
    '',
    DIVIDER,
    'SESSION COMPLETE',
    DIVIDER,
    `Components analyzed : ${componentCount}`,
    `Total tokens        : ${totalTokens}`,
    `Estimated cost      : $${totalCost.toFixed(4)} USD`,
    `Finished at         : ${new Date().toISOString()}`,
    DIVIDER,
  ]);
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function append(logFile: string, lines: string[]) {
  appendFileSync(logFile, lines.join('\n') + '\n');
}
