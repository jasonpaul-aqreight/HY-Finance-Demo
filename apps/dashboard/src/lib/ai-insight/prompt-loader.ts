// Runtime prompt source after prompt DB removal.
//
// Prompt text is code-backed from prompts-defaults.ts. prompts.ts remains the
// section/component registry and user-message builder; it does not own prompt
// bodies. Phase 3 will render threshold tokens here before returning text.

import {
  DEFAULT_COMPONENT_PROMPTS,
  DEFAULT_GLOBAL_SYSTEM,
  DEFAULT_SUMMARY_SYSTEM,
} from './prompts-defaults';
import { renderThresholdText } from './threshold-config';

export async function getGlobalSystemPrompt(): Promise<string> {
  return DEFAULT_GLOBAL_SYSTEM;
}

export async function getSummarySystemPrompt(): Promise<string> {
  return DEFAULT_SUMMARY_SYSTEM;
}

export async function getComponentPrompt(componentKey: string): Promise<string> {
  const prompt = DEFAULT_COMPONENT_PROMPTS[componentKey];
  if (!prompt) throw new Error(`No prompt defined for component: ${componentKey}`);
  return renderThresholdText(prompt, componentKey);
}
