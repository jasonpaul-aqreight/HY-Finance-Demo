# 12 — Finance Domain Config (Budget Setting & Variance KPI Surface)

> **Classification:** Domain Pack
> **Enables:** The Budget Setting CRUD UI + table, and the Variance KPI badge surface on the Financial page, both of which feed AI Insight's Financial-page sections as upstream data.
> **Read after:** 00, 01, 02, 04, 04a, 08

---

## 1. Purpose

This document specifies **two Finance-domain configuration surfaces** that AI Insight *consumes* but does not *own*:

1. **Budget Setting** — the operator UI and persistence that an admin uses to set per-line annual budgets and per-line variance tolerances. Its values flow into AI Insight's `financial_variance` section (doc 04a) as evidence data inside the fetcher's raw block.
2. **Variance KPI surface** — the polarity-aware KPI cards on the Financial page (Net Sales / Cost of Sales / Gross Profit / Operating Costs) that render "On Budget" / "Over Budget" badges plus *vs Budget*, *Variance %*, and *Last Year* comparison rows.

> **Production status (as of 2026-05-17).** Both surfaces are **built in this sandbox repo** (latest commit `a0cbab3`, 2026-05-16) but **not yet deployed to the production app (`Hoi-Yong_HR`)**. This document is the spec for the production port; the production rebuild should follow it verbatim. Migration `023_budget_global.sql` must be applied to the production database before the UI can be deployed.

These two surfaces are sibling features: the Budget Setting dialog is where the numbers are *defined*; the Variance KPI cards are where the same numbers are *consumed by the operator at a glance*. AI Insight's `financial_variance` section is a third consumer of the same data, downstream of both.

This is a **Domain Pack** document — the surfaces are finance-shaped (line items are P&L line items, the polarity rules are accounting conventions). The contract pattern (§3) is reusable for any domain that needs operator-edited business-rule inputs to flow into AI Insight; HR or another module can build an analogous pair on the same shape.

After this document you can build the Budget Setting CRUD UI, the `budget_global` table, the `/api/budget` endpoints, the Variance KPI tile API, the KPI card component with its badge logic, and pass the verification checks in §8.

## 2. Prerequisites

- **Doc 00** — vocabulary; Engine / Domain Pack / Spine split. This is Domain Pack; the *settings UI pattern* in §3 is portable, the §5+ specifics are finance.
- **Doc 01** — the engine datastore (this doc adds one new table to the same store). The migration history table in doc 01 §2 lists `023_budget_global.sql` as the migration this doc owns.
- **Doc 02 §6.2** — the *external data dependency* classification that names Budget Setting as a Domain Pack settings UI feeding AI Insight evidence (not a threshold-registry tunable).
- **Doc 04** — the per-section generation pipeline (the `financial_variance` fetchers read `budget_global` during data assembly).
- **Doc 04a** — the four `financial_variance` component entries (`fv_variance_summary`, `fv_variance_breakdown`, `fv_trend_forecast`, `fv_budget_suggestions`) whose conditional prompt rules depend on whether `budget_global` is populated. The phrase *"approved budget baseline"* in those entries refers to a row set persisted by this document's UI.
- **Doc 08** — the admin authorization gate pattern (`x-user-role: admin` header). This document reuses it for the Budget Setting PUT.

This document owns **no AI Insight ENV variables**. It consumes `DATABASE_URL` (doc 01).

## 3. Concept & Contract

> *Stack-neutral. The settings-surface + KPI-surface pair is a reusable pattern; only the specific schema and polarity rules are finance.*

The pattern is **an operator-edited settings store with two consumers — a glance-level KPI surface and an AI Insight section fetcher**. Three pieces:

```
                    ┌──────────────────────────────────┐
                    │  Settings UI (Budget Setting)    │   ← operator (admin)
                    │  - GET current values            │
                    │  - PUT validated new values      │
                    └──────────────┬───────────────────┘
                                   ▼ persists
                    ┌──────────────────────────────────┐
                    │  Domain config table             │
                    │  (one row per line item)         │
                    └──┬───────────────────────────┬───┘
                       ▼                           ▼
   ┌──────────────────────────────┐   ┌────────────────────────────────────┐
   │  KPI tile API + card surface │   │  AI Insight section fetcher        │
   │  - actual vs budget          │   │  - reads same table during run     │
   │  - polarity-aware badge      │   │  - emits numbers as evidence data  │
   │  - vs-budget / variance /    │   │  - AI narrates against operator's  │
   │    last-year rows            │   │    judgement boundaries            │
   └──────────────────────────────┘   └────────────────────────────────────┘
              (Financial page)                  (doc 04 / doc 04a)
```

**Inputs (operator-facing).** A "Budget Setting" dialog reachable from the Financial page (admin only) listing every configurable line item. Per line: an editable annual amount and an editable per-line tolerance percentage. A free-text note. A save button.

**Outputs / guarantees.**

- A persisted row per configurable line item; saving replaces the line in place.
- A snapshot of monthly / annual values + tolerance per line, plus *who* updated *when* and an optional note.
- Two read consumers see the same row set: the Variance KPI card (operator glance) and the AI Insight fetcher (LLM evidence).

**Invariants:**

1. **Mutation is admin-gated; observation is open.** Reading the budget table requires no auth; saving requires the admin role.
2. **One row per line item.** Saving is upsert on a single-column PK; there is no version table and no fiscal-year axis.
3. **Tolerance is a per-row attribute, not a global threshold.** This is why it cannot live in the AI Insight threshold registry (doc 02 §6.2). Each line has its own tolerance because the polarity and acceptable-variance band differ by accounting convention.
4. **The KPI badge is derived, not stored.** The "On Budget" / "Over Budget" label is computed from `actual`, `budget`, and `tolerance` at read time. No badge column exists; changing the tolerance flips the badge with no re-write.
5. **AI Insight reads the same row set the UI reads.** The two consumers never diverge — there is exactly one source of truth, the table.
6. **Gross/Net Profit are not configurable budget lines.** Only *input* P&L lines are stored (Net Sales, Cost of Sales, Operating Costs, Other Income). Profit lines are *derived* — they have no budget row and no badge.

**Boundary.** *Up:* the operator (admin browser session). *Sideways:* AI Insight's `financial_variance` fetchers (read-only). *Down:* the engine datastore (doc 01) for persistence. The AI Insight engine itself (docs 04, 05) does not import any code from this document — it only reads the table.

## 4. Data contracts

### 4.1 Owned — `budget_global` table

```sql
CREATE TABLE budget_global (
  line_item        TEXT PRIMARY KEY,
  monthly_budget   NUMERIC(18,2) NOT NULL,
  annual_budget    NUMERIC(18,2) NOT NULL,
  tolerance_pct    NUMERIC(5,2)  NOT NULL DEFAULT 5,
  approved_by      TEXT,
  note             TEXT,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

- **`line_item` (PK)** — a code from the canonical set: `NS` (Net Sales), `CO` (Cost of Sales), `EP` (Operating Costs), `OI` (Other Income). Adding a line item is a migration + UI + fetcher coordinated change (see §6.3).
- **`monthly_budget` / `annual_budget`** — both persisted explicitly; `monthly_budget = annual_budget / 12` is computed server-side on every PUT (callers send only `annual_budget`). Having both columns avoids a divide on every read.
- **`tolerance_pct`** — % band defining the *On Budget* zone, default `5`. Per-line, finite, in `[0, 100]`.
- **`approved_by`** — display name of the admin who last saved (e.g. `"Analyst (Mary)"`).
- **`note`** — free text, ≤50 words; client-clamped before send.
- **`updated_at`** — `NOW()` on every upsert.

Source: `migrations/023_budget_global.sql`. The migration also seeds the four canonical line items with the values that were in production at cut-over.

### 4.2 Owned — HTTP envelopes

**`GET /api/budget`** — open (no auth):

```
200 → { budget: BudgetRow[] }

interface BudgetRow {
  line_item:      'NS' | 'CO' | 'EP' | 'OI';
  monthly_budget: number;
  annual_budget:  number;
  tolerance_pct:  number;
  approved_by:    string | null;
  note:           string | null;
  updated_at:     string;   // ISO timestamp
}
```

Returned in the canonical line order `[NS, CO, EP, OI]`. `no-store` cache header.

**`PUT /api/budget`** — admin only (`x-user-role: admin` header):

| Case | Status | Body |
|---|---|---|
| Saved | 200 | `{ ok: true, budget: BudgetRow[] }` (the freshly-read list) |
| Not admin | 403 | `{ error: 'Admin role required' }` |
| Bad input | 400 | `{ error: <field-level message> }` |

Request body:

```ts
{
  lines: Array<{
    line_item:     'NS' | 'CO' | 'EP' | 'OI';
    annual_budget: number;                     // finite, non-negative
    tolerance_pct: number;                     // finite, 0..100
  }>;
  userName: string;                            // recorded into approved_by
  note?:    string;                            // ≤50 words (server-truncates if needed)
}
```

Server validation, in order:
1. Header gate. Missing/non-`admin` → 403.
2. `lines` is a non-empty array of plain objects.
3. Each `line_item` ∈ canonical set; each `annual_budget` is finite and ≥ 0; each `tolerance_pct` is finite and ∈ `[0, 100]`.
4. `userName` is a non-empty string (trimmed).
5. `note` is a string (default `null`).

On success: in one transaction, `INSERT … VALUES … ON CONFLICT (line_item) DO UPDATE SET monthly_budget, annual_budget, tolerance_pct, approved_by, note, updated_at = NOW()` for each posted line; re-read the full table; return.

All `/api/budget` routes declare `dynamic = 'force-dynamic'` and `Cache-Control: no-store`.

### 4.3 Owned — Variance KPI tile API

**`GET /api/pnl/v3/variance-kpi?fy=<FY>&range=<fy|last12|ytd>`** — open (no auth):

```ts
200 → { tiles: V3VarianceKpiTile[] }

interface V3VarianceKpiTile {
  line_item:     'NS' | 'CO' | 'GP' | 'EP' | 'OP' | 'NP' | 'ER' | 'CR';
  label:         string;          // "NET SALES" etc.
  actualRm:      number;          // current FY window actual
  budget?: {                      // only present for input lines (NS, CO, EP, OI)
    monthlyRm:     number;
    annualRm:      number;
    tolerancePct:  number;
    varianceRm:    number;        // actualRm − annualRm
    variancePct:   number | null; // varianceRm / |annualRm| × 100; null when budget = 0
    yoyPct:        number | null; // (current − prior) / |prior| × 100
    higherIsBetter: boolean;
    isFavourable:  boolean | null;
    position:      BudgetPosition;
    positionLabel: string;        // human label, from getBudgetPositionLabel()
  };
  yoy?: {                         // present for derived lines too (GP, OP, NP)
    priorRm:    number;
    deltaRm:    number;
    pct:        number | null;
  };
}

type BudgetPosition =
  | 'on-budget' | 'above-target' | 'below-target'
  | 'over-budget' | 'under-budget' | 'no-budget';
```

The route reads `budget_global` once and the P&L slice (`pc_pnl_period` + opening balance fold-in) once, joins in memory, computes the variance + YoY + position, and returns. `no-store`.

### 4.4 Consumed

- **`pc_pnl_period`** — read-only source-of-truth (doc 01 §2; doc 04 §5.5 `LOCAL_WHITELIST`). The fiscal-period actuals come from here via `getFiscalSlice(period)`.
- **The engine pool** (`getPool` — doc 01) for `budget_global` reads/writes.
- **The admin gate header convention** (doc 08 §5.1).

## 5. Behavior & flow

> `[VERSION-SENSITIVE]` flags stack assumptions. Reference stack: Next.js App Router + React + TypeScript.

### 5.1 Budget Setting dialog (operator UI)

Hosted in the Financial page shell (`DashboardShellV3`), top right, as a button labelled "Budget Setting". The button renders only when the role provider reports `isAdmin === true`. Non-admin users see no button (the page does not advertise the feature it cannot use).

Clicking opens a modal dialog with:

- **Title** "Budget Setting".
- **Close (×)** button (top-right).
- A **table** of the four canonical line items, one row each, three columns: `Line Item | Annual Budget | Tolerance (%)`. Both numeric columns are editable inputs. Numbers display with thousands grouping; the underlying state is the unformatted number.
- **Note (optional)** — labelled textarea below the table, with a live `<words used>/50 words` counter top-right of the label. Words past 50 are clamped client-side (the textarea trims on blur).
- **Last updated** footer line — `Last updated by <approved_by> on <updated_at>` (locale-formatted), or a placeholder when never saved.
- **Save** button — black, bottom-right. Disabled when the draft is invalid (see §5.3) or the user is not admin.

Initial load: SWR or equivalent `GET /api/budget`; populate the inputs from the response; copy into a draft state for editing. The dialog has no internal navigation — close discards an unsaved draft (no confirm prompt; this is a 4-row form, the discard cost is low).

### 5.2 Budget Setting CRUD

**Read.** Always-fresh: the dashboard re-fetches `/api/budget` on dialog open and after a successful save. No client cache survives a save.

**Save.** Validate client-side first (§5.3); if clean, POST the draft via `PUT /api/budget` with `x-user-role: admin` and `x-user-name: <userName>` headers; on `200`, patch the dashboard's KPI store from the response and close the dialog with a success toast. On `400`, surface the server's error inline at the offending field. On `403`, surface "Admin role required" and disable the button.

### 5.3 Budget Setting validation (client mirror of server authority)

The client validates before enabling **Save**; the server re-validates and is the authority. Client checks:

| Field | Rule |
|---|---|
| `annual_budget` per line | numeric, finite, ≥ 0 |
| `tolerance_pct` per line | numeric, finite, ∈ `[0, 100]` |
| `note` | string; ≤ 50 words (clamped) |

A hand-crafted invalid PUT bypassing the UI is rejected `400` and persists nothing.

### 5.4 KPI card layout (PLKpiCardsV3)

The Financial page's KPI band renders two rows of four cards each. Row 1 carries the **budget-linked** lines; row 2 carries derived ratios.

**Row 1.** Net Sales · Cost of Sales · Gross Profit · Operating Costs.

**Row 2.** Operating Profit · Profit/Loss · Expense Ratio · Current Ratio.

Each card shows:

```
┌──────────────────────────────────────────────────────────┐
│ NET SALES                                  ⬤ On Budget    │  ← header
│ RM 81,520,186                                              │  ← value (huge)
│                                                            │
│ vs Budget         Variance %         Last Year             │  ← row labels
│ +RM 3,020,186     +3.8%              +2.0%                 │  ← row values
└──────────────────────────────────────────────────────────┘
```

Per-card layout pieces:

- **Title** — `text-xs font-medium uppercase`; the line's display label.
- **Value** — `text-2xl font-bold`; colour-graded by line semantics (positive favourable = emerald; clearly unfavourable = red; neutral = default text colour).
- **Badge (top right)** — a pill: emerald background for favourable positions (`on-budget`, `above-target` for NS-like, `under-budget` for CO-like), red for unfavourable (`over-budget`, `below-target` for NS-like). Cards without budget (Gross Profit, Operating Profit, Profit/Loss, ratios) have no badge.
- **Three-column comparison footer** — `vs Budget` (absolute RM delta, signed), `Variance %` (signed), `Last Year` (signed % YoY). Each value is coloured by favourability: emerald if the value's direction matches `higherIsBetter`, red if it opposes.
- **Subtitle** (Gross Profit only) — `Sales − Cost of Sales` as a static descriptor; no comparison footer because Gross Profit has no budget row.

All comparison row labels are fixed strings:
- `"vs Budget"`
- `"Variance %"`
- `"Last Year"`

### 5.5 Badge decision logic (`getBudgetPosition`)

```ts
type BudgetPosition =
  | 'on-budget' | 'above-target' | 'below-target'
  | 'over-budget' | 'under-budget' | 'no-budget';

function getBudgetPosition({
  varianceRm, variancePct, tolerancePct, higherIsBetter,
}: {
  varianceRm:    number | null;
  variancePct:   number | null;
  tolerancePct:  number | null;
  higherIsBetter: boolean;
}): BudgetPosition {
  if (varianceRm == null) return 'no-budget';

  const tolerance = Math.max(0, tolerancePct ?? 5);   // default 5%

  if (variancePct == null) {
    if (varianceRm === 0) return 'on-budget';
    // otherwise fall through to direction
  } else if (Math.abs(variancePct) <= tolerance) {
    return 'on-budget';
  }

  if (higherIsBetter) {
    return varianceRm > 0 ? 'above-target' : 'below-target';
  }
  return varianceRm > 0 ? 'over-budget' : 'under-budget';
}
```

Six positions, three semantic classes:

| Position | Semantic | Typical label |
|---|---|---|
| `on-budget` | Within tolerance band, either direction | **On Budget** (emerald) |
| `above-target` | Above budget *and* `higherIsBetter` (e.g. Net Sales beat) | **Above Target** (emerald) |
| `below-target` | Below budget *and* `higherIsBetter` (e.g. Net Sales miss) | **Below Target** (red) |
| `over-budget` | Above budget *and* `!higherIsBetter` (e.g. costs ran hot) | **Over Budget** (red) |
| `under-budget` | Below budget *and* `!higherIsBetter` (e.g. costs ran lean) | **Under Budget** (emerald) |
| `no-budget` | No budget row exists for this line | **No Budget** (neutral) — usually hidden |

`getBudgetPositionLabel(position)` returns the human-readable string.

### 5.6 Polarity (`higherIsBetter`) per line item

Polarity is a **per-line constant** declared in code, not user-editable. It encodes the accounting convention "is going up good news?".

| Line | Code | `higherIsBetter` | Reason |
|---|---|---|---|
| Net Sales | `NS` | `true` | Higher sales = good |
| Other Income | `OI` | `true` | Higher other income = good |
| Cost of Sales | `CO` | `false` | Higher cost = bad |
| Operating Costs | `EP` | `false` | Higher cost = bad |
| Gross Profit | `GP` | — | Derived (Sales − Cost of Sales); no budget row, no badge |
| Operating / Net Profit | `OP` / `NP` | — | Derived; no badge in row 2 |

Polarity also drives the **comparison-row value colour**: Variance % and Last Year text are emerald when the value's sign agrees with `higherIsBetter`, red when it opposes. `vs Budget` is the absolute RM and uses the same colour as Variance %.

### 5.7 AI Insight integration (read-only)

The `financial_variance` section's four components read `budget_global` during fetch and embed the values in their raw-data blocks. Two patterns inside doc 04a govern how the prompts must handle this:

- **Conditional rules.** Each component has explicit *"if a budget baseline exists"* vs *"if no baseline exists"* branches. If `budget_global` is empty, the fetcher must explicitly state *"no approved budget baseline"* so the prompt's "no-budget" branch fires — the model then suppresses any variance-to-budget claims. See [04a `fv_variance_summary`](04a-prompt-catalog.md) and [04a `fv_budget_suggestions`](04a-prompt-catalog.md) for the exact rules.
- **No fiscal-year qualifier.** The label used in the prompts is the literal phrase *"approved budget baseline"*; the model is instructed not to qualify it with a fiscal year. This matches the table's design (global, not FY-keyed).
- **Tolerance flows in as evidence.** The `tolerance_pct` per line is included in the raw-data table and feeds the human-readable "Tolerance" / "Budget Position" / "Favourability" columns the model narrates. The AI is told to *treat the position label as authoritative* (do not re-derive the position from raw numbers).

## 6. Rules & edge cases

| # | Trigger | Required behavior | Why |
|---|---|---|---|
| 1 | Non-admin opens dashboard | No Budget Setting button rendered | Invariant 1 — mutation is gated. |
| 2 | Non-admin reads `/api/budget` | Served normally | Observation is open; the KPI cards must render for everyone. |
| 3 | PUT without admin header | `403 Admin role required` | Server is the authority on the gate. |
| 4 | PUT with `tolerance_pct = 150` | `400 Invalid tolerance_pct` | Bound enforcement (rule §5.3). |
| 5 | PUT with negative `annual_budget` | `400 Invalid annual_budget` | Negative budgets are not a meaningful state. |
| 6 | PUT with non-finite number | `400 Invalid value (must be finite)` | Defensive against NaN / Infinity from JSON. |
| 7 | Note exceeds 50 words client-side | Truncated to 50 words before send | UX limit, not a security limit; server is permissive. |
| 8 | Saving a subset of lines (e.g. only NS) | Upsert only the posted lines; others unchanged | The form posts all four, but partial posts must be safe. |
| 9 | `budget_global` empty (fresh install) | `GET /api/budget` returns `{ budget: [] }`; KPI cards show `no-budget`; AI Insight section emits "no approved baseline" data block | Invariants 4, 5; doc 04a conditional rules cover the prompt side. |
| 10 | Tolerance edited from 5% to 10% | KPI badge flips immediately on next render (no re-save of actuals); AI section reflects on next batch run | Invariant 4 — badge is derived; the table is the only state. |
| 11 | `variancePct` undefined because `annual_budget = 0` | `getBudgetPosition` falls through to direction-only branch; if `varianceRm = 0` ⇒ `on-budget`; else direction by polarity | Don't divide by zero; still emit a meaningful position. |
| 12 | Gross Profit / Operating Profit / Net Profit cards | No `budget` block on the tile; no badge; no comparison footer | Invariant 6 — only input lines are configurable. |
| 13 | A new line item is needed (e.g. Finance Expenses) | Migration adds the row; UI adds the editable row; `FPA_LINE_META` adds the polarity entry; doc 04a's affected entries update their conditional rules; the AI Insight batch must be re-run | Coordinated change across §4.1, §5.4, §5.6, and doc 04a. |
| 14 | Server-side `monthly_budget` divergence (DB row's monthly ≠ annual/12) | Server *always* writes `annual_budget / 12` on PUT — never trusts a sent monthly value | Single source of truth; the column exists only as a read cache. |
| 15 | Admin role spoofed (sandbox header is spoofable, doc 08 §5.1) | Documented as **sandbox stand-in**; production must replace with real auth | Same caveat as doc 08; the *contract* (admin-only mutation) must survive even if the mechanism changes. |

### 6.1 Configuration owned by this layer

| Variable | Source | Purpose |
|---|---|---|
| Default tolerance | Code constant `5` | Used by `getBudgetPosition` when `tolerancePct` is null and by the migration's seed default. |
| Canonical line set | Code constant in `FPA_LINE_META` + migration seed | The four-line set `[NS, CO, EP, OI]`. Adding a line is a coordinated change (rule 13). |
| Note word limit | UI constant `50` | Client-side clamp; not enforced server-side. |

No ENV variables.

## 7. Reference Implementation

Source paths are evidence; the spec above is what binds.

| Path | Symbol / role |
|---|---|
| `migrations/023_budget_global.sql` | `budget_global` DDL + seed rows. |
| `apps/dashboard/src/lib/budget/queries.ts` | `getGlobalBudget()`, `saveGlobalBudget(lines, userName, note)`, default-tolerance handling. |
| `apps/dashboard/src/lib/budget/status.ts` | `getBudgetPosition({varianceRm,variancePct,tolerancePct,higherIsBetter})`, `getBudgetPositionLabel(pos)`, the `BudgetPosition` type. |
| `apps/dashboard/src/app/api/budget/route.ts` | `GET` (open) and `PUT` (admin) — §4.2 envelopes. |
| `apps/dashboard/src/app/api/pnl/v3/variance-kpi/route.ts` | `GET` — calls `getVarianceKpiTiles(period)` and returns §4.3 shape. |
| `apps/dashboard/src/lib/ai-insight/data-fetcher.ts` | `getVarianceKpiTiles(period)` (~line 4400+) — the join of `getFiscalSlice(period)` × `getGlobalBudget()`; also where `FPA_LINE_META` (per-line label + `higherIsBetter`) lives. |
| `apps/dashboard/src/components/pnl/dashboard-v3/PLKpiCardsV3.tsx` | The KPI card component, the `KpiCardProps` / `BudgetInfo` interfaces, the inline `StatusBadge`, the favourability colouring. |
| `apps/dashboard/src/hooks/pnl/usePLDataV3.ts` | `useV3VarianceKpi(fy, range)` — SWR-backed read of the tile API. |
| `apps/dashboard/src/components/ai-insight/BudgetSettingDialog.tsx` | The dialog UI, the client-side validation, the word-clamp on note. |
| `apps/dashboard/src/components/pnl/dashboard-v3/DashboardShellV3.tsx` | Hosts the Budget Setting button (admin-gated) and the KPI cards. |
| `docs/plans/variance-panel-rework.md` | Approved spec (2026-05-14) for this work — supplementary context only; this document is the binding spec for the production port. |

**Sandbox-only commit:** `a0cbab3` (2026-05-16) — *"feat(financials): polarity-aware KPI cards + Budget Setting Dialog rework"*. Production deployment requires applying `migrations/023_budget_global.sql` and porting the components above.

## 8. Verification checkpoint

**Setup.** Apply doc 01's schema and `migrations/023_budget_global.sql`. Confirm `budget_global` contains the four canonical line items at sensible seed values (e.g. NS 78500000, CO 72300000, EP 7000000, OI 0; tolerance 5%). Build the engine per docs 01–08 so an AI Insight batch can run.

**Action & expected observable result:**

1. **Admin save round-trip.** As admin, open the Budget Setting dialog → values match the table → change NS annual to `82000000` and `tolerance_pct` to `7` → Save → toast → reopen → values persisted, `approved_by` and `updated_at` reflect the save.
2. **Non-admin gate.** Without the admin header: the Budget Setting button is hidden; a forged `PUT /api/budget` ⇒ `403`; `GET /api/budget` ⇒ served normally.
3. **Validation rejection.** PUT with `tolerance_pct = -5` ⇒ `400`; with `annual_budget = "abc"` ⇒ `400`; with `annual_budget = NaN` ⇒ `400`. In all cases the table is unchanged.
4. **KPI badge.** With NS budget 82,000,000, tolerance 7%, and current actuals 81,520,186 ⇒ varianceRm = −479,814, variancePct ≈ −0.59%, |variancePct| ≤ 7 ⇒ position `on-budget`, label "On Budget", emerald pill. Set tolerance to `0.4` and re-fetch ⇒ |variancePct| > 0.4, polarity NS is `higherIsBetter` ⇒ position `below-target`, label "Below Target", red pill.
5. **Gross Profit invariant.** The Gross Profit card renders with the value RM `(NS actual − CO actual)`, *no* badge, *no* `vs Budget` / `Variance %` / `Last Year` rows, and the subtitle `Sales − Cost of Sales`.
6. **No-budget branch.** `DELETE FROM budget_global` → `GET /api/budget` returns `{ budget: [] }`; the KPI cards render with no badge and no comparison footer; trigger the AI Insight batch → the `financial_variance` section's fetcher emits *"no approved budget baseline"* in its raw data block and the four components' prompts suppress all variance-to-budget claims (verify against [04a `fv_variance_summary`](04a-prompt-catalog.md) / [`fv_budget_suggestions`](04a-prompt-catalog.md) conditional rules).
7. **AI Insight integration.** Re-seed `budget_global`; trigger the batch; open the persisted `financial_variance` section. Confirm the section narrative references the budget values (within numeric guard tolerance) and uses the literal phrase *"approved budget baseline"* without a fiscal-year qualifier.

**Definition of Done:** a developer who has read docs 00–04 and 08 plus this one, with no access to this repository's source, can build `budget_global`, the Budget Setting dialog, the `/api/budget` endpoints, the Variance KPI tile API, the KPI card component with badge logic, and pass all seven checks. The AI Insight engine itself requires no code change to consume the result.
