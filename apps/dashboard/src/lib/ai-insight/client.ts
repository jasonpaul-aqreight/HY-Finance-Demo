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

export const AI_MODEL = 'claude-haiku-4-5-20251001';
export const MAX_TOKENS = 2048;

// Haiku pricing (per million tokens)
const INPUT_COST_PER_M = 0.80;
const OUTPUT_COST_PER_M = 4.00;

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * INPUT_COST_PER_M +
         (outputTokens / 1_000_000) * OUTPUT_COST_PER_M;
}
