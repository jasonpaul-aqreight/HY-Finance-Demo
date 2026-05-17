# 03 — Model Provider

> **Classification:** Engine
> **Enables:** A model-call boundary with provider fallback and mock interception.
> **Read after:** 00

---

## 1. Purpose

The model provider is the engine's **single boundary to an external LLM gateway**. Its one responsibility is to turn an abstract, slot-typed model *request* into a normalized model *response*, and in doing so to isolate every layer above it from: which SDK is used, which upstream provider serves the call, how fallback is ordered, how cost is accounted, how a deterministic mock is substituted, and how gateway-specific errors are classified.

Nothing above this layer knows the gateway exists. The generation layer (doc 04) builds requests and reads responses; it never imports an SDK type, never picks a provider, never parses a raw completion. After this document you can build that boundary and a mock that lets the entire pipeline run offline.

## 2. Prerequisites

- **Doc 00**, specifically: the vocabulary in §3 (a section's insight is assembled from per-**component** analyses plus a **summary** pass — these two generation units map to the two model *slots* this layer defines), the Engine/Domain split in §4 (this layer is Engine — it must contain no domain concepts), and the ENV rows owned by `03` in §8.
- **External dependency, by role:** an LLM gateway SDK that provides OpenAI-style chat completions with (a) ordered multi-provider routing, (b) tool / function calling, (c) a per-request timeout and an external cancellation signal, and (d) usage reporting (token counts, optionally a cost figure). The reference realisation is the OpenRouter SDK; any gateway meeting this role contract can be substituted behind the same boundary.
- No engine document beyond `00` is required. This layer is a leaf — it depends on nothing in `01`/`02`.

## 3. Concept & Contract

> *Stack-neutral and domain-neutral. This is the model boundary as an idea.*

The provider is a pure boundary function: **`request → response`**. It holds no domain knowledge and no generation logic. It is the only place in the engine where a gateway/SDK type may appear.

**Slots.** The engine declares a fixed, small set of named model **slots** — abstract *roles*, not model names. Each slot independently configures an ordered **model fallback chain** and an ordered **upstream-provider preference**. The reference defines two:

| Slot | Role | Volume | Tools | Model strength |
|---|---|---|---|---|
| `component` | Narrate one pre-fetched data unit | High (many calls/section) | No | Cheaper |
| `summary` | Synthesize a section from its components | Low (one loop/section) | Yes | Stronger |

A reader on another domain reuses these slots unchanged; a reader needing a third role adds a slot here, not in the layers above.

**Inputs (abstract contract).** A request carries: the target *slot*; a token budget; an optional system instruction; an ordered list of conversation messages (each message has a role of *user* or *assistant* and a body that is plain text or a sequence of *text* / *tool-use* / *tool-result* blocks); an optional set of tool definitions plus a tool-choice policy; and an optional cancellation signal.

**Outputs (abstract contract).** A response carries: normalized content blocks — **text** and **tool-use** only (tool-result is an input-only block, never produced); the model id actually served; a stop reason; a usage record (input / output / total tokens, a cost in USD, a flag stating whether that cost was *reported by the gateway* or *locally estimated*, and optional cache / reasoning token counts); and provider metadata describing requested-vs-served model, the upstream provider, the provider and model fallback paths taken, and whether (and why) any fallback occurred.

**Invariants.**

1. **Mock-first.** A single mock switch is evaluated before anything else. When it is set, **no network call occurs** and a deterministic response is returned. The entire pipeline above must be runnable with no gateway and no credential.
2. **Bounded, ordered fallback.** Models in the slot's chain are attempted in order. The boundary advances to the next model *only* on a **fallback-eligible** failure. A non-eligible failure aborts immediately, without trying later models. An exhausted chain raises exactly one terminal error that carries every attempt's failure reason.
3. **Fail-fast on misconfiguration.** A missing credential is a *non-eligible* failure: it must surface at once and must not be allowed to consume the fallback chain.
4. **Never invent cost.** Cost is the gateway's reported figure when one is present, otherwise a local estimate. The response always records which of the two it used.
5. **Cancellation is honored and distinguishable.** An aborted call yields a distinct, non-fallback-eligible error — it is a caller decision, not a provider failure, and must not trigger fallback or retry.
6. **Total isolation.** No caller ever receives a gateway/SDK type. Conversion in and normalization out both happen here.
7. **Domain-blind.** The provider knows slots and messages only. It must never reference a section, component, page, threshold, or any domain term.

**Boundary.** Upstream, the generation layer (doc 04) constructs requests and consumes responses. Downstream is the external gateway. This layer sits between them and translates in both directions; the seam above it is the abstract request/response contract in §4, the seam below it is the gateway SDK.

## 4. Data contracts

Owned shapes are defined by this layer. Consumed shapes are defined in the shared engine type module and reproduced here because they cross this boundary; the field tables here are authoritative for what this layer reads and writes.

### 4.1 Owned — request

```ts
type AiModelSlot = 'component' | 'summary';

interface AiModelRequest {
  slot: AiModelSlot;          // selects the model chain + provider order
  model?: string;             // ADVISORY only — see note below
  maxTokens: number;          // output token budget for this call
  system?: string | AiTextBlock[];
  messages: AiMessage[];      // ordered conversation
  tools?: AiTool[];           // omit ⇒ no tool calling this turn
  toolChoice?: AiToolChoice;
  abortSignal?: AbortSignal;  // external cancellation
}
```

> **`model` is advisory.** Real model selection is driven entirely by `slot` → the slot's fallback chain (§5). The optional `model` field is **not** used to choose the live model; it is consulted only by the mock path as a label preference. Callers may pass it for traceability; the provider ignores it for routing.

### 4.2 Owned — response

```ts
type AiContentBlock = AiTextBlock | AiToolUseBlock;   // produced; never tool_result

interface AiModelUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;                 // gateway total, else in+out
  costUsd: number;
  costSource: 'openrouter_usage_cost' | 'local_estimate';
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  reasoningTokens?: number;
  costDetails?: unknown;               // opaque gateway cost breakdown, pass-through
}

interface AiModelResponse {
  content: AiContentBlock[];
  model: string;                       // model actually served
  stopReason: string | null;           // 'tool_use' if any tool block, else gateway finish reason
  usage: AiModelUsage;
  providerMeta: AiProviderMetadata;
  rawResponse?: unknown;               // raw gateway result, for logging/debug only
}
```

### 4.3 Consumed — message & tool contract (owned by the shared type module)

```ts
type AiRole = 'user' | 'assistant';

interface AiTextBlock        { type: 'text'; text: string; }
interface AiToolUseBlock     { type: 'tool_use'; id: string; name: string; input: unknown; }
interface AiToolResultBlock  { type: 'tool_result'; tool_use_id: string; content: string; }
type AiMessageContentBlock = AiTextBlock | AiToolUseBlock | AiToolResultBlock;

interface AiMessage {
  role: AiRole;
  content: string | AiMessageContentBlock[];
}

interface AiTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;   // JSON Schema for the tool's arguments
}

type AiToolChoice =
  | { type: 'tool'; name: string }   // force a specific tool
  | { type: 'any' }                  // require some tool
  | { type: 'auto' };                // model decides
```

### 4.4 Produced here, persisted downstream — `AiProviderMetadata`

This layer **produces** every `AiProviderMetadata`. Doc 04 aggregates many of them into a section result; doc 01 persists the aggregate. The field set is authoritative here.

| Field | Type | Meaning |
|---|---|---|
| `sdk` | `'openrouter'` | The gateway SDK family. |
| `providerLabel` | `'OpenRouter'` | Human label for UI/debug. |
| `model` | `string` | Model actually served. |
| `requestedModel?` | `string` | Model this attempt asked for. |
| `upstreamProvider?` | `string` | Upstream provider that served the call (`'mock'` for the mock path). |
| `providerOrder?` | `string[]` | The ordered provider preference sent for this slot. |
| `providerFallbackPath?` | `string[]` | Providers the gateway tried, in order. |
| `modelFallbackPath?` | `string[]` | Models this layer tried, in order. |
| `modelFallbackUsed?` | `boolean` | A later model in the chain was used. |
| `fallbackUsed` | `boolean` | Any provider- or model-level fallback occurred. |
| `fallbackReason?` | `string` | Why fallback happened (first/most-relevant). |
| `costSource` | `'openrouter_usage_cost' \| 'local_estimate'` | Provenance of `costUsd`. |
| `reasoningTokens?` | `number` | Reasoning tokens, if the model reported them. |
| `primarySdk?` `summarySdk?` | `'openrouter'` | Aggregate-only: set by the metadata summarizer. |
| `modelsUsed?` | `string[]` | Aggregate-only: distinct models across a section. |
| `summaryModel?` | `string` | Aggregate-only: model used for the summary pass. |

## 5. Behavior & flow

Concrete behavior on the reference stack (OpenRouter SDK, Node/TypeScript). Every gateway-specific step is flagged.

### 5.1 Entry: `callAiModel(request)`

1. **Mock interception (first, unconditional check).** If the mock environment switch is set, return a deterministic mock response immediately — no client is constructed, no network call is made. `[VERSION-SENSITIVE]` the switch is a single `process.env` read evaluated at call time, so tests can set/unset it per case.
2. **Resolve the model chain for the slot:**
   - `component` → `[componentModel, componentFallbackModel]`
   - `summary` → `[summaryModel, ...summaryFallbackModels]` (the fallback list is one ENV value, comma-split, trimmed, empties dropped)
3. **Iterate the chain in order.** For each model: append it to `modelFallbackPath`; attempt the gateway call (§5.2). On success, return. On a **fallback-eligible** error, record the reason and continue to the next model. On a **non-eligible** error, rethrow immediately. If the chain is exhausted, throw one terminal error: `OpenRouter model fallback exhausted: <reason | reason | …>`.

### 5.2 One gateway attempt: `callOpenRouterModel(request, attempt)`

1. **Credential gate.** If the API key is empty → throw a **non-fallback-eligible** provider error (invariant 3: this must not burn the chain).
2. **Construct/reuse the client** — a lazily-created singleton (§5.5).
3. **Build the provider preference for the slot** — an ordered upstream-provider list with `allowFallbacks: false`, `requireParameters: true`, `dataCollection: 'deny'` (§6).
4. **Send the chat request** `[VERSION-SENSITIVE]` (OpenRouter SDK `chat.send`): experimental metadata enabled; body = `{ model: attempt.requestedModel, maxTokens, messages: <converted>, provider, reasoning: { effort: 'none' }, tools?, toolChoice? }`; transport options = the caller's abort signal + the configured per-request timeout. Any thrown error is run through error normalization (§5.4).
5. **Require a choice.** If the response has no first choice/message → throw a **fallback-eligible** error (a later model may succeed).
6. **Normalize content:** an optional leading text block (string content, or array parts joined) followed by one tool-use block per returned tool call. Tool-call arguments are `JSON.parse`d; on parse failure the input becomes `{}` (never throws).
7. **Stop reason:** `'tool_use'` if any tool-use block was produced, otherwise the gateway's finish reason, otherwise `null`.
8. **Cost:** if the gateway reported a numeric usage cost → use it, `costSource = 'openrouter_usage_cost'`. Otherwise → local estimate from a per-model pricing table, `costSource = 'local_estimate'`.
9. **Provider metadata:** requested vs served model; upstream provider and provider fallback path read from the gateway's per-attempt metadata; this layer's model fallback path/used; `fallbackUsed = provider-fallback OR model-fallback`; a `fallbackReason` chosen from the model-fallback reason, else a generic provider-order note, else undefined.
10. Return the full `AiModelResponse` (content, served model, stop reason, usage incl. cache/reasoning/costDetails pass-through, provider metadata, raw response for debug).

### 5.3 Message conversion (in) and content normalization (out)

`[VERSION-SENSITIVE]` — this is the only adapter to the gateway's wire shape:

- **System** → a leading `system` message (string passed through; block array flattened to joined text; empty ⇒ omitted).
- **`user` message** → a `user` message for its text; each contained `tool_result` block → a separate `tool` message keyed by `tool_use_id`.
- **`assistant` message** → an `assistant` message; contained `tool_use` blocks → the gateway's `toolCalls` shape (`{ id, type:'function', function:{ name, arguments: JSON.stringify(input) } }`); text content `null` if empty.
- **Tools** → `{ type:'function', function:{ name, description, parameters: input_schema } }`.
- **Tool-choice** → `tool`→`{type:'function',function:{name}}`, `any`→`'required'`, `auto`→`'auto'`.
- **Out:** gateway content (string or parts) → a single joined text block; gateway tool calls → `tool_use` blocks (synthetic id if the gateway omitted one).

### 5.4 Error normalization & fallback eligibility

A gateway error is normalized into the provider's own error type carrying `{ message, status?, fallbackable }`:

- **Aborted** (the caller's signal is set) → `Error('Analysis aborted')`, **non-fallback-eligible**. Cancellation is a caller decision (invariant 5).
- `status` is taken from the SDK error's status code when numeric.
- **Fallback-eligible** iff: status ∈ {408, 409, 429}; **or** status ≥ 500; **or** the message matches *unavailable / no endpoint / no provider / model not available / provider not available / (un)supported parameter / required parameter*; **or** the error name is a connection / request-timeout error.
- All other errors (including the missing-credential error and any 4xx not listed) are **non-eligible** — they fail the whole call at once.

### 5.5 Client construction & cost estimation

- **Client:** a lazily-initialized module singleton `[VERSION-SENSITIVE]` built with `{ apiKey, httpReferer, appTitle, timeoutMs }`. **Engine note:** `httpReferer` and `appTitle` are *deployment identity*, not engine constants — in the reference they are app-branded strings; a reuse must parameterize them per deployment and must not hardcode the originating app's identity.
- **Cost table:** a static `model → { input, output }` per-million-token map. Lookup is exact key → longest matching key prefix → a conservative default (`{ input: 0.80, output: 4.00 }` per million). Estimate = `inputTokens/1e6 * input + outputTokens/1e6 * output`. The mock path always uses this estimator (`costSource: 'local_estimate'`).

### 5.6 Metadata aggregation: `summarizeProviderMetadata(metas, summaryMeta?)`

Given the per-component provider metadatas and the summary pass's metadata, produce one section-level `AiProviderMetadata`: distinct `modelsUsed`, unioned provider/model fallback paths, `fallbackUsed`/`modelFallbackUsed` = any-of, the first non-empty `fallbackReason`, `summaryModel` from the summary meta. Downstream (doc 04) attaches the result to the section; doc 01 persists it.

### 5.7 Prompt-logging behavior (this layer owns the switch and its contract)

`AI_INSIGHT_LOG_PROMPTS` is read here as a boolean (`=== 'true'`, default off). When **on**, the generation layer (doc 04) writes — to stdout, in addition to the normal debug log — the **full system prompt, the full user prompt, and the full summary response text, verbatim, with no redaction or truncation**.

The user prompt for every component embeds the values fetched from the source-of-truth store. Therefore prompt logging **captures raw source domain data (financial figures) in plaintext logs**. It is a developer-only switch:

- Default is off and it must be left off in production. Production logs would otherwise contain source financial data.
- There is **no redaction layer** — turning it on is all-or-nothing by design (debug determinism).
- The switch lives at the model-provider configuration boundary so it is documented and owned in one place even though the log statements execute inside doc 04's pipeline.

## 6. Rules & edge cases

| Trigger | Required behavior | Why |
|---|---|---|
| Mock switch set (any value) | Skip all network; return deterministic response for the slot. | Offline-runnable pipeline (invariant 1). |
| Mock switch = the "bad" value, `summary` slot | Return summary text **without** the delimiter format, to exercise the parser-fallback path. | Lets tests cover the malformed-output branch deterministically. |
| Mock switch set, `component` slot | Return a single fixed text block; usage = small fixed token counts. | Deterministic, cheap, no parser branches needed. |
| API key empty, mock not set | Throw a **non-fallback-eligible** error before any model is tried. | Misconfiguration must fail fast, not silently churn the chain (invariant 3). |
| Fallback-eligible failure on model *i* | Record reason; try model *i+1*. | Bounded ordered resilience (invariant 2). |
| Non-eligible failure on model *i* | Rethrow immediately; do not try *i+1*. | A deterministic/client error won't be fixed by another model. |
| Chain exhausted | Throw one terminal error concatenating all attempt reasons. | Single actionable failure with full history. |
| Caller aborts mid-call | Distinct `Analysis aborted` error, non-eligible, no retry/fallback. | Cancellation is intentional, not a provider fault (invariant 5). |
| Gateway returns no choice/message | Treat as fallback-eligible. | Empty result is a transient gateway condition a later model may avoid. |
| Tool-call arguments not valid JSON | Tool input becomes `{}`; never throw. | One malformed tool call must not crash the section. |
| Gateway reports numeric usage cost | Use it; `costSource='openrouter_usage_cost'`. | Prefer ground truth over estimate (invariant 4). |
| Gateway omits cost | Local estimate; `costSource='local_estimate'`. | Cost must always be present and labeled (invariant 4). |
| Unknown model in cost table | Exact → prefix → conservative default rate. | Never crash on pricing; estimate high rather than under-report. |
| Every request | Provider preference fixes `allowFallbacks:false`, `dataCollection:'deny'`, `requireParameters:true`, `reasoning.effort:'none'`. | Deterministic provider routing; no data retention; reject providers missing required params; suppress costly reasoning tokens for this workload. |
| Client identity headers | Must be parameterized per deployment. | Engine layer must not hardcode the originating app's identity. |
| `AI_INSIGHT_LOG_PROMPTS=true` in production | Disallowed by policy; surfaces source financial data unredacted. | Privacy/compliance (invariant: §5.7). |

## 7. Reference Implementation

| Path | Symbol | Responsibility |
|---|---|---|
| `lib/ai-insight/client.ts` | `getOpenRouterClient()` | Lazy SDK singleton (apiKey, identity headers, timeout). |
| | `estimateCost(in,out,model?)` | Local per-million pricing fallback estimator. |
| | `OPENROUTER_*`, `MAX_TOKENS`, `LOG_PROMPTS` | Resolved configuration constants from ENV. |
| `lib/ai-insight/model-provider.ts` | `callAiModel(request)` | Entry: mock check → slot chain → ordered fallback loop. |
| | `callOpenRouterModel(req,attempt)` | One gateway attempt: send, normalize, cost, metadata. |
| | `toOpenRouterMessages` / `normalizeOpenRouterContent` | Wire-shape adapters in/out. |
| | `openRouterModelsForSlot` / `openRouterProviderForSlot` / `baseProviderPreference` | Slot → model chain / provider order. |
| | `normalizeOpenRouterSdkError` / `isOpenRouterFallbackStatus` | Error classification & fallback eligibility. |
| | `summarizeProviderMetadata` | Section-level metadata aggregation. |
| `lib/ai-insight/mock-llm.ts` | `mockAiModelResponse(request)` | Deterministic per-slot response; "bad" → no-delimiter summary. |
| `lib/ai-insight/types.ts` | `Ai*` types | Shared message/tool/metadata contracts (§4.3–4.4). |

**Slot routing (key shape):**

```ts
component → models [COMPONENT_MODEL, COMPONENT_FALLBACK_MODEL]   provider order = COMPONENT_PROVIDER_ORDER (7 entries)
summary   → models [SUMMARY_MODEL, ...SUMMARY_FALLBACK_MODELS]   provider order = SUMMARY_PROVIDER_ORDER (5 entries)

baseProviderPreference(order) = { order, allowFallbacks:false, requireParameters:true, dataCollection:'deny' }
```

**Configuration owned by this layer** (authoritative copy of the `03` rows of `00` §8):

| Variable | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | `''` | Gateway auth. Empty ⇒ live calls hard-fail (non-eligible); use the mock switch offline. |
| `AI_INSIGHT_OPENROUTER_TIMEOUT_MS` | `45000` | Per-request HTTP timeout. |
| `AI_INSIGHT_OPENROUTER_COMPONENT_MODEL` | `deepseek/deepseek-v4-flash` | Primary `component` model. |
| `AI_INSIGHT_OPENROUTER_SUMMARY_MODEL` | `deepseek/deepseek-v4-pro` | Primary `summary` model. |
| `AI_INSIGHT_OPENROUTER_COMPONENT_FALLBACK_MODEL` | `deepseek/deepseek-v4-pro` | `component` chain fallback. |
| `AI_INSIGHT_OPENROUTER_SUMMARY_FALLBACK_MODELS` | `z-ai/glm-5.1` | Comma-separated ordered `summary` fallbacks. |
| `AI_INSIGHT_MOCK_LLM` | unset | Set ⇒ deterministic offline responses; the value `bad` drives the parser-fallback path. |
| `AI_INSIGHT_LOG_PROMPTS` | `false` | `true` ⇒ unredacted prompt+response to stdout. Must stay off in production (§5.7). |

`MAX_TOKENS` (component output budget) is a code constant of `2048`, not an ENV var; the summary pass uses a larger budget set by doc 04.

## 8. Verification checkpoint

**Setup (no source access):** implement the boundary per §3–§5; build a tiny harness that calls `callAiModel`. Checks 1–3 need no gateway and no credential because the mock path intercepts first. Checks 4–6 exercise the live-path adapter; for the cancellation check, configure a non-empty dummy credential and stub the gateway/client so the test observes the already-aborted signal without making a network call. An empty credential must fail at the credential gate before cancellation can be tested.

**Action & expected observable result:**

1. **Offline component call.** Set the mock switch to any value; call with `slot:'component'`, one user message. Expect: exactly one `text` content block; `usage.costSource === 'local_estimate'`; non-zero token counts; `providerMeta.upstreamProvider === 'mock'`; **no outbound network connection** (verify with no network / a blocked socket).
2. **Offline summary call, well-formed.** Mock switch set to a normal value; `slot:'summary'`. Expect a text block containing the delimiter markers (`===INSIGHT===` … `---DETAIL---` … `===END===`).
3. **Offline summary call, malformed.** Mock switch set to the "bad" value; `slot:'summary'`. Expect a text block with **no** delimiter markers (drives doc 04's parser fallback).
4. **Fail-fast misconfiguration.** Mock switch unset, API key empty; call any slot. Expect an immediate error whose classification is **non-fallback-eligible** (no model chain iteration, no network).
5. **Cancellation.** Provide an already-aborted signal with the mock unset and a non-empty dummy credential/stubbed gateway. Expect the distinct `Analysis aborted` error, classified non-eligible. With an empty credential, the expected result is instead the fail-fast credential error from Check 4.
6. **Cost provenance.** Inspect any response: `usage.costUsd` is a number and `usage.costSource` is exactly one of the two enum values, consistently with whether a gateway cost was present.

**Definition of Done:** a developer who has read only `00` and `03`, with no access to this repo's source, can implement the boundary and a mock such that all six checks pass — and the layers above can be developed and tested entirely offline through it.
