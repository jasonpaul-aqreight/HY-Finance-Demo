// Feedback Router LLM (Phase 1 of feedback loop).
//
// Given a piece of raw user feedback + the section it was submitted from,
// asks Haiku to:
//   1. Pick the single component prompt within that section most likely to
//      be responsible for the feedback.
//   2. Compact the feedback into 2–4 imperative bullets.
//
// Tool use is forced via tool_choice so the model must return structured
// output. The router cannot pick keys outside the section's component list —
// the tool's enum scopes it.

import { getAnthropicClient } from './client';
import {
  getFeedbackRouterSystemPrompt,
  getSurgicalEditorSystemPrompt,
} from './prompt-loader';
import { SECTION_COMPONENTS } from './prompts';
import type { SectionKey } from './types';

const ROUTER_MODEL =
  process.env.AI_INSIGHT_FEEDBACK_ROUTER_MODEL || 'claude-haiku-4-5-20251001';

const SURGICAL_EDITOR_MODEL =
  process.env.AI_INSIGHT_SURGICAL_EDITOR_MODEL || 'claude-sonnet-4-6';

const ROUTER_MAX_TOKENS = 512;
// Most component prompts are 200–600 tokens; allow plenty of headroom for the
// edited version + the change_summary tool output.
const SURGICAL_EDITOR_MAX_TOKENS = 4096;

export interface RouteAndCompactInput {
  section_key: SectionKey;
  page: string;
  raw_feedback: string;
}

export interface RouteAndCompactResult {
  target_prompt_key: string;
  compact_feedback: string;
}

export async function routeAndCompact(
  input: RouteAndCompactInput,
): Promise<RouteAndCompactResult> {
  const components = SECTION_COMPONENTS[input.section_key];
  if (!components || components.length === 0) {
    throw new Error(`Unknown or empty section: ${input.section_key}`);
  }

  const componentKeys = components.map((c) => c.key);
  const componentList = components
    .map((c) => `- ${c.key} (${c.type}): ${c.name}`)
    .join('\n');

  const systemPrompt = await getFeedbackRouterSystemPrompt();

  const userMessage = `Page: ${input.page}
Section: ${input.section_key}

Components in this section:
${componentList}

User feedback:
"""
${input.raw_feedback}
"""

Pick the single component prompt this feedback should edit, and compact the feedback to 2–4 bullets. Always call select_target.`;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: ROUTER_MODEL,
    max_tokens: ROUTER_MAX_TOKENS,
    system: systemPrompt,
    tools: [
      {
        name: 'select_target',
        description:
          'Select the component prompt this feedback should edit and return a compacted bullet form of the feedback.',
        input_schema: {
          type: 'object',
          properties: {
            target_prompt_key: {
              type: 'string',
              enum: componentKeys,
              description: 'Component prompt key from the provided list.',
            },
            compact_feedback: {
              type: 'string',
              description:
                '2–4 imperative bullets, each on its own line starting with "- ".',
            },
          },
          required: ['target_prompt_key', 'compact_feedback'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'select_target' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: 'tool_use' }> =>
      block.type === 'tool_use' && block.name === 'select_target',
  );

  if (!toolUse) {
    throw new Error('Router LLM did not return a select_target tool call');
  }

  const args = toolUse.input as Partial<RouteAndCompactResult>;
  const targetKey = args.target_prompt_key;
  const compact = args.compact_feedback;

  if (!targetKey || !componentKeys.includes(targetKey)) {
    throw new Error(`Router returned invalid target key: ${String(targetKey)}`);
  }
  if (!compact || !compact.trim()) {
    throw new Error('Router returned empty compact_feedback');
  }

  return {
    target_prompt_key: targetKey,
    compact_feedback: compact.trim(),
  };
}

// ─── Surgical Editor (Phase 2) ──────────────────────────────────────────────
// Given the current prompt text + compacted feedback, asks Sonnet to produce a
// minimally-edited new version plus a one-line change summary. Forced tool use
// guarantees structured output.

export interface ProposeSurgicalEditInput {
  current_prompt_text: string;
  compact_feedback: string;
  prompt_display_name?: string;
}

export interface ProposeSurgicalEditResult {
  proposed_text: string;
  change_summary: string;
}

export async function proposeSurgicalEdit(
  input: ProposeSurgicalEditInput,
): Promise<ProposeSurgicalEditResult> {
  if (!input.current_prompt_text?.trim()) {
    throw new Error('current_prompt_text is required');
  }
  if (!input.compact_feedback?.trim()) {
    throw new Error('compact_feedback is required');
  }

  const systemPrompt = await getSurgicalEditorSystemPrompt();

  const heading = input.prompt_display_name
    ? `Component: ${input.prompt_display_name}\n`
    : '';

  const userMessage = `${heading}CURRENT PROMPT:
"""
${input.current_prompt_text}
"""

COMPACT FEEDBACK:
"""
${input.compact_feedback}
"""

Produce the smallest edit that incorporates the feedback. Always call propose_edit.`;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: SURGICAL_EDITOR_MODEL,
    max_tokens: SURGICAL_EDITOR_MAX_TOKENS,
    system: systemPrompt,
    tools: [
      {
        name: 'propose_edit',
        description:
          'Return a minimally-edited new version of the component prompt and a one-line summary of what changed.',
        input_schema: {
          type: 'object',
          properties: {
            proposed_text: {
              type: 'string',
              description:
                'Full revised prompt text. Plain text only, no markdown wrapping.',
            },
            change_summary: {
              type: 'string',
              description:
                'Single sentence (≤100 chars) describing what concretely changed.',
            },
          },
          required: ['proposed_text', 'change_summary'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'propose_edit' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: 'tool_use' }> =>
      block.type === 'tool_use' && block.name === 'propose_edit',
  );

  if (!toolUse) {
    throw new Error('Surgical editor LLM did not return a propose_edit tool call');
  }

  const args = toolUse.input as Partial<ProposeSurgicalEditResult>;
  const proposed = args.proposed_text;
  const summary = args.change_summary;

  if (!proposed || !proposed.trim()) {
    throw new Error('Surgical editor returned empty proposed_text');
  }
  if (!summary || !summary.trim()) {
    throw new Error('Surgical editor returned empty change_summary');
  }

  return {
    proposed_text: proposed.trim(),
    change_summary: summary.trim(),
  };
}
