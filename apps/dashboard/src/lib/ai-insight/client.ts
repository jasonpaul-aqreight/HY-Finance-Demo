import { OpenRouter } from '@openrouter/sdk';

let openRouterClient: OpenRouter | null = null;

export const MAX_TOKENS = 2048;
export const LOG_PROMPTS = process.env.AI_INSIGHT_LOG_PROMPTS === 'true';

export const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || '';

export const OPENROUTER_TIMEOUT_MS =
  Number(process.env.AI_INSIGHT_OPENROUTER_TIMEOUT_MS ?? 45_000);

export const OPENROUTER_COMPONENT_MODEL =
  process.env.AI_INSIGHT_OPENROUTER_COMPONENT_MODEL || 'deepseek/deepseek-v4-flash';

export const OPENROUTER_SUMMARY_MODEL =
  process.env.AI_INSIGHT_OPENROUTER_SUMMARY_MODEL || 'z-ai/glm-5.1';

export const OPENROUTER_ROUTER_MODEL =
  process.env.AI_INSIGHT_OPENROUTER_ROUTER_MODEL || OPENROUTER_COMPONENT_MODEL;

export const OPENROUTER_EDITOR_MODEL =
  process.env.AI_INSIGHT_OPENROUTER_EDITOR_MODEL || OPENROUTER_SUMMARY_MODEL;

export const OPENROUTER_COMPONENT_FALLBACK_MODEL =
  process.env.AI_INSIGHT_OPENROUTER_COMPONENT_FALLBACK_MODEL || 'anthropic/claude-haiku-latest';

export const OPENROUTER_ROUTER_FALLBACK_MODEL =
  process.env.AI_INSIGHT_OPENROUTER_ROUTER_FALLBACK_MODEL || OPENROUTER_COMPONENT_FALLBACK_MODEL;

export const OPENROUTER_SUMMARY_FALLBACK_MODELS =
  (process.env.AI_INSIGHT_OPENROUTER_SUMMARY_FALLBACK_MODELS || 'deepseek/deepseek-v4-pro,anthropic/claude-sonnet-latest')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);

export const OPENROUTER_EDITOR_FALLBACK_MODELS =
  (process.env.AI_INSIGHT_OPENROUTER_EDITOR_FALLBACK_MODELS || OPENROUTER_SUMMARY_FALLBACK_MODELS.join(','))
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);

// Legacy names retained for local logging call sites.
export const AI_MODEL = OPENROUTER_COMPONENT_MODEL;
export const SUMMARY_MODEL = OPENROUTER_SUMMARY_MODEL;

export function getOpenRouterClient(): OpenRouter {
  if (!openRouterClient) {
    openRouterClient = new OpenRouter({
      apiKey: OPENROUTER_API_KEY,
      httpReferer: 'https://hoi-yong-finance.local',
      appTitle: 'Hoi-Yong Finance AI Insight',
      timeoutMs: OPENROUTER_TIMEOUT_MS,
    });
  }
  return openRouterClient;
}

// Pricing per million tokens by model family
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-5-20250514': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'anthropic/claude-haiku-latest': { input: 0.80, output: 4.00 },
  'anthropic/claude-sonnet-latest': { input: 3.00, output: 15.00 },
  'deepseek/deepseek-v4-flash': { input: 0.14, output: 0.28 },
  'deepseek/deepseek-v4-pro': { input: 1.00, output: 3.00 },
  'z-ai/glm-5.1': { input: 1.05, output: 3.50 },
};

export function estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
  const modelKey = model ?? AI_MODEL;
  const pricing = PRICING[modelKey] ??
    Object.entries(PRICING).find(([key]) => modelKey.startsWith(key))?.[1] ??
    { input: 0.80, output: 4.00 };
  return (inputTokens / 1_000_000) * pricing.input +
         (outputTokens / 1_000_000) * pricing.output;
}
