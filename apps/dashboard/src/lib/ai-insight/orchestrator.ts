import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, AI_MODEL, MAX_TOKENS, estimateCost, LOG_PROMPTS } from './client';
import {
  getComponentSystemPrompt,
  getSummarySystemPrompt,
  buildComponentUserPrompt,
  buildSummaryUserPrompt,
  SECTION_COMPONENTS,
  SECTION_NAMES,
} from './prompts';
import { AI_TOOLS, executeToolCall } from './tools';
import { fetchComponentData } from './data-fetcher';
import type { SectionKey, DateRange, ComponentResult, SummaryJson, SummaryInsight, ComponentType } from './types';

const MAX_CONCURRENCY = 2; // Keep low to avoid rate limits on lower-tier API plans
const MAX_TOOL_CALLS_PER_COMPONENT = 3;
const MAX_COST_PER_SECTION = 0.50;
const MAX_RUNTIME_MS = 5 * 60 * 1000; // 5 minutes
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
): Promise<AnalysisResult> {
  const components = SECTION_COMPONENTS[sectionKey];
  if (!components) throw new Error(`Unknown section: ${sectionKey}`);

  const abortSignal = abortController.signal;
  const startTime = Date.now();
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
        const result = await analyzeComponent(comp.key, comp.name, comp.type, sectionKey, dateRange, abortSignal);
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
    const summary = await runSummaryAnalysis(sectionKey, dateRange, componentResults, abortSignal);
    totalTokens += summary.tokenCount;
    totalCost += estimateCost(summary.inputTokens, summary.outputTokens);
    onProgress('summary', 'complete');

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
): Promise<ComponentResult> {
  const client = getAnthropicClient();

  // Fetch dashboard data for this component
  const formattedValues = await fetchComponentData(componentKey, sectionKey, dateRange);

  const systemPrompt = getComponentSystemPrompt(componentKey);
  const userPrompt = buildComponentUserPrompt({
    sectionKey,
    componentName,
    componentType,
    dateRange,
    formattedValues,
  });

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userPrompt },
  ];

  if (LOG_PROMPTS) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📊 COMPONENT: ${componentName} (${componentKey})`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`SYSTEM PROMPT:\n${systemPrompt}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`USER PROMPT:\n${userPrompt}`);
    console.log(`${'═'.repeat(80)}\n`);
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let toolCallCount = 0;

  // Agent loop: handle tool calls
  while (true) {
    if (abortSignal.aborted) throw new Error('Analysis aborted');

    const response = await callWithRetry(
      () => client.messages.create({
        model: AI_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: AI_TOOLS,
        messages,
      }),
      abortSignal,
    );

    totalInputTokens += response.usage?.input_tokens ?? 0;
    totalOutputTokens += response.usage?.output_tokens ?? 0;

    if (response.stop_reason === 'end_turn' || response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      return {
        component_key: componentKey,
        component_type: componentType,
        analysis_md: textBlock?.text ?? 'No analysis generated.',
        token_count: totalInputTokens + totalOutputTokens,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      };
    }

    // Handle tool use
    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (toolBlocks.length === 0) {
      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      return {
        component_key: componentKey,
        component_type: componentType,
        analysis_md: textBlock?.text ?? 'No analysis generated.',
        token_count: totalInputTokens + totalOutputTokens,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      };
    }

    // Add assistant message with tool use
    messages.push({ role: 'assistant', content: response.content });

    // Execute tools and add results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolBlock of toolBlocks) {
      toolCallCount++;
      const result = await executeToolCall(
        toolBlock.name,
        toolBlock.input as Parameters<typeof executeToolCall>[1],
      );
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: result,
      });
    }

    messages.push({ role: 'user', content: toolResults });

    // If max tool calls reached, make one final call without tools to get concluding analysis
    if (toolCallCount >= MAX_TOOL_CALLS_PER_COMPONENT) {
      if (abortSignal.aborted) throw new Error('Analysis aborted');

      const finalResponse = await callWithRetry(
        () => client.messages.create({
          model: AI_MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          messages,
        }),
        abortSignal,
      );

      totalInputTokens += finalResponse.usage?.input_tokens ?? 0;
      totalOutputTokens += finalResponse.usage?.output_tokens ?? 0;

      const textBlock = finalResponse.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      return {
        component_key: componentKey,
        component_type: componentType,
        analysis_md: textBlock?.text ?? 'No analysis generated.',
        token_count: totalInputTokens + totalOutputTokens,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      };
    }
  }
}

// ─── Summary analysis ────────────────────────────────────────────────────────

async function runSummaryAnalysis(
  sectionKey: SectionKey,
  dateRange: DateRange | null,
  componentResults: ComponentResult[],
  abortSignal: AbortSignal,
): Promise<{ json: SummaryJson; tokenCount: number; inputTokens: number; outputTokens: number }> {
  if (abortSignal.aborted) throw new Error('Analysis aborted');

  const client = getAnthropicClient();
  const components = SECTION_COMPONENTS[sectionKey];

  const userPrompt = buildSummaryUserPrompt({
    sectionKey,
    dateRange,
    componentResults: componentResults.map(cr => {
      const compDef = components.find(c => c.key === cr.component_key);
      return {
        name: compDef?.name ?? cr.component_key,
        type: compDef?.type ?? cr.component_type,
        analysis: cr.analysis_md,
      };
    }),
  });

  if (LOG_PROMPTS) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📋 SUMMARY GENERATION: ${sectionKey}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`SYSTEM PROMPT:\n${getSummarySystemPrompt()}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`USER PROMPT:\n${userPrompt}`);
    console.log(`${'═'.repeat(80)}\n`);
  }

  const response = await callWithRetry(
    () => client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: getSummarySystemPrompt(),
      messages: [{ role: 'user', content: userPrompt }],
    }),
    abortSignal,
  );

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const tokenCount = inputTokens + outputTokens;

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );

  if (LOG_PROMPTS && textBlock) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📋 SUMMARY RESPONSE:\n${textBlock.text}`);
    console.log(`${'─'.repeat(80)}\n`);
  }

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

    const sentiment = sentimentMatch?.[1]?.trim().toLowerCase() ?? 'good';
    const title = titleMatch?.[1]?.trim() ?? 'Insight';
    const metric = metricMatch?.[1]?.trim();

    const insight: SummaryInsight = { title, detail };
    if (metric) insight.metric = metric;

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
