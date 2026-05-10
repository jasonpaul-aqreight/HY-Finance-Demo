# AI Insight Prompt Redesign — Codebase Study (REVIEW BEFORE EDIT)

> Purpose: confirm where "Rubric / deterministic questions / General" labels actually live in the codebase, what the runtime user message looks like end-to-end, and propose a clean redesign for review.
> Source: live codebase audit on 2026-05-09. No code changes yet.

---

## 1 — How the Summary user message is actually built

The Summary LLM (Sonnet) receives **two messages**:

- **SYSTEM** = `summary_system` prompt loaded from DB (`ai_insight_prompts` table, key = `summary_system`).
- **USER** = assembled at runtime by [`buildSummaryUserPrompt`](apps/dashboard/src/lib/ai-insight/prompts.ts#L161-L227).

The USER message is composed of (in order):

1. **Header**: `Section: ... / Page: ... / Date Range or Scope: ... / Generated: ...`
2. **General block** (only if a `*_guidance` row exists in DB) — wrapped with the label `General (deterministic questions, soft hints, and any output overrides — apply these to the Detail body):` + the raw guidance text inside `"""` quotes.
3. **Separator** `---` and one paragraph: `Below is the RUBRIC and RAW DATA for each component...`
4. **Per-component blocks** — for each component:
   - Header `### Component N: <Name> (<type>)`
   - Wrapper label `Rubric (good/neutral/bad criteria — apply directly, do not invent thresholds):` + the component prompt loaded from DB inside `"""` quotes.
   - `Raw Data:` + the formatted dashboard values from `data-fetcher.ts`.
5. **Footer**: `--- / Produce the summary now using the ===INSIGHT=== delimiter format.`

**So yes — the General block IS part of the USER message at runtime, not the SYSTEM message.** The DB stores the raw text; the wrapper labels (`General (...)`, `Rubric (...)`) come from string templates in [prompts.ts:185-208](apps/dashboard/src/lib/ai-insight/prompts.ts#L185-L208), not from the DB.

---

## 2 — Audit: every place "Rubric / deterministic / General" labels live

### A. DB defaults (`prompts-defaults.ts`)

| Line | Constant | Snippet to change |
|---|---|---|
| [992](apps/dashboard/src/lib/ai-insight/prompts-defaults.ts#L992) | `DEFAULT_SUMMARY_SYSTEM` | "Apply each component's **Rubric** block as the authority on good/neutral/bad — never invent thresholds." |
| [1024](apps/dashboard/src/lib/ai-insight/prompts-defaults.ts#L1024) | `DEFAULT_SUMMARY_SYSTEM` | "If a 'General' block is provided, follow its instructions and **answer its deterministic questions** inside the Detail body. If it includes an 'Output Override', apply that override in place of the Detail structure above." |
| [1028](apps/dashboard/src/lib/ai-insight/prompts-defaults.ts#L1028) | comment | "answers the section's **deterministic questions** (PRD §16)" |
| [1035–1145](apps/dashboard/src/lib/ai-insight/prompts-defaults.ts#L1035-L1145) | `DEFAULT_SECTION_GUIDANCE` | **All 16 sections** use `Answer these questions in order: 1. ... 2. ... 3. ... / Lean into: ...` |
| [1154](apps/dashboard/src/lib/ai-insight/prompts-defaults.ts#L1154) | `DEFAULT_FEEDBACK_ROUTER_SYSTEM` | "one **General** key (ends in `_guidance`) covering section-wide tone, **deterministic questions**, and output-format overrides" |

### B. Runtime user-message builder (`prompts.ts`)

| Line | Snippet to change |
|---|---|
| [185–193](apps/dashboard/src/lib/ai-insight/prompts.ts#L185-L193) | Per-component template renders `Rubric (good/neutral/bad criteria — apply directly, do not invent thresholds):` |
| [202–207](apps/dashboard/src/lib/ai-insight/prompts.ts#L202-L207) | General block template renders `General (deterministic questions, soft hints, and any output overrides — apply these to the Detail body):` |
| [217](apps/dashboard/src/lib/ai-insight/prompts.ts#L217) | Intro paragraph: "Below is the **RUBRIC** and **RAW DATA** for each component in this section. The Rubric is the authority on what counts as good/neutral/bad..." |
| [178–180](apps/dashboard/src/lib/ai-insight/prompts.ts#L178-L180) | Code comment "Per-component blocks: Rubric ..." (cosmetic only) |
| [184](apps/dashboard/src/lib/ai-insight/prompts.ts#L184) | Variable name `const rubric = await getComponentPrompt(c.key);` (cosmetic only) |

### C. Feedback router (`feedback-llm.ts`)

| Line | Snippet to change |
|---|---|
| [59](apps/dashboard/src/lib/ai-insight/feedback-llm.ts#L59) | `'- ${guidanceKey} (general): ${sectionName} — General (overall tone, **deterministic questions**, output-format overrides, section-wide concerns)'` (this string is in the user message sent to the Router LLM, so the Router agent sees it) |

### D. Admin UI

No hardcoded labels in `apps/dashboard/src/components/admin/ai-insight-config/` or `apps/dashboard/src/app/admin/ai-insight`. The admin page renders raw DB text — no UI changes needed.

### E. DB column / key naming

Internal keys remain `*_guidance` (e.g. `payment_outstanding_guidance`, `summary_system`). These are stable identifiers — not user-facing — so we keep them as-is. Only display strings change.

---

## 3 — What the user message looks like RIGHT NOW (real example)

Built by `buildSummaryUserPrompt` for `payment_outstanding`. Header + General block + intro paragraph reproduced verbatim:

```
Section: Outstanding Payment
Page: Payment
Scope: Snapshot — current state
Generated: 2026-05-09 21:00

General (deterministic questions, soft hints, and any output overrides — apply these to the Detail body):
"""
Answer these questions in order:
1. How much total is outstanding?
2. What % is in the >60 days bucket?
3. Which customers have the highest outstanding?

Lean into: aging concentration (how much sits in the worst buckets), credit-limit breaches, and the 3–5 customers driving most of the exposure.
"""

---

Below is the RUBRIC and RAW DATA for each component in this section. The Rubric
is the authority on what counts as good/neutral/bad. The Raw Data is the
authoritative source for every number you cite. Every number must be traceable
to a specific line in a Raw Data block or to a tool-call result.

### Component 1: Total Outstanding (kpi)

Rubric (good/neutral/bad criteria — apply directly, do not invent thresholds):
"""
"Total Outstanding" KPI — sum of all unpaid invoices to date (snapshot, ignores date range).

No fixed threshold. Evaluate vs total invoicing volume and trend direction. Growing outstanding alongside flat or declining sales = red flag.
"""

Raw Data:
<live values>
```

---

## 4 — Proposed redesign (PROPOSED — not yet applied)

### Two changes you asked for

1. **Drop deterministic questions** from the General block (keep "Lean into" narrative hint).
2. **Rename `Rubric` → `About`** at every touchpoint.

### Side effects forced by those two changes

- `DEFAULT_SUMMARY_SYSTEM` mentions both terms (`Rubric block`, `answer its deterministic questions`) → must update.
- `DEFAULT_FEEDBACK_ROUTER_SYSTEM` and `feedback-llm.ts:59` describe General as carrying "deterministic questions" → must update so the Router LLM still understands what General is.
- `DEFAULT_SECTION_GUIDANCE` — needs decision on scope: pilot 1 section or rewrite all 16.

### The new wrapper labels (rendered into the USER message)

| Block | Before | After |
|---|---|---|
| General wrapper | `General (deterministic questions, soft hints, and any output overrides — apply these to the Detail body):` | `General:` |
| Per-component wrapper | `Rubric (good/neutral/bad criteria — apply directly, do not invent thresholds):` | `About:` |
| Intro paragraph | "Below is the RUBRIC and RAW DATA for each component in this section. The Rubric is the authority on what counts as good/neutral/bad. The Raw Data is the authoritative source..." | "Below is the ABOUT and RAW DATA for each component. ABOUT describes the component and is the authority on good / neutral / bad. RAW DATA is what the dashboard shows the user — every number you cite must be traceable to a specific line in a Raw Data block or a tool-call result." |

### The new SYSTEM prompt lines

| Before | After |
|---|---|
| "Apply each component's **Rubric** block as the authority on good/neutral/bad — never invent thresholds." | "Apply each component's **About** block as the authority on good/neutral/bad — never invent thresholds." |
| "If a 'General' block is provided, follow its instructions and **answer its deterministic questions** inside the Detail body. If it includes an 'Output Override', apply that override in place of the Detail structure above." | "If a 'General' block is provided, follow its guidance. If it includes an 'Output Override', apply that override in place of the Detail structure above." |

### The new Feedback Router description (`feedback-llm.ts:59`)

| Before | After |
|---|---|
| `${sectionName} — General (overall tone, deterministic questions, output-format overrides, section-wide concerns)` | `${sectionName} — General (overall tone, soft hints, output-format overrides, section-wide concerns)` |

And in `DEFAULT_FEEDBACK_ROUTER_SYSTEM` line 1154:

| Before | After |
|---|---|
| "one **General** key (ends in `_guidance`) covering section-wide tone, **deterministic questions**, and output-format overrides" | "one **General** key (ends in `_guidance`) covering section-wide tone, soft hints, and output-format overrides" |

### The new General prompts (DB defaults) — scope question

The 16 sections currently follow this template:

```
Answer these questions in order:
1. <question>
2. <question>
3. <question>

Lean into: <narrative hint>
```

After redesign each becomes just the narrative hint:

```
Lean into <narrative hint>.
```

Example, `payment_outstanding`:

```
Lean into aging concentration (how much sits in the worst buckets), credit-limit breaches, and the 3–5 customers driving most of the exposure.
```

Example, `payment_collection_trend`:

```
Lean into month-over-month direction, the gap between invoiced and collected, and any single month that breaks the pattern.
```

Example, `sales_trend`:

```
Lean into direction (MoM and YoY), seasonality vs structural change, and any single month that breaks the run.
```

(Pattern repeats for all 16 — strip the questions, keep the lean-into clause.)

---

## 5 — Open question for you (one)

**Scope: pilot or all 16?**

- **A) Pilot one section** (`payment_outstanding`) — change wrapper labels in code globally (so `Rubric → About` flips for every section), but only rewrite ONE section's General prompt to verify the LLM behaves well without the questions. Keep the other 15 with questions for now.
- **B) Apply to all 16 at once** — the wrapper-label change is global anyway, and the question-stripping is a 1-minute mechanical edit per section. Cleaner end-state, no half-state to maintain.

Recommendation: **B**. The wrapper rename is global, so leaving 15 sections with their old "Answer these questions in order: …" content while only payment_outstanding has the new style would be inconsistent — and the deterministic-questions answers come naturally from the Detail structure subsections anyway (Current Status, Key Observations, Evidence). If quality drops on any section after dropping questions, you can re-add them surgically per section via the admin UI.

---

## 6 — Apply order (when you approve)

1. Edit `prompts.ts` wrapper labels (General + per-component + intro paragraph).
2. Edit `prompts-defaults.ts`:
   - `DEFAULT_SUMMARY_SYSTEM` (2 lines + 1 comment)
   - `DEFAULT_SECTION_GUIDANCE` (16 entries — strip questions, keep "Lean into")
   - `DEFAULT_FEEDBACK_ROUTER_SYSTEM` (1 line)
3. Edit `feedback-llm.ts:59` (1 line).
4. Re-seed defaults: hit `POST /api/admin/ai-insight-prompts/seed-defaults` so the DB picks up the new SYSTEM + General + Feedback-Router strings. Component prompts (the ABOUT bodies) don't change — only their wrapper label changes, and the wrapper label is in code, not DB.
5. Quick smoke test: run AI Insight on payment_outstanding, eyeball the output, confirm tool use + numeric guard still pass.

No DB schema migration needed. No UI changes needed.
