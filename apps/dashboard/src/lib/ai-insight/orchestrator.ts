import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, AI_MODEL, SUMMARY_MODEL, MAX_TOKENS, estimateCost, LOG_PROMPTS } from './client';
import {
  getGlobalSystemPrompt,
  getSummarySystemPrompt,
  buildComponentUserPrompt,
  buildSummaryUserPrompt,
  SECTION_COMPONENTS,
} from './prompts';
import { executeToolCall } from './tools';
import { toolsForSection, validateToolForSection } from './tool-policy';
import { runNumericGuard, formatGuardError, extractNumbers } from './numeric-guard';
import { fetchComponentData } from './data-fetcher';
import {
  initDebugSession,
  logComponentStart,
  logApiResponse,
  logToolResult,
  logComponentEnd,
  logSummaryStart,
  logSummaryResponse,
  logNumericGuard,
  logSessionEnd,
} from './debug-logger';
import type { SectionKey, DateRange, FiscalPeriod, ComponentResult, SummaryJson, SummaryInsight, ComponentType, AllowedValue } from './types';

const MAX_CONCURRENCY = 2; // Keep low to avoid rate limits on lower-tier API plans
const MAX_TOOL_CALLS_PER_SUMMARY = 2; // Summary can drill down for root causes
const MAX_COST_PER_SECTION = 0.50;
const MAX_RUNTIME_MS = 5 * 60 * 1000; // 5 minutes
const SUMMARY_MAX_TOKENS = 4096; // Summary needs more tokens for tool reasoning + formatted output
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY_MS = 15_000; // 15s base backoff for rate limits

export interface ProgressCallback {
  (component: string, status: 'analyzing' | 'complete' | 'error', message?: string): void;
}

export interface AnalysisResult {
  components: ComponentResult[];
  summary: SummaryJson;
  totalTokens: number;
  totalCost: number;
}

export async function runSectionAnalysis(
  sectionKey: SectionKey,
  dateRange: DateRange | null,
  abortController: AbortController,
  onProgress: ProgressCallback,
  fiscalPeriod: FiscalPeriod | null = null,
): Promise<AnalysisResult> {
  const components = SECTION_COMPONENTS[sectionKey];
  if (!components) throw new Error(`Unknown section: ${sectionKey}`);

  const logFile = initDebugSession(
    sectionKey,
    AI_MODEL,
    dateRange ? { start: dateRange.start, end: dateRange.end } : null,
  );

  const abortSignal = abortController.signal;
  let totalTokens = 0;
  let totalCost = 0;
  let timedOut = false;

  // Set up timeout — abort the controller so all in-flight calls cancel
  const timeoutId = setTimeout(() => {
    if (!abortSignal.aborted) {
      timedOut = true;
      abortController.abort();
    }
  }, MAX_RUNTIME_MS);

  try {
    // Step 1: Run parallel component analyses with concurrency pool
    const componentResults: ComponentResult[] = [];
    const queue = [...components];
    const running = new Set<Promise<void>>();

    const processComponent = async (comp: typeof components[0]) => {
      if (abortSignal.aborted) return;

      onProgress(comp.key, 'analyzing');

      try {
        const result = await analyzeComponent(comp.key, comp.name, comp.type, sectionKey, dateRange, abortSignal, logFile, fiscalPeriod);
        componentResults.push(result);
        totalTokens += result.token_count;
        totalCost += estimateCost(result.input_tokens, result.output_tokens);

        if (totalCost > MAX_COST_PER_SECTION) {
          throw new Error(`Cost limit exceeded: $${totalCost.toFixed(4)} > $${MAX_COST_PER_SECTION}`);
        }

        onProgress(comp.key, 'complete');
      } catch (err) {
        if (abortSignal.aborted) return;
        onProgress(comp.key, 'error', err instanceof Error ? err.message : String(err));
        throw err;
      }
    };

    while (queue.length > 0 || running.size > 0) {
      if (abortSignal.aborted) throw new Error(timedOut ? 'Analysis timed out. Please try again.' : 'Analysis cancelled');

      // Fill up to MAX_CONCURRENCY
      while (queue.length > 0 && running.size < MAX_CONCURRENCY) {
        const comp = queue.shift()!;
        const promise = processComponent(comp).then(() => {
          running.delete(promise);
        });
        running.add(promise);
      }

      // Wait for at least one to finish
      if (running.size > 0) {
        await Promise.race(running);
      }
    }

    if (abortSignal.aborted) throw new Error(timedOut ? 'Analysis timed out. Please try again.' : 'Analysis cancelled');

    // Step 2: Run summary analysis
    onProgress('summary', 'analyzing');
    const summary = await runSummaryAnalysis(sectionKey, dateRange, componentResults, abortSignal, logFile, fiscalPeriod);
    totalTokens += summary.tokenCount;
    totalCost += estimateCost(summary.inputTokens, summary.outputTokens, SUMMARY_MODEL);
    onProgress('summary', 'complete');

    logSessionEnd(logFile, totalTokens, totalCost, componentResults.length);

    return {
      components: componentResults,
      summary: summary.json,
      totalTokens,
      totalCost,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Rate-limit-aware API call wrapper ───────────────────────────────────────

async function callWithRetry(
  fn: () => Promise<Anthropic.Message>,
  abortSignal: AbortSignal,
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    if (abortSignal.aborted) throw new Error('Analysis aborted');
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = (err instanceof Anthropic.RateLimitError) ||
        (err instanceof Error && (err.message.includes('429') || err.message.includes('rate_limit')));
      if (!isRateLimit || attempt === RATE_LIMIT_RETRIES) throw err;

      const delay = RATE_LIMIT_BASE_DELAY_MS * (attempt + 1);
      console.log(`Rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${RATE_LIMIT_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Exhausted rate limit retries');
}

// ─── Single component analysis ───────────────────────────────────────────────

async function analyzeComponent(
  componentKey: string,
  componentName: string,
  componentType: ComponentType,
  sectionKey: SectionKey,
  dateRange: DateRange | null,
  abortSignal: AbortSignal,
  logFile: string | null,
  fiscalPeriod: FiscalPeriod | null = null,
): Promise<ComponentResult> {
  const client = getAnthropicClient();

  // Fetch dashboard data for this component
  const { prompt: formattedValues, allowed } = await fetchComponentData(componentKey, sectionKey, dateRange, fiscalPeriod);

  const systemPrompt = getGlobalSystemPrompt();
  const userPrompt = buildComponentUserPrompt({
    componentKey,
    sectionKey,
    componentName,
    componentType,
    dateRange,
    fiscalPeriod,
    formattedValues,
  });

  if (LOG_PROMPTS) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📊 COMPONENT: ${componentName} (${componentKey})`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`SYSTEM PROMPT:\n${systemPrompt}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`USER PROMPT:\n${userPrompt}`);
    console.log(`${'═'.repeat(80)}\n`);
  }

  logComponentStart(logFile, componentKey, componentName, systemPrompt, userPrompt);

  if (abortSignal.aborted) throw new Error('Analysis aborted');

  // Single LLM call — no tools. Components narrate/interpret the pre-fetched data.
  const response = await callWithRetry(
    () => client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    abortSignal,
  );

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  logApiResponse(logFile, 1, response, AI_MODEL);

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  const analysis = textBlock?.text ?? 'No analysis generated.';
  logComponentEnd(logFile, componentKey, analysis, inputTokens, outputTokens, 0, AI_MODEL);

  return {
    component_key: componentKey,
    component_type: componentType,
    raw_data_md: formattedValues,
    analysis_md: analysis,
    allowed,
    token_count: inputTokens + outputTokens,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  };
}

// ─── Summary analysis ────────────────────────────────────────────────────────

async function runSummaryAnalysis(
  sectionKey: SectionKey,
  dateRange: DateRange | null,
  componentResults: ComponentResult[],
  abortSignal: AbortSignal,
  logFile: string | null,
  fiscalPeriod: FiscalPeriod | null = null,
): Promise<{ json: SummaryJson; tokenCount: number; inputTokens: number; outputTokens: number }> {
  if (abortSignal.aborted) throw new Error('Analysis aborted');

  const client = getAnthropicClient();
  const components = SECTION_COMPONENTS[sectionKey];

  const systemPrompt = getSummarySystemPrompt();
  const userPrompt = buildSummaryUserPrompt({
    sectionKey,
    dateRange,
    fiscalPeriod,
    componentResults: componentResults.map(cr => {
      const compDef = components.find(c => c.key === cr.component_key);
      return {
        name: compDef?.name ?? cr.component_key,
        type: compDef?.type ?? cr.component_type,
        rawData: cr.raw_data_md,
      };
    }),
  });

  if (LOG_PROMPTS) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📋 SUMMARY GENERATION: ${sectionKey}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`SYSTEM PROMPT:\n${systemPrompt}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`USER PROMPT:\n${userPrompt}`);
    console.log(`${'═'.repeat(80)}\n`);
  }

  logSummaryStart(logFile, sectionKey, systemPrompt, userPrompt, SUMMARY_MODEL);

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userPrompt },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const sectionTools = toolsForSection(sectionKey);
  const toolsAllowed = sectionTools.length > 0;

  // Aggregate every fetcher's allowed values into one whitelist for the guard.
  const allAllowed: AllowedValue[] = componentResults.flatMap(c => c.allowed ?? []);

  const MAX_GUARD_ATTEMPTS = 2;
  let attempt = 0;
  let lastText = '';
  let parsed: ReturnType<typeof parseSummaryResponse> | null = null;
  let unmatched: ReturnType<typeof runNumericGuard>['unmatched'] = [];

  while (attempt < MAX_GUARD_ATTEMPTS) {
    attempt++;
    if (abortSignal.aborted) throw new Error('Analysis aborted');

    const loopResult = await runSummaryAgentLoop({
      client,
      sectionKey,
      messages,
      systemPrompt,
      sectionTools,
      toolsAllowed,
      abortSignal,
      logFile,
    });

    totalInputTokens += loopResult.inputTokens;
    totalOutputTokens += loopResult.outputTokens;
    lastText = loopResult.textBlock?.text ?? '';

    parsed = parseSummaryResponse(
      loopResult.textBlock,
      totalInputTokens + totalOutputTokens,
      totalInputTokens,
      totalOutputTokens,
    );

    // Whitelist any number that appeared in a tool_result this attempt — it's
    // ground truth pulled live from the DB and the LLM is allowed to cite it.
    for (const trText of loopResult.toolResultTexts) {
      for (const f of extractNumbers(trText)) {
        allAllowed.push({ label: `tool result: ${f.raw}`, value: f.value, unit: f.unit });
      }
    }

    const guard = runNumericGuard(lastText, allAllowed);
    unmatched = guard.unmatched;
    logNumericGuard(logFile, attempt, guard.ok, unmatched.map(u => ({ raw: u.raw, value: u.value, unit: u.unit })));

    if (guard.ok) break;

    // Flag and reject on final attempt; otherwise issue corrective and retry.
    if (attempt >= MAX_GUARD_ATTEMPTS) break;

    messages.push({ role: 'assistant', content: lastText });
    messages.push({ role: 'user', content: formatGuardError(guard.unmatched) });
  }

  if (!parsed) {
    parsed = parseSummaryResponse(undefined, 0, 0, 0);
  }

  parsed.json.numericGuard = {
    passed: unmatched.length === 0,
    attempts: attempt,
    unmatched: unmatched.map(u => ({ raw: u.raw, value: u.value, unit: u.unit })),
  };

  return {
    json: parsed.json,
    tokenCount: totalInputTokens + totalOutputTokens,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}

// ─── Inner agent loop (one summary attempt, with tool use) ───────────────────

interface AgentLoopParams {
  client: Anthropic;
  sectionKey: SectionKey;
  messages: Anthropic.MessageParam[];
  systemPrompt: string;
  sectionTools: Anthropic.Tool[];
  toolsAllowed: boolean;
  abortSignal: AbortSignal;
  logFile: string | null;
}

interface AgentLoopResult {
  textBlock: Anthropic.TextBlock | undefined;
  inputTokens: number;
  outputTokens: number;
  toolResultTexts: string[];
}

async function runSummaryAgentLoop(p: AgentLoopParams): Promise<AgentLoopResult> {
  let inputTokens = 0;
  let outputTokens = 0;
  let toolCallCount = 0;
  let turnNumber = 0;
  const toolResultTexts: string[] = [];

  while (true) {
    if (p.abortSignal.aborted) throw new Error('Analysis aborted');

    turnNumber++;
    const isLastTurn = toolCallCount >= MAX_TOOL_CALLS_PER_SUMMARY;
    const includeTools = p.toolsAllowed && !isLastTurn;

    const response = await callWithRetry(
      () => p.client.messages.create({
        model: SUMMARY_MODEL,
        max_tokens: SUMMARY_MAX_TOKENS,
        system: p.systemPrompt,
        ...(includeTools ? { tools: p.sectionTools } : {}),
        messages: p.messages,
      }),
      p.abortSignal,
    );

    inputTokens += response.usage?.input_tokens ?? 0;
    outputTokens += response.usage?.output_tokens ?? 0;
    logApiResponse(p.logFile, turnNumber, response, SUMMARY_MODEL);

    const finalize = (): AgentLoopResult => {
      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      if (LOG_PROMPTS && textBlock) {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`📋 SUMMARY RESPONSE:\n${textBlock.text}`);
        console.log(`${'─'.repeat(80)}\n`);
      }
      logSummaryResponse(p.logFile, response, textBlock?.text ?? '(no text block)');
      return { textBlock, inputTokens, outputTokens, toolResultTexts };
    };

    if (response.stop_reason !== 'tool_use') return finalize();

    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (toolBlocks.length === 0) return finalize();

    p.messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolBlock of toolBlocks) {
      toolCallCount++;
      const policyError = validateToolForSection(
        p.sectionKey,
        toolBlock.name,
        toolBlock.input as { table?: string },
      );
      const result = policyError
        ? policyError
        : await executeToolCall(
            toolBlock.name,
            toolBlock.input as Parameters<typeof executeToolCall>[1],
          );
      logToolResult(p.logFile, turnNumber, toolBlock.name, toolBlock.id, result);
      toolResultTexts.push(result);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: result,
      });
    }
    p.messages.push({ role: 'user', content: toolResults });

    if (toolCallCount >= MAX_TOOL_CALLS_PER_SUMMARY) {
      p.messages.push({
        role: 'user',
        content: 'You have used all available tool calls. Now produce your final summary using the ===INSIGHT=== delimiter format. Do not request more data — work with what you have.',
      });
    }
  }
}

// ─── Summary response parser ────────────────────────────────────────────────

function parseSummaryResponse(
  textBlock: Anthropic.TextBlock | undefined,
  tokenCount: number,
  inputTokens: number,
  outputTokens: number,
): { json: SummaryJson; tokenCount: number; inputTokens: number; outputTokens: number } {
  if (!textBlock) {
    return { json: { good: [], bad: [] }, tokenCount, inputTokens, outputTokens };
  }

  // Parse delimiter-based format: ===INSIGHT=== ... ===END===
  const rawText = textBlock.text;
  const insightBlocks = rawText.split('===INSIGHT===').slice(1); // skip text before first delimiter

  const good: SummaryInsight[] = [];
  const bad: SummaryInsight[] = [];

  for (const block of insightBlocks) {
    const endIdx = block.indexOf('===END===');
    const content = endIdx >= 0 ? block.slice(0, endIdx) : block;

    // Parse header fields (before ---DETAIL---)
    const detailSplit = content.split('---DETAIL---');
    const header = detailSplit[0] ?? '';
    const detail = (detailSplit[1] ?? '').trim();

    const sentimentMatch = header.match(/sentiment:\s*(good|bad)/i);
    const titleMatch = header.match(/title:\s*(.+)/i);
    const metricMatch = header.match(/metric:\s*(.+)/i);
    const summaryMatch = header.match(/summary:\s*(.+)/i);

    const sentiment = sentimentMatch?.[1]?.trim().toLowerCase() ?? 'good';
    const title = titleMatch?.[1]?.trim() ?? 'Insight';
    const metric = metricMatch?.[1]?.trim();
    const summary = summaryMatch?.[1]?.trim();

    const insight: SummaryInsight = { title, detail };
    if (metric) insight.metric = metric;
    if (summary) insight.summary = summary;

    if (sentiment === 'bad') {
      bad.push(insight);
    } else {
      good.push(insight);
    }
  }

  // Fallback: if no insights parsed, try JSON parse (backward compat)
  if (good.length === 0 && bad.length === 0) {
    try {
      let jsonStr = rawText.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      const parsed = JSON.parse(jsonStr) as SummaryJson;
      return {
        json: {
          good: (parsed.good ?? []).slice(0, 3),
          bad: (parsed.bad ?? []).slice(0, 3),
        },
        tokenCount,
        inputTokens,
        outputTokens,
      };
    } catch {
      console.error('Failed to parse summary response:', rawText.slice(0, 500));
      return {
        json: {
          good: [{ title: 'Summary generated', detail: rawText }],
          bad: [],
        },
        tokenCount,
        inputTokens,
        outputTokens,
      };
    }
  }

  return {
    json: {
      good: good.slice(0, 3),
      bad: bad.slice(0, 3),
    },
    tokenCount,
    inputTokens,
    outputTokens,
  };
}
