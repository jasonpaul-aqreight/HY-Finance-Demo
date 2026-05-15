# Variance Panel Rework — Execution Tracker

**Plan:** [variance-panel-rework.md](variance-panel-rework.md)
**Recommended split:** 2 sessions (Backend → Frontend).
**One-session feasible?** Possible but risky. The change crosses migration + queries + API + prompt + UI. A 2-session split keeps each session well-scoped, avoids context bloat, and lets you verify the data layer is solid before the UI consumes it.

---

## Session 1 — Backend (Data + API + Prompt)

**Status:** ⬜ Not started
**Estimated scope:** 1 migration, 1 file rewrite, 1 new route, 2 deletes, 2 narrow edits.

### Quick-dev prompt

> Read `docs/plans/variance-panel-rework.md` and implement **Scope Section A only** (A1, A2, A3, A4). Do not touch any files in `apps/dashboard/src/components/` — this session is backend only.
>
> Concretely:
>
> 1. **Delete** the untracked migration `migrations/022_budget_metadata.sql`.
> 2. **Create** `migrations/023_budget_global.sql` exactly as specified in §A1, including the seed inserts and the final `DROP TABLE IF EXISTS budget;`.
> 3. **Apply the migration** against the local DB. Confirm `budget_global` has 4 rows (Net Sales, Cost of Sales, Operating Costs, Other Income — Other Income may be `0,0`) and the legacy `budget` table is gone.
> 4. **Rewrite** `apps/dashboard/src/lib/budget/queries.ts` per §A2: export `getGlobalBudget()` and `saveGlobalBudget(lines, meta)`. Reject any `line_item` outside the 4 allowed.
> 5. **Create** `apps/dashboard/src/app/api/budget/route.ts` with `GET` and `PUT` handlers per §A3. Copy the admin-guard pattern from the existing `[fiscalYear]/route.ts` before deleting it.
> 6. **Delete** `apps/dashboard/src/app/api/budget/[fiscalYear]/route.ts` and `apps/dashboard/src/app/api/budget/save/route.ts`.
> 7. In `apps/dashboard/src/lib/ai-insight/data-fetcher.ts`:
>     - Swap the two `getBudget(period.fiscalYear)` calls (lines ~4580 and ~4945) to `getGlobalBudget()`.
>     - **Also locate the `fv_trend_forecast` fetcher** (grep `fv_trend_forecast` in the same file). Add a `const savedBudget = await getGlobalBudget();` call there too. Merge budget values into the forecast prompt context with a "Projected vs Budget" block: `Line Item | Projected (annualized) | Budget (annual) | Delta RM | Delta %`. If `savedBudget` is empty, omit the block entirely.
>     - Keep the existing "no approved budget → do not mention budgets" branch logic intact across all three prompts.
> 8. In `apps/dashboard/src/lib/ai-insight/prompts-defaults.ts`, edit `fv_variance_summary`, `fv_budget_suggestions`, **and `fv_trend_forecast`** per §A4: remove FY-specific budget wording, tighten the no-budget rule, drop any references to Gross Profit / Net Profit budget rows. For `fv_trend_forecast` specifically, add the Projected-vs-Budget instruction (hedged language: "at current trend, projected to be X% below budget pace"; pure-trend output when no budget rows exist). Leave existing numeric-guard whitelist entries alone; if new tokens like `forecast_vs_budget_pct` / `forecast_vs_budget_rm` are introduced, add them to the whitelist following the existing convention.
>
> **Verification before declaring done:**
> - `curl http://localhost:3001/api/budget` returns `{ "budget": [...4 rows...] }`.
> - `curl http://localhost:3001/api/budget/2025` returns 404.
> - `curl -X POST http://localhost:3001/api/budget/save` returns 404.
> - `grep -r "getBudget(" apps/dashboard/src` returns no hits (only `getGlobalBudget`).
> - `grep -rn "fiscal_year" apps/dashboard/src/lib/budget apps/dashboard/src/app/api/budget` returns no hits.
> - `pnpm tsc --noEmit` passes in `apps/dashboard`.
>
> Do NOT touch UI components, do NOT update PRD docs, do NOT commit. Report back what was changed.

### Checklist

- [ ] `022_budget_metadata.sql` deleted
- [ ] `023_budget_global.sql` created
- [ ] Migration applied locally; `budget_global` populated; `budget` table dropped
- [ ] `lib/budget/queries.ts` rewritten
- [ ] `api/budget/route.ts` created
- [ ] `api/budget/[fiscalYear]/route.ts` deleted
- [ ] `api/budget/save/route.ts` deleted
- [ ] `data-fetcher.ts` two-call swap applied + `fv_trend_forecast` fetcher injects global budget + builds Projected-vs-Budget block
- [ ] `prompts-defaults.ts` FY language stripped + GP/NP refs removed + `fv_trend_forecast` Projected-vs-Budget instruction added
- [ ] `tsc --noEmit` passes
- [ ] Curl checks pass

---

## Session 2 — Frontend (Reorder + Strip Removal + Dialog + Button)

**Status:** ⬜ Not started
**Depends on:** Session 1 complete and verified (`/api/budget` GET/PUT live).
**Estimated scope:** 1 page-shell reorder, 2 component edits, 1 component delete, 1 new dialog component.

### Quick-dev prompt

> Read `docs/plans/variance-panel-rework.md` and implement **Scope Section B only** (B1, B2, B3, B4) plus the cleanup checks in Section C. Backend work (Section A) is already complete — assume `/api/budget` GET/PUT exists and works.
>
> Concretely:
>
> 1. **Reorder** `apps/dashboard/src/components/pnl/dashboard-v3/DashboardShellV3.tsx` per §B1: move the `financial_variance` `InsightSectionHeader` block to render directly after the Financial Overview section. New order: Filter Bar → Financial Overview → Variance/Forecast/Budget → P&L Detail → Balance Sheet.
> 2. **Edit** `apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx` per §B2: remove the `BudgetBaselinePanel` mount (lines ~82–88), remove the `showBudgetPanel` conditional, and drop the now-unused `isAdmin` / `userName` props if nothing else uses them.
> 3. **Delete** `apps/dashboard/src/components/ai-insight/BudgetBaselinePanel.tsx`.
> 4. **Create** `apps/dashboard/src/components/ai-insight/BudgetSettingDialog.tsx` per §B4:
>     - Fields: Net Sales, Cost of Sales, Operating Costs, Other Income (Monthly + Annual numeric inputs each).
>     - No fiscal-year selector anywhere.
>     - Admin gate: non-admins → inputs disabled + explainer; admins → editable + `Save`.
>     - Audit footer: "Last updated by {approved_by} on {updated_at}".
>     - Optional `note` textarea.
>     - Reuse shadcn `Dialog`, `Input`, `Label`, `Button`, `Textarea`.
>     - Wires to `GET /api/budget` (prefill) and `PUT /api/budget` (save).
> 5. **Edit** `apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx` per §B3:
>     - Add an outline button **"Budget Setting"** between the existing `Feedback` button and the `Analyze`/`Cancel` button.
>     - Add a prop from `InsightSectionHeader` to gate the button — only render when `sectionKey === 'financial_variance'`.
>     - Local `useState` for the dialog open-state lives in `AiInsightPanel`. Clicking the button opens `BudgetSettingDialog`.
>
> **Verification before declaring done — use Playwright MCP tools:**
> - Navigate to `http://localhost:3001/financial`.
> - `browser_snapshot`: confirm section order is Financial Overview → Variance/Forecast/Budget → P&L Detail → Balance Sheet.
> - Confirm no blue "Budget Baseline: Set" strip is visible anywhere.
> - Expand the Variance panel: action row order is `Feedback | Budget Setting | Analyze`.
> - Expand the Financial Overview / P&L Detail / Balance Sheet panels: action row is `Feedback | Analyze` only — `Budget Setting` must NOT appear.
> - Click `Budget Setting`: modal opens with the 4 line items, no FY selector. As admin, edit Net Sales monthly to a known value, Save, reopen → value persists.
> - Click `Analyze`: AI run completes; verify the prompt-context payload (network tab or orchestrator log) contains the saved budget values with no FY qualifier.
> - `DELETE FROM budget_global;` and re-run Analyze → output must contain no budget commentary, only YoY variance.
> - `pnpm tsc --noEmit` and `pnpm lint` pass in `apps/dashboard`.
> - `grep -rn "BudgetBaselinePanel" apps/dashboard/src` returns no hits.
>
> Do NOT update PRD docs, do NOT commit. Report back what was changed.

### Checklist

- [ ] `DashboardShellV3.tsx` reordered
- [ ] `InsightSectionHeader.tsx` strip mount removed
- [ ] `BudgetBaselinePanel.tsx` deleted
- [ ] `BudgetSettingDialog.tsx` created
- [ ] `AiInsightPanel.tsx` button added (gated to `financial_variance`)
- [ ] Playwright section-order snapshot passes
- [ ] Playwright button-placement check passes per section
- [ ] Admin save → reopen → persistence verified
- [ ] Empty-budget → no-budget-commentary path verified
- [ ] `tsc --noEmit` + `lint` pass

---

## Post-Implementation

- [ ] **Update PRD 11** (`docs/prd/11-ai-insight-finance.md`) per "Follow-up" section in the plan: global budget, 4 line items, no snapshot concept, modal-from-footer pattern, section reorder.
- [ ] Commit (single bundled commit recommended — feature is cohesive).
