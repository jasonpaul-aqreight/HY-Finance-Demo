import {
  OPENROUTER_COMPONENT_MODEL,
  OPENROUTER_SUMMARY_MODEL,
  estimateCost,
} from './client';
import type { AiModelRequest, AiModelResponse, AiModelUsage } from './model-provider';
import type { AiProviderMetadata } from './types';

function usageFor(inputTokens: number, outputTokens: number, model: string): AiModelUsage {
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: estimateCost(inputTokens, outputTokens, model),
    costSource: 'local_estimate',
  };
}

function providerMeta(model: string): AiProviderMetadata {
  return {
    sdk: 'openrouter',
    providerLabel: 'OpenRouter',
    model,
    requestedModel: model,
    upstreamProvider: 'mock',
    fallbackUsed: false,
    costSource: 'local_estimate',
  };
}

export async function mockAiModelResponse(request: AiModelRequest): Promise<AiModelResponse> {
  const model = request.model || (
    request.slot === 'component' ? OPENROUTER_COMPONENT_MODEL : OPENROUTER_SUMMARY_MODEL
  );
  const usage = request.slot === 'component'
    ? usageFor(120, 60, model)
    : usageFor(180, 100, model);

  if (request.slot === 'component') {
    return {
      content: [
        {
          type: 'text',
          text: 'Mock component analysis. The business signal is readable and suitable for executive review.',
        },
      ],
      model,
      stopReason: 'stop',
      usage,
      providerMeta: providerMeta(model),
    };
  }

  const text = process.env.AI_INSIGHT_MOCK_LLM === 'bad'
    ? 'Mock summary without delimiters for parser fallback coverage.'
    : [
        '===INSIGHT===',
        'sentiment: good',
        'title: Healthy operating signal',
        'metric: Business quality',
        'summary: The section shows a constructive pattern for management attention.',
        '---DETAIL---',
        'The available evidence points to a positive business signal. Treat this as a mock insight used only for batch verification.',
        '===END===',
        '===INSIGHT===',
        'sentiment: bad',
        'title: Follow up required',
        'metric: Execution risk',
        'summary: The section also contains a risk that should be reviewed by management.',
        '---DETAIL---',
        'The available evidence points to a risk area that needs operational follow up. Treat this as a mock insight used only for batch verification.',
        '===END===',
      ].join('\n');

  return {
    content: [{ type: 'text', text }],
    model,
    stopReason: 'stop',
    usage,
    providerMeta: providerMeta(model),
  };
}
