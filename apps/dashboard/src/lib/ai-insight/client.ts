import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return client;
}

export const AI_MODEL = process.env.AI_INSIGHT_MODEL || 'claude-haiku-4-5-20251001';
export const MAX_TOKENS = 2048;
export const LOG_PROMPTS = process.env.AI_INSIGHT_LOG_PROMPTS === 'true';

// Pricing per million tokens by model family
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-5-20250514': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-6-20250725': { input: 3.00, output: 15.00 },
};

export function estimateCost(inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[AI_MODEL] ?? { input: 0.80, output: 4.00 };
  return (inputTokens / 1_000_000) * pricing.input +
         (outputTokens / 1_000_000) * pricing.output;
}
