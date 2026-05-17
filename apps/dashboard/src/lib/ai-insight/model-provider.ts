import {
  OPENROUTER_API_KEY,
  OPENROUTER_COMPONENT_FALLBACK_MODEL,
  OPENROUTER_COMPONENT_MODEL,
  OPENROUTER_SUMMARY_FALLBACK_MODELS,
  OPENROUTER_SUMMARY_MODEL,
  OPENROUTER_TIMEOUT_MS,
  estimateCost,
  getOpenRouterClient,
} from './client';
import { mockAiModelResponse } from './mock-llm';
import type {
  AiMessage,
  AiProviderMetadata,
  AiTextBlock,
  AiTool,
  AiToolChoice,
  AiToolUseBlock,
} from './types';
import type {
  ChatChoice,
  ChatFunctionTool,
  ChatMessages,
  ChatResult,
  ChatToolChoice,
  ProviderPreferences,
} from '@openrouter/sdk/models';

export type AiModelSlot = 'component' | 'summary';
export type { AiTextBlock, AiToolUseBlock };
export type AiContentBlock = AiTextBlock | AiToolUseBlock;

export interface AiModelUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  costSource: AiProviderMetadata['costSource'];
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  reasoningTokens?: number;
  costDetails?: unknown;
}

export interface AiModelResponse {
  content: AiContentBlock[];
  model: string;
  stopReason: string | null;
  usage: AiModelUsage;
  providerMeta: AiProviderMetadata;
  rawResponse?: unknown;
}

export interface AiModelRequest {
  slot: AiModelSlot;
  model?: string;
  maxTokens: number;
  system?: string | AiTextBlock[];
  messages: AiMessage[];
  tools?: AiTool[];
  toolChoice?: AiToolChoice;
  abortSignal?: AbortSignal;
}

interface AttemptContext {
  requestedModel: string;
  modelFallbackPath: string[];
  modelFallbackUsed: boolean;
  fallbackReason?: string;
}

class OpenRouterProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly fallbackable = false,
  ) {
    super(message);
    this.name = 'OpenRouterProviderError';
  }
}

const COMPONENT_PROVIDER_ORDER = [
  'parasail/fp8',
  'atlas-cloud/fp8',
  'deepseek',
  'deepinfra/fp4',
  'siliconflow/fp8',
  'akashml/fp8',
  'novita',
];

const SUMMARY_PROVIDER_ORDER = [
  'deepinfra/fp4',
  'siliconflow/fp8',
  'friendli',
  'atlas-cloud/fp8',
  'z-ai',
];

export async function callAiModel(request: AiModelRequest): Promise<AiModelResponse> {
  if (process.env.AI_INSIGHT_MOCK_LLM) {
    return mockAiModelResponse(request);
  }

  const models = openRouterModelsForSlot(request.slot);
  const modelFallbackPath: string[] = [];
  const fallbackErrors: string[] = [];

  for (const model of models) {
    modelFallbackPath.push(model);
    const modelFallbackUsed = modelFallbackPath.length > 1;
    try {
      return await callOpenRouterModel(request, {
        requestedModel: model,
        modelFallbackPath: [...modelFallbackPath],
        modelFallbackUsed,
        fallbackReason: fallbackErrors.at(-1),
      });
    } catch (err) {
      if (!isFallbackableOpenRouterError(err)) throw err;
      fallbackErrors.push(err instanceof Error ? err.message : String(err));
    }
  }

  throw new OpenRouterProviderError(
    `OpenRouter model fallback exhausted: ${fallbackErrors.join(' | ') || 'no successful model response'}`,
    undefined,
    false,
  );
}

export function summarizeProviderMetadata(
  metas: AiProviderMetadata[],
  summaryMeta?: AiProviderMetadata,
): AiProviderMetadata | undefined {
  const primary = summaryMeta ?? metas.at(-1);
  if (!primary) return undefined;

  const modelsUsed = [...new Set(metas.map((meta) => meta.model).filter(Boolean))];
  const providerFallbackPath = [
    ...new Set(metas.flatMap((meta) => meta.providerFallbackPath ?? []).filter(Boolean)),
  ];
  const modelFallbackPath = [
    ...new Set(metas.flatMap((meta) => meta.modelFallbackPath ?? []).filter(Boolean)),
  ];
  const fallbackReason =
    metas.find((meta) => meta.fallbackReason)?.fallbackReason ?? primary.fallbackReason;

  return {
    ...primary,
    primarySdk: 'openrouter',
    summarySdk: 'openrouter',
    summaryModel: summaryMeta?.model ?? primary.model,
    fallbackUsed: metas.some((meta) => meta.fallbackUsed) || primary.fallbackUsed,
    fallbackReason,
    modelsUsed,
    providerFallbackPath: providerFallbackPath.length ? providerFallbackPath : primary.providerFallbackPath,
    modelFallbackPath: modelFallbackPath.length ? modelFallbackPath : primary.modelFallbackPath,
    modelFallbackUsed: metas.some((meta) => meta.modelFallbackUsed) || primary.modelFallbackUsed,
  };
}

function aiToolsToOpenRouterTools(tools: AiTool[]): ChatFunctionTool[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

async function callOpenRouterModel(
  request: AiModelRequest,
  attempt: AttemptContext,
): Promise<AiModelResponse> {
  if (!OPENROUTER_API_KEY) {
    throw new OpenRouterProviderError('OPENROUTER_API_KEY is not configured for the dashboard process');
  }

  const client = getOpenRouterClient();
  const provider = openRouterProviderForSlot(request.slot);
  let response: ChatResult;

  try {
    response = await client.chat.send({
      xOpenRouterExperimentalMetadata: 'enabled',
      chatRequest: {
        model: attempt.requestedModel,
        maxTokens: request.maxTokens,
        messages: toOpenRouterMessages(request.system, request.messages),
        provider,
        reasoning: { effort: 'none' },
        ...(request.tools?.length ? { tools: aiToolsToOpenRouterTools(request.tools) } : {}),
        ...(request.toolChoice ? { toolChoice: toOpenRouterToolChoice(request.toolChoice) } : {}),
      },
    }, {
      signal: request.abortSignal,
      timeoutMs: OPENROUTER_TIMEOUT_MS,
    });
  } catch (err) {
    throw normalizeOpenRouterSdkError(err, request.abortSignal);
  }

  const choice = response.choices[0];
  if (!choice?.message) {
    throw new OpenRouterProviderError('OpenRouter SDK returned no message choices', undefined, true);
  }

  const content = normalizeOpenRouterContent(choice);
  const inputTokens = response.usage?.promptTokens ?? 0;
  const outputTokens = response.usage?.completionTokens ?? 0;
  const reasoningTokens = response.usage?.completionTokensDetails?.reasoningTokens ?? undefined;
  const model = response.model ?? attempt.requestedModel;
  const usageCost = response.usage?.cost;
  const costUsd = typeof usageCost === 'number'
    ? usageCost
    : estimateCost(inputTokens, outputTokens, model);
  const costSource: AiProviderMetadata['costSource'] =
    typeof usageCost === 'number' ? 'openrouter_usage_cost' : 'local_estimate';
  const providerFallbackPath = getOpenRouterProviderFallbackPath(response);
  const providerFallbackUsed = providerFallbackPath.length > 1;

  const providerMeta: AiProviderMetadata = {
    sdk: 'openrouter',
    providerLabel: 'OpenRouter',
    model,
    requestedModel: attempt.requestedModel,
    upstreamProvider: providerFallbackPath.at(-1) ?? getOpenRouterUpstreamProvider(response),
    providerOrder: provider.order ?? provider.only ?? undefined,
    providerFallbackPath: providerFallbackPath.length ? providerFallbackPath : undefined,
    modelFallbackPath: attempt.modelFallbackPath,
    modelFallbackUsed: attempt.modelFallbackUsed,
    fallbackUsed: providerFallbackUsed || attempt.modelFallbackUsed,
    fallbackReason: attempt.modelFallbackUsed
      ? attempt.fallbackReason
      : providerFallbackUsed
        ? 'OpenRouter used a later provider from the approved order'
        : undefined,
    costSource,
    reasoningTokens,
  };

  return {
    content,
    model,
    stopReason: content.some((block) => block.type === 'tool_use')
      ? 'tool_use'
      : choice.finishReason ?? null,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: response.usage?.totalTokens ?? inputTokens + outputTokens,
      costUsd,
      costSource,
      cacheCreationInputTokens: response.usage?.promptTokensDetails?.cacheWriteTokens,
      cacheReadInputTokens: response.usage?.promptTokensDetails?.cachedTokens,
      reasoningTokens,
      costDetails: response.usage?.costDetails,
    },
    providerMeta,
    rawResponse: response,
  };
}

function toOpenRouterMessages(
  system: AiModelRequest['system'],
  messages: AiMessage[],
): ChatMessages[] {
  const converted: ChatMessages[] = [];
  const systemText = systemToText(system);
  if (systemText) converted.push({ role: 'system', content: systemText } as ChatMessages);

  for (const message of messages) {
    if (typeof message.content === 'string') {
      converted.push({ role: message.role, content: message.content } as ChatMessages);
      continue;
    }

    const text = message.content
      .filter((block): block is AiTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (message.role === 'assistant') {
      const toolCalls = message.content
        .filter((block): block is AiToolUseBlock => block.type === 'tool_use')
        .map((block) => ({
          id: block.id,
          type: 'function' as const,
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input ?? {}),
          },
        }));
      converted.push({
        role: 'assistant',
        content: text || null,
        ...(toolCalls.length ? { toolCalls } : {}),
      } as ChatMessages);
      continue;
    }

    if (text) converted.push({ role: 'user', content: text } as ChatMessages);
    for (const block of message.content) {
      if (block.type !== 'tool_result') continue;
      converted.push({
        role: 'tool',
        toolCallId: block.tool_use_id,
        content: block.content,
      } as ChatMessages);
    }
  }

  return converted;
}

function systemToText(system: AiModelRequest['system']): string | undefined {
  if (!system) return undefined;
  if (typeof system === 'string') return system;
  const text = system
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
  return text || undefined;
}

function toOpenRouterToolChoice(toolChoice: AiToolChoice): ChatToolChoice | undefined {
  if (toolChoice.type === 'tool') {
    return { type: 'function', function: { name: toolChoice.name } };
  }
  if (toolChoice.type === 'any') return 'required';
  if (toolChoice.type === 'auto') return 'auto';
  return undefined;
}

function normalizeOpenRouterContent(choice: ChatChoice): AiContentBlock[] {
  const blocks: AiContentBlock[] = [];
  const text = extractOpenRouterText(choice.message.content);
  if (text) {
    blocks.push({ type: 'text', text });
  }

  for (const call of choice.message.toolCalls ?? []) {
    const name = call.function.name;
    if (!name) continue;
    blocks.push({
      type: 'tool_use',
      id: call.id || `tool_${blocks.length + 1}`,
      name,
      input: parseToolArguments(call.function.arguments),
    });
  }

  return blocks;
}

function extractOpenRouterText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      const maybeText = part as { text?: unknown; content?: unknown };
      if (typeof maybeText.text === 'string') return maybeText.text;
      if (typeof maybeText.content === 'string') return maybeText.content;
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseToolArguments(args: string | undefined): unknown {
  if (!args) return {};
  try {
    return JSON.parse(args);
  } catch {
    return {};
  }
}

function openRouterModelsForSlot(slot: AiModelSlot): string[] {
  switch (slot) {
    case 'component':
      return [OPENROUTER_COMPONENT_MODEL, OPENROUTER_COMPONENT_FALLBACK_MODEL];
    case 'summary':
    default:
      return [OPENROUTER_SUMMARY_MODEL, ...OPENROUTER_SUMMARY_FALLBACK_MODELS];
  }
}

function openRouterProviderForSlot(slot: AiModelSlot): ProviderPreferences {
  if (slot === 'summary') {
    return baseProviderPreference(SUMMARY_PROVIDER_ORDER);
  }

  return baseProviderPreference(COMPONENT_PROVIDER_ORDER);
}

function baseProviderPreference(order: string[]): ProviderPreferences {
  return {
    order,
    allowFallbacks: false,
    requireParameters: true,
    dataCollection: 'deny',
  };
}

function isFallbackableOpenRouterError(err: unknown): boolean {
  return err instanceof OpenRouterProviderError && err.fallbackable;
}

function normalizeOpenRouterSdkError(err: unknown, abortSignal?: AbortSignal): Error {
  if (abortSignal?.aborted) return new Error('Analysis aborted');

  const message = err instanceof Error ? err.message : String(err);
  const status = typeof (err as { statusCode?: unknown })?.statusCode === 'number'
    ? (err as { statusCode: number }).statusCode
    : undefined;
  const name = err instanceof Error ? err.name : '';
  const fallbackable =
    isOpenRouterFallbackStatus(status, message) ||
    /ConnectionError|RequestTimeoutError/i.test(name);

  return new OpenRouterProviderError(message, status, fallbackable);
}

function getOpenRouterUpstreamProvider(response: ChatResult): string | undefined {
  const attempts = response.openrouterMetadata?.attempts;
  const successfulAttempt = attempts?.find((attempt) => attempt.status >= 200 && attempt.status < 300);
  return successfulAttempt?.provider ?? attempts?.at(-1)?.provider;
}

function getOpenRouterProviderFallbackPath(response: ChatResult): string[] {
  const attempts = response.openrouterMetadata?.attempts ?? [];
  return attempts
    .map((attempt) => attempt.provider)
    .filter((provider): provider is string => Boolean(provider));
}

function isOpenRouterFallbackStatus(status: number | undefined, message = ''): boolean {
  if (status === 408 || status === 409 || status === 429) return true;
  if (status !== undefined && status >= 500) return true;
  return /unavailable|no endpoint|no provider|model.*not.*available|provider.*not.*available|provider.*support|required parameter|require.*parameter|unsupported.*parameter/i.test(message);
}
