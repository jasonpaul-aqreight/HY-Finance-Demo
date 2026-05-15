# Variance / Forecast / Budget Panel — Rework

**Status:** Approved — ready to implement
**Owner:** Aqreight
**Created:** 2026-05-14
**Affects:** `/financial` page · AI Insight Engine · Budget data model · PRD 11 (needs update after implementation)

---

## Context

Six related changes to the "Variance, Forecasting & Budgeting" AI Insight panel on `/financial`, after a stakeholder review with the boss:

1. Panel is currently the **last** section — should sit directly under Financial Overview.
2. The blue "Budget Baseline" footer strip (View Budget / Take/Replace Snapshot / Manual Edit) is too noisy and conflates "snapshot" (AI-captured) with "manual" (admin-entered). Snapshots should be removed; the budget is a deliberate, admin-keyed setting.
3. Budget is currently keyed by `(fiscal_year, line_item)` — should be **global** (one baseline applied across all years unless changed).
4. Budget currently covers 5 line items including computed Gross Profit / Net Profit; also omits Other Income, which the AI keeps flagging. Trim & re-add.
5. AI prompt already reads from the DB (not invented) but must be repointed at the new global table.
6. Budget Setting entry point moves into the AI panel's own action row, between **Feedback** and **Analyze**.

### Decisions captured

- Budget Setting stays an **in-place modal Dialog** (no new route).
- Line items: **Net Sales, Cost of Sales, Operating Costs, Other Income** (drop Gross Profit, Net Profit).
- Migration: **new global table, drop `fiscal_year` column**. Seed from most-recent FY's existing budget.
- Edit access: **admins only**; non-admins see read-only.

---

## Scope

### A. Backend (data + API + prompt)

#### A1. New global budget schema

**New migration:** `migrations/023_budget_global.sql`

```sql
CREATE TABLE IF NOT EXISTS budget_global (
  line_item        TEXT PRIMARY KEY,
  monthly_budget   NUMERIC(18,2) NOT NULL,
  annual_budget    NUMERIC(18,2) NOT NULL,
  approved_by      TEXT,
  note             TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed from latest FY rows for the 4 kept line items.
INSERT INTO budget_global (line_item, monthly_budget, annual_budget, approved_by, note, updated_at)
SELECT line_item, monthly_budget, annual_budget, approved_by, note, updated_at
FROM (
  SELECT DISTINCT ON (line_item) line_item, monthly_budget, annual_budget, approved_by, note, updated_at
  FROM budget
  WHERE line_item IN ('Net Sales', 'Cost of Sales', 'Operating Costs', 'Other Income')
  ORDER BY line_item, fiscal_year DESC, updated_at DESC
) latest
ON CONFLICT (line_item) DO NOTHING;

-- Other Income may not exist in legacy table; ensure row.
INSERT INTO budget_global (line_item, monthly_budget, annual_budget)
VALUES ('Other Income', 0, 0)
ON CONFLICT (line_item) DO NOTHING;

DROP TABLE IF EXISTS budget;
```

- `source` column ('snapshot' | 'manual') is **dropped** — snapshots no longer exist.
- **Delete** untracked `migrations/022_budget_metadata.sql` before applying 023 — it attaches columns to a table that 023 drops.

#### A2. Rewrite budget queries

**File:** `apps/dashboard/src/lib/budget/queries.ts`

Replace `getBudget(fiscalYear)` and `saveBudget(fiscalYear, …)` with:

```ts
export type BudgetRow = {
  line_item: string;
  monthly_budget: number;
  annual_budget: number;
  approved_by: string | null;
  note: string | null;
  updated_at: string;
};

export async function getGlobalBudget(): Promise<BudgetRow[]> { … }
export async function saveGlobalBudget(
  lines: { line_item: string; monthly_budget: number; annual_budget: number }[],
  meta: { userName: string; note?: string }
): Promise<void> { … }
```

- Use `INSERT … ON CONFLICT (line_item) DO UPDATE` on `budget_global`.
- Reject any `line_item` outside the allowed 4.

#### A3. Rewrite API routes

- **New:** `apps/dashboard/src/app/api/budget/route.ts`
  - `GET /api/budget` → `{ budget: BudgetRow[] }`
  - `PUT /api/budget` → admin-only; accepts `{ lines, userName, note }`. Copy admin-guard pattern from existing `[fiscalYear]/route.ts`.
- **Delete:** `apps/dashboard/src/app/api/budget/[fiscalYear]/route.ts`
- **Delete:** `apps/dashboard/src/app/api/budget/save/route.ts`

#### A4. Repoint AI Insight prompt at global budget

**File:** `apps/dashboard/src/lib/ai-insight/data-fetcher.ts`

- Line ~4580 (`fv_variance_summary` fetcher): swap `await getBudget(period.fiscalYear)` → `await getGlobalBudget()`.
- Line ~4945 (`fv_budget_suggestions` fetcher): same swap.
- **`fv_trend_forecast` fetcher** — locate this fetcher (grep `fv_trend_forecast` in the same file). Add a `const savedBudget = await getGlobalBudget();` call and merge budget values into the forecast prompt context alongside the projected MA values. Build a **"Projected vs Budget"** block with columns: `Line Item | Projected (annualized) | Budget (annual) | Delta RM | Delta %`. If `savedBudget` is empty, omit the block entirely (do not include placeholder rows or zero-budget rows).
- Keep the existing "no approved budget → do not mention budgets" branch across all three prompts — it will now trigger when `budget_global` is empty.

**File:** `apps/dashboard/src/lib/ai-insight/prompts-defaults.ts`

In `fv_variance_summary`, `fv_budget_suggestions`, **and `fv_trend_forecast`** (lines ~893–973 area):
- Remove any wording that says or implies fiscal-year-specific budget (e.g. "approved budget for FY{period.fiscalYear}" → "approved budget baseline").
- Reinforce: "Budget label: 'approved budget baseline'. If no budget rows exist, do NOT mention budgets or variance-to-budget anywhere in the output."
- Drop any hints/lines that reference Gross Profit / Net Profit budget rows.
- **For `fv_trend_forecast` specifically**, add: *"When an approved budget baseline is provided, include a Projected-vs-Budget commentary line for each line item — express the gap as both an absolute RM figure and a percentage of the annual budget. Use hedged language ('at current trend, projected to be X% below budget pace') — do not assert certainty about the gap being met or missed. When no budget rows are provided, output the pure-trend projection only and make no reference to budgets."*
- Leave numeric-guard whitelist entries (`budget_annual`, `budget_vs_variance`, etc.) untouched. If new numeric tokens are introduced for the forecast-vs-budget gap (e.g. `forecast_vs_budget_pct`, `forecast_vs_budget_rm`), add them to the whitelist following the existing convention.

---

### B. Frontend (page reorder + remove strip + new dialog + button)

#### B1. Reorder `/financial` sections

**File:** `apps/dashboard/src/components/pnl/dashboard-v3/DashboardShellV3.tsx`

Move the `financial_variance` `InsightSectionHeader` block so it renders immediately after `Financial Overview` (§9). Resulting order:

```
Filter Bar → Financial Overview → Variance, Forecast & Budget → P&L Detail → Balance Sheet
```

No prop changes needed.

#### B2. Remove the blue "Budget Baseline" footer strip

- `apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx`: delete the `BudgetBaselinePanel` mount (~lines 82–88) and the `showBudgetPanel` conditional. Drop unused `isAdmin` / `userName` props if nothing else uses them.
- `apps/dashboard/src/components/ai-insight/BudgetBaselinePanel.tsx`: **delete**. (File is still untracked — no git history to worry about.)

#### B3. Add "Budget Setting" button between Feedback and Analyze

**File:** `apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx`

In the footer action row (~lines 266–290), insert an outline button **"Budget Setting"** between the existing `Feedback` button and the `Analyze` / `Cancel` button.

- Add a prop (`sectionKey` or a targeted `showBudgetSetting`) from `InsightSectionHeader` so the button **only renders when `sectionKey === 'financial_variance'`**.
- Local `useState` for the dialog open-state lives in `AiInsightPanel`.

#### B4. New Budget Setting dialog component

**New file:** `apps/dashboard/src/components/ai-insight/BudgetSettingDialog.tsx`

Replaces the modal block that lived inside the old `BudgetBaselinePanel.tsx`. Requirements:

- **Fields:** Net Sales, Cost of Sales, Operating Costs, Other Income. Each row has `Monthly Budget` + `Annual Budget` numeric inputs.
- **No fiscal-year selector anywhere.**
- **Admin gate:** non-admins → inputs disabled + explainer ("Contact an admin to update the budget baseline"). Admins → editable inputs + `Save` button.
- **Audit footer:** "Last updated by {approved_by} on {updated_at}".
- Optional `note` textarea (carries `note` column).
- Reuse existing shadcn primitives: `Dialog`, `Input`, `Label`, `Button`, `Textarea`.
- Wires to `GET /api/budget` (prefill) and `PUT /api/budget` (save, admin only).

---

### C. Cleanup

- `grep -r "getBudget("` — confirm only `getGlobalBudget` remains.
- `grep -r "/api/budget/"` — confirm no client code still hits `/api/budget/{fiscalYear}` or `/api/budget/save`.
- Confirm `BudgetBaselinePanel` is not imported anywhere; delete it.
- `grep -r "fiscal_year"` inside `apps/dashboard/src/lib/budget/` and `apps/dashboard/src/app/api/budget/` — should return no hits.

---

## Critical Files

| File | Action |
|------|--------|
| `apps/dashboard/src/components/pnl/dashboard-v3/DashboardShellV3.tsx` | Reorder §12 to right after §9 |
| `apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx` | Remove `BudgetBaselinePanel` mount + props |
| `apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx` | Add "Budget Setting" button (gated to `financial_variance`) |
| `apps/dashboard/src/components/ai-insight/BudgetSettingDialog.tsx` | **NEW** — replacement dialog |
| `apps/dashboard/src/components/ai-insight/BudgetBaselinePanel.tsx` | **DELETE** |
| `migrations/023_budget_global.sql` | **NEW** — global table + seed + drop legacy |
| `migrations/022_budget_metadata.sql` | **DELETE** (never applied) |
| `apps/dashboard/src/lib/budget/queries.ts` | Replace with `getGlobalBudget` / `saveGlobalBudget` |
| `apps/dashboard/src/app/api/budget/route.ts` | **NEW** — GET + PUT global |
| `apps/dashboard/src/app/api/budget/[fiscalYear]/route.ts` | **DELETE** |
| `apps/dashboard/src/app/api/budget/save/route.ts` | **DELETE** |
| `apps/dashboard/src/lib/ai-insight/data-fetcher.ts` | Two `getBudget` → `getGlobalBudget` swaps |
| `apps/dashboard/src/lib/ai-insight/prompts-defaults.ts` | Strip FY language; tighten no-budget rule; drop GP/NP hints |

---

## Verification

Run in order against `http://localhost:3001/financial`:

1. **Migration** — apply 023; confirm `budget_global` has 4 rows; confirm legacy `budget` table is gone.
2. **Page order** — section order is `Financial Overview → Variance/Forecast/Budget → P&L Detail → Balance Sheet`. Verify with Playwright `browser_snapshot`.
3. **Footer strip gone** — no blue "Budget Baseline: Set" row below the AI panel.
4. **Button placement** — expand the Variance panel; action row reads `Feedback | Budget Setting | Analyze` in that order. Every other section (Financial Overview, P&L Detail, Balance Sheet) shows only `Feedback | Analyze` — `Budget Setting` must not appear.
5. **Modal — non-admin** — opens, inputs disabled, explainer visible.
6. **Modal — admin** — edit Net Sales monthly to a known value, Save, reopen → value persists. Confirm no Gross Profit / Net Profit / fiscal-year selector anywhere.
7. **API contract**
   - `curl GET /api/budget` → 4 rows
   - `curl GET /api/budget/2025` → 404
   - `curl POST /api/budget/save` → 404
8. **Prompt uses global budget** — click `Analyze`, inspect request payload: budget block contains the values just saved, no fiscal-year qualifier. Then `DELETE FROM budget_global;` and re-run Analyze → output must contain **no** budget commentary, only YoY variance.
9. **Type + lint** — `pnpm tsc --noEmit` and `pnpm lint` in `apps/dashboard`.

---

## Out of scope

- Multi-currency / FX-aware budgeting.
- Historical per-FY budget archive (data is migrated then dropped; if needed later, add a separate `budget_history` table).
- Budget rows for Sales Returns / Discounts / Taxation (folded into Net Sales today; revisit if variance commentary needs finer breakdown).

---

## Follow-up

- **PRD 11 (`docs/prd/11-ai-insight-finance.md`) must be updated** after implementation to reflect:
  - Global (not FY-keyed) budget baseline
  - 4 budget line items (Net Sales, Cost of Sales, Operating Costs, Other Income) — no computed GP/NP rows
  - Removal of snapshot concept
  - Budget Setting modal triggered from AI panel footer (not a separate strip)
  - Section reorder: Variance/Forecast/Budget now second on `/financial`
