# Plan: AI Insight Config - Configurable Thresholds + Remove Feedback Loop

> Status: Approved 2026-05-16 (Revision 2, contracts added). Cleared to implement, Phase 0 first.  
> Scope: sandbox repo only (`Hoi-Yong_Finance`). Do not switch to `Hoi-Yong_HR`.

## Progress Tracker

Single source of truth for cross-session status. On finishing a phase, the executing
agent flips `[ ]` → `[x]` and fills the date + commit hash. Each phase below also has
its own `> Progress:` line — keep both in sync.

- [x] **Phase 0** — Audit + Safe Replacement Baseline · _date:_ 2026-05-16 · _commit:_ pending user approval
- [x] **Phase 1** — Remove Feedback Loop · _date:_ 2026-05-16 · _commit:_ pending user approval
- [ ] **Phase 2** — Threshold Config Foundation + Inventory · _date:_ — · _commit:_ —
- [ ] **Phase 3** — Tokenize + Wire Single Source of Truth · _date:_ — · _commit:_ —
- [ ] **Phase 4** — Config Page UI Rebuild · _date:_ — · _commit:_ —
- [ ] **Post (deferred)** — PRD update — only when the user explicitly asks

Next action: **Phase 2**.

## Context

Today, changing an AI Insight threshold such as the 30-day benchmark for **Avg Collection Days** requires the Feedback Loop:

1. User submits free-text feedback.
2. Router LLM chooses a target prompt.
3. Surgical-editor LLM rewrites the prompt.
4. Admin reviews a diff and applies a new prompt version.

This is not the intended product behavior. Thresholds are configuration values, not feedback. They should be changed directly by a superadmin-style user from the AI Insight Config page.

## Product Intention

- Remove the AI Insight Feedback Loop completely.
- Remove Guidance, feedback badges, Version section, Feedback section, Feedback button, Feedback Router, Surgical Editor, prompt versioning, and Summary prompt guidance injection.
- Replace the admin page with:
  - Prompt Tree with search.
  - Read-only rendered Prompt.
  - Editable Configuration values for threshold tokens.
- Configuration values are saved in DB and injected into prompts/data at runtime.
- Prompt wording should not be redesigned during this work. Existing wording stays the same unless the value itself is replaced by a token.
- Complex prompts should not be simplified in this pass. Preserve the current threshold structure, but make numeric thresholds configurable where they are true business interpretation bands.

## Key Decisions

### 1. Runtime injection, not prompt rewriting

Existing hardcoded threshold values become named tokens, for example:

```text
"Avg Collection Days" KPI
Thresholds:
- <= {{payment.avg_collection_days.good_days}} = Good
- <= {{payment.avg_collection_days.warning_days}} = Warning
- > {{payment.avg_collection_days.warning_days}} = Critical
```

At runtime, the loader renders the prompt with the current DB value. The stored prompt prose does not change when a superadmin edits a threshold.

### 2. Prompt and Configuration are separate UI concepts

The config page should show:

- **Prompt**: read-only rendered prompt text, so the user can understand what the LLM will see.
- **Configuration**: editable controls for threshold values used by that prompt.

Desktop layout should match the provided image direction: **Configuration left, Prompt right**. On smaller screens, stack them vertically.

### 3. Preserve current defaults exactly

The first seed of `ai_insight_thresholds` must equal today's literal values. With default config, rendered prompts and data blocks must be byte-identical to the current runtime output, except for intended deletion of feedback/guidance text.

### 4. Complex prompts use the same token system

Simple and complex numeric thresholds use the same mechanism:

- Simple KPI: tokens drive prompt text, data block status, color label, and numeric guard allowed values.
- Complex prompt: tokens drive prompt/data text. Code only classifies where code already classifies today.
- Non-numeric rules stay read-only and non-configurable, for example sign flips and "no fixed threshold" trend rules.

### 5. Superadmin handling in this sandbox

The current demo app only has `admin | viewer` in localStorage. For this sandbox, treat `admin` as the superadmin-equivalent write role, but label the UI and endpoint comments as "Superadmin/Admin only" so the production transfer can map this to a real superadmin permission.

Do not build a full auth system in this sandbox.

## Required Gaps Closed By This Revision

The original plan missed several breaking paths. The implementation must explicitly cover them:

- Replace the old prompt-list API before deleting `/api/admin/ai-insight-prompts/**`; otherwise the config page breaks.
- Export/audit current DB prompt text before dropping `ai_insight_prompts`; otherwise existing selected prompt edits may be lost silently.
- Remove sidebar polling of `/api/admin/ai-insight-feedback`; otherwise the sidebar calls a deleted endpoint.
- Rewrite or delete the existing `e2e/ai-insight-config.spec.ts`, which currently depends on feedback/version APIs.
- Tokenize user-facing component explanation text in `component-info.ts`; otherwise the Component Insight dialog shows stale thresholds after a config edit.
- Scan all emitted threshold/status text, not only `Thresholds:` blocks. Some data blocks hardcode threshold status strings outside a threshold block.
- Add numeric-guard support for ratio values if the registry introduces `ratio` units.
- Verify with several completed prompts, including complex threshold structures. **Avg Collection Days is only a simple smoke check, not the acceptance proof.**
- Do not update PRDs in this implementation pass. Record the required PRD changes in memory first, then update docs later only when the user asks.

### Revision 2 additions (2026-05-16) — contracts that make the above safe

These were asserted in v1 but had no execution contract. They are now binding:

1. **NUMERIC formatting contract (byte-identical safety).** The `byte-identical` claim
   fails without this. Each registry token declares a value type: `int` (no decimals)
   or `decimal(n)` (fixed precision). Migration `025` seeds **integer literals with no
   trailing decimal** (`30`, not `30.0`). The loader must coerce node-postgres NUMERIC
   (returned as a *string* by default) into the token's declared type, and a single
   canonical formatter renders it back to text (`int` → no decimal point, `decimal(n)`
   → fixed `n` places). Token comparisons in `data-fetcher.ts` consume the typed number,
   not the raw DB string. The golden test asserts formatted output, not just value
   equality.

2. **Direction/polarity is required registry metadata.** Each threshold group declares
   `direction: 'ascending' | 'descending'` (ascending = higher is better, e.g.
   `collection_rate >= 80`; descending = lower is better, e.g. `avg_collection_days <= 30`
   — the user's own headline example is descending). Direction drives: (a) monotonic
   validation order, (b) the auto-derived final band comparator (`> warning = Critical`
   vs `< warning = Critical`), (c) the comparator rendered into prompt/data text
   (`<=` vs `>=`). Without this, Avg Collection Days validates and renders wrong.

3. **`SAFE_INTEGERS` stays; `allowedThresholds()` must emit the live value.**
   `numeric-guard.ts` `SAFE_INTEGERS` is a *global, count-gated* permissive net that
   only ever permits more numbers, never strips. Leave it as-is — do not tokenize it.
   The real risk is the inverse: a configured value not in that set (e.g. `good_days=37`)
   being stripped from LLM output. `allowedThresholds(componentKey)` MUST emit the
   current live configured values so non-"safe" values pass the guard. Phase 3 must
   assert this with a deliberately non-SAFE value (e.g. 37), proving it survives the
   guard, and that the golden default test is not silently passing only because the
   defaults happen to be SAFE integers.

4. **Post-`024` runtime prompt source is explicit, not implied.** `prompts-defaults.ts`
   is seed-only today (never imported by the orchestrator); runtime prompts flow through
   `prompt-loader.ts` from the DB store that `024` drops. Phase 1 must explicitly name
   which code constant becomes the post-`024` runtime source and reconcile
   `prompts.ts` vs `prompts-defaults.ts` so exactly one is authoritative. No implicit
   "comes from DEFAULT_COMPONENT_PROMPTS" hand-wave.

5. **Test harness is a standalone script (no test runner in repo).** `package.json` has
   no jest/vitest. The Phase-3 golden regression is a standalone `tsx` script run via a
   new `npm` script (compares rendered prompt + data block before/after for the listed
   components against a committed fixture). Phase-4 propagation is verified with
   Playwright. Do not introduce a test framework for this.

---

## Architecture

### New module: `threshold-config.ts`

Create `apps/dashboard/src/lib/ai-insight/threshold-config.ts`.

Responsibilities:

- Token registry: component key -> token metadata. Each token declares `unit`,
  value type (`int` | `decimal(n)`), min/max, and the owning group. Each group
  declares `direction: 'ascending' | 'descending'`.
- DB loader with 30s in-memory snapshot, inflight dedup, DB-miss fallback to registry defaults.
  Loader coerces node-postgres NUMERIC (string by default) into the declared value type.
- `formatThresholdValue(token, value)`: single canonical formatter — `int` renders with
  no decimal point, `decimal(n)` with fixed `n`. All text rendering goes through this so
  default config stays byte-identical.
- `renderThresholdText(text, componentKey)`: replaces tokens with formatted values.
- `getThresholdGroups(componentKey)`: returns UI grouping metadata, `direction`, and current values.
- `validateThresholdValues(componentKey, values)`: server and client validation; monotonic
  check respects each group's `direction`.
- `classifyThresholdValue(componentKey, metricId, value)`: used only where code already classifies today.
- `allowedThresholds(componentKey)`: emits numeric-guard allowed values **from the live
  configured values**, so a non-SAFE_INTEGERS value (e.g. 37) is not stripped.
- `invalidateThresholdCache()`: called after save.

Use `days | pct | RM | count | ratio` as registry units. If `ratio` is added, update `AllowedValueUnit`, `numeric-guard.ts` extraction/matching, and tests. Do not leave `ratio` as metadata only.

### New table: `ai_insight_thresholds`

Migration `025` creates:

```sql
CREATE TABLE ai_insight_thresholds (
  component_key TEXT NOT NULL,
  token TEXT NOT NULL,
  value NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  PRIMARY KEY (component_key, token)
);
```

Seed every registry token with today's exact value.

### Replacement config API

The current UI reads `/api/admin/ai-insight-prompts`, but that API will be deleted. Add a replacement API before deletion:

- `GET /api/admin/ai-insight-config`
  - Returns system prompts, component prompts, rendered prompt text, tree metadata, and threshold configuration groups.
  - Source is code constants plus threshold registry, not `ai_insight_prompts`.
- `PUT /api/admin/ai-insight-thresholds`
  - Saves one component's threshold values.
  - Requires demo admin/superadmin role.
  - Validates values server-side.
  - Invalidates threshold cache.
  - Returns updated rendered prompt/config for the selected component.

The old feedback/prompt APIs can be deleted only after the config page no longer depends on them.

### Prompt sources after removal

After Phase 1:

- System prompts come from code constants.
- Component prompts come from `DEFAULT_COMPONENT_PROMPTS`, rendered with threshold values.
- No DB prompt store.
- No section guidance.
- No feedback router/surgical editor prompt.
- No prompt versioning.

### Where threshold values must render

The same token value must feed:

- `prompts-defaults.ts` component prompts.
- `data-fetcher.ts` data-block strings and status text.
- `data-fetcher.ts` color/status classification where it exists today.
- Numeric guard `allowed` threshold values.
- `component-info.ts` user-facing Component Insight dialog text.
- AI Insight Config page prompt preview.

Do not leave any threshold definition hardcoded in a separate user-facing/runtime surface unless it is explicitly marked non-configurable.

### Scope exclusions

Do not absorb these existing configuration systems:

- `customer_credit_health`: owned by Credit Health Score Settings (`app_settings.credit_score_v2`).
- `fv_*` budget/variance controls: owned by Budget Setting (`budget_global`).

These may appear on the AI Insight Config page as read-only prompt text or future links, but their existing config knobs must not be duplicated in `ai_insight_thresholds`.

---

## Phase 0 - Audit + Safe Replacement Baseline

> Progress: DONE · date: 2026-05-16 · commit: pending user approval

Purpose: prevent accidental data loss or a broken config page.

- Export current `ai_insight_prompts` selected prompt text to a local audit artifact under `docs/plans/artifacts/` or `AI_Insight_Study/` before dropping tables.
- Diff DB-selected prompt text against `DEFAULT_*` code constants.
- If any DB prompt differs from code defaults, report it to the user before deletion. Do not silently discard meaningful prompt edits.
- Build the replacement `GET /api/admin/ai-insight-config` route using code constants and current rendered threshold defaults.
- Update `PromptConfigDashboard.tsx` to read the replacement route while still showing the old read-only prompt layout.
- Confirm the config page still loads before deleting old prompt APIs.

Verification:

- Typecheck/build.
- Config page loads using the new config API.
- Audit artifact exists and clearly states whether DB prompts match code defaults.

---

## Phase 1 - Remove Feedback Loop

> Progress: DONE · date: 2026-05-16 · commit: pending user approval

Purpose: delete the confusing workflow without breaking AI Insight analysis.

Delete:

- `app/api/admin/ai-insight-feedback/**`
- `app/api/ai-insight/feedback/route.ts`
- `app/api/test/seed-feedback/route.ts`
- `lib/ai-insight/feedback-llm.ts`
- `lib/ai-insight/prompt-store.ts`
- `components/admin/ai-insight-config/FeedbackList.tsx`
- `components/admin/ai-insight-config/VersionPanel.tsx`
- `components/admin/ai-insight-config/DiffModal.tsx`
- `components/admin/ai-insight-config/prompt-diff.tsx`
- `components/ai-insight/FeedbackModal.tsx`

Edit:

- `AiInsightPanel.tsx`: remove Feedback button, modal state, toast path used only for feedback.
- `AppSidebar.tsx`: remove `/api/admin/ai-insight-feedback` polling and AI Insight Config badge.
- `prompts.ts`: remove `getSectionGuidance` and Guidance block from summary user prompt.
- `prompts-defaults.ts`: delete section guidance, feedback router, surgical editor constants, and guidance instruction text in summary system prompt.
- `prompt-loader.ts`: remove DB prompt-store dependency and return code constants rendered with thresholds. **Explicitly name the post-`024` runtime source**: pick one of `prompts.ts` / `prompts-defaults.ts` as authoritative (today `prompts-defaults.ts` is seed-only, never imported at runtime — that gap must be closed here, not implied) and reconcile the other so there is exactly one source of truth.
- `client.ts` / `model-provider.ts`: remove or deprecate unused `feedback_router` and `surgical_editor` model slots after all references are gone.
- `e2e/ai-insight-config.spec.ts`: remove feedback/version tests or replace them with the new configurable-threshold tests.

Migration `024`:

- Drop `ai_insight_feedback`.
- Drop `ai_insight_prompt_versions`.
- Drop `ai_insight_prompts`.
- Use `DROP TABLE IF EXISTS ... CASCADE` only where needed and document the reason.

Verification:

- Typecheck/build clean.
- Existing AI Insight panel opens with Analyze/Cancel only.
- No frontend or route reference remains to feedback, feedback router, surgical editor, prompt versions, or seed-feedback.
- Config page loads using the replacement config API.

---

## Phase 2 - Threshold Config Foundation + Complete Inventory

> Progress: NOT STARTED · date: — · commit: —

Purpose: create the registry/table/API and prove validation works before tokenizing prompts.

Implement:

- Migration `025` with table + seed.
- `threshold-config.ts` registry, loader, render, classify, allowed thresholds, validation, cache invalidation.
- `GET /api/admin/ai-insight-config` includes threshold groups and rendered prompt text.
- `PUT /api/admin/ai-insight-thresholds` saves values.

Validation rules:

- Numeric only.
- Unit ranges:
  - `pct`: 0 to 100 unless registry marks a drift/variance threshold that can exceed 100.
  - `days`, `count`, `RM`, `ratio`: registry-specific min/max.
- Monotonic ordering per group, **evaluated in the group's declared `direction`**
  (ascending vs descending); a descending group like `avg_collection_days` must validate
  with the opposite ordering to an ascending group like `collection_rate`.
- No duplicate or unknown tokens.
- Server validation is authoritative; client validation only improves UX.

Inventory deliverable:

- Produce a checklist of every configurable numeric threshold in:
  - `prompts-defaults.ts`
  - `data-fetcher.ts`
  - `component-info.ts`
- The scan must include:
  - `Thresholds:` blocks.
  - Color/status ternaries.
  - Inline status strings such as "above the <=1% Good threshold".
  - Numeric-guard threshold allowlist literals.
  - User-facing "About" / `indicator` strings.
- Exclude `customer_credit_health` and `fv_*` where the value belongs to existing settings.
- Mark non-numeric rules as read-only non-configurable.

Verification:

- Seed populates all registry tokens with integer literals (no `.0`); loader coerces
  NUMERIC strings to the declared type and `formatThresholdValue` round-trips defaults
  to identical text.
- GET returns rendered defaults and includes each group's `direction`.
- PUT rejects invalid values, including a non-monotonic edit in a *descending* group
  (proves direction-aware validation, not just ascending).
- PUT persists valid values and invalidates cache immediately.
- After save, a second GET returns the new rendered prompt without waiting 30 seconds.

---

## Phase 3 - Tokenize + Wire Single Source Of Truth

> Progress: NOT STARTED · date: — · commit: —

Purpose: make default behavior unchanged while making values live.

Write regression coverage first. The harness is a standalone `tsx` script wired to a
new `npm run test:thresholds` script (no jest/vitest in this repo — do not add one). It
renders the listed components with default config and diffs against a committed fixture;
the diff must be empty before tokenization is considered done.

Golden default coverage must include:

- `avg_collection_days`
- `collection_rate`
- `overdue_amount`
- `aging_analysis`
- `bs_statement`
- At least two additional completed complex prompts from the Phase-2 inventory, selected because they have multi-band thresholds, mixed threshold units, or inline status text. Candidate prompts include `fin_pnl_summary`, `fin_pl_statement`, `cm_margin_distribution`, `sm_supplier_table`, `rt_settlement_breakdown`, or `ex_top_expenses`.
- One data-fetcher string with inline threshold status outside a `Thresholds:` block
- One user-facing `component-info.ts` About/indicator entry

Tokenize:

- `prompts-defaults.ts` threshold values.
- `data-fetcher.ts` emitted threshold/status strings.
- Existing classification thresholds in `data-fetcher.ts`.
- Numeric guard threshold literals via `allowedThresholds`.
- `component-info.ts` threshold text.

Rendering:

- Apply rendering at the component prompt loader.
- Apply rendering at the final fetcher return boundary so Component and Summary both get the same resolved raw-data string.
- Apply rendering to the Component Insight dialog source.

Verification:

- With seeded defaults, the `test:thresholds` diff is empty (byte-identical), proving the
  NUMERIC formatting contract holds — not merely value equality.
- Numeric-guard regression: set a deliberately non-`SAFE_INTEGERS` value (e.g. `37`) on a
  guarded component and confirm `allowedThresholds()` emits it and the guard does **not**
  strip it from rendered/LLM output. Also confirm the golden default test is not passing
  only because defaults coincidentally sit in `SAFE_INTEGERS`.
- Run configurable-value edit tests against a representative set of completed prompts:
  - One simple KPI prompt, such as `avg_collection_days`, only as a smoke check.
  - One complex ratio prompt, such as `bs_statement`.
  - One complex margin/concentration/bucket prompt from the completed prompt inventory, such as `fin_pnl_summary`, `cm_margin_distribution`, `sm_supplier_table`, or `ex_top_expenses`.
- For each selected prompt, confirm all relevant surfaces move together:
  - Config prompt preview.
  - Component analysis prompt.
  - Summary raw component About block.
  - Data block benchmark/status text.
  - Color/status classification where the component has code classification.
  - Numeric guard allowed thresholds where the component has guard threshold literals.
  - Component Insight dialog About/indicator text.

---

## Phase 4 - Config Page UI Rebuild

> Progress: NOT STARTED · date: — · commit: —

Purpose: match the intended admin workflow.

Prompt tree:

- Add search box above tree.
- Search matches prompt labels, section names, page names, and configurable token labels.
- Remove feedback badges.
- Remove Guidance leaves.
- Remove Feedback Router and Surgical Editor nodes.
- Keep Finance and HR grouping if still useful, but only show prompts that exist after feedback removal.

Main layout:

- Desktop: two columns.
  - Left: **Configuration**
  - Right: **Prompt**
- Mobile/narrow: stack Configuration then Prompt.
- Prompt is read-only and rendered with live values.
- Configuration groups tokens by business concept.
- Components with no configurable thresholds show Prompt only plus a clear high-contrast "No configurable thresholds" state.

Controls:

- Percent fixed-range values: slider plus number input.
- Days/count/ratio/RM: number input with unit label.
- Auto-derived final band shown read-only, using the group's `direction` to pick the
  comparator: descending → `> warning = Critical`, ascending → `< warning = Critical`.
- Inline validation errors.
- Save button disabled until values are valid and changed.
- Save success toast: `Your values are saved!`

Readability:

- No gray/muted text for important labels, headings, or values.
- Use high contrast and clear labels for older executives.

Verification with Playwright:

- Open `/admin/ai-insight-config`.
- Search and edit at least three completed prompts from the Phase-3 representative set:
  - One simple prompt smoke check, such as `avg_collection_days`.
  - One complex ratio prompt, such as `bs_statement`.
  - One complex margin/concentration/bucket prompt selected from the completed inventory.
- For each edited prompt:
  - Select it from search.
  - Confirm Configuration shows the expected grouped controls.
  - Change one or more threshold values.
  - Save.
  - Confirm toast.
  - Reload page.
  - Confirm values persist.
  - Confirm rendered Prompt reflects the saved values.
- For at least one complex prompt, run the related AI Insight section or verify the server-rendered analysis payload and confirm prompt/data evidence reflects the saved values.
- Capture screenshot.

---

## Critical Files

| File | Phase | Action |
|---|---:|---|
| `apps/dashboard/src/lib/ai-insight/threshold-config.ts` | 2 | New registry, loader, render, classify, allowed, validate |
| `apps/dashboard/src/app/api/admin/ai-insight-config/route.ts` | 0 | New replacement config page API |
| `apps/dashboard/src/app/api/admin/ai-insight-thresholds/route.ts` | 2 | New GET/PUT save API if kept separate from config GET |
| `apps/dashboard/src/components/admin/ai-insight-config/ConfigurationPanel.tsx` | 4 | New grouped threshold editor |
| `apps/dashboard/src/components/admin/ai-insight-config/PromptConfigDashboard.tsx` | 0, 4 | Switch API, then rebuild layout |
| `apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx` | 4 | Search and remove feedback/guidance/router/editor nodes |
| `apps/dashboard/src/components/admin/ai-insight-config/PromptTextPanel.tsx` | 4 | Read-only rendered prompt panel |
| `apps/dashboard/src/components/layout/AppSidebar.tsx` | 1 | Remove feedback badge polling |
| `apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx` | 1 | Remove Feedback button/modal path |
| `apps/dashboard/src/components/ai-insight/ComponentInsightDialog.tsx` | 3 | Use rendered component info |
| `apps/dashboard/src/lib/ai-insight/component-info.ts` | 3 | Tokenize/render user-facing threshold text |
| `apps/dashboard/src/lib/ai-insight/prompts-defaults.ts` | 1, 3 | Remove feedback/guidance; tokenize thresholds |
| `apps/dashboard/src/lib/ai-insight/prompts.ts` | 1 | Remove summary guidance block |
| `apps/dashboard/src/lib/ai-insight/prompt-loader.ts` | 0, 1, 3 | Remove DB store dependency; render code constants |
| `apps/dashboard/src/lib/ai-insight/data-fetcher.ts` | 3 | Tokenize emitted threshold/status text |
| `apps/dashboard/src/lib/ai-insight/numeric-guard.ts` | 2, 3 | Add ratio support if registry uses ratio |
| `apps/dashboard/src/lib/ai-insight/types.ts` | 2 | Add `ratio` unit if needed |
| `apps/dashboard/e2e/ai-insight-config.spec.ts` | 1, 4 | Replace feedback/version specs with config specs |
| `migrations/024_*.sql` | 1 | Drop feedback/prompt tables |
| `migrations/025_*.sql` | 2 | Create/seed thresholds |

Delete after replacement path is active:

- `feedback-llm.ts`
- `prompt-store.ts`
- `FeedbackList.tsx`
- `VersionPanel.tsx`
- `DiffModal.tsx`
- `prompt-diff.tsx`
- `FeedbackModal.tsx`
- `/api/admin/ai-insight-prompts/**`
- `/api/admin/ai-insight-feedback/**`
- `/api/ai-insight/feedback/route.ts`
- `/api/test/seed-feedback/route.ts`

---

## End-to-End Verification Checklist

Minimum required before completion:

- `npm run lint`
- `npm run build`
- Config page loads with no feedback/version/guidance UI.
- Sidebar has no pending-feedback badge or feedback API polling.
- Existing AI Insight analysis still runs.
- Golden default regression passes via `npm run test:thresholds` (empty diff = byte-identical).
- Numeric guard does not strip a non-`SAFE_INTEGERS` configured value (e.g. 37).
- PUT validation rejects:
  - non-numeric value
  - out-of-range percentage
  - non-monotonic thresholds (tested in both an ascending and a descending group)
  - unknown token
- PUT save invalidates cache immediately.
- Representative completed-prompt edits propagate through:
  - config UI
  - prompt preview
  - component prompt
  - summary prompt component About block
  - data block
  - classification/color/status where applicable
  - numeric guard allowlist where applicable
  - Component Insight dialog About text where applicable
- Playwright screenshot captured for the new config page.

If paid AI model execution is not possible in the environment, verify the rendered prompt/data payload through the server-side render/test endpoint and state that full model execution was not run.

---

## Documentation Deferred

Do **not** update PRDs in this implementation pass.

Record a memory note that future PRD/docs work must update:

- `docs/prd/10-ai-insight-base.md`
- `docs/prd/11-ai-insight-finance.md`
- `docs/prd/12-ai-insight-hr.md`

Future docs work should remove or rewrite:

- Feedback loop.
- Prompt versioning.
- Guidance prompt.
- Feedback Router.
- Surgical Editor.
- Feedback button/modal.
- Feedback badges.
- Old prompt DB store.

Future docs work should add:

- Configurable threshold registry.
- `ai_insight_thresholds`.
- Runtime token substitution.
- Superadmin/admin config workflow.
- Prompt preview + Configuration UI.
- Scope exclusions for Credit Health Score Settings and Budget Setting.

---

## Execution Handoff

Run one phase per session. Each phase should end in a clean, committable state and ask before committing. Before asking to commit, update **both** the top Progress Tracker checkbox and that phase's `> Progress:` line (set to DONE, fill date + commit hash) and bump "Next action:".

### Phase 0 Prompt

```text
Implement Phase 0 of docs/plans/ai-insight-config-configurable-thresholds.md.
Scope strictly to Phase 0. Export/audit current ai_insight_prompts selected text
before any deletion, build the replacement GET /api/admin/ai-insight-config route,
and switch the config page to that route while preserving the old read-only prompt
layout. Verify typecheck/build and that the config page loads from the new API.
Report any DB prompt differences before continuing. Ask before committing.
```

### Phase 1 Prompt

```text
Implement Phase 1 of docs/plans/ai-insight-config-configurable-thresholds.md.
Remove the Feedback Loop only after Phase 0 replacement API is active. Delete the
feedback/version APIs, UI, libs, sidebar polling, guidance injection, router/editor
prompt constants, and obsolete e2e feedback/version coverage. Add migration 024
to drop feedback/prompt tables. Verify build/lint, config page loads, AI Insight
panel still analyzes, and no feedback/router/editor/version references remain.
Ask before committing.
```

### Phase 2 Prompt

```text
Implement Phase 2 of docs/plans/ai-insight-config-configurable-thresholds.md.
Create the threshold registry/table/API and full extraction checklist across
prompts-defaults.ts, data-fetcher.ts, and component-info.ts. Include inline status
strings and numeric guard literals, not only Thresholds blocks. Exclude
customer_credit_health and fv_* where owned by existing settings. Verify seed,
GET, PUT validation, persistence, and immediate cache invalidation. Ask before
committing.
```

### Phase 3 Prompt

```text
Implement Phase 3 of docs/plans/ai-insight-config-configurable-thresholds.md.
Write the golden regression first. Tokenize prompts, data blocks, classification,
allowed thresholds, and component-info text. Defaults must render unchanged. Then
run configurable-value edit tests against a representative set of completed prompts:
one simple smoke prompt, one complex ratio prompt, and one complex margin /
concentration / bucket prompt from the Phase-2 inventory. Prove prompt preview,
component prompt, summary About block, data block, classification where applicable,
guard allowlist where applicable, and Component Insight dialog all update together.
Ask before committing.
```

### Phase 4 Prompt

```text
Implement Phase 4 of docs/plans/ai-insight-config-configurable-thresholds.md.
Rebuild the config page UI: searchable prompt tree, desktop Configuration-left /
Prompt-right layout, high-contrast labels, grouped controls, validation, Save
toast, and no feedback/version/guidance UI. Verify with Playwright using at least
three completed prompts: one simple smoke prompt, one complex ratio prompt, and
one complex margin/concentration/bucket prompt. Capture a screenshot. Ask before
committing.
```
