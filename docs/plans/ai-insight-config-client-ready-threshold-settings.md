# Plan: AI Insight Config - Client-Ready Threshold Settings

> Status: Draft for user review. Do not implement until approved.  
> Scope: `Hoi-Yong_Finance` only. This plan corrects the AI Insight Config presentation after the configurable-threshold implementation.  
> Important: existing Phase 4 work is uncommitted. A new implementation session must check `git status` first and preserve existing user/agent changes.

## Problem

The current AI Insight Config page proves the technical threshold plumbing, but the result is not client-ready.

The page exposes internal implementation language such as:

- `Top 1 severe above`
- `Top 10 diversified below`
- `Composite rule. Final band is defined in the rendered prompt.`
- raw prompt text beside editable controls without enough product framing

This is understandable to the developer who built the token registry, but not to a non-technical superadmin or client. The client needs to see business settings, not prompt-engineering internals.

## Product Direction

AI Insight Config should be a business configuration page.

The user-facing layer should answer:

- What business rule am I changing?
- What does this value mean?
- What output label will AI Insight use after I save?
- Which prompt will receive the saved value?

The technical layer should remain internal:

- token names
- registry group IDs
- prompt placeholders
- monotonic validation rules
- numeric guard details

## Target Before/After Shape

The implementation must optimize for this kind of change. The point is not only to rename labels. The Configuration UI must feel like business rule editing, not registry editing.

### Example 1 - Top Expenses

Bad current shape:

```text
Configuration

Expense concentration
Lower is better

Top 1 severe above        [30] %
Top 1 concentrated above  [15] %
Top 10 concentrated above [75] %
Top 10 diversified below  [50] %

Composite rule. Final band is defined in the rendered prompt.
```

Client-ready shape:

```text
Top Expenses: Cost Concentration Rules

These settings control how AI Insight judges whether expenses are spread across many accounts or concentrated in only a few.

Single-account risk

Severe risk
AI Insight marks Top Expenses as Severe when one account is more than:

[30] % of total cost

Concentrated risk
AI Insight marks Top Expenses as Concentrated when one account is more than:

[15] % of total cost

Result:
15% to 30% = Concentrated
Above 30% = Severe

Top-10 concentration

Concentrated cost base
AI Insight marks the cost base as Concentrated when the top 10 accounts are more than:

[75] % of total cost

Diversified cost base
AI Insight marks the cost base as Diversified when the top 10 accounts are less than:

[50] % of total cost

Result:
Below 50% = Diversified
Above 75% = Concentrated
```

### Example 2 - Average Collection Days

Bad current shape:

```text
Collection days band
Lower is better

Good at or below    [30] days
Warning at or below [60] days

> 60 days = Critical
```

Client-ready shape:

```text
Average Collection Days: Payment Speed Rules

These settings control how AI Insight describes collection speed.

Good collection speed
AI Insight marks collection speed as Good when average collection days are:

[30] days or less

Warning collection speed
AI Insight marks collection speed as Warning when average collection days are:

[60] days or less

Result:
0 to 30 days = Good
31 to 60 days = Warning
Above 60 days = Critical
```

### Example 3 - Balance Sheet Current Ratio

Bad current shape:

```text
Current ratio
Higher is better

Healthy below [2.0]
Thin below    [1.2]
Severe below  [1.0]
```

Client-ready shape:

```text
Balance Sheet: Liquidity Rules

Current Ratio measures whether the company can cover short-term liabilities with short-term assets.

Strong liquidity
AI Insight marks liquidity as Strong when Current Ratio is above:

[2.0]

Healthy liquidity
AI Insight marks liquidity as Healthy when Current Ratio is at least:

[1.2]

Severe liquidity risk
AI Insight marks liquidity as Severe when Current Ratio is below:

[1.0]

Result:
Below 1.0 = Severe
1.0 to 1.2 = Thin
1.2 to 2.0 = Healthy
Above 2.0 = Strong
```

The guiding rule:

```text
Do not show: "Edit threshold token top_1_severe_pct"
Show instead: "At what point should AI Insight warn the business that one expense account is too dominant?"
```

## Answer: Do We Need Multiple Sessions?

Yes. Split this into at least two sessions.

### Session 1 - Planning only

This session creates and reviews this corrective plan.

No implementation.
No commit.

### Session 2 - UI and metadata correction

Implement the client-ready Configuration UI and Playwright verification.

This is the main implementation pass.

### Optional Session 3 - Prompt copy alignment

Do this only if Session 2 reveals that many runtime prompts read badly after the UI is fixed.

Do not rewrite all user prompts blindly in Session 2. There are many prompts, and broad prompt rewrites create regression risk for AI output quality.

## Answer: Should We Improve The Prompt To Flow With Business-Rule Sentences?

Yes, but with a clear boundary.

The Configuration UI should be the main client-readable layer. The runtime prompt is still an LLM instruction, so it does not need to read like a settings page.

However, the prompt should be aligned where threshold language is confusing, inconsistent, or duplicated in a way that makes the UI feel wrong.

Correct approach:

- Keep prompt placeholders and runtime injection.
- Keep the rendered prompt visible as an advanced read-only preview.
- Improve prompt wording only where it helps consistency and trust.
- Do not simplify a threshold if it changes the business rule.
- Do simplify the way thresholds are presented to the user.

Example:

Current UI label:

```text
Top 1 severe above
```

Client-ready setting:

```text
Severe single-account risk
Mark Top Expenses as severe when one account is more than [30] % of total cost.
```

Prompt can remain:

```text
- Top 1 >30% = Severe (single-account risk)
```

That is acceptable because the prompt is the AI instruction. The UI must not expose `top_1_severe_pct` thinking.

## Design Decisions

### 1. Separate display metadata from runtime tokens

Add client-facing metadata to the threshold registry or a nearby presentation map.

Session 2 decision: keep runtime threshold metadata stable, and add a presentation layer that is returned by the existing config APIs. The Configuration UI must read business copy from this presentation layer. It must not infer client-facing labels from `token`, `group.id`, or the current technical `label` fields.

Each token or business rule needs:

- `displayLabel`
- `businessSentence`
- optional `helpText`
- optional `resultLabel`
- optional `example`

For grouped business rules, the presentation layer also needs:

- `businessRuleId`
- `tokenRefs`
- `derivedBands`
- `appliesToPromptLabel`

Internal fields stay internal:

- `token`
- `group.id`
- `direction`
- `enforceMonotonic`
- `valueType`

### 2. Group complex thresholds into business rules

Some prompts have several related values. Do not render each raw token as an isolated setting if that makes the page confusing.

For example, `ex_top_expenses` should show two business groups:

#### Single-account concentration

- Concentrated when the largest account is above `[15]%`
- Severe when the largest account is above `[30]%`
- Derived band: `15% to 30% = Concentrated`, `above 30% = Severe`

#### Top-10 concentration

- Concentrated when top 10 accounts are above `[75]%`
- Diversified when top 10 accounts are below `[50]%`
- Derived band: `below 50% = Diversified`, `above 75% = Concentrated`

This is much easier to defend to a client than four raw controls.

### 3. Keep prompt preview, but reframe it

Rename `Prompt` to something clearer, such as:

- `AI Prompt Preview`
- `Read-only AI Prompt`

Add a short, high-contrast line:

```text
This preview shows the exact instruction AI Insight receives after saved settings are applied.
```

The preview should remain read-only.

### 4. Hide developer wording from the main UI

The main Configuration panel must not show:

- token names
- `Composite rule`
- `Higher is better` / `Lower is better` as the only explanation
- registry IDs
- placeholder syntax
- raw technical token labels such as `Top 1 severe above`

Use plain business language instead:

- `Higher value is better for this metric`
- `Lower value is better for this metric`
- `AI Insight will classify this as Critical above 60 days`

If a selectable component does not yet have presentation metadata, do not fall back to raw token controls. Show a high-contrast read-only state such as:

```text
Business settings for this prompt are not client-ready yet.
```

This prevents a partial implementation from leaking developer labels on components outside the initial coverage set.

### 5. Keep validation strict but readable

Validation messages should be business-readable.

Bad:

```text
Top 1 severe above must be less than Top 1 concentrated above.
```

Good:

```text
The severe threshold must be higher than the concentrated threshold.
```

For descending/lower-is-better metrics:

```text
The warning limit must be higher than the good limit.
```

This applies to both client-side validation and server-returned save errors. The UI should map server errors to business-readable messages before display, or the API should return business-readable errors directly. Do not show raw token labels in error messages.

### 6. Keep technical search behavior from leaking into the UI

Search may still match hidden technical fields for admin convenience, but results and visible labels must stay business-readable.

Do not type forbidden labels into Playwright search fields before asserting they are absent. If the test searches for `Top 1 severe above`, that text becomes visible inside the search input and invalidates the check. Search by component name or business label instead.

### 7. Keep prompt preview visible for this demo

For Session 2, keep the prompt preview visible in the right panel on desktop and stacked below Configuration on smaller screens.

Do not collapse it under `Advanced` in this pass. The current demo needs to prove that saved business settings flow into the exact AI instruction.

System prompts may remain in the tree, but they should be read-only and clearly separated as AI instructions, not editable client settings. The default selection should remain a configurable component, not a system prompt.

## Implementation Plan For Next Session

### Step 1 - Audit current threshold surfaces

Review:

- `apps/dashboard/src/lib/ai-insight/threshold-config.ts`
- `apps/dashboard/src/components/admin/ai-insight-config/ConfigurationPanel.tsx`
- `apps/dashboard/src/components/admin/ai-insight-config/PromptTextPanel.tsx`
- `apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx`
- `apps/dashboard/e2e/ai-insight-config.spec.ts`

Confirm where labels, descriptions, validation copy, and prompt preview title come from.

### Step 2 - Add presentation metadata

Extend threshold definitions or add a separate presentation map.

Recommended smallest change:

- keep current runtime registry structure
- add a presentation layer for business-rule copy and grouping
- expose the presentation fields through `GET /api/admin/ai-insight-config` and the `PUT /api/admin/ai-insight-thresholds` response
- do not use runtime token labels as UI fallback copy
- either populate presentation metadata for every editable threshold group, or hide/edit-disable groups without presentation metadata behind the read-only "not client-ready yet" state

Required first components:

- `avg_collection_days`
- `bs_statement`
- `ex_top_expenses`

These cover:

- simple days threshold
- ratio threshold
- complex concentration threshold

If any other configurable component remains editable in Session 2, it must also have client-facing presentation metadata.

### Step 3 - Rewrite Configuration UI into business-rule cards

Change the panel from raw token controls to rule-based controls.

For each setting:

- show a business label
- show a sentence containing the editable value
- keep the numeric input or slider
- show unit clearly
- show derived result bands in plain language
- show which selected prompt receives the saved value

Business-rule cards may group multiple runtime tokens. Do not change DB token names or prompt placeholder names to achieve this.

Example for `avg_collection_days`:

```text
Good collection speed
AI Insight marks collection speed as Good when average collection days are [30] days or less.

Warning limit
AI Insight marks it as Warning up to [60] days.

Derived:
Above 60 days = Critical.
```

Example for `ex_top_expenses`:

```text
Severe single-account risk
AI Insight marks Top Expenses as Severe when one account is more than [30]% of total cost.

Concentrated single-account risk
AI Insight marks it as Concentrated when one account is more than [15]% of total cost.

Derived:
15% to 30% = Concentrated.
Above 30% = Severe.

Top-10 concentration
AI Insight marks Top Expenses as Concentrated when the top 10 accounts are more than [75]% of total cost.

Diversified cost base
AI Insight marks Top Expenses as Diversified when the top 10 accounts are less than [50]% of total cost.

Derived:
Below 50% = Diversified.
Above 75% = Concentrated.
```

### Step 4 - Reframe the prompt panel

Change the panel title and explanatory text.

Recommended copy:

```text
AI Prompt Preview
Exact instruction sent to AI Insight after saved settings are applied.
```

Do not make the prompt editable.

### Step 5 - Improve prompt copy only where needed

Do a narrow alignment pass for the first covered prompts.

Rules:

- Keep the same business thresholds.
- Keep placeholders.
- Avoid broad rewrites.
- Prefer consistent labels between Configuration and prompt preview.

For `ex_top_expenses`, the current prompt is acceptable technically, but can be made clearer by grouping the two concentration concepts:

```text
Thresholds:
- Single-account concentration: >{{ex_top_expenses.top_1_severe_pct}}% = Severe; {{ex_top_expenses.top_1_concentrated_pct}}-{{ex_top_expenses.top_1_severe_pct}}% = Concentrated
- Top-10 concentration: >{{ex_top_expenses.top_10_concentrated_pct}}% = Concentrated; <{{ex_top_expenses.top_10_diversified_pct}}% = Diversified
```

Use the real existing token names if implemented.

### Step 6 - Update Playwright tests

Add browser assertions that prove the client-facing UI no longer leaks developer wording.

Required assertions:

- Search by `Top Expenses` or `Severe single-account risk`, not by a hidden technical label.
- `Top 1 severe above` is not visible in the tree, Configuration panel, or validation messages.
- `Composite rule` is not visible in the Configuration panel.
- `Severe single-account risk` is visible for `ex_top_expenses`.
- `AI Prompt Preview` is visible.
- An invalid edit shows a business-readable validation message, not a raw token label.
- Saving a changed value updates:
  - Configuration sentence
  - prompt preview
  - persisted threshold value

Take a screenshot after the test.

### Step 7 - Run verification

Required commands:

```bash
cd apps/dashboard
bun run test:thresholds
bun run build
./node_modules/.bin/playwright test e2e/ai-insight-config.spec.ts
```

Report the exact pass/fail result.

## Acceptance Criteria

The work is acceptable only if:

- A non-technical client can understand what each setting does.
- The UI does not expose token names or developer labels.
- The UI does not fall back to raw registry labels when presentation metadata is missing.
- Save and validation errors are business-readable.
- Complex prompts are grouped into understandable business rules.
- Prompt preview clearly explains why values appear inside the prompt.
- Runtime prompt injection still works.
- Numeric guard and threshold regression still pass.
- Playwright covers the revised UI.
- No unrelated prompt rewrites are included.

## Non-Goals

Do not do these in the corrective implementation:

- Do not move work to `Hoi-Yong_HR`.
- Do not redesign the whole AI Insight Config page.
- Do not rewrite every user prompt in one pass.
- Do not remove Component Insight entry points or magnifying-icon actions in this threshold-settings pass.
- Do not change the AI analysis architecture.
- Do not change threshold values.
- Do not remove the prompt preview.
- Do not commit without user approval.

## Deferred Study - Duplicate Component Insight Scope

User review of the Sales KPI metadata found a deeper product issue: some dashboard components repeat the same analysis scope. Example:

- `net_sales` already covers invoice/cash mix and credit-note impact.
- `invoice_sales` repeats the invoice/cash mix rule from a narrower KPI card.
- `credit_notes` repeats the credit-note impact rule unless it provides deeper spike/root-cause analysis.

This is not only a Sales issue. Before removing any Component Insight magnifying icons, run a separate cross-dashboard study across all Finance sections.

Study scope:

- Scan every dashboard component and every component prompt, not only Sales.
- Identify duplicate or supporting-only prompts that repeat a parent component's analysis.
- Decide which components deserve their own Component Insight model call.
- Decide which components should remain visible dashboard metrics but should not expose a Component Insight action.
- Decide whether repeated KPI prompts should be removed, merged into parent prompts, or rewritten to provide distinct analysis depth.
- Estimate cost impact from removing duplicate Component Insight calls.
- Preserve executive readability and trust; do not remove an insight entry point if it is the only place where a material risk is explained.

Initial Sales hypothesis for the future study:

- Keep Component Insight for `net_sales`.
- Keep Component Insight for `net_sales_trend`.
- Review whether `invoice_sales` should lose its Component Insight action because it is likely a supporting KPI.
- Review `credit_notes` separately. It should either lose its duplicate Component Insight action or be rewritten to focus only on credit-note spikes, top months, and operational root-cause evidence.

Do not implement this during threshold metadata sessions. Discuss and approve the study plan first when this work is prioritized.

## Resolved Review Decisions

1. Keep the prompt preview visible for Session 2. Do not collapse it under `Advanced` yet.
2. Every exposed editable threshold needs business presentation metadata. If Session 2 only covers selected prompts, all other configurable threshold groups must be non-editable/read-only and must not show raw token labels.
3. Keep system prompts read-only and clearly separated as AI instructions. Default the page to the first configurable component, not a system prompt.
4. Do not use `H1` / `H2` half-period wording in AI Insight prompts or data blocks. Hoi Yong users recognize quarter-based language instead. For `invoiced_vs_collected`, group sub-period analysis by Hoi Yong fiscal quarters: Q1 = Mar-May, Q2 = Jun-Aug, Q3 = Sep-Nov, Q4 = Dec-Feb. If later sessions encounter H1/H2 wording in prompt copy or fetcher output, replace it with fiscal-quarter wording and keep the model rule that sub-period averages must be copied from pre-calculated data.
5. Sales KPI metadata exposed a broader duplicate Component Insight problem. Do not remove magnifying-icon Component Insight actions inside the threshold-settings implementation. Treat duplicate insight scope as a separate cross-dashboard study across all Finance sections.
