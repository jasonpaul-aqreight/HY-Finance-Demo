# OpenRouter-Only AI Insight Plan

Date: 2026-05-11
Status: Implemented locally, pending commit
Owner: current implementation session

## Decision

Go with OpenRouter as the only model gateway for Finance AI Insight.

Remove direct Claude SDK usage. If a Claude model is needed, call it through OpenRouter using an Anthropic model slug.

This is acceptable for the Finance demo because it simplifies:

- API key management
- provider routing
- cost accounting
- fallback logging
- future model swaps

Accepted risk: if OpenRouter itself is unavailable, the app has no independent model gateway. This is acceptable for the demo/POC, but should be revisited before production HR rollout.

## Non-Negotiables

- Trust stays above cost. Do not accept cheaper output if numeric trust drops.
- Fallback is for technical failure only, not weak business analysis.
- Every RM, percent, days, and count citation must still pass the existing numeric guard.
- Keep `requireParameters: true`.
- Keep `dataCollection: "deny"`.
- Keep provider/model metadata visible in logs and the AI Insight panel.

## Fallback Strategy

Use two fallback layers inside OpenRouter:

1. Same model, different upstream provider.
2. Different model, still through OpenRouter.

Do not use the Claude SDK as a third layer.

OpenRouter config note: use `order` for the approved provider ladder. Set `allowFallbacks: false` to prevent routing outside that approved list. The implementation session should verify with a small provider-routing probe that OpenRouter still tries later providers in `order` when the first provider is unavailable.

### Component / Router Slot

Purpose: cheap narration, routing, and component-level interpretation over pre-fetched data.

Primary model:

```text
deepseek/deepseek-v4-flash
```

Provider order:

```text
Parasail -> AtlasCloud -> DeepSeek -> DeepInfra -> SiliconFlow -> AkashML -> Novita
```

Recommended OpenRouter provider config:

```ts
provider: {
  order: [
    "parasail/fp8",
    "atlas-cloud/fp8",
    "deepseek",
    "deepinfra/fp4",
    "siliconflow/fp8",
    "akashml/fp8",
    "novita",
  ],
  allowFallbacks: false,
  requireParameters: true,
  dataCollection: "deny",
}
```

Notes:

- `Parasail` is first because it already passed the accepted S05 OpenRouter run for component calls.
- `AtlasCloud` is second because it has strong throughput and full-context support.
- `DeepSeek` is included as the official provider.
- `DeepInfra` is reliable but has lower max output on this model; component calls should still fit.
- `Venice` is omitted initially because it is more expensive. Add it last only if we need an emergency extra provider.

Model fallback:

```text
anthropic/claude-haiku-latest
```

### Summary / Editor Slot

Purpose: section-level good/bad insight synthesis, tool-use reasoning, numeric correction, and surgical editing.

Primary model:

```text
z-ai/glm-5.1
```

Provider order:

```text
DeepInfra -> SiliconFlow -> Friendli -> AtlasCloud -> Z.AI
```

Recommended OpenRouter provider config:

```ts
provider: {
  order: [
    "deepinfra/fp4",
    "siliconflow/fp8",
    "friendli",
    "atlas-cloud/fp8",
    "z-ai",
  ],
  allowFallbacks: false,
  requireParameters: true,
  dataCollection: "deny",
}
```

Notes:

- `DeepInfra` stays first because S05 summary already passed through DeepInfra.
- `SiliconFlow`, `Friendli`, `AtlasCloud`, and `Z.AI` currently advertise tool support for GLM 5.1.
- Do not include providers that do not advertise the required tool parameters for this slot.

Model fallback order:

```text
deepseek/deepseek-v4-pro -> anthropic/claude-sonnet-latest
```

## Fallback Triggers

Fallback only on technical failures:

- timeout
- connection error
- `408`
- `409`
- `429`
- `5xx`
- no provider available
- model unavailable
- provider unavailable
- provider does not support required parameters

Do not fallback on:

- weak analysis
- hallucinated arithmetic
- unsupported numeric citation
- generic insight
- failed quality score

Those are quality failures and must be handled by numeric guard retry, prompt/data fixes, or rollout rejection.

## Implementation Scope

### In Scope

- Remove direct `@anthropic-ai/sdk` usage from AI Insight.
- Remove the Anthropic client from `client.ts`.
- Make `callAiModel()` OpenRouter-only.
- Replace Anthropic SDK message/tool/content types with internal AI Insight types.
- Convert internal tool definitions to OpenRouter function-tool payloads.
- Add provider-order and model-fallback configuration per slot.
- Preserve actual OpenRouter `usage.cost` as the cost source of truth.
- Log:
  - model requested
  - model actually used
  - upstream provider
  - provider fallback path
  - model fallback path
  - cost source
  - reasoning tokens when present
- Keep AI Insight panel provider footer.
- Remove obsolete S05-specific implementation plan.

### Out Of Scope

- Prompt tuning.
- Fetcher tuning.
- Re-scoring all 16 sections.
- HR repo transfer.
- Production PRD.
- Removing historical study logs or rollout tracker rows.

## Proposed Code Shape

Create internal provider-neutral types, for example:

```ts
type AiRole = "user" | "assistant";

interface AiTextBlock {
  type: "text";
  text: string;
}

interface AiToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface AiToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

interface AiMessage {
  role: AiRole;
  content: string | Array<AiTextBlock | AiToolUseBlock | AiToolResultBlock>;
}

interface AiTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
```

This keeps the orchestrator independent from OpenRouter, Anthropic, or any future SDK.

## Files Likely To Change

- `apps/dashboard/package.json`
- `apps/dashboard/package-lock.json`
- `apps/dashboard/src/lib/ai-insight/client.ts`
- `apps/dashboard/src/lib/ai-insight/model-provider.ts`
- `apps/dashboard/src/lib/ai-insight/orchestrator.ts`
- `apps/dashboard/src/lib/ai-insight/feedback-llm.ts`
- `apps/dashboard/src/lib/ai-insight/tools.ts`
- `apps/dashboard/src/lib/ai-insight/tool-policy.ts`
- `apps/dashboard/src/lib/ai-insight/types.ts`
- `apps/dashboard/src/lib/ai-insight/debug-logger.ts`
- `apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx` only if metadata labels need adjustment

## Implementation Steps

1. Confirm current git status.
2. Remove old S05-specific implementation document.
3. Add this OpenRouter-only plan document.
4. Inspect all `@anthropic-ai/sdk` imports.
5. Add internal AI Insight provider types.
6. Migrate tools and tool-policy to internal types.
7. Migrate orchestrator messages and tool-result blocks to internal types.
8. Update `model-provider.ts`:
   - OpenRouter-only call path
   - provider order per slot
   - model fallback per slot
   - metadata for fallback route
9. Update `client.ts`:
   - remove Anthropic client
   - remove `AI_INSIGHT_PROVIDER`
   - keep OpenRouter model env vars
10. Remove direct Anthropic dependency if no longer used anywhere in `apps/dashboard`.
11. Run type/build checks.
12. Run one S05 smoke test.
13. Run one S02 stress test if practical.
14. Update study docs with outcome.
15. Ask before committing.

## Validation Plan

Minimum checks:

- `rg "@anthropic-ai/sdk" apps/dashboard/src` returns no AI Insight usage.
- TypeScript/build passes.
- S05 `customer_margin_overview` still produces:
  - OpenRouter provider metadata
  - no Claude SDK fallback
  - numeric guard pass
  - quality `>= 9/10`
- S02 `payment_outstanding` stress run still has:
  - no material hallucination
  - numeric guard pass
  - no silent quality-based fallback

Acceptance gate:

- OpenRouter-only implementation works.
- Direct Claude SDK is gone from AI Insight.
- Fallback is visible and explainable.
- Cost is still based on OpenRouter actual `usage.cost` when present.
- No regression in numeric trust.

## Implementation Result - 2026-05-11

Implemented OpenRouter as the only AI Insight model gateway.

Changes made:

- Removed direct `@anthropic-ai/sdk` usage from AI Insight provider files.
- Replaced SDK-specific message, tool, and content types with internal AI Insight types.
- Made `callAiModel()` OpenRouter-only.
- Implemented provider-order routing first and model fallback second.
- Kept `requireParameters: true`, `dataCollection: "deny"`, and `allowFallbacks: false`.
- Preserved OpenRouter `usage.cost` as the cost source when present.
- Added requested model, actual model, provider order, provider path, model fallback path, and cost-source metadata to logs and panel data.

Validation completed:

- `rg "@anthropic-ai/sdk" apps/dashboard/src apps/dashboard/package.json apps/dashboard/package-lock.json` returned no matches.
- `rg "getAnthropicClient|AI_INSIGHT_PROVIDER|MessageParam|ToolResultBlockParam|Anthropic\\." apps/dashboard/src/lib/ai-insight` returned no matches.
- `./node_modules/.bin/tsc --noEmit --project tsconfig.json` passed in `apps/dashboard`.
- `bun run build` passed in `apps/dashboard`.
- S05 smoke run passed:
  - section: `customer_margin_overview`
  - log: `apps/dashboard/logs/ai-debug-customer_margin_overview-2026-05-11T08-43-40.log`
  - cost: `$0.0167`
  - tokens: `18,912`
  - numeric guard: passed on attempt 2 with 0 unmatched
  - model fallback: not used
  - cost source: `openrouter_usage_cost`
- S02 stress run passed:
  - section: `payment_outstanding`
  - log: `apps/dashboard/logs/ai-debug-payment_outstanding-2026-05-11T08-47-32.log`
  - cost: `$0.0156`
  - tokens: `16,157`
  - numeric guard: passed on attempt 1 with 0 unmatched
  - model fallback: not used
  - cost source: `openrouter_usage_cost`
- Headed Playwright verification passed for S02 and S05 panel metadata:
  - Provider shown as `OpenRouter`
  - Summary model shown as `z-ai/glm-5.1`

OpenRouter did not return per-attempt upstream provider metadata in these runs. Logs now record the configured provider order for auditability, and will record the actual upstream path when OpenRouter returns it.

## Rollback Plan

Rollback should be config-first when possible:

- Change OpenRouter primary models back to known-good model slugs.
- Remove risky provider from a provider order list.
- Use `anthropic/claude-sonnet-latest` through OpenRouter for summary/editor if GLM or DeepSeek Pro fails.

There is intentionally no direct Claude SDK rollback after this plan. If OpenRouter-only proves unacceptable, restore direct Claude SDK from git history in a separate approved change.

## New Session Prompt

```text
Implement the OpenRouter-only AI Insight provider plan.

Read:
- AGENTS.md
- AI_Insight_Study/OPENROUTER_ONLY_PLAN.md
- AI_Insight_Study/ROLLOUT_TRACKER.md

Before code edits:
1. Inspect current AI Insight provider files.
2. Confirm current git status.
3. Confirm the exact implementation approach with me.
4. Wait for my explicit approval.

Implementation goal:
- Remove direct @anthropic-ai/sdk usage from AI Insight.
- Use OpenRouter as the only model gateway.
- If Claude is needed, use Claude model slugs through OpenRouter.
- Provider fallback first, model fallback second.

Provider/model policy:
- Component/router primary: deepseek/deepseek-v4-flash
- Component/router provider order: Parasail -> AtlasCloud -> DeepSeek -> DeepInfra -> SiliconFlow -> AkashML -> Novita
- Component/router model fallback: anthropic/claude-haiku-latest
- Summary/editor primary: z-ai/glm-5.1
- Summary/editor provider order: DeepInfra -> SiliconFlow -> Friendli -> AtlasCloud -> Z.AI
- Summary/editor model fallback: deepseek/deepseek-v4-pro -> anthropic/claude-sonnet-latest
- Keep requireParameters true and dataCollection deny.
- Fallback only on technical errors, not weak output.

Validation:
- Run type/build checks.
- Run one S05 smoke test.
- Run one S02 stress test if practical.
- Update study docs.
- Ask before commit.
```
