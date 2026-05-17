# 04 — Insight Generation & Prompts

> **Classification:** Domain Pack
> **Enables:** Per-section insight generation: data fetch, prompt assembly, token rendering, numeric guard, and the tool-capable summary pass.
> **Read after:** 00, 01, 02, 03 — verbatim prompt text is the companion catalog **04a**.

---

## 1. Purpose

This layer is the **per-section generation pipeline**. Given one section (its ordered component list and resolved scope) it produces a single, persistence-ready section result: a narrated analysis for every component, a synthesized section summary split into positive and negative insights, a numeric-validation report, and aggregated cost/token/provider metadata.

It owns two domain-specific things: the **prompt assembly** (how the fixed prompt bodies and the live data are composed into the messages sent to the model) and the **numeric guard** (the rule that the model may narrate only numbers the engine actually fetched). It owns the *mechanism* of threshold-token substitution; the tokens themselves and their values are defined in doc 02. The verbatim prompt bodies live in the companion catalog **04a**.

After this document you can build the pipeline that the batch runner (doc 05) calls once per section and whose output the storage layer (doc 01) persists.

## 2. Prerequisites

- **Doc 00** — §3 vocabulary (section, component, scope, insight, threshold token); the Engine/Domain split (this layer is Domain Pack — finance specifics are intentional here); the ENV row `AI_INSIGHT_DEBUG_FILE` (owned by `04`).
- **Doc 01** — the result shapes storage consumes (`ComponentResult`, `SummaryJson`, the section result it persists — doc 01 §4.3) and the local-pool source read contract.
- **Doc 02** — the catalog (`section → [{key,name,type}]`, section→page, section→display-name, section→scope), and the threshold contracts this layer *calls*: `renderThresholdText`, `allowedThresholds`. Threshold tokens are **defined in 02**; this doc only references and renders them.
- **Doc 03** — the model boundary `callAiModel`, the two slots (`component`, `summary`), the message/tool contracts (`AiMessage`, `AiTool`, `AiToolChoice`), `AiProviderMetadata`, and `summarizeProviderMetadata`.
- **Doc 04a** — the Prompt Catalog: the verbatim global/summary system prompts and one entry per component. This doc specifies *how* prompts are assembled; 04a is *what* text is assembled.

## 3. Concept & Contract

> *Stack-neutral mechanism. The domain content it operates on is finance (this is a Domain Pack doc), but the pipeline shape below is reusable for any domain.*

The pipeline is a function: **`(section identity, scope) → section result`**, built on three injected contracts — a per-component **data fetcher**, a **model boundary** (two slots), and a **threshold renderer + allow-list**.

**Two stages.**

1. **Component fan-out.** For each component of the section, fetch its pre-computed data, assemble a single-turn prompt (no tools), call the cheap model slot, and keep the model's narrative plus the fetched data and its numeric allow-list. Bounded concurrency; a per-section cost ceiling and a wall-clock ceiling apply across the whole stage.
2. **Summary pass.** Assemble one prompt from every component's *about* text + raw data, run a **tool-capable agent loop** on the stronger model slot (the model may issue a bounded number of read-only data queries for evidence), then validate every number in the model's output against the union of all components' allow-lists. On failure, issue one corrective turn and retry; on a second failure, accept but flag.

**Inputs (abstract):** a section key; its ordered components (key, display name, type) from the catalog; a resolved scope (calendar range, snapshot, or fiscal period); the data-fetch contract; the model contract; the threshold contract.

**Outputs (abstract):** a section result = `components[]` (each: key, type, raw data block, narrative, numeric allow-list, tokens, cost, provider metadata) + a `summary` (≤3 positive + ≤3 negative structured insights, a numeric-guard report, aggregated provider metadata) + total tokens + total cost.

**Invariants.**

1. **The model narrates; it never computes.** Every numeric token the model emits must match a value the engine fetched (within unit tolerance) or a value returned by an in-loop tool call, or it is rejected. Pre-computed sub-period figures must be quoted, not re-derived.
2. **Prompt prose is fixed; only threshold tokens vary.** Editing a threshold value must never require editing prompt text. Substitution is mechanical and applied at render time.
3. **A section is produced atomically.** `runSectionAnalysis` returns exactly one section result or throws; no partial section is persisted.
4. **Everything is bounded.** Concurrency, tool calls per summary, cost per section, wall-clock runtime, and numeric-guard attempts all have hard ceilings.
5. **Data fetch is fail-soft.** A missing fetcher or a fetch error yields an explanatory empty data block and an empty allow-list — never an exception that aborts the section.
6. **Identical guidance to both stages.** The per-component *about* text shown to the summary model is the same rendered prompt body used for the component call, so the two stages cannot disagree on thresholds.

**Boundary.** Above: the batch runner (doc 05) calls this once per active section and hands the result to storage (doc 01). Below: doc 02 supplies catalog + data + token values; doc 03 supplies the model. 04a supplies the verbatim text this layer arranges.

## 4. Data contracts

### 4.1 Produced here — consumed by storage (doc 01 §4.3 lists these as owned by `04`)

```ts
interface ComponentResult {
  component_key: string;
  component_type: 'kpi' | 'chart' | 'table' | 'breakdown';
  raw_data_md: string;        // the fetched, threshold-rendered data block
  analysis_md: string;        // the component model's narrative ('No analysis generated.' if none)
  allowed: AllowedValue[];    // numeric allow-list for this component (feeds the guard)
  token_count: number;        // input+output
  input_tokens: number;
  output_tokens: number;
  cost_usd?: number;
  providerMeta?: AiProviderMetadata;
}

interface SummaryInsight {
  title: string;              // ≤50 chars
  metric?: string;            // ≤25 chars, e.g. "84.3%", "43 days", "RM 2.1M"
  summary?: string;           // ≤80 chars, plain text, collapsed-card preview
  detail: string;             // markdown body
}

interface NumericGuardReport {
  passed: boolean;
  attempts: number;
  unmatched: { raw: string; value: number; unit: string }[];
}

interface SummaryJson {
  good: SummaryInsight[];     // ≤3
  bad: SummaryInsight[];      // ≤3
  numericGuard?: NumericGuardReport;
  providerMeta?: AiProviderMetadata;
}

// orchestrator return
interface AnalysisResult {
  components: ComponentResult[];
  summary: SummaryJson;
  totalTokens: number;
  totalCost: number;
  providerMeta?: AiProviderMetadata;
}
```

### 4.2 Consumed — owned elsewhere

| Contract | Owner | Used for |
|---|---|---|
| `SECTION_COMPONENTS` (`section → [{key,name,type}]`), `SECTION_NAMES`, `SECTION_PAGE`, `SECTION_SCOPE` | 02 | Which components to run, prompt header text, scope resolution |
| `fetchComponentData(componentKey, sectionKey, dateRange, fiscalPeriod?) → { prompt, allowed }` (`FetcherResult`) | 02 (data) / 01 (read contract) | Per-component pre-computed data + its allow-list |
| `renderThresholdText(text, componentKey)`, `allowedThresholds(componentKey)` | 02 | Token substitution; threshold values added to the guard allow-list |
| `callAiModel`, `AiMessage`, `AiTool`, `AiToolChoice`, `AiProviderMetadata`, `summarizeProviderMetadata` | 03 | The two model calls and metadata aggregation |
| `AllowedValue { label; value; tolerance?; unit? }`, `AllowedValueUnit = 'RM'\|'pct'\|'days'\|'count'\|'ratio'` | 01/02 shared types | Numeric allow-list entries |

### 4.3 Owned here — prompt & tool shapes

- **Component user message:** `<rendered component prompt>` + a `Page/Section/Component/<scope line>` header + `Current Values:` + the fetched data block.
- **Summary user message:** a `Section/Page/<scope>/Generated` header, a tool-budget line, one `### Component N: <name> (<type>)` block per component carrying `About:` (the rendered component prompt) and `Raw Data:` (that component's fetched block), then the closing instruction to emit the delimiter format.
- **Tool schema** (`AI_TOOLS`, two read-only tools) and **`ToolPolicy = 'none' | 'aggregate_only' | 'full'`** (§5.5).

## 5. Behavior & flow

`[VERSION-SENSITIVE]` — Node/TypeScript, in-process. The pipeline is a plain async function tree; on another stack the only constraints are the ordering and the bounds below.

### 5.1 `runSectionAnalysis(sectionKey, dateRange, abortController, onProgress, fiscalPeriod=null)`

1. Look up the section's components from the catalog. **Unknown section ⇒ throw** (`Unknown section: <key>`).
2. Open a debug session (§5.7) — returns a log file path or `null`.
3. Start a wall-clock timer of **`MAX_RUNTIME_MS` = 5 min**; on fire, mark timed-out and `abortController.abort()` (cancels all in-flight model calls via the shared signal).
4. **Stage 1 — component fan-out** with a concurrency pool of **`MAX_CONCURRENCY` = 2**:
   - For each component: `onProgress(key,'analyzing')` → `analyzeComponent(...)` → push result; accumulate tokens and cost.
   - After each, if cumulative cost **> `MAX_COST_PER_SECTION` = $0.50** ⇒ throw (cost ceiling).
   - `onProgress(key,'complete')`; on error `onProgress(key,'error',msg)` then rethrow (unless already aborted, in which case swallow).
   - The pool keeps ≤2 in flight via `Promise.race`. If the signal is aborted, throw `Analysis timed out. Please try again.` (timeout) or `Analysis cancelled`.
5. **Stage 2 — summary**: `onProgress('summary','analyzing')` → `runSummaryAnalysis(...)` → accumulate tokens/cost → `onProgress('summary','complete')`.
6. Log session end; return `{ components, summary: summary.json, totalTokens, totalCost, providerMeta: summary.json.providerMeta }`. The runtime timer is always cleared in `finally`.

### 5.2 `analyzeComponent(...)` — one component, single turn, no tools

1. `fetchComponentData(componentKey, sectionKey, dateRange, fiscalPeriod)` → `{ prompt: formattedValues, allowed }`. This call (doc 02) resolves the section scope, runs the component's fetcher against the **local pre-computed pool**, prepends a scope label, **renders threshold tokens into the scope+data text**, and appends `allowedThresholds(componentKey)` to the allow-list. It never throws (fail-soft).
2. `getGlobalSystemPrompt()` → the global component system prompt (verbatim in 04a).
3. `buildComponentUserPrompt(...)` → `<getComponentPrompt(key)>` + header + `Current Values:\n<formattedValues>`. `getComponentPrompt` reads the fixed body and applies `renderThresholdText(body, key)`; **a component with no prompt body throws** (`No prompt defined for component: <key>`).
4. If prompt logging is on (doc 03 §5.7) the full system+user prompts are echoed to stdout. The debug session logs the same to file (§5.7).
5. Abort check, then **one** `callAiModel({ slot:'component', model:AI_MODEL, maxTokens:MAX_TOKENS (2048), system, messages:[{role:'user',content:userPrompt}], abortSignal })`.
6. Take the first text block as the narrative (`'No analysis generated.'` if none). Return the `ComponentResult` (§4.1) with `raw_data_md = formattedValues`, the component's `allowed`, tokens, cost, and provider metadata.

### 5.3 `runSummaryAnalysis(...)` — one section synthesis with numeric-guard retry

1. `getSummarySystemPrompt()` (verbatim in 04a) + `buildSummaryUserPrompt(...)`: header (`Section`, `Page`, scope line, `Generated <ts>`), the tool-budget sentence, then per component a block — `### Component N: <name> (<type>)`, `About:` the **rendered** component prompt (so summary sees identical guidance — invariant 6), `Raw Data:` that component's `raw_data_md` — and the closing line *"Produce the summary now using the ===INSIGHT=== delimiter format."*
2. Tools for the section = `toolsForSection(sectionKey)` (§5.5); `toolsAllowed` iff non-empty.
3. Allow-list = the union (`flatMap`) of every component's `allowed`.
4. Guard loop, **`MAX_GUARD_ATTEMPTS` = 2**:
   - Run the agent loop (§5.4) → text + tokens + cost + provider metas + tool-result texts.
   - Parse the text (§5.6).
   - **Whitelist live tool numbers:** every bare number in this attempt's tool results (permissive extractor) is added to the allow-list under *all* units — tool results are ground truth pulled live from the DB.
   - `runNumericGuard(text, allowList)` (§5.5). If clean ⇒ break. If this was the last attempt ⇒ break (accept, flagged). Otherwise append the assistant text and a corrective user message listing the offending values, and retry.
5. Attach to the parsed JSON: `numericGuard = { passed: noUnmatched, attempts, unmatched[] }` and `providerMeta = summarizeProviderMetadata(allMetas, lastMeta)`. Return it with token/cost totals.

### 5.4 Summary agent loop (one attempt)

```
loop:
  turn++; isLastTurn = toolCallCount >= MAX_TOOL_CALLS_PER_SUMMARY (2)
  includeTools = toolsAllowed && !isLastTurn
  resp = callAiModel({ slot:'summary', model:SUMMARY_MODEL, maxTokens:SUMMARY_MAX_TOKENS (4096),
                       system, tools?:sectionTools, messages, abortSignal })
  accumulate tokens/cost; push providerMeta; log
  if resp.stopReason != 'tool_use'            → finalize(resp)
  toolBlocks = resp tool_use blocks; if none  → finalize(resp)
  push assistant(resp.content)
  for each toolBlock:
     toolCallCount++
     err = validateToolForSection(sectionKey, name, input)   // policy gate (§5.5)
     result = err ?? executeToolCall(name, input)             // read-only query (§5.5)
     collect result text; push tool_result(id, result)
  push user(toolResults)
  if toolCallCount >= 2 → push user("You have used all available tool calls. Now produce
                                     your final summary using the ===INSIGHT=== delimiter
                                     format. Do not request more data …")
```

`finalize` extracts the text block, echoes it to stdout if prompt logging is on, logs it, and returns.

### 5.5 Numeric guard, tool policy, tools

**Numeric guard** (`runNumericGuard(text, allowed)`):

- Extract candidate numbers with an **ordered** pattern list (first match on a span wins; date-like strings and 4-digit years are stripped/ignored): RM range with shared `M/K`; `RM n[.n] M/K`; plain `RM` amount (comma-grouped, signed); `% / percent / pp`; `n days`; ratio (`current ratio` / `debt-to-equity` / `D/E`); bare integer count followed by a domain noun.
- Each candidate carries a normalized `value` and a `unit ∈ {RM, pct, days, count, ratio}`.
- A candidate **passes** if any of: it is a safe small integer count (0–12, 30, 60, 80, 90, 100, 120, 365); it matches an allowed value within tolerance; it is a derivable percentage of two allowed values (±0.2); or it is a supported lower-bound claim ("over/above/more than/≥ X" where some allowed value exceeds X). Default tolerances: RM ±1, pct ±0.1, days ±0.1, count ±0.5, ratio ±0.01 — plus RM also matches on absolute value and ±5% relative; pct also ±1.0 absolute or ±1% relative; days also ±1.0 absolute (display rounding).
- Unmatched candidates ⇒ guard fails; `formatGuardError` produces the corrective message demanding verbatim values only.

**Tool policy** (`policyForSection` → `toolsForSection` / `validateToolForSection`).

- `none` ⇒ tool array is empty; the slot is invoked without `tools`.
- `full` ⇒ both tools, full enums.
- `aggregate_only` ⇒ only `query_local_table`, with its `table.enum` filtered to the **nine** aggregate pre-compute tables: `pc_sales_daily, pc_ar_monthly, pc_ar_aging_history, pc_customer_margin, pc_supplier_margin, pc_return_monthly, pc_return_products, pc_expense_monthly, pc_pnl_period`. The tool's `description` is appended with `[POLICY: aggregate_only — only these tables allowed: ...]` so the model sees the restriction in-prompt as well as in the enum.

Server-side `validateToolForSection(sectionKey, toolName, input)` re-checks every call before execution. Outcomes:

- `full` → `null` (allow).
- `none` → string *`Tool <name> is not allowed for section <key> (policy: none).`*
- `aggregate_only` with `query_rds_table` or a non-aggregate table → string *`Tool <name> is not allowed for section <key> (policy: aggregate_only — only query_local_table on aggregate tables is permitted).`* or *`Table <name> is not allowed for section <key> (policy: aggregate_only). Allowed tables: ...`*

A rejection is a **string** returned to the model as a `tool_result` — never thrown. The model sees the message on the next turn and can pivot.

**Tool catalog** (`AI_TOOLS`, both read-only). `ROW_LIMIT = 100` caps the `limit` argument (`Math.min(input.limit ?? 100, 100)`).

#### `query_local_table` — pre-computed local Postgres

Input schema, as exposed to the model (verbatim from `AI_TOOLS`):

```ts
{
  type: 'object',
  properties: {
    table:        { type: 'string', enum: [/* 15 tables, full enum when policy=full;
                                              narrowed to 9 aggregate tables when policy=aggregate_only */] },
    columns:      { type: 'array', items: { type: 'string' },
                    description: 'Columns to select (must be from the allowed list for this table)' },
    where_clause: { type: 'string',
                    description: 'Optional WHERE clause (without the WHERE keyword). Use $1, $2, etc. for parameters.' },
    params:       { type: 'array', items: { type: 'string' },
                    description: 'Parameter values for the WHERE clause placeholders' },
    order_by:     { type: 'string',
                    description: 'Optional ORDER BY clause (without the ORDER BY keywords)' },
    limit:        { type: 'number',
                    description: 'Maximum rows to return (default: 100, max: 100)' },
  },
  required: ['table', 'columns'],
}
```

Per-table column whitelist (`LOCAL_WHITELIST`, exact and exhaustive — any column outside this list returns the string *`Columns not allowed for <table>: <list>. Allowed: <whitelist>`*):

| Table | Allowed columns |
|---|---|
| `pc_sales_daily` | doc_date, invoice_total, cash_total, cn_total, net_revenue, doc_count |
| `pc_sales_by_customer` | doc_date, debtor_code, company_name, debtor_type, sales_agent, invoice_sales, cash_sales, credit_notes, total_sales, doc_count |
| `pc_sales_by_outlet` | doc_date, dimension, dimension_key, dimension_label, is_active, invoice_sales, cash_sales, credit_notes, total_sales, doc_count, customer_count |
| `pc_sales_by_fruit` | doc_date, fruit_name, fruit_country, fruit_variant, invoice_sales, cash_sales, credit_notes, total_sales, total_qty, doc_count |
| `pc_ar_monthly` | month, invoiced, collected, cn_applied, refunded, total_outstanding, total_billed, customer_count |
| `pc_ar_customer_snapshot` | debtor_code, company_name, debtor_type, sales_agent, display_term, credit_limit, total_outstanding, overdue_amount, utilization_pct, credit_score, risk_tier, is_active, invoice_count, avg_payment_days, max_overdue_days |
| `pc_ar_aging_history` | snapshot_date, bucket, dimension, invoice_count, total_outstanding |
| `pc_customer_margin` | month, debtor_code, company_name, debtor_type, sales_agent, is_active, iv_revenue, dn_revenue, cn_revenue, iv_cost, dn_cost, cn_cost, iv_count, cn_count |
| `pc_supplier_margin` | month, creditor_code, creditor_name, item_code, item_group, is_active, sales_revenue, attributed_cogs, purchase_qty, purchase_value |
| `pc_return_monthly` | month, cn_count, cn_total, knock_off_total, refund_total, unresolved_total, reconciled_count, partial_count, outstanding_count |
| `pc_return_products` | month, item_code, item_description, fruit_name, fruit_variant, fruit_country, cn_count, total_qty, total_amount, goods_returned_qty, credit_only_qty |
| `pc_return_aging` | snapshot_date, bucket, count, amount |
| `pc_return_by_customer` | month, debtor_code, company_name, cn_count, cn_total, knock_off_total, refund_total, unresolved, outstanding_count |
| `pc_expense_monthly` | month, acc_no, account_name, acc_type, net_amount |
| `pc_pnl_period` | period_no, acc_type, acc_no, account_name, parent_acc_no, home_dr, home_cr, proj_no |

**Special case — `pc_ar_customer_snapshot` auto-dedup.** The handler runs `SELECT MAX(snapshot_date) AS d FROM pc_ar_customer_snapshot`, prefixes `snapshot_date = '<d>'` (AND-combined with any user WHERE), wraps as `SELECT DISTINCT ON ("debtor_code") <cols> FROM pc_ar_customer_snapshot WHERE … ORDER BY debtor_code`, and if the caller supplied an `order_by` wraps the whole thing as `SELECT * FROM (<inner>) sub ORDER BY <caller order_by>` so the dedup applies first and the requested sort second. Then `LIMIT 100`.

#### `query_rds_table` — read-only source SQL Server

Input schema (verbatim — note `where_clause` is **required** here, unlike the local tool):

```ts
{
  type: 'object',
  properties: {
    table:        { type: 'string',
                    enum: ['dbo.IV','dbo.CS','dbo.CN','dbo.ARInvoice','dbo.ARPayment','dbo.ARPaymentKnockOff'] },
    columns:      { type: 'array', items: { type: 'string' } },
    where_clause: { type: 'string',
                    description: "WHERE clause (without the WHERE keyword). Must include Cancelled = 'F' for applicable tables." },
    params:       { type: 'array', items: { type: 'string' } },
    order_by:     { type: 'string' },
    limit:        { type: 'number', description: 'default 100, max 100' },
  },
  required: ['table', 'columns', 'where_clause'],
}
```

Per-table column whitelist (`RDS_WHITELIST`, exact):

| Table | Allowed columns |
|---|---|
| `dbo.IV` | DocNo, DocDate, DebtorCode, LocalNetTotal, Description, SalesAgent, SalesLocation, Cancelled |
| `dbo.CS` | DocNo, DocDate, DebtorCode, LocalNetTotal, Description, SalesAgent, SalesLocation, Cancelled |
| `dbo.CN` | DocNo, DocDate, DebtorCode, LocalNetTotal, Description, SalesAgent, CNType, Cancelled |
| `dbo.ARInvoice` | DocNo, DocDate, DueDate, DebtorCode, LocalNetTotal, Outstanding, DisplayTerm, Cancelled |
| `dbo.ARPayment` | DocNo, DocDate, DebtorCode, LocalPaymentAmt, Description, Cancelled |
| `dbo.ARPaymentKnockOff` | DocKey, KnockOffDocKey, KnockOffAmt, KnockOffDate |

**`Cancelled = 'F'` server-side injection.** Applies to the five document tables `dbo.IV, dbo.CS, dbo.CN, dbo.ARInvoice, dbo.ARPayment` — **not** to `dbo.ARPaymentKnockOff` (no `Cancelled` column). Detection regex: `/Cancelled\s*=\s*'F'/i`. Rewrite:

```
if table NOT in cancelled-set     → where unchanged
if where already matches regex    → where unchanged
if where empty/blank              → "Cancelled = 'F'"
else                              → "(<where>) AND Cancelled = 'F'"
```

The model is **also** instructed in its `where_clause` description to include the filter, but server injection is the authoritative guarantee — prompt drift cannot leak a voided document.

#### `params` placeholder convention (both tools)

- `where_clause` uses Postgres-style `$1, $2, …, $N` placeholders.
- `params: string[]` supplies values in positional order.
- No application-side count check — driver under/over-supply errors are caught by `executeToolCall`'s try/catch and returned to the model as the string `Error executing query: <message>`.
- The blocklist below screens nested SQL, comments, and DDL/DML regardless of placeholder use.

#### WHERE / ORDER BY safety blocklist (`validateWhereClauseSafety`, applied to both clauses)

Eighteen patterns. A hit returns the string *`WHERE clause rejected: contains disallowed token (<label>). Use only column comparisons with $1/$2 parameter placeholders.`* — never executed.

| Pattern (case-insensitive where flagged) | Reported label |
|---|---|
| `;` | statement terminator (;) |
| `--` | line comment (--) |
| `/*` | block comment start (/*) |
| `*/` | block comment end (*/) |
| `\bUNION\b` | UNION |
| `\bSELECT\b` | nested SELECT |
| `\bINSERT\b` | INSERT |
| `\bUPDATE\b` | UPDATE |
| `\bDELETE\b` | DELETE |
| `\bDROP\b` | DROP |
| `\bTRUNCATE\b` | TRUNCATE |
| `\bALTER\b` | ALTER |
| `\bEXEC\b` | EXEC |
| `\bEXECUTE\b` | EXECUTE |
| `\bGRANT\b` | GRANT |
| `\bREVOKE\b` | REVOKE |
| `\bxp_\w+` | extended stored procedure (xp_*) |
| `\bsp_\w+` | system stored procedure (sp_*) |

#### Result formatting back to the model (`formatRowsAsTable`)

Both executors serialise rows via the same helper. Exact shape:

```
<N> row(s) returned:

| col1 | col2 | col3 |
| --- | --- | --- |
| v1 | v2 | v3 |
…
```

Cell value transforms:

- `null` / `undefined` → `-`
- `Date` → `toISOString().slice(0, 10)` (YYYY-MM-DD)
- `number` → `toLocaleString('en-MY')` (e.g. `1,234,567.89`)
- everything else → `String(v)`

Empty result: the executor returns the literal string `No rows returned.` (and `formatRowsAsTable` carries a `No data.` fallback for an empty rows array).

#### `executeToolCall(toolName, input) → Promise<string>` — never throws

```ts
try {
  if (toolName === 'query_local_table') return await executeLocalQuery(input);
  if (toolName === 'query_rds_table')   return await executeRdsQuery(input);
  return `Unknown tool: ${toolName}`;
} catch (err) {
  return `Error executing query: ${err instanceof Error ? err.message : String(err)}`;
}
```

Per-executor pipeline: column whitelist check → `validateWhereClauseSafety(where_clause)` → `validateWhereClauseSafety(order_by)` → (RDS only) `ensureRdsCancelledFilter` → driver query → `formatRowsAsTable`. Every branch returns a string; the orchestrator routes whatever comes back into a `tool_result` block whose numbers are then whitelisted under all units for the current guard attempt (§5.3 step 4).

### 5.6 Summary parsing (`parseSummaryResponse`)

Primary format (defined by the summary system prompt, verbatim in 04a):

```
===INSIGHT===
sentiment: good|bad
title: <≤50 chars>
metric: <≤25 chars>
summary: <≤80 chars, plain text>
---DETAIL---
<markdown, ~150-word soft cap>
===END===
```

Parse: split on `===INSIGHT===` (drop the preamble); per block take text up to `===END===`; split header vs detail on `---DETAIL---`; regex `sentiment|title|metric|summary`; default sentiment `good`, default title `Insight`. Route to `good`/`bad`, each capped at 3. **Fallbacks:** if no delimited insight parsed, try a fenced/raw JSON `{good,bad}` (each sliced to 3); if that fails, emit one `good` insight `{ title:'Summary generated', detail:<raw text> }`. A missing text block yields `{ good:[], bad:[] }`.

### 5.7 Debug log (owned ENV: `AI_INSIGHT_DEBUG_FILE`)

When `AI_INSIGHT_DEBUG_FILE === 'true'` a per-section file `logs/ai-debug-<section>-<timestamp>.log` is written: header, every component's full system+user prompt and model response, every tool call and (≤3000-char) result, each numeric-guard attempt, and a session summary with tokens/cost/provider path. Default off. **Like prompt logging (doc 03 §5.7), this captures raw source financial data verbatim — it must stay off in production.** This switch is owned here; the stdout prompt-logging switch is owned by doc 03.

## 6. Rules & edge cases

| Trigger | Required behavior | Why |
|---|---|---|
| Unknown section key | Throw before any work | Catalog is the contract; no silent empty section |
| Component has no prompt body | `getComponentPrompt` throws | A component without guidance must not be analysed blindly |
| Missing data fetcher / fetch error | Fail-soft: explanatory text + empty allow-list | One bad component must not abort the section (invariant 5) |
| Cumulative cost > $0.50 / section | Throw (cost ceiling) | Bounded spend per section (invariant 4) |
| Wall-clock > 5 min | Abort controller; throw timed-out | Bounded runtime; cancels in-flight calls |
| Caller aborts | Throw `Analysis cancelled` (or timed-out) | Cancellation is honored end-to-end |
| > MAX_CONCURRENCY components | Pool to 2 concurrent | Rate/cost smoothing on lower-tier plans |
| Guard fails, attempt 1 | Append corrective msg, retry once | Give the model one chance to self-correct |
| Guard fails, attempt 2 | Accept but set `numericGuard.passed=false` + list unmatched | Never block a section forever; surface the defect |
| Number from a tool result | Whitelisted under all units for that attempt | Live DB ground truth is citable |
| Safe small integer as a count | Never flagged | Ordinals/counts like "top 5", "12 months" aren't claims |
| `tool_use` with no tool blocks | Finalize the loop | Defensive: treat as a normal stop |
| Tool call under `aggregate_only` to a non-aggregate table / other tool | Return rejection string to model | Policy enforced server-side, not just in the prompt |
| LLM WHERE contains a blocklisted token | Return rejection string | SQL-injection / data-exfiltration guard |
| RDS document-table query | `Cancelled='F'` injected server-side | Voided documents can never leak even on prompt drift |
| Summary not in delimiter format | JSON fallback, then single-insight fallback | Always yield a renderable summary |
| HR sections (scaffold) | Empty component list, policy `none` | HR Domain Pack not implemented; pipeline must tolerate empty sections |
| `AI_INSIGHT_DEBUG_FILE=true` in prod | Disallowed by policy (financial data in files) | Privacy/compliance (§5.7) |

## 7. Reference Implementation

| Path | Symbol | Responsibility |
|---|---|---|
| `lib/ai-insight/orchestrator.ts` | `runSectionAnalysis` | Stage 1+2 driver, bounds, progress, atomic section result |
| | `analyzeComponent` | One component: fetch → assemble → single model call |
| | `runSummaryAnalysis` / `runSummaryAgentLoop` | Summary synthesis + tool loop + guard retry |
| | `parseSummaryResponse` | Delimiter → JSON → raw fallback parser |
| `lib/ai-insight/prompts.ts` | `SECTION_COMPONENTS/_NAMES/_PAGE`, `buildComponentUserPrompt`, `buildSummaryUserPrompt` | Catalog registry + user-message assembly |
| `lib/ai-insight/prompt-loader.ts` | `getGlobalSystemPrompt`, `getSummarySystemPrompt`, `getComponentPrompt` | Code-backed prompt bodies + `renderThresholdText` |
| `lib/ai-insight/prompts-defaults.ts` | `DEFAULT_GLOBAL_SYSTEM`, `DEFAULT_SUMMARY_SYSTEM`, `DEFAULT_COMPONENT_PROMPTS` | Verbatim bodies — catalogued in **04a** |
| `lib/ai-insight/numeric-guard.ts` | `runNumericGuard`, `extractNumbers`, `extractToolResultNumbers`, `formatGuardError` | The "narrate, don't compute" enforcement |
| `lib/ai-insight/tool-policy.ts` | `policyForSection`, `toolsForSection`, `validateToolForSection` | Per-section tool scoping |
| `lib/ai-insight/tools.ts` | `AI_TOOLS`, `executeToolCall` | Read-only local/RDS query tools + SQL safety |
| `lib/ai-insight/data-fetcher.ts` | `fetchComponentData` | Per-component pre-computed data + allow-list (fail-soft) |
| `lib/ai-insight/debug-logger.ts` | `initDebugSession`, `log*` | File debug log (`AI_INSIGHT_DEBUG_FILE`) |
| `lib/ai-insight/prompt-config.ts` | `buildPromptConfigRows` | Read projection of prompts+thresholds for the admin UI (consumed by doc 08) |

**Pipeline constants:** `MAX_CONCURRENCY=2`, `MAX_TOOL_CALLS_PER_SUMMARY=2`, `MAX_COST_PER_SECTION=$0.50`, `MAX_RUNTIME_MS=5min`, `MAX_GUARD_ATTEMPTS=2`, component `MAX_TOKENS=2048` (doc 03), `SUMMARY_MAX_TOKENS=4096`.

**`fetchComponentData` contract (exact):** `(componentKey, sectionKey, dateRange, fiscalPeriod?) → { prompt, allowed }`; dispatches on `SECTION_SCOPE[sectionKey]` to a calendar or fiscal-period fetcher; missing fetcher / missing fiscal period / thrown error all return an explanatory `prompt` with `allowed:[]`; on success returns `renderThresholdText(scopeLabel + "\n\n" + fetched.prompt, componentKey)` and `allowed = [...fetched.allowed, ...allowedThresholds(componentKey)]`.

**ENV owned by this layer** (authoritative copy of the `04` row of `00` §8):

| Variable | Default | Purpose |
|---|---|---|
| `AI_INSIGHT_DEBUG_FILE` | unset | `true` ⇒ per-section debug log to `logs/`; captures source financial data — keep off in production. |

## 8. Verification checkpoint

**Setup (no source access):** implement the pipeline per §3–§6 with: the mock model from doc 03 (set the mock switch); a stub catalog of one section with two components; stub fetchers returning a known data block plus an allow-list `[{label:'x',value:1000,unit:'RM'}]`; a no-op threshold renderer/allow-list (doc 02 stubs).

**Action & expected result:**

1. **Happy path.** Run the section. Expect a result with two `ComponentResult`s (each with the stub data in `raw_data_md`, a non-empty `analysis_md`, the stub allow-list, tokens, cost) and a `summary` parsed from the well-formed mock into `good`/`bad` (each ≤3) with `numericGuard.passed === true`, plus aggregated `totalTokens`/`totalCost` and a `providerMeta`.
2. **Parser fallback.** Switch the mock to its "bad" value; rerun. Expect the summary to fall back to a single `good` insight (`title:'Summary generated'`) — the pipeline still returns a valid result.
3. **Numeric guard.** Feed (via a stubbed summary text) a number absent from every allow-list, e.g. `RM 999,999`. Expect: guard fails attempt 1, a corrective user turn is appended, attempt 2 runs, and `summary.numericGuard.passed === false` with the offending value listed in `unmatched`.
4. **Fail-soft fetch.** Make one component's fetcher throw. Expect that component's `raw_data_md` to be the explanatory error text, `allowed: []`, the other component unaffected, and the section result still returned.
5. **Bounds.** Set the stub component cost above $0.50 → expect a thrown cost-ceiling error and no section result.

**Definition of Done:** a developer who has read only `00`–`04` (with `04a` for verbatim text), no source access, can build the pipeline and pass all five checks.
