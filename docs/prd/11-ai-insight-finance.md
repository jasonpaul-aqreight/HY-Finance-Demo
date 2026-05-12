# Finance AI Insight Module

Primary base dependency: [10-ai-insight-base.md](10-ai-insight-base.md)

This document describes the Finance-specific AI Insight module. It is intentionally separate from the base AI Insight engine. The base document defines shared UI, orchestration, prompt registry, provider, guard, persistence, feedback, and evaluation contracts. This file defines Finance pages, sections, components, prompts, data packages, tools, model defaults, database usage, and rollout evidence.

## 1. Scope

Finance AI Insight is an embedded analyst inside the Finance dashboard. Users do not type free-form questions. They click `Get Insight` on a Finance section, then read ranked positive and negative cards with detail dialogs and component-level narratives.

Inventory:

- Pages: 7 Finance pages.
- Sections: 16 Finance AI Insight sections.
- Registered Finance components: 69.

Finance-specific behavior must not leak into the reusable base engine. Future modules can reuse the base contracts but must provide their own section catalog, prompt library, data fetchers, tool policy, scopes, guard whitelists, and evaluation set.

## 2. User Behavior

The Finance user sees the normal dashboard first. AI Insight is an assistive layer beside section headings and components.

User actions:

- Click `Get Insight` on a section.
- Read up to 3 positive and up to 3 negative section cards.
- Open a section detail dialog for evidence and root cause.
- Click a component Analyze icon to read the component narrative generated during the section run.
- Submit feedback on poor insight text.
- Admin users review routed feedback, preview prompt edits, and create/select prompt versions.

Non-goals:

- No free-form chatbot.
- No autonomous financial approvals.
- No model-side arithmetic beyond using supplied values.
- No raw unrestricted SQL.

## 3. Finance Screenshots

Reference UI captures (see PRD 10 §3–§6 for the canonical UI shell screenshots).

| UI evidence | Path |
|---|---|
| Section header with Get Insight | `docs/prd/screenshots/payment/ai-insight-section-header.png` |
| Completed AI panel | `docs/prd/screenshots/payment/ai-insight-panel-results.png` |
| Insight detail dialog | `docs/prd/screenshots/payment/ai-insight-detail-dialog.png` |
| Component Analyze icon | `docs/prd/screenshots/payment/ai-insight-component-icon.png` |
| Component dialog | `docs/prd/screenshots/payment/ai-insight-component-dialog.png` |
| Feedback modal | `docs/prd/screenshots/payment/ai-insight-feedback-modal.png` |
| Idle panel | `docs/prd/screenshots/expenses/ai-insight-panel-idle.png` |
| Admin config page (full) | `docs/prd/screenshots/ai-insight-admin/config-page-full.png` |
| Prompt text panel | `docs/prd/screenshots/ai-insight-admin/prompt-text-panel.png` |
| Version panel (default) | `docs/prd/screenshots/ai-insight-admin/version-panel-default.png` |
| Version panel (with versions) | `docs/prd/screenshots/ai-insight-admin/version-panel-with-versions.png` |
| Feedback list | `docs/prd/screenshots/ai-insight-admin/feedback-list.png` |
| Feedback diff modal | `docs/prd/screenshots/ai-insight-admin/feedback-diff-modal.png` |

![AI Insight section header](screenshots/payment/ai-insight-section-header.png)

![AI Insight completed panel](screenshots/payment/ai-insight-panel-results.png)

![AI Insight detail dialog](screenshots/payment/ai-insight-detail-dialog.png)

![AI Insight component dialog](screenshots/payment/ai-insight-component-dialog.png)

![AI Insight admin config](screenshots/ai-insight-admin/config-page-full.png)

## 4. Runtime Shape

Finance uses the base two-layer AI Insight flow.

1. Resolve Finance page, section key, and scope.
2. Load the registered components for the section.
3. Fetch each component data package from deterministic server fetchers.
4. Run component analysis for each component with no tools.
5. Build the section summary user prompt from raw component data, not component prose.
6. Run the summary model with section-level tools according to policy.
7. Execute at most 2 summary tool calls.
8. Parse `===INSIGHT===` delimiter blocks into `{ good, bad }`.
9. Run numeric guard across all raw-data allowed values plus tool-result numbers.
10. Retry the summary once with guard feedback if numeric guard fails.
11. Persist the accepted section and component results.
12. Stream progress and final metadata to the UI.

Current runtime limits from `orchestrator.ts`:

| Limit | Current value |
|---|---:|
| Component concurrency | 2 |
| Component max tokens | 2,048 |
| Summary max tokens | 4,096 |
| Summary tool-call cap | 2 |
| Numeric guard attempts | 2 |
| Section cost cap | USD 0.50 |
| Runtime timeout | 5 minutes |

The summary must use raw fetcher data as source of truth. Component narratives are UI content, not evidence input for the summary.

## 5. Section Catalog

| ID | Page | Section key | Section | Scope | Tool policy | Components |
|---|---|---|---|---|---|---:|
| S01 | Payment | `payment_collection_trend` | Payment Collection Trend | period | aggregate_only | 5 |
| S02 | Payment | `payment_outstanding` | Outstanding Payment | snapshot | full | 6 |
| S03 | Sales | `sales_trend` | Sales Trend | period | aggregate_only | 5 |
| S04 | Sales | `sales_breakdown` | Sales Breakdown | period | full | 4 |
| S05 | Customer Margin | `customer_margin_overview` | Customer Margin Overview | period | aggregate_only | 7 |
| S06 | Customer Margin | `customer_margin_breakdown` | Customer Margin Breakdown | period | full | 3 |
| S07 | Supplier Performance | `supplier_margin_overview` | Supplier Margin Overview | period | aggregate_only | 7 |
| S08 | Supplier Performance | `supplier_margin_breakdown` | Supplier Margin Breakdown | period | full | 4 |
| S09 | Returns | `return_trend` | Return Trends | period | aggregate_only | 7 |
| S10 | Returns | `return_unsettled` | Unsettled Returns | snapshot | full | 2 |
| S11 | Expenses | `expense_overview` | Expense Overview | period | aggregate_only | 7 |
| S12 | Expenses | `expense_breakdown` | Expense Breakdown | period | full | 2 |
| S13 | Financial | `financial_overview` | Financial Overview | fiscal_period | aggregate_only | 2 |
| S14 | Financial | `financial_pnl` | Profit & Loss Detail | fiscal_period | aggregate_only | 2 |
| S15 | Financial | `financial_balance_sheet` | Balance Sheet | fiscal_period | aggregate_only | 2 |
| S16 | Financial | `financial_variance` | Variance, Forecast & Budget | fiscal_period | aggregate_only | 4 |

Scope meanings:

| Scope | Meaning |
|---|---|
| `period` | Activity inside the selected calendar date range. |
| `snapshot` | Current point-in-time state anchored to a snapshot table. |
| `fiscal_period` | Financial page window selected by fiscal year plus `fy`, `last12`, or `ytd`. |

Snapshot anchors:

| Section | Snapshot source |
|---|---|
| `payment_outstanding` | Latest `pc_ar_customer_snapshot.snapshot_date` |
| `return_unsettled` | Latest `pc_return_aging.snapshot_date` |

## 6. Full Component Catalog

| Page | Section key | Section | Component key | Component | Type | Scope | Tool policy |
|---|---|---|---|---|---|---|---|
| Payment | `payment_collection_trend` | Payment Collection Trend | `avg_collection_days` | Avg Collection Days | kpi | period | aggregate_only |
| Payment | `payment_collection_trend` | Payment Collection Trend | `collection_rate` | Collection Rate | kpi | period | aggregate_only |
| Payment | `payment_collection_trend` | Payment Collection Trend | `avg_monthly_collection` | Avg Monthly Collection | kpi | period | aggregate_only |
| Payment | `payment_collection_trend` | Payment Collection Trend | `collection_days_trend` | Avg Collection Days Trend | chart | period | aggregate_only |
| Payment | `payment_collection_trend` | Payment Collection Trend | `invoiced_vs_collected` | Invoiced vs Collected | chart | period | aggregate_only |
| Payment | `payment_outstanding` | Outstanding Payment | `total_outstanding` | Total Outstanding | kpi | snapshot | full |
| Payment | `payment_outstanding` | Outstanding Payment | `overdue_amount` | Overdue Amount | kpi | snapshot | full |
| Payment | `payment_outstanding` | Outstanding Payment | `credit_limit_breaches` | Credit Limit Breaches | kpi | snapshot | full |
| Payment | `payment_outstanding` | Outstanding Payment | `aging_analysis` | Aging Analysis | chart | snapshot | full |
| Payment | `payment_outstanding` | Outstanding Payment | `credit_usage_distribution` | Credit Usage Distribution | chart | snapshot | full |
| Payment | `payment_outstanding` | Outstanding Payment | `customer_credit_health` | Customer Credit Health | table | snapshot | full |
| Sales | `sales_trend` | Sales Trend | `net_sales` | Net Sales | kpi | period | aggregate_only |
| Sales | `sales_trend` | Sales Trend | `invoice_sales` | Invoice Sales | kpi | period | aggregate_only |
| Sales | `sales_trend` | Sales Trend | `cash_sales` | Cash Sales | kpi | period | aggregate_only |
| Sales | `sales_trend` | Sales Trend | `credit_notes` | Credit Notes | kpi | period | aggregate_only |
| Sales | `sales_trend` | Sales Trend | `net_sales_trend` | Net Sales Trend | chart | period | aggregate_only |
| Sales | `sales_breakdown` | Sales Breakdown | `by_customer` | By Customer | breakdown | period | full |
| Sales | `sales_breakdown` | Sales Breakdown | `by_product` | By Product | breakdown | period | full |
| Sales | `sales_breakdown` | Sales Breakdown | `by_agent` | By Sales Agent | breakdown | period | full |
| Sales | `sales_breakdown` | Sales Breakdown | `by_outlet` | By Outlet | breakdown | period | full |
| Customer Margin | `customer_margin_overview` | Customer Margin Overview | `cm_net_sales` | Net Sales | kpi | period | aggregate_only |
| Customer Margin | `customer_margin_overview` | Customer Margin Overview | `cm_cogs` | COGS | kpi | period | aggregate_only |
| Customer Margin | `customer_margin_overview` | Customer Margin Overview | `cm_gross_profit` | Gross Profit | kpi | period | aggregate_only |
| Customer Margin | `customer_margin_overview` | Customer Margin Overview | `cm_margin_pct` | Margin % | kpi | period | aggregate_only |
| Customer Margin | `customer_margin_overview` | Customer Margin Overview | `cm_active_customers` | Active Customers | kpi | period | aggregate_only |
| Customer Margin | `customer_margin_overview` | Customer Margin Overview | `cm_margin_trend` | Margin Trend | chart | period | aggregate_only |
| Customer Margin | `customer_margin_overview` | Customer Margin Overview | `cm_margin_distribution` | Margin Distribution | chart | period | aggregate_only |
| Customer Margin | `customer_margin_breakdown` | Customer Margin Breakdown | `cm_top_customers` | Top Customers | chart | period | full |
| Customer Margin | `customer_margin_breakdown` | Customer Margin Breakdown | `cm_customer_table` | Customer Margin Table | table | period | full |
| Customer Margin | `customer_margin_breakdown` | Customer Margin Breakdown | `cm_credit_note_impact` | Credit Note Impact | table | period | full |
| Supplier Performance | `supplier_margin_overview` | Supplier Margin Overview | `sp_net_sales` | Est. Net Sales | kpi | period | aggregate_only |
| Supplier Performance | `supplier_margin_overview` | Supplier Margin Overview | `sp_cogs` | Est. Cost of Sales | kpi | period | aggregate_only |
| Supplier Performance | `supplier_margin_overview` | Supplier Margin Overview | `sp_gross_profit` | Est. Gross Profit | kpi | period | aggregate_only |
| Supplier Performance | `supplier_margin_overview` | Supplier Margin Overview | `sp_margin_pct` | Gross Margin % | kpi | period | aggregate_only |
| Supplier Performance | `supplier_margin_overview` | Supplier Margin Overview | `sp_active_suppliers` | Active Suppliers | kpi | period | aggregate_only |
| Supplier Performance | `supplier_margin_overview` | Supplier Margin Overview | `sp_margin_trend` | Profitability Trend | chart | period | aggregate_only |
| Supplier Performance | `supplier_margin_overview` | Supplier Margin Overview | `sp_margin_distribution` | Margin Distribution | chart | period | aggregate_only |
| Supplier Performance | `supplier_margin_breakdown` | Supplier Margin Breakdown | `sm_top_bottom` | Top/Bottom Suppliers & Items | chart | period | full |
| Supplier Performance | `supplier_margin_breakdown` | Supplier Margin Breakdown | `sm_supplier_table` | Supplier Analysis Table | table | period | full |
| Supplier Performance | `supplier_margin_breakdown` | Supplier Margin Breakdown | `sm_item_pricing` | Item Price Comparison | breakdown | period | full |
| Supplier Performance | `supplier_margin_breakdown` | Supplier Margin Breakdown | `sm_price_scatter` | Purchase vs Selling Price | chart | period | full |
| Returns | `return_trend` | Return Trends | `rt_total_returns` | Total Returns | kpi | period | aggregate_only |
| Returns | `return_trend` | Return Trends | `rt_settled` | Settled | kpi | period | aggregate_only |
| Returns | `return_trend` | Return Trends | `rt_unsettled` | Unsettled | kpi | period | aggregate_only |
| Returns | `return_trend` | Return Trends | `rt_return_pct` | Return % | kpi | period | aggregate_only |
| Returns | `return_trend` | Return Trends | `rt_settlement_breakdown` | Settlement Breakdown | chart | period | aggregate_only |
| Returns | `return_trend` | Return Trends | `rt_monthly_trend` | Monthly Return Trend | chart | period | aggregate_only |
| Returns | `return_trend` | Return Trends | `rt_product_bar` | Top Returns by Item | chart | period | aggregate_only |
| Returns | `return_unsettled` | Unsettled Returns | `ru_aging_chart` | Aging of Unsettled Returns | chart | snapshot | full |
| Returns | `return_unsettled` | Unsettled Returns | `ru_debtors_table` | Customer Returns | table | snapshot | full |
| Expenses | `expense_overview` | Expense Overview | `ex_total_costs` | Total Costs | kpi | period | aggregate_only |
| Expenses | `expense_overview` | Expense Overview | `ex_cogs` | Cost of Sales | kpi | period | aggregate_only |
| Expenses | `expense_overview` | Expense Overview | `ex_opex` | Operating Costs | kpi | period | aggregate_only |
| Expenses | `expense_overview` | Expense Overview | `ex_yoy_costs` | vs Last Year | kpi | period | aggregate_only |
| Expenses | `expense_overview` | Expense Overview | `ex_cost_trend` | Cost Trend | chart | period | aggregate_only |
| Expenses | `expense_overview` | Expense Overview | `ex_cost_composition` | Cost Composition | chart | period | aggregate_only |
| Expenses | `expense_overview` | Expense Overview | `ex_top_expenses` | Top Expenses | chart | period | aggregate_only |
| Expenses | `expense_breakdown` | Expense Breakdown | `ex_cogs_table` | Cost of Sales Breakdown | table | period | full |
| Expenses | `expense_breakdown` | Expense Breakdown | `ex_opex_table` | Operating Costs Breakdown | table | period | full |
| Financial | `financial_overview` | Financial Overview | `fin_pnl_summary` | P&L Summary | kpi | fiscal_period | aggregate_only |
| Financial | `financial_overview` | Financial Overview | `fin_monthly_trend` | Monthly P&L Trend | chart | fiscal_period | aggregate_only |
| Financial | `financial_pnl` | Profit & Loss Detail | `fin_pl_statement` | Profit & Loss Statement | table | fiscal_period | aggregate_only |
| Financial | `financial_pnl` | Profit & Loss Detail | `fin_yoy_comparison` | Multi-Year Comparison | table | fiscal_period | aggregate_only |
| Financial | `financial_balance_sheet` | Balance Sheet | `bs_trend` | Assets, Liabilities & Equity Trend | chart | fiscal_period | aggregate_only |
| Financial | `financial_balance_sheet` | Balance Sheet | `bs_statement` | Balance Sheet Statement | table | fiscal_period | aggregate_only |
| Financial | `financial_variance` | Variance, Forecast & Budget | `fv_variance_summary` | P&L Variance Summary | kpi | fiscal_period | aggregate_only |
| Financial | `financial_variance` | Variance, Forecast & Budget | `fv_variance_breakdown` | Variance by Account | table | fiscal_period | aggregate_only |
| Financial | `financial_variance` | Variance, Forecast & Budget | `fv_trend_forecast` | Trend Forecast | kpi | fiscal_period | aggregate_only |
| Financial | `financial_variance` | Variance, Forecast & Budget | `fv_budget_suggestions` | AI Budget Suggestions | kpi | fiscal_period | aggregate_only |

## 7. Prompt Inventory

Runtime prompt source:

- Runtime reads prompts from `ai_insight_prompts` through `prompt-loader.ts` with a 30 second in-memory snapshot cache.
- Factory defaults live in `prompts-defaults.ts` and are used by seed/reset helpers and DB-miss fallback.
- `ai_insight_prompts.prompt_text` is a denormalized cache of the selected prompt version.
- `ai_insight_prompt_versions` stores immutable versions. One Default version exists per prompt and up to 5 feedback-derived versions are allowed by application logic.
- Section guidance keys follow `<section_key>_guidance`.
- Finance section guidance defaults are intentionally blank. A guidance block is injected only when a non-empty DB/default guidance body exists.

Prompt keys required for Finance:

| Prompt category | Keys |
|---|---|
| System | `component_analysis`, `summary_analysis`, `feedback_router`, `surgical_editor` |
| Component | One prompt per component key in the component catalog above. |
| Section guidance | `payment_collection_trend_guidance`, `payment_outstanding_guidance`, `sales_trend_guidance`, `sales_breakdown_guidance`, `customer_margin_overview_guidance`, `customer_margin_breakdown_guidance`, `supplier_margin_overview_guidance`, `supplier_margin_breakdown_guidance`, `return_trend_guidance`, `return_unsettled_guidance`, `expense_overview_guidance`, `expense_breakdown_guidance`, `financial_overview_guidance`, `financial_pnl_guidance`, `financial_balance_sheet_guidance`, `financial_variance_guidance` |

Actual factory prompt text is embedded in Appendix A.

## 8. Model And Provider Configuration

Finance currently uses OpenRouter as the only AI model gateway for AI Insight.

| Slot | Primary model | Fallback model path |
|---|---|---|
| Component analysis | `deepseek/deepseek-v4-flash` | `anthropic/claude-haiku-latest` |
| Summary analysis | `z-ai/glm-5.1` | `deepseek/deepseek-v4-pro`, then `anthropic/claude-sonnet-latest` |
| Feedback router | Defaults to component model | Defaults to component fallback |
| Surgical editor | Defaults to summary model | Defaults to summary fallback list |

Environment overrides:

| Variable | Purpose | Default |
|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter credential | empty string |
| `AI_INSIGHT_OPENROUTER_TIMEOUT_MS` | Request timeout | `45000` |
| `AI_INSIGHT_OPENROUTER_COMPONENT_MODEL` | Component primary | `deepseek/deepseek-v4-flash` |
| `AI_INSIGHT_OPENROUTER_SUMMARY_MODEL` | Summary primary | `z-ai/glm-5.1` |
| `AI_INSIGHT_OPENROUTER_ROUTER_MODEL` | Router primary | component primary |
| `AI_INSIGHT_OPENROUTER_EDITOR_MODEL` | Editor primary | summary primary |
| `AI_INSIGHT_OPENROUTER_COMPONENT_FALLBACK_MODEL` | Component fallback | `anthropic/claude-haiku-latest` |
| `AI_INSIGHT_OPENROUTER_ROUTER_FALLBACK_MODEL` | Router fallback | component fallback |
| `AI_INSIGHT_OPENROUTER_SUMMARY_FALLBACK_MODELS` | Summary fallbacks | `deepseek/deepseek-v4-pro,anthropic/claude-sonnet-latest` |
| `AI_INSIGHT_OPENROUTER_EDITOR_FALLBACK_MODELS` | Editor fallbacks | summary fallback list |

Provider order:

| Slot/model family | Provider order |
|---|---|
| Component/router non-Anthropic | `parasail/fp8`, `atlas-cloud/fp8`, `deepseek`, `deepinfra/fp4`, `siliconflow/fp8`, `akashml/fp8`, `novita` |
| Summary/editor non-Anthropic | `deepinfra/fp4`, `siliconflow/fp8`, `friendli`, `atlas-cloud/fp8`, `z-ai` |
| Anthropic fallback slugs | `Anthropic` only |

Provider controls:

- `allowFallbacks: false` is sent to OpenRouter provider preferences so provider fallback stays inside the explicit order.
- `requireParameters: true` is sent.
- `dataCollection: deny` is sent where OpenRouter supports it.
- Reasoning is disabled with `reasoning: { effort: 'none' }`.
- Model fallback happens in code only for technical failures: timeout, rate limit, 5xx, model/provider unavailable, unsupported parameter, or connection timeout.
- Metadata captures requested model, resolved model, upstream provider, provider fallback path, model fallback path, cost source, token counts, reasoning tokens, and fallback reason.
- Cost uses OpenRouter `usage.cost` when available and local pricing estimates otherwise.

## 9. Data Package Contract

Every Finance component fetcher returns:

- A formatted raw data block for the model.
- An `allowed` numeric whitelist for RM, percent, days, and counts.
- A scope label prepended by `fetchComponentData`.
- Precomputed totals, ratios, ranks, concentrations, trends, and labels where the model might otherwise calculate.
- Population/scope wording such as period activity, snapshot state, active customers, active suppliers, top-N universe, fiscal window, or approved budget presence.

Fetcher source by module:

| Finance area | Sections | Primary data source families |
|---|---|---|
| Payment | `payment_collection_trend`, `payment_outstanding` | Direct fetchers over `pc_ar_monthly`, `pc_ar_customer_snapshot`, `pc_ar_aging_history`; credit-score settings from `app_settings.credit_score_v2`. |
| Sales | `sales_trend`, `sales_breakdown` | Direct fetchers over `pc_sales_daily`, `pc_sales_by_customer`, `pc_sales_by_outlet`, `pc_sales_by_fruit`. |
| Customer Margin | `customer_margin_overview`, `customer_margin_breakdown` | Customer-margin query helpers over `pc_customer_margin` and `pc_customer_margin_by_product`. |
| Supplier Performance | `supplier_margin_overview`, `supplier_margin_breakdown` | Supplier-margin V2 query helpers over `pc_supplier_margin`, plus limited raw IV/CS line use for item sell-price estimates. |
| Returns | `return_trend`, `return_unsettled` | Return query helpers over `pc_return_monthly`, `pc_return_products`, `pc_return_aging`, `pc_return_by_customer`, and total sales from `pc_sales_daily`. |
| Expenses | `expense_overview`, `expense_breakdown` | Expense query helpers over `pc_expense_monthly`; OpEx category logic in `data-fetcher.ts`. |
| Financial | `financial_overview`, `financial_pnl`, `financial_balance_sheet`, `financial_variance` | P&L query helpers over `pc_pnl_period`, `pc_opening_balance`, `pl_format`, `account_type`, fiscal-year helpers, and `budget`. |

Precompute rules by risk type:

| Risk | Required precompute pattern |
|---|---|
| Sub-period trend claims | Provide half-period averages, first-to-last changes, longest streaks, peak/trough rows, or named period labels. |
| Concentration claims | Provide top-1, top-3, top-5, top-10 totals and shares as allowed values. |
| Rank claims | Provide explicit slowest/fastest/highest/lowest ordered labels. |
| Margin claims | Provide margin %, margin drift pp, GP/NP sign flips, and top movers. |
| Snapshot claims | Provide latest snapshot date and snapshot population labels. |
| Budget claims | Provide approved budget table only when one exists; otherwise state no approved budget. |

## 10. Tool Contract

Finance exposes two model-callable tools to the summary phase only:

| Tool | Purpose | Availability |
|---|---|---|
| `query_local_table` | Query approved local `pc_*` aggregate/precomputed tables. | `aggregate_only` and `full` policies. |
| `query_rds_table` | Query approved source-system document tables for drill-down detail. | `full` policy only. |

Policy behavior:

| Policy | Runtime behavior |
|---|---|
| `none` | No tools exposed. Not used by the current Finance section catalog; retained as a base policy option. |
| `aggregate_only` | Only `query_local_table`; table enum is restricted to aggregate local tables. |
| `full` | Both local and RDS tools exposed with table/column whitelists. |

Aggregate-only tables:

- `pc_sales_daily`
- `pc_ar_monthly`
- `pc_ar_aging_history`
- `pc_customer_margin`
- `pc_supplier_margin`
- `pc_return_monthly`
- `pc_return_products`
- `pc_expense_monthly`
- `pc_pnl_period`

Tool whitelist and safety snapshot:

~~~ts
const LOCAL_WHITELIST: Record<string, string[]> = {
  pc_sales_daily: ['doc_date', 'invoice_total', 'cash_total', 'cn_total', 'net_revenue', 'doc_count'],
  pc_sales_by_customer: ['doc_date', 'debtor_code', 'company_name', 'debtor_type', 'sales_agent', 'invoice_sales', 'cash_sales', 'credit_notes', 'total_sales', 'doc_count'],
  pc_sales_by_outlet: ['doc_date', 'dimension', 'dimension_key', 'dimension_label', 'is_active', 'invoice_sales', 'cash_sales', 'credit_notes', 'total_sales', 'doc_count', 'customer_count'],
  pc_sales_by_fruit: ['doc_date', 'fruit_name', 'fruit_country', 'fruit_variant', 'invoice_sales', 'cash_sales', 'credit_notes', 'total_sales', 'total_qty', 'doc_count'],
  pc_ar_monthly: ['month', 'invoiced', 'collected', 'cn_applied', 'refunded', 'total_outstanding', 'total_billed', 'customer_count'],
  pc_ar_customer_snapshot: ['debtor_code', 'company_name', 'debtor_type', 'sales_agent', 'display_term', 'credit_limit', 'total_outstanding', 'overdue_amount', 'utilization_pct', 'credit_score', 'risk_tier', 'is_active', 'invoice_count', 'avg_payment_days', 'max_overdue_days'],
  pc_ar_aging_history: ['snapshot_date', 'bucket', 'dimension', 'invoice_count', 'total_outstanding'],
  pc_customer_margin: ['month', 'debtor_code', 'company_name', 'debtor_type', 'sales_agent', 'is_active', 'iv_revenue', 'dn_revenue', 'cn_revenue', 'iv_cost', 'dn_cost', 'cn_cost', 'iv_count', 'cn_count'],
  pc_supplier_margin: ['month', 'creditor_code', 'creditor_name', 'item_code', 'item_group', 'is_active', 'sales_revenue', 'attributed_cogs', 'purchase_qty', 'purchase_value'],
  pc_return_monthly: ['month', 'cn_count', 'cn_total', 'knock_off_total', 'refund_total', 'unresolved_total', 'reconciled_count', 'partial_count', 'outstanding_count'],
  pc_return_products: ['month', 'item_code', 'item_description', 'fruit_name', 'fruit_variant', 'fruit_country', 'cn_count', 'total_qty', 'total_amount', 'goods_returned_qty', 'credit_only_qty'],
  pc_return_aging: ['snapshot_date', 'bucket', 'count', 'amount'],
  pc_return_by_customer: ['month', 'debtor_code', 'company_name', 'cn_count', 'cn_total', 'knock_off_total', 'refund_total', 'unresolved', 'outstanding_count'],
  pc_expense_monthly: ['month', 'acc_no', 'account_name', 'acc_type', 'net_amount'],
  pc_pnl_period: ['period_no', 'acc_type', 'acc_no', 'account_name', 'parent_acc_no', 'home_dr', 'home_cr', 'proj_no'],
};

const RDS_WHITELIST: Record<string, string[]> = {
  'dbo.IV': ['DocNo', 'DocDate', 'DebtorCode', 'LocalNetTotal', 'Description', 'SalesAgent', 'SalesLocation', 'Cancelled'],
  'dbo.CS': ['DocNo', 'DocDate', 'DebtorCode', 'LocalNetTotal', 'Description', 'SalesAgent', 'SalesLocation', 'Cancelled'],
  'dbo.CN': ['DocNo', 'DocDate', 'DebtorCode', 'LocalNetTotal', 'Description', 'SalesAgent', 'CNType', 'Cancelled'],
  'dbo.ARInvoice': ['DocNo', 'DocDate', 'DueDate', 'DebtorCode', 'LocalNetTotal', 'Outstanding', 'DisplayTerm', 'Cancelled'],
  'dbo.ARPayment': ['DocNo', 'DocDate', 'DebtorCode', 'LocalPaymentAmt', 'Description', 'Cancelled'],
  'dbo.ARPaymentKnockOff': ['DocKey', 'KnockOffDocKey', 'KnockOffAmt', 'KnockOffDate'],
};

const ROW_LIMIT = 100;

// RDS tables that require Cancelled='F' to exclude voided documents. The
// LLM is instructed to include this filter, but we ALSO inject it server-side
// (see executeRdsQuery) so prompt drift can never let a cancelled document
// leak into the analysis.
const RDS_CANCELLED_FILTER_TABLES = new Set([
  'dbo.IV',
  'dbo.CS',
  'dbo.CN',
  'dbo.ARInvoice',
  'dbo.ARPayment',
]);

// Words/sequences that should never appear inside an LLM-supplied WHERE clause.
// Statement separators, comment markers, and any keyword that would let the
// model exfiltrate or mutate data outside the intended SELECT.
const WHERE_CLAUSE_BLOCKLIST: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /;/, label: 'statement terminator (;)' },
  { pattern: /--/, label: 'line comment (--)' },
  { pattern: /\/\*/, label: 'block comment start (/*)' },
  { pattern: /\*\//, label: 'block comment end (*/)' },
  { pattern: /\bUNION\b/i, label: 'UNION' },
  { pattern: /\bSELECT\b/i, label: 'nested SELECT' },
  { pattern: /\bINSERT\b/i, label: 'INSERT' },
  { pattern: /\bUPDATE\b/i, label: 'UPDATE' },
  { pattern: /\bDELETE\b/i, label: 'DELETE' },
  { pattern: /\bDROP\b/i, label: 'DROP' },
  { pattern: /\bTRUNCATE\b/i, label: 'TRUNCATE' },
  { pattern: /\bALTER\b/i, label: 'ALTER' },
  { pattern: /\bEXEC\b/i, label: 'EXEC' },
  { pattern: /\bEXECUTE\b/i, label: 'EXECUTE' },
  { pattern: /\bGRANT\b/i, label: 'GRANT' },
  { pattern: /\bREVOKE\b/i, label: 'REVOKE' },
  { pattern: /\bxp_\w+/i, label: 'extended stored procedure (xp_*)' },
  { pattern: /\bsp_\w+/i, label: 'system stored procedure (sp_*)' },
];

function validateWhereClauseSafety(where: string | undefined | null): string | null {
  if (!where) return null;
  for (const { pattern, label } of WHERE_CLAUSE_BLOCKLIST) {
    if (pattern.test(where)) {
      return `WHERE clause rejected: contains disallowed token (${label}). Use only column comparisons with $1/$2 parameter placeholders.`;
    }
  }
  return null;
}

function ensureRdsCancelledFilter(table: string, where: string | undefined): string | undefined {
  if (!RDS_CANCELLED_FILTER_TABLES.has(table)) return where;
  // Already present (any case)? Leave it untouched.
  if (where && /Cancelled\s*=\s*'F'/i.test(where)) return where;
  const filter = `Cancelled = 'F'`;
  if (!where || !where.trim()) return filter;
  return `(${where}) AND ${filter}`;
}
~~~

Additional runtime safety:

- Row limit is capped at 100.
- Tool columns must exactly match the whitelist for the requested table.
- Unsafe `where_clause` and `order_by` tokens are rejected, including statement terminators, comments, nested SELECT, UNION, mutation/DDL keywords, and stored procedure patterns.
- RDS `dbo.IV`, `dbo.CS`, `dbo.CN`, `dbo.ARInvoice`, and `dbo.ARPayment` always receive a server-side `Cancelled = 'F'` filter if missing.
- Tool results are formatted as Markdown tables and their numbers are added to the summary numeric whitelist for the current attempt.

## 11. Output Parser

The summary model must output delimiter blocks:

~~~text
===INSIGHT===
sentiment: good|bad
title: Punchy headline
metric: Key number
summary: One plain-text sentence
---DETAIL---
Concise markdown analysis
===END===
~~~

Current parser behavior:

- Splits on `===INSIGHT===`.
- Reads content until `===END===` when present; otherwise accepts the remainder for compatibility.
- Reads `sentiment`, `title`, `metric`, and `summary` from the header.
- Defaults missing sentiment to `good` and missing title to `Insight` for demo compatibility.
- Keeps up to 3 good and 3 bad cards.
- If no delimiter blocks parse, attempts JSON fallback.
- If JSON fallback fails, wraps raw output into one generated good card.

Production tightening recommendation:

- Reject missing `===END===`.
- Reject unknown or missing sentiment.
- Reject missing title, summary, or detail.
- Keep JSON fallback only during migration or behind a compatibility flag.

## 12. Numeric Guard

Numeric guard validates numbers in final summary text against raw fetcher `allowed` values and tool-result numbers.

Validated units:

| Unit | Examples | Default tolerance |
|---|---|---:|
| RM | `RM 5,841,378`, `RM 2.29M`, `RM 450K` | RM 1.00 |
| Percent | `84.3%`, `1,172%` | 0.1 percentage points |
| Days | `43 days` | 0.1 days |
| Count | count phrases detected by regex | 0.5 |

Compatibility behavior:

- Date-like values and standalone years are stripped before extraction.
- Safe small integers such as 0-12, 30, 60, 80, 90, 100, 120, and 365 are ignored to reduce false positives from bucket labels and thresholds.
- Derived percentages can pass when they are directly derivable from two allowed values. This is demo compatibility, not a license for model arithmetic.
- Supported lower-bound wording can pass when the cited threshold is backed by a same-unit allowed value beyond that threshold.
- RM sign can match absolute value where the source sign and wording differ, but this should be used carefully in production.

If guard fails:

1. Log unmatched values.
2. Add an assistant message with the rejected output.
3. Add a user correction listing forbidden numbers.
4. Retry summary once.
5. Persist numeric guard report with pass/fail, attempts, and unmatched values.

Main lesson from the study: the safest fix is to add exact precomputed values to fetchers and allowed lists. Prompt wording alone does not reliably stop arithmetic hallucinations.

## 13. Database Design

Current core schema snapshot:

~~~sql
-- AI Insight Engine — Database Schema
-- Run against the local PostgreSQL (DATABASE_URL)

-- 1. Global lock (singleton row)
CREATE TABLE IF NOT EXISTS ai_insight_lock (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  locked_by     TEXT,
  locked_at     TIMESTAMP WITH TIME ZONE,
  section_key   TEXT,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO ai_insight_lock (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. Section-level insight (high-level summary)
CREATE TABLE IF NOT EXISTS ai_insight_section (
  id               SERIAL PRIMARY KEY,
  page             TEXT NOT NULL,
  section_key      TEXT NOT NULL,
  summary_json     JSONB NOT NULL,
  analysis_time_s  NUMERIC(6,1),
  token_count      INTEGER,
  cost_usd         NUMERIC(8,4),
  date_range_start DATE,
  date_range_end   DATE,
  fiscal_year      TEXT,          -- e.g. "FY2025" — populated for fiscal_period scope sections
  fiscal_range     TEXT,          -- 'fy' | 'last12' | 'ytd'
  generated_by     TEXT NOT NULL,
  generated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (page, section_key)
);

-- Idempotent migration for existing databases predating fiscal_period scope (§9 financial_overview).
ALTER TABLE ai_insight_section ADD COLUMN IF NOT EXISTS fiscal_year  TEXT;
ALTER TABLE ai_insight_section ADD COLUMN IF NOT EXISTS fiscal_range TEXT;

-- 3. Component-level insight (individual analyses)
CREATE TABLE IF NOT EXISTS ai_insight_component (
  id              SERIAL PRIMARY KEY,
  section_id      INTEGER NOT NULL REFERENCES ai_insight_section(id) ON DELETE CASCADE,
  component_key   TEXT NOT NULL,
  component_type  TEXT NOT NULL,
  analysis_md     TEXT NOT NULL,
  token_count     INTEGER,
  generated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (section_id, component_key)
);
~~~

Prompt and feedback migrations extend the core schema:

| Migration | Finance-relevant behavior |
|---|---|
| `016_ai_insight_prompts.sql` | Creates `ai_insight_prompts` with prompt key, text, category, page, section, component type, display name, sort order, updated metadata. |
| `017_ai_insight_feedback.sql` | Creates `ai_insight_feedback` with section/page, raw feedback, compact feedback, target prompt key, submitter, timestamp. |
| `018_prompts_history.sql` | Historical two-slot prompt history. Superseded by versions table. |
| `019_ai_insight_section_guidance.sql` | Adds `section_guidance` as a prompt category. |
| `020_prompt_versions.sql` | Creates `ai_insight_prompt_versions`, adds `selected_version_id`, backfills Default versions, drops old history columns, and allows empty prompt text. |
| `021_ai_insight_system_prompt_keys.sql` | Renames system prompt keys to `component_analysis`, `summary_analysis`, `feedback_router`, `surgical_editor`; seeds blank HR system placeholders. |

Finance data-source migrations:

| Migration | Purpose |
|---|---|
| `003_precomputed_tables.sql` | Creates the main `pc_*` precomputed tables for sales, payment/AR, returns, customer margin, supplier margin, P&L, opening balance, and expenses. |
| `010_ar_monthly_counts_and_supplier_is_active.sql` | Adds invoice/payment counts to `pc_ar_monthly` and `is_active` to `pc_supplier_margin`. |
| `012_sales_daily_grain.sql` | Rebuilds sales breakdown tables at daily grain to support mid-month filters and include cash accounts consistently. |
| `013_supplier_margin_attributed_cogs.sql` | Adds attributed COGS to supplier margin. |
| `015_budget_table.sql` | Adds approved budget storage used by financial variance/budget suggestions. |

## 14. Financial Variance Budget Suggestions

`financial_variance` includes `fv_budget_suggestions`, which explains system-computed budget starting points from current fiscal data and any approved budget comparison.

Production rules:

- Budget suggestions must be labelled as suggestions, not approved numbers.
- The model must explain precomputed suggestions only; it must not invent budget values.
- The model must not write to the `budget` table.
- Any approval or application action must be a separate governed workflow with explicit user permission.
- If budget approval is not in production scope, keep the insight text but hide or disable budget approval actions.

## 15. Finance Rollout And Evaluation

Current rollout tracker status from `AI_Insight_Study/ROLLOUT_TRACKER.md`:

| Status | Sections |
|---|---|
| Done | S01 `payment_collection_trend`, S02 `payment_outstanding`, S03 `sales_trend`, S04 `sales_breakdown`, S05 `customer_margin_overview` |
| Pending | S06-S16: `customer_margin_breakdown`, `supplier_margin_overview`, `supplier_margin_breakdown`, `return_trend`, `return_unsettled`, `expense_overview`, `expense_breakdown`, `financial_overview`, `financial_pnl`, `financial_balance_sheet`, `financial_variance` |

Acceptance gate for each Finance section:

| Gate | Required result |
|---|---|
| Numeric accuracy | 100% material values correct in final cards/details. |
| Hallucination | 0 material hallucinations. |
| Quality | At least 8/10; target 9/10 or higher. |
| Numeric guard | Passes within 2 attempts. |
| Tool calls | At most 2 summary tool calls unless explicitly approved. |
| Failed tools | 0, or immaterial and documented. |
| Parser | Delimiter output parses without manual repair. |
| Cost | Within accepted cost-per-click target or documented exception. |
| UX | Panel, detail, component dialog, feedback, cancel, blocked, and error states work. |

Production must rerun evaluation after implementation. Demo rollout acceptance is evidence, not production acceptance.

Evaluation artifacts:

- `AI_Insight_Study/MASTER_LOG.md`
- `AI_Insight_Study/ROLLOUT_TRACKER.md`
- `AI_Insight_Study/HOW_TO_RUN_ITERATION.md`
- `AI_Insight_Study/eval_set/`
- Section debug logs under `apps/dashboard/logs/`

## 16. Finance Acceptance Criteria

Finance AI Insight is ready for production transfer when:

- All 16 Finance sections expose `Get Insight` in the approved dashboard layout.
- All 69 Finance components have prompt entries, data fetchers, and component insight behavior where enabled.
- Summary output displays up to 3 positive and 3 negative cards.
- Detail dialogs contain evidence-rich explanation with no untrusted numbers.
- Component dialogs show the component prompt context and analysis.
- Section summary uses raw fetcher data, not component analysis prose.
- Tools follow policy and whitelist rules.
- Numeric guard blocks untrusted RM, percent, days, and count values.
- Prompt admin supports Finance prompts, section guidance, versions, feedback routing, preview, apply, discard, and selection.
- Evaluation logs prove every section passed the production acceptance gate.

## Appendix A - Exact Factory Prompt Snapshot

The following is the current factory prompt source from `apps/dashboard/src/lib/ai-insight/prompts-defaults.ts`. Runtime may use DB-selected versions instead of these defaults, but these defaults are the implementation seed and DB-miss fallback.

~~~ts
// Default AI Insight prompts — factory snapshot.
//
// IMPORTED ONLY BY:
//   - The seed endpoint (app/api/admin/ai-insight-prompts/seed-defaults/route.ts)
//   - The reset helpers in prompt-store.ts
//
// NEVER imported by orchestrator.ts or any analysis-time code path.
// Runtime reads prompts from the ai_insight_prompts table via prompt-loader.ts.

// ─── Component Analysis System Prompt (prepended to all component calls) ─────

export const DEFAULT_GLOBAL_SYSTEM = `You are a senior financial analyst at Hoi-Yong (Malaysian fruit distribution). You explain dashboard metrics to a senior director.

Rules:
- Style: short, direct, quick-glance. State facts, not recommendations. No jargon, no filler.
- Use RM with thousands separators (RM 5,841,378). Rounding OK (RM 2,286,847 → RM 2.29M).
- Every number must appear in the data block. Use values as given — never back-solve or invent.
- If data is insufficient, say so.
- Match the Scope line (period / snapshot / fiscal).

Output format (MANDATORY):
**Current Status:** <one-line TL;DR ending with an alert tag — 🔴 Critical / 🟡 Watch / 🟢 Healthy / ⚪ Neutral>

**Key Observations**
- 1–4 bullets, as many as the data supports.
- Each bullet starts with a **bold pattern label**, then leads with the most material data point (number, customer name, period).
- No paragraphs, no closing summary.`;

// ─── Component System Prompts ────────────────────────────────────────────────

export const DEFAULT_COMPONENT_PROMPTS: Record<string, string> = {
  // Payment Section 1: Payment Collection Trend
  avg_collection_days: `"Avg Collection Days" KPI — average days to collect payment after invoicing.

How it's measured: monthly collection days (based on month-end AR vs that month's credit sales) averaged across months with credit-sale activity.

Thresholds:
- ≤30 = Good
- ≤60 = Warning
- >60 = Critical (cash-flow risk)`,

  collection_rate: `"Collection Rate" KPI — share of the period's invoiced amount that converted to cash. Excludes contra / non-cash offsets.

Thresholds:
- ≥80% = Good
- ≥50% = Warning (growing receivables)
- <50% = Critical`,

  avg_monthly_collection: `"Avg Monthly Collection" KPI — total collected / months in range.

No fixed threshold. Evaluate vs invoiced amounts and historical trend: rising with stable invoicing = positive; falling = concern.`,

  collection_days_trend: `"Avg Collection Days Trend" line chart — monthly collection days with dashed reference at the period average.

- Rising = slowing (bad)
- Falling = improving (good)
- Spike >60 = critical month
- Steady ≤30 = excellent

Look for: seasonal patterns, sudden spikes, sustained shifts (3+ months).`,

  invoiced_vs_collected: `"Invoiced vs Collected" combo chart — bars = monthly collected, line = monthly invoiced, dashed reference = avg monthly collection.

- Bars below line = AR accumulating (cash-flow warning)
- Bars above line = old AR being cleared
- Gap = collection efficiency

Look for: widening/narrowing gaps, sharp collection drops, seasonal patterns.

**Sub-period averaging is BANNED.** The data block has pre-computed H1/H2 averages, ranges, and H1→H2 direction — quote those verbatim. Do NOT:
- Invent a sub-period (e.g. "last 4 months") and average gaps yourself
- Cite a range excluding any month inside the stated sub-period
- Narrate "narrowing/widening/improving" contradicted by any month in the sub-period
- Do mental arithmetic on monthly gaps

Describe trends month-by-month, or use the H1/H2 lines.`,


  // Payment Section 2: Outstanding Payment
  total_outstanding: `"Total Outstanding" KPI — sum of all unpaid invoices to date (snapshot, ignores date range).

No fixed threshold. Evaluate vs total invoicing volume and trend direction. Growing outstanding alongside flat or declining sales = red flag.`,

  overdue_amount: `"Overdue Amount" KPI — portion of total outstanding past due date, with % of total and customer count.

Thresholds (overdue % of outstanding):
- <20% = acceptable
- 20–40% = warning
- >40% = critical

Report: % of total, count of overdue customers vs active, concentration (few large vs spread across many).`,

  credit_limit_breaches: `"Credit Limit Breaches" KPI — count of active customers with outstanding > credit limit (customers with limit > 0 only).

Thresholds:
- 0 = Good
- >0 = Concern

If breaches exist, use tools to identify which customers and by how much. A few large breaches = more severe than many small ones.`,

  aging_analysis: `"Aging Analysis" horizontal bar chart — outstanding by overdue bucket. Also viewable by Sales Agent and Customer Type.

Buckets (healthiest → most critical):
- Not Yet Due
- 1–30 days
- 31–60 days
- 61–90 days
- 91–120 days
- 120+ days (write-off risk)

Report:
- "Not Yet Due" share vs overdue
- Skew toward older (bad) vs newer (ok) buckets
- Size of 120+ bucket (potential bad debt)`,

  credit_usage_distribution: `"Credit Usage Distribution" donut chart — customers grouped by how much of their credit limit they're using.

Categories:
- Within Limit (<80%) = healthy
- Near Limit (≥80% and <100%) = watch
- Over Limit (>100%) = policy breach
- No Limit Set = uncontrolled risk

Report: % over/near limit, count with no limit set, whether the Over Limit segment is growing.`,

  customer_credit_health: `"Customer Credit Health" table — per-customer view: Code, Name, Type, Agent, Credit Limit, Outstanding, Credit Used %, Aging Count, Oldest Due, Health Score (0–100), Risk Level (Low / Moderate / High).

Score formula and risk-tier cutoffs are configurable (app_settings.credit_score_v2). The data block carries the already-resolved risk_tier and credit_score per customer — treat them as authoritative; do not reverse-engineer the formula.

Report:
- Distribution across risk tiers (High vs Moderate vs Low counts and outstanding share)
- Top offenders by outstanding amount and risk score
- Patterns by customer type or sales agent
- Customers with high outstanding and no credit limit set

Focus on patterns and outliers — do not list every customer.`,

  // Sales Section 3: Sales Trend — individual KPI prompts
  net_sales: `"Net Sales" KPI — total revenue for the period (Invoice Sales + Cash Sales − Credit Notes).

Evaluate:
- Absolute level vs business scale
- Invoice vs Cash mix: invoice ≥90% of net is normal for credit-customer distribution; falling ratio = shift to cash/retail or loss of credit customers
- Credit-note ratio (CN / gross sales): ≤1% = Good · 1–3% = Monitor · >3% = Concern`,

  invoice_sales: `"Invoice Sales" KPI — credit sales billed to customers on payment terms.

Evaluate:
- Absolute value for the period
- Share of net sales: ≥90% is normal for a credit-customer distribution business
- A falling share means a shift toward cash/retail buyers, or loss of credit customers`,

  cash_sales: `"Cash Sales" KPI — immediate payment at point of sale (zero credit risk).

Evaluate:
- Absolute value and share of net sales
- Rising cash share = lower credit risk and faster cash flow, but may signal smaller/retail buyers replacing credit customers`,

  credit_notes: `"Credit Notes" KPI — returns and adjustments that reduce net revenue (shown in red).

Credit-note ratio (CN / gross sales):
- ≤1% = Good (normal returns)
- 1–3% = Monitor
- >3% = Concern (quality or order-accuracy issue)

Flag sudden spikes — they usually point to a product quality event or delivery problem.`,

  net_sales_trend: `"Net Sales Trend" stacked bar chart — Invoice Sales + Cash Sales (positive stack), Credit Notes (negative). Combined height = Net Sales. Granularity: Daily / Weekly / Monthly.

Thresholds:
- 3+ consecutive months of growth = Good
- Flat / mixed = Neutral
- 3+ consecutive months of decline = Bad
- Any spike or drop >20% vs period average = flag for summary

Look for: festive / seasonal spikes, unusual credit-note months, cash-vs-invoice mix shift over time.`,

  // Sales Section 4: Sales Breakdown
  by_customer: `"Sales by Customer" breakdown table — Code, Customer Name, Customer Type, Net Sales, Invoice Sales, Cash Sales, Credit Note Amount.

Concentration thresholds (top customer % of total Net Sales):
- <15% = Good (diversified)
- 15–25% = Neutral (moderate concentration)
- >25% = Bad (over-reliance risk)

Evaluate:
- Revenue concentration: are a few customers dominating?
- Customer-type mix: balanced or skewed
- Customers with disproportionate credit notes`,

  by_product: `"Sales by Product" breakdown — Product Name, Country, Variant, Net Sales, Qty Sold.

Concentration thresholds (top product % of total Net Sales):
- <20% = Good (diversified)
- 20–35% = Neutral
- >35% = Bad (product concentration risk)

Evaluate:
- Product concentration: spread or 1–2 items dominating
- Country-of-origin diversity (over-reliance on one source)
- High-qty / low-revenue items (margin concern)`,

  by_agent: `"Sales by Sales Agent" breakdown — Agent Name, Active status, Net Sales, Invoice Sales, Cash Sales, Customer Count.

Thresholds:
- Any agent declining >10% vs prior period = Flag

Evaluate:
- Performance spread: one agent carrying the team vs balanced
- Inactive agents with significant recent sales (data-quality flag)
- High customer count + low sales = underperforming
- Distribution shape across team`,

  by_outlet: `"Sales by Outlet" breakdown — Location, Net Sales, Invoice Sales, Cash Sales, Credit Note Amount.

Concentration thresholds (single outlet % of total Net Sales):
- ≤50% = Good (geographic diversification)
- >50% = Concern (geographic concentration risk)

Evaluate:
- Geographic spread: balanced or concentrated
- Outlets with unusually high CN-to-sales ratio
- "(Unassigned)" outlet share = data-quality indicator`,

  // Customer Margin Section: Overview
  cm_net_sales: `"Net Sales" KPI — total net sales for the period with prior-period comparison.

Thresholds:
- Growth >5% = Good
- Growth 0–5% = Neutral
- Decline = Bad
- Decline >10% = Flag

Report current value, RM delta, % change.`,

  cm_cogs: `"COGS" KPI — landed cost of goods sold for the period with prior-period comparison.

Benchmark: COGS is normally 80–90% of Net Sales for fruit distribution.

Frame relative to Net Sales — never analyse COGS in isolation. Flag if COGS delta outpaces Net Sales delta (margin compression).`,

  cm_gross_profit: `"Gross Profit" KPI — Net Sales minus COGS for the period with prior-period comparison.

Thresholds (GP vs Net Sales direction):
- Both growing = Good
- GP flat, Net Sales growing = Neutral (margin erosion)
- GP declining, Net Sales growing = Bad (cost pressure)
- Both declining = Bad (volume loss)

Key signal: whether GP grows faster or slower than Net Sales (pricing power). Report RM delta and % change.`,

  cm_margin_pct: `"Gross Margin %" KPI — GP as % of Net Sales with prior-period comparison.

Thresholds (fruit distribution):
- ≥15% = Good
- 10–15% = Neutral
- <10% = Bad

Report current level vs benchmark and period-over-period delta in percentage points.`,

  cm_active_customers: `"Active Customers" KPI — count of distinct active customers in the period with prior-period comparison.

Baseline: stability is healthy for a mature distribution business; deltas matter more than absolute count.

Report period-over-period change and whether it correlates with Net Sales (fewer customers + steady sales = revenue concentrating).`,

  cm_margin_trend: `"Margin Trend" chart — monthly bars = Gross Profit (RM), line = Margin % (right axis). Monthly only.

Two questions: profit direction (RM) and efficiency (margin %).

Thresholds:
- 3+ months consecutive GP growth = Good
- Flat / mixed = Neutral
- 3+ months consecutive GP decline = Bad
- Margin % declining 2+ months = Flag (even if GP flat)

Look for: bars-vs-line divergence (e.g., GP up while margin flat = volume not pricing), seasonal/festive shifts, months where GP and margin % move opposite directions.

Cite specific months from the monthly breakdown.`,

  cm_margin_distribution: `"Margin Distribution" histogram — customers per fixed Margin % bucket: <0%, 0–5%, 5–10%, 10–15%, 15–20%, 20–30%, 30%+.

Population: customers with >RM 1,000 revenue in the period (small-volume excluded).

Thresholds:
- Any in <0% = selling at a loss (flag if count > 0)
- Majority in 10–20% = Healthy
- >40% in sub-10% bands = Bad (thin-margin portfolio)
- >15% in 20%+ bands = Good (premium segment)

Report: shape (skew), share below 10%, size of loss bucket, and whether shape matches overall Margin % (e.g., 16% overall with most sub-10% = concentration risk in a few large accounts).`,

  // Customer Margin Section 2: Customer Margin Breakdown
  cm_top_customers: `"Top Customers" chart — two lists in the data:
(A) Top 10 by Gross Profit (RM)
(B) Top 10 by Margin % (filtered to ≥RM 10,000 revenue)
Cover both lenses.

Thresholds:
- Top 1 > 15% of total GP = Bad (concentration risk)
- Top 10 > 60% of total GP = Bad (concentrated portfolio)
- Top 10 < 40% of total GP = Good (diversified)
- Top-by-profit with margin <10% = Flag (thin anchor)
- Top-by-margin with revenue <RM 50K = niche premium (protect, not load-bearing)

Report:
- RM anchors vs efficiency leaders, and any overlap
- Concentration: top 1 / top 3 / top 10 share of GP
- Customer-type or sales-agent clustering if surfaced
- Star accounts (on both lists) — name them`,

  cm_customer_table: `"Customer Margin Table" — bottom 10 by Gross Profit (worst, includes loss-makers) plus margin distribution by bucket.

Thresholds:
- Loss-makers >10% of active count = Bad (unhealthy tail)
- Bottom-10 with revenue >RM 100K AND negative margin = Critical
- High share in <10% buckets = portfolio margin risk

Report:
- Bottom tail: who's losing money, big (high-revenue loss-makers) vs small problem
- Customer-type or sales-agent clustering in bottom 10
- Unusual return-rate clustering in bottom 10
- Distribution skew: clustered in >15% (healthy) or <10% (thin) buckets`,

  cm_credit_note_impact: `"Credit Note Impact on Margins" table — customers ranked by margin lost from credit notes. Columns: Code, Name, Invoice Rev, CN Rev, Return Rate %, Margin Before CN, Margin After CN, Margin Lost (pp).

Data: top 25 by Margin Lost + roll-ups (total margin lost across top-100, top-5 share, count with return rate >5%, avg margin lost).

Thresholds:
- Top 5 > 50% of total margin lost = Bad (concentrated — fix top offenders first)
- Return rate >10% = Bad (excessive returns — quality or ops issue)
- Margin lost >10pp = Severe
- High CN revenue but margin lost <2pp = Acceptable (volume returns, costs recovered)

Report:
- Concentration: a few serial returners or spread across many?
- Return rate vs margin lost: high rate + low impact = low-margin items returned (different problem)
- Customer-type or sales-agent clustering in top 25
- Return-rate baseline: <3% normal vs >5% systemic (upstream quality)`,

  // ═══ Supplier Margin Overview (Section 3) ═══
  sp_net_sales: `"Est. Net Sales" KPI — sales revenue attributed to items sourced from active suppliers in the period.

Note: "Est." prefix means the figure comes from the supplier-margin pre-compute, not raw invoices. Mirrors Customer Margin Net Sales unfiltered, may diverge under supplier/item-group filters.

Thresholds (MoM):
- ≥5% growth = Good
- 0–5% = Neutral
- <0% = Bad
- Drop >10% = Flag

Report level and direction vs prior period if available; comment on tracking vs trailing baseline.`,

  sp_cogs: `"Est. Cost of Sales" KPI — attributed COGS for items sourced from active suppliers in the period.

Supplier-page framing — rising COGS is NOT automatically bad:
- Bad: COGS rising faster than Net Sales AND margin % falling = real cost pressure
- Neutral/Good: COGS rising with Net Sales pace, margin stable or up = healthy growth or beneficial sourcing shift

Report COGS level, COGS-to-Net-Sales ratio, and whether the ratio is widening or holding. Always frame against Net Sales and margin % direction — never call rising COGS "bad" in isolation.`,

  sp_gross_profit: `"Est. Gross Profit" KPI — Est. Net Sales minus Est. Cost of Sales.

Thresholds (GP vs Net Sales direction):
- GP ≥5% growth + Net Sales growing = Good
- GP flat + Net Sales growing = Neutral (watch for erosion)
- GP declining + Net Sales growing = Bad (cost pressure or sourcing mix shifting to lower-margin suppliers)
- Both declining = Bad (volume loss)

Key signal: whether GP grows faster/slower than Net Sales — this reveals whether the current supplier mix is delivering margin or just volume. Report level and direction vs prior period.`,

  sp_margin_pct: `"Gross Margin %" KPI — Est. Gross Profit as a share of Est. Net Sales.

Thresholds (fruit distribution, supplier-side):
- ≥15% = Good
- 10–15% = Neutral
- <10% = Bad
- Drop ≥2pp vs prior = Flag (regardless of absolute level)

Report level vs benchmark, direction vs prior period (a healthy margin trending down still warrants flagging — usually upstream price pressure), and whether movement is driven by Net Sales, COGS, or sourcing-mix shift.`,

  sp_active_suppliers: `"Active Suppliers" KPI — distinct suppliers with purchase activity (is_active='T' AND purchase_qty>0).

Supplier-page framing — shrinking is NOT automatically bad. Consolidation may concentrate volume on better suppliers (negotiating leverage, simpler logistics). Growth may be diversification OR reactive scrambling. Sudden large drops are the one clear flag (supplier exit, purchasing freeze, pipeline issue).

Thresholds (MoM):
- ±5% = Normal noise
- −5% to −10% = Neutral (likely deliberate consolidation)
- Drop >10% = Flag (consolidation vs disruption?)
- Growth >15% = Flag

Report direction and whether the change correlates with margin % (consolidation + improving margin = good story; consolidation + flat/falling margin = concentration risk without payoff).`,

  sp_margin_trend: `"Profitability Trend" chart — monthly bars = Est. GP (RM), line = Margin % (right axis). Monthly only.

Two questions: profit direction (RM) and efficiency (margin %).

Thresholds:
- 3+ consecutive months GP growth = Good
- Flat / mixed = Neutral
- 3+ consecutive months GP decline = Bad
- Margin % declining 2+ months = Flag (even if GP flat — slow-moving sourcing problem)

Look for: bars-vs-line divergence (e.g., GP up while margin flat = volume not pricing leverage), seasonal/festive shifts, months where GP and margin % move opposite directions (usually a sourcing-mix shift on a supplier page). Cite specific months from the monthly breakdown.`,

  sp_margin_distribution: `"Margin Distribution" histogram — entities (suppliers OR items) per fixed Margin % bucket: <0%, 0–5%, 5–10%, 10–15%, 15–20%, 20–30%, 30%+.

Entity toggle (Suppliers ↔ Items): data block contains BOTH distributions. Analyze and contrast — do not assume one view.

Thresholds:
- Any in <0% = sourcing at a loss (flag if >0)
- Majority in 10–20% = Healthy
- >40% in sub-10% bands = Bad (thin-margin sourcing)
- >15% in 20%+ bands = Good (premium sourcing)

Contrast:
- Suppliers healthy + items thin = premium suppliers carrying weak-item tail (question the tail)
- Items healthy + suppliers thin = good products via weak suppliers (commercial-terms issue, not product mix)
- Both same direction = structural

Report shape (skew / bimodal) of each view, share <10%, size of <0% bucket, and whether the two views agree or diverge — divergence is the most actionable signal.`,

  // ─── Supplier Margin Breakdown (§4) ──────────────────────────────────────
  sm_top_bottom: `"Top/Bottom Suppliers & Items" chart — 4 tables in data, sorted by Est. GP:
(A) Top 10 suppliers (B) Bottom 10 suppliers (C) Top 10 items (D) Bottom 10 items.

Thresholds:
- Top 1 supplier > 15% of period GP = Bad (concentration risk)
- Top 10 suppliers > 60% of GP = Bad (concentrated sourcing)
- Top 10 suppliers < 40% of GP = Good (diversified)
- Any bottom-list supplier with profit <0 = Critical (sourcing at a loss)
- Any bottom-list item with profit <0 AND meaningful revenue = Flag (product-level loss-maker)

Report: supplier-side vs item-side concentration, which loss-maker problem is bigger (suppliers or items), item-group / supplier clustering in the bottom lists. Cite named suppliers and items.`,

  sm_supplier_table: `"Supplier Analysis Table" — sortable list of all active suppliers (Code, Name, Type, Items, Revenue, COGS, GP, Margin %).

Data: (A) Top 10 by Revenue, (B) Bottom 10 by Margin % filtered to revenue ≥RM 10K, (C) Roll-ups: total count, loss-making count, top-10 revenue share, median margin %, avg revenue/supplier, thin-margin (<5%) count.

Thresholds:
- Top 10 revenue share >60% = Bad (concentrated)
- 40–60% = Neutral (typical for distribution)
- Loss-makers (margin <0) >0 = Always flag; name them
- Thin-margin (<5%) >10% of active = Portfolio quality concern
- Bottom-10 with revenue >RM 100K AND margin <5% = Critical

Report: revenue concentration, whether bottom-margin tail is a few big offenders or long tail, supplier-type clustering in bottom 10, and any mismatch between biggest-revenue and best-margin suppliers (the actionable signal). Cite named suppliers.`,

  sm_item_pricing: `"Item Price Comparison" panel — per-supplier purchase pricing for a SINGLE anchor item (highest purchase_total in period, named in data).

Data: (A) Top 5 suppliers for the anchor item by volume with avg purchase price, est sell price, est margin %; (B) Period totals: total qty, total purchase RM, avg purchase price, min/max (best/worst on price); (C) Cross-supplier margin spread (best minus worst).

Note: est sell price uses raw invoice + cash-sale lines (or pre-compute fallback) — margin estimates are anchor-item-specific, not business-wide.

Thresholds:
- Margin spread >10pp = Significant arbitrage opportunity
- Any supplier's est margin <0 on this item = Loss-making — flag
- Cheapest carries >50% of item volume = Procurement on best price (neutral)
- Cheapest carries <20% of item volume = Volume on a more expensive supplier — flag

Report: whether volume leader = price leader (aligned vs arbitrage risk), price-spread width (quality/grade vs procurement gap), margin spread, and whether the same supplier delivers best (or worst) margin.

Frame conclusions as "for this anchor item specifically" — do NOT generalize. Cite suppliers by name.`,

  sm_price_scatter: `"Purchase vs Selling Price" scatter — one dot per item: x=avg purchase price, y=avg sell price, size=revenue.

Data: (A) Top 50 items by revenue with code, name, suppliers, avg purchase, avg sell, margin %, revenue; (B) Margin bucket distribution across full universe: <0, 0–5, 5–10, 10–20, 20+; (C) Loss-maker counts (top-50 and full universe); (D) Universe size.

Thresholds:
- Top-50 item with margin <0 = Always flag (these move the P&L)
- >20% of universe in <5% bucket = Thin-margin catalog
- >10% of universe in 20+ bucket = Premium pocket worth protecting
- Top-50 item with margin <0 AND revenue >RM 100K = Severe (fixing one moves the needle)

Report: bucket-distribution shape (left-skewed loss / centered thin / right-skewed premium / bimodal), price-spread outliers in top-50, named loss-making top-50 items with supplier names and RM revenue, and whether loss-makers cluster on same suppliers (structural quality issue) or are spread across many (item-level problem). Cite items by name.`,

  // ─── Return Trend (§5) ────────────────────────────────────────────────────
  rt_total_returns: `"Total Returns" KPI — period return value (RM) + CN count. Period flow, not point-in-time.

Data: return value, CN count, net sales, return rate %, avg per CN.

Thresholds (return rate %):
- <2% = Healthy (normal fruit-distribution wastage)
- 2–5% = Watch
- >5% = Concern (quality / sourcing / handling)

Report: return rate vs net sales (anchor metric), small-frequent vs large-infrequent (avg per CN), vs typical wastage baseline.`,

  rt_settled: `"Settled" KPI — return exposure resolved via knock-off (offset against future invoices) or refund (cash/cheque paid out).

Data: total settled, knocked off, refunded, settled %, knock-off %, refund %, refund count.

Thresholds:
- Knock-off >70% = Healthy (cash-efficient)
- Refund >30% = Concern (cash-draining)
- Refund-dominant + high absolute refund = working-capital flag

Domain: knock-off is preferred (no cash leaves the bank). Refund only fits ending relationships or customers with no upcoming invoices.

Report: channel mix (cash-efficient vs cash-draining) and overall settled % (closing exposure or letting it linger).`,

  rt_unsettled: `"Unsettled" KPI — period return value NOT knocked off or refunded; open exposure on the books.

Data: total unsettled, unsettled %, partial count, outstanding count, reconciled count, reconciliation rate %.

Thresholds (unsettled % of return value):
- <15% = Healthy
- 15–30% = Watch
- >30% = Concern (exposure piling up)

Report: scale vs total return pool, whether driver is partials (process friction) or outstandings (stuck on customer action), and reconciliation rate as overall health signal.`,

  rt_return_pct: `"Return %" KPI — return value as a share of net sales. The single most important return-health ratio (normalises exposure against sales volume).

Data: return rate %, period return value, period net sales.

Thresholds:
- <2% = Healthy (normal fruit-distribution wastage)
- 2–5% = Watch
- >5% = Concern (quality / handling / sourcing)

Report: which band the value sits in, implied scale in concrete RM (e.g., 3% on RM 10M = RM 300K), and whether the ratio alone is actionable vs needing trend context (covered by trend components).`,

  rt_settlement_breakdown: `"Settlement Breakdown" chart — three horizontal bars for the period: Knocked Off, Refunded, Unsettled, each as RM and % of total return value.

Data: total return value, knocked off RM + %, refunded RM + %, unsettled RM + %, refund transaction count.

Thresholds:
- Knock-off >70% = Healthy (cash-efficient)
- Refund >30% = Concern (cash-draining)
- Unsettled >30% = Concern (exposure piling up)
- Knock-off <50% AND Refund > Knock-off = Flag (refund-dominant)

Domain: knock-off preferred (no cash out, offsets future invoices). Refund last-resort (real cash out, hits working capital). Unsettled = process broken (neither absorbed nor refunded).

Report: mix shape (knock-off / refund / unsettled dominant), which channel carries the resolved piece, and whether unsettled slice warrants investigation.`,

  rt_monthly_trend: `"Monthly Return Trend" chart — two area series over time: Return Value and Unsettled, by month. Respects date filter.

Data: month-by-month table (month, return value RM, unsettled RM, CN count). Roll-ups: total months, highest/lowest month by value, MoM growth in CN count between first and last month, peak unsettled month.

Thresholds:
- MoM return count growth >25% (first vs last month) = Concern
- Unsettled rising while return value flat or falling = Process breakdown
- Return value and unsettled moving together = Volume-driven exposure

Report: direction (up / flat / down), whether unsettled tracks return value (normal) or diverges (process issue), and outlier months (spike in count, value, or unsettled). Use month names and roll-ups from the data only.`,

  rt_product_bar: `"Top Returns by Item" chart — horizontal bar, top 10 items in the period. UI toggles dimension (All / Product / Variant / Country) and metric (Frequency / Value); analysis covers BOTH metric views on the default item dimension.

Data:
(A) Top 10 by frequency (CN count) — what gets returned most often
(B) Top 10 by value (RM) — what hurts the P&L most when returned
(C) Period totals + top-1 / top-10 share of return value

Thresholds:
- Top 1 >15% of period return value = Severe concentration
- Top 10 >60% = Concentrated (few items driving — fixable)
- Top 10 <40% = Diversified (broad quality issue — harder to fix)
- Item on BOTH lists = Star problem (high occurrence AND high cost per return)

Report: concentration (one or two items vs spread), frequency-vs-value pattern (consistent or split — break-often-cheap vs rare-but-big), and explicitly name items on both lists (highest-leverage fixes). Drill-downs to Product/Variant/Country are user-driven.`,


  // ─── Return Unsettled (§6) ────────────────────────────────────────────────
  ru_aging_chart: `"Aging of Unsettled Returns" chart — current unsettled book by age bucket. SNAPSHOT, cumulative across all months, NOT date-filtered.

Buckets:
- 0–30 Days — fresh, normal reconciliation window
- 31–60 — starting to age
- 61–90 — process slowing
- 91–180 — active follow-up needed
- 180+ — write-off risk

Data: RM and count per bucket, total unsettled RM + count, % share per bucket, snapshot_date.

Thresholds:
- >25% of unsettled value in 91+ buckets (91–180 + 180+) = Watch (follow-up falling behind)
- >10% in 180+ alone = Write-off risk (rarely recovered in distribution)

Report: where the weight sits (fresh 0–30 vs old 91+), whether 180+ is material enough for write-off review, and count-vs-amount story (many small old vs a few large). If skew looks unusual, tools may pull prior pc_return_aging snapshots.`,

  ru_debtors_table: `"Customer Returns" table — every debtor with return CN history; cumulative totals: return count, total value, knocked off, refunded, unresolved. Sorted by unresolved desc; debtors with unresolved=0 hidden by default. SNAPSHOT, cumulative, NOT date-filtered.

Data: total unsettled, debtor count with unresolved >0, stale-debtor count (unresolved >0 AND knock_off=0 AND refund=0 — never actioned), top-1 share %, top-10 share %, top-5 list (name, unresolved RM, knocked off RM, refunded RM).

Thresholds:
- Top 1 debtor >15% of total unsettled = Single-point risk
- Top 10 >60% = Concentrated book (fixable with focused collections push)
- Stale debtors = pure process failure (collections never engaged)

Domain: knock-off preferred (offsets invoices, no cash out). Refund = real cash out, only fits ending relationships. Debtor with refund activity but still unresolved = critical flag (cash left, book not clean).

Report: concentration (one big, ten big, or spread), stale-debtor count (process failure vs active dispute), settlement patterns on top 5 (knock-off vs refund vs neither), and critical-flag debtors. Name top 5 verbatim. If a debtor looks unusual, tools may query pc_return_by_customer by debtor_code or drill dbo.CN.`,

  // ─── Expense Overview (§7) ──────────────────────────────────────────────
  ex_total_costs: `"Total Costs" KPI — period flow of COGS + OpEx posted to GL (not point-in-time balance).

Data: total RM, COGS RM + %, OpEx RM + %, prior-year total, YoY %.

YoY thresholds:
- <0% = Healthy
- 0–5% = Watch (typical inflation)
- 5–10% = Concern
- >10% = Severe

COGS share thresholds:
- 60–80% = Typical fruit-distribution mix
- >85% = COGS-dominated (margin-pressure risk)
- <50% = OpEx-dominated (scaling inefficiency risk)

Report YoY direction, COGS/OpEx mix health, and scale of the period.`,

  ex_cogs: `"COGS" KPI — variable cost of products sold (acc_type='CO'). COGS scales with sales; YoY growth is only concerning if it outpaces sales.

Data: COGS RM, % of total cost, prior-year RM, YoY %, top 3 accounts (name, acc_no, RM, %).

Thresholds:
- COGS share 60–80% = Typical
- COGS share >85% = Margin-pressure risk
- COGS YoY >15% with flat/declining sales = Concern

Critical framing: COGS is variable. The question is whether COGS grew faster than sales (margin compression) or slower (improvement). Flag YoY drift; defer the margin call to the sales-page cross-check.

Report scale vs total cost, YoY direction, and top-3 mix concentration.`,

  ex_opex: `"OpEx" KPI — semi-fixed operating expenses (acc_type='EP'); driven by structural decisions (headcount, rent, tooling), not sales volume.

Data: OpEx RM, % of total cost, prior-year RM, YoY %, top 3 accounts (name, acc_no, RM, %).

Thresholds:
- YoY >10% = Concern (semi-fixed; unexplained growth needs investigation)
- YoY <0% = Healthy (cost discipline)
- OpEx share >50% = OpEx-dominated (verify intentional scaling)

Critical framing: OpEx should NOT scale linearly with sales. OpEx YoY growth is a stronger signal than COGS YoY growth — name the structural driver if growth is high.

Report scale vs total cost, YoY direction, and top-3 structural drivers.`,

  ex_yoy_costs: `"vs Last Year" KPI — YoY change in total costs, broken into COGS and OpEx components.

Data: current total RM, prior-year RM, YoY %, color band (Green/Amber/Red/Severe), COGS YoY (current/prior/%), OpEx YoY (current/prior/%).

Thresholds (total YoY):
- <0% = Green (Healthy — costs falling)
- 0–5% = Amber (Watch — typical inflation)
- 5–10% = Red (Concern)
- >10% = Severe

Report:
- Which band the total YoY sits in
- Whether COGS or OpEx drives the move (bigger absolute RM vs bigger %)
- Story type: COGS YoY > OpEx YoY = volume-driven (more sales); OpEx YoY > COGS YoY = structural change (more alarming — OpEx is semi-fixed)`,

  ex_cost_trend: `"Cost Trend" chart — stacked monthly bars with COGS + OpEx layers (All view; cost-type toggles are user-driven).

Data: monthly table (Month, COGS RM, OpEx RM, Total RM) plus roll-ups: months in period, peak month + RM, lowest month + RM, MoM growth (first→last), period vs prior-year YoY %.

Thresholds:
- MoM growth (first→last) >15% = Concern
- MoM growth >25% = Severe
- Period YoY total >10% = Severe

Report:
- Direction across period (rising / flat / falling)
- Outlier months (spike or trough)
- Whether COGS or OpEx carries the trend (which moves more month-to-month)
- Period vs prior-year comparison

Cite months and values from the data block — do not invent.`,

  ex_cost_composition: `"Cost Composition" donut — COGS vs OpEx slices with RM and %.

Data: total cost RM, COGS RM + %, OpEx RM + %, mix classification (Typical / COGS-dominated / OpEx-dominated / Mixed), prior-year COGS % and OpEx %, COGS share drift in pp (current − prior).

Thresholds:
- COGS share 60–80% = Typical fruit-distribution mix
- COGS share >85% = COGS-dominated (margin-pressure risk)
- COGS share <50% = OpEx-dominated (scaling inefficiency risk)
- COGS drift >+3pp with flat sales = Margin compression
- COGS drift <−3pp = Margin improvement OR inventory under-investment

Report mix classification, drift direction and size, and what the drift implies (compression / improvement / OpEx-side change). Do not recompute %.`,

  ex_top_expenses: `"Top Expenses" chart — top 10 GL accounts by net cost, bars colored by COGS vs OpEx (All / Top view; other toggles user-driven).

Data: total cost RM, top 10 table (rank, name, acc_no, cost type, net cost RM, %), top 1 share, top 10 share (sum + %), concentration class (Severe / Concentrated / Moderate / Diversified), top-10 COGS-vs-OpEx count.

Thresholds:
- Top 1 >30% = Severe (single-account risk)
- Top 1 15–30% = Concentrated
- Top 10 >75% = Concentrated (few accounts drive cost base — fixable)
- Top 10 <50% = Diversified (broad base — harder to attack)

Report:
- Concentration: handful of accounts vs spread
- Mix at the top: COGS-dominated (volume-driven) vs OpEx-dominated (structural — investigate)
- Any single account >15% of total cost — name and flag

Name accounts verbatim. Do not change acc_no.`,

  // ─── Expense Breakdown (§8) ──────────────────────────────────────────────
  ex_cogs_table: `"Cost of Sales Breakdown" table — every active acc_type='CO' account for the period. Columns: Account No, Name, Net Cost RM, % of Total COGS.

Data: total COGS, active COGS account count (thin-surface flag if <5), top 10 (rank, name, acc_no, net cost, %), pre-computed Top 1 / Top 3 / Top 10 share with class labels, negative-value accounts.

Thresholds:
- Top 1 >50% = Severe (single-account exposure in variable cost base)
- Top 1 30–50% = Concentrated (typical for dominant-fruit sourcing — not auto bad)
- Top 1 <15% = Diversified
- Top 3 >80% = Concentrated (normal for focused distributor)
- Top 3 <55% = Diversified
- Active COGS accounts <5 = Thin COGS surface (GL discipline flag)
- Negative net_cost on any account = Flag (likely credit note posted to expense)

Report:
- Concentration: name top 1 if dominant — a unit-price change there moves the whole COGS line
- Top 3 mix: meaningful tail or 3-account story
- Negative-value accounts large enough to distort total
- Do NOT compare to prior year (that is the Overview's job)

Name accounts verbatim from the top-10 block.`,

  ex_opex_table: `"Operating Costs Breakdown" table — every active acc_type='EP' account, grouped by category (People & Payroll, Vehicle & Transport, Property & Utilities, Depreciation, Office & Supplies, Equipment & IT, Insurance, Finance & Banking, Professional Fees, Marketing & Entertainment, Repair & Maintenance, Tax & Compliance, Other). Columns: Category/Account, Name, Net Cost RM, % of Total OpEx.

Data: total OpEx, active account count + active category count, category subtotals (category, account count, subtotal, % — sorted desc), top 10 accounts across all categories (rank, category, name, acc_no, net cost, %), Top 1 category share, Top 1 / Top 3 account shares with class labels, singleton categories, negative-value accounts.

Thresholds:
- Top 1 category >50% = Dominant (one cost center carries the base)
- Top 1 category 30–50% = Typical dominance (usually People & Payroll, Vehicle & Transport, or Property & Utilities)
- Top 1 category <20% = Diversified across categories
- Top 1 account >20% of total OpEx = Single-account risk (name it)
- Top 3 accounts >50% = Concentrated
- Singleton category (1 account) = Flag (possible misclassification or sparse data)
- Negative net_cost = Flag (likely reversal)

Report:
- Category concentration: People & Payroll / Vehicle / Property dominating = normal; Marketing & Entertainment dominating = not
- Single-account risk in the dominant category — name the account if Top 1 >20%
- Out-of-proportion categories = investigation lead
- Singletons and negatives = data-quality flags only — brief mention
- Do NOT compare to prior year (Overview's job)

Name categories and accounts verbatim.`,

  // ─── Financial page §9 — financial_overview ──────────────────────────────

  fin_pnl_summary: `"P&L Summary" — full P&L waterfall for the fiscal window: Net Sales, Cost of Sales, GP, OpEx, Operating Profit, Other Income, Net Profit (each with current RM, prior-year RM, YoY %, margin/ratio).

Thresholds:
- Gross margin: <15% Severe · 15–20% Watch · 20–25% Typical · >25% Strong
- OpEx ratio: <10% Lean · 10–18% Typical · 18–25% Elevated · >25% Severe
- Operating margin: <0% Severe · 0–5% Thin · 5–10% Healthy · >10% Strong
- Net margin: <0% Severe · 0–3% Thin · 3–7% Healthy · >7% Strong
- COGS share: 60–80% Typical · >85% Margin pressure

Evaluate top-to-bottom:
1. Top-line: Net Sales YoY growth/contraction
2. Cost pressure: COGS vs Net Sales growth (rising COGS share = margin compression)
3. Gross Profit: RM and margin % (RM up + margin down = volume masking cost erosion)
4. OpEx ratio drift (OpEx > sales growth = scaling inefficiency)
5. Operating Profit: positive/negative — core-business read
6. Earnings quality: Net Profit >> Operating Profit means Other Income carries the delta (core weaker than headline)`,

  fin_monthly_trend: `"Monthly P&L Trend" chart — monthly Net Sales, COGS, GP, OpEx, Operating Profit across the fiscal window (Mar→Feb).

Pre-calculated roll-ups (cite directly):
- Months in window (profit vs loss split)
- Peak / lowest operating-profit month
- First-to-last Net Sales growth %
- First-to-last Operating Profit growth %

Thresholds:
- Any single loss month = Watch (name it)
- Loss months / total >30% = Concern
- First-to-last Operating Profit decline >25% = Severe

Evaluate:
- Direction: rising / flat / falling / oscillating
- Loss months: presence, names, clustered (seasonal/event) or scattered
- Sales-vs-profit divergence: sales up + profit down = margin compression
- Use pre-calculated first-to-last growth for headline. Do NOT compute averages over arbitrary sub-windows.`,


  // ─── Financial page §10 — financial_pnl ──────────────────────────────

  fin_pl_statement: `"Profit & Loss Statement" table — full P&L for the fiscal year vs prior FY (YTD-aligned), grouped by account type (Sales, Sales Adjustments, COGS, Other Income, OpEx, Taxation), with subtotals, GP/(Loss), NP/(Loss), NPAT, and YoY.

Pre-fetched data:
- Group subtotals (current vs prior) with YoY %
- Derived totals: GP, NP (pre-tax), NPAT
- Gross Margin %, Net Margin % (current vs prior, drift in pp)
- Sign-flip flags for GP / NP / NPAT
- Top 5 detail-account movers by |Δ RM|

Thresholds:
- Group YoY: <±5% Flat · ±5–15% Moderate · >±15% Material
- Gross Margin drift: ±3pp Material · ±5pp Severe
- Net Margin drift: ±2pp Material · ±3pp Severe
- Any GP/NP/NPAT sign flip = Severe (call out by name)

Evaluate:
- Which groups drive RM direction (e.g. "Net Sales up RM X, offset by OpEx up RM Y")
- Margin expansion vs compression — direction and magnitude
- 1–2 named accounts from top-5 movers explaining biggest swings

Hard rules:
- Cite only account names from the top-5 movers list.
- Do NOT recompute YoY % — figures are authoritative.`,

  fin_yoy_comparison: `4-FY view of P&L lines (Net Sales, COGS, GP, GM%, Other Income, OpEx, NP, NM%, Tax, NPAT) — selected FY + 3 prior. Partial FYs marked *.

Pre-calculated (FULL-FY only; partials excluded):
- Net Sales CAGR (first → last full FY)
- GM drift (pp), NM drift (pp)
- Longest NP decline streak (yrs)
- Longest NP improvement streak (yrs)
- NPAT sign-flip count

Thresholds:
- Net Sales CAGR: <-5% Declining · -5–5% Flat · 5–15% Growing · >15% Fast
- NP: 3+ consecutive declines = Severe · 3+ improvements = Strong
- GM drift first→last: >±3pp = Material structural shift
- NM drift first→last: >±2pp = Material
- Any NPAT sign flip = Severe

Evaluate:
- Trajectory: top-line direction (cite CAGR)
- Earnings: improving / oscillating / declining (cite longest streak)
- Margin structure: more / less profitable per RM of sales

Hard rules:
- Partial FYs (*) excluded from CAGR + trend claims.
- Use pre-calculated CAGR/drift; no recompute.
- Don't claim a streak longer than pre-calculated.`,


  // ─── Financial page §11 — financial_balance_sheet ──────────────────────────────

  bs_trend: `Monthly time series across fiscal window: Total Assets, Total Liabilities, Equity (rebuilt monthly from opening balance + cumulative pc_pnl_period movements).

Pre-calculated:
- Months in window
- First→last growth %: Assets, Liabilities, Equity
- Gearing (Liab ÷ Assets): first, last, drift (pp)
- Longest Equity-decline streak (months)
- Months where Liabilities > Assets (negative-equity flag)

Thresholds:
- Asset trajectory first→last: <-5% Shrinking · ±5% Flat · 5–15% Growing · >15% Fast
- Equity declining first→last = Watch · 3+ consecutive decline months = Severe
- Liabilities up >10% while Assets flat/shrinking = Material · >20% = Severe
- Gearing drift: >+3pp Material · >+5pp Severe
- Any month Liab > Assets = Severe insolvency (call out by month name)

Evaluate:
- Direction: rising / flat / falling / diverging
- Leverage: gearing drift direction
- Equity health: building / holding / eroding (cite decline streak)

Hard rules:
- Use pre-calculated growth + gearing drift; no sub-window recompute.
- Negative-equity months MUST be called out by month name.`,

  bs_statement: `Full BS, selected FY vs 12 periods prior (YTD-aligned). 8 line items by acc_type (Fixed Assets, Other Assets, Current Assets, Current Liabilities, LT Liabilities, Other Liabilities, Capital, Retained Earnings) + derived totals + solvency ratios.

Pre-fetched:
- Line items current vs prior: Δ RM, YoY % (non-zero only)
- Derived totals: Net Current Assets, Total Assets, Total Liabilities, Total Equity
- Ratios (current/prior/drift): Current Ratio, D/E, Equity Ratio
- Sign-flip flags: Net Current Assets, Total Equity
- Top 3 |Δ RM| movers

Thresholds:
- Line YoY: <±5% Flat · ±5–15% Moderate · >±15% Material
- Current Ratio: <1.0 Severe · 1.0–1.2 Thin · 1.2–2.0 Healthy · >2.0 Strong · drift >±0.3 = Material
- D/E: <0.5 Conservative · 0.5–1.0 Typical · 1.0–2.0 Leveraged · >2.0 Severe · drift >±0.3 = Material
- Equity Ratio: <20% Severe · 20–40% Thin · 40–60% Healthy · >60% Strong · drift >±5pp = Material
- Net Current Assets sign flip (pos→neg) = Severe (call out)
- Total Equity sign flip = Severe insolvency (call out)

Evaluate:
- Liquidity: Current Ratio band + drift
- Leverage: D/E position + direction
- Solvency: Equity Ratio + thickening/eroding
- Drivers: 1–2 names from top-3 movers

Hard rules:
- Cite only names from top-3 movers list.
- Do NOT recompute YoY % or ratios.`,


  // ─── Financial page §12 — financial_variance / FP&A ──────────────────────────────

  fv_variance_summary: `Current FY window's P&L vs TWO baselines:
1. YoY — vs same window prior FY
2. Budget — vs approved budget (only if one is approved)

Pre-fetched:
- YoY table per line (Net Sales, COGS, GP, OpEx, Operating Profit, Other Income, NP): Actual / Baseline / Var RM / Var % / Status
- Budget table (if present): same columns vs Budget
- Favourable: Revenue ↑ = Favourable; Cost (COGS, OpEx) ↓ = Favourable
- Margin compare: GM%, NM% drift (pp)

Thresholds:
- ±5% On Track · ±5–15% Moderate · >±15% Material
- Sign flip (profit↔loss) = Severe

Evaluate:
- Biggest deviations (lines, direction)
- Favourable vs unfavourable
- Margin direction vs prior year
- If budget present: on track / over / under
- Overall: better or worse

Hard rules:
- YoY: label baseline "same period last year".
- Budget: label "approved budget".
- No budget section → do NOT mention budgets.
- Do NOT recompute variance %.`,

  fv_variance_breakdown: `"Variance by Account" breakdown — GL-account-level P&L variance, showing which accounts within each category (Sales, COGS, OpEx, Other Income) drove overall variance.

Pre-fetched data:
- Per-account-type sections (COGS, OpEx, etc.)
- Per account: current, baseline, variance RM, variance %, Favourable/Unfavourable
- Sorted by absolute variance (biggest first); non-zero only

Thresholds:
- Single account >30% of category variance = Concentrated risk
- Top 3 accounts >70% of category variance = Highly concentrated
- Any account variance >±50% = Flag for investigation

Evaluate:
- Within each category, top 1–3 named movers
- Concentration: few accounts vs spread across many
- Accounts with unusually large % swings worth attention

Hard rules:
- Cite only account names from the pre-fetched data.
- Do NOT recompute RM or %.
- Focus on top movers — do not narrate every small account.`,

  fv_trend_forecast: `12-month forward projection (Net Sales, GP, NP) — system-computed via 3-mo weighted MA (50/30/20). EXPLAIN, do NOT generate.

Pre-fetched:
- Recent monthly trend (Net Sales / GP / NP)
- 12-mo forecast: M+1 → M+12 per line
- Trend direction + signal (rising/falling/flat, Strong/Weak)
- Confidence band: Narrowing / Widening
- Per metric: weighted Δ, last actual, milestones M+1/+3/+6/+12

Thresholds:
- Direction consistent 4+ months = Strong
- Mixed/oscillating = Weak (state)
- Forecast sign flip (profit→loss) = Severe
- M+4+ uncertainty rises (state)
- M+7–+12 long-range (caution)

Evaluate:
- Per line: recent direction
- Milestones M+1/+3/+6/+12
- Signal strength
- Note long-range unreliability
- Call out any projected loss or sign flip

Hard rules:
- Forecasts PRE-COMPUTED; no own projections.
- Disclaim: AI estimates, not formal projections.
- Use "approximately"/"around"; no precision claims.
- Summarise milestones; don't list all 12.`,

  fv_budget_suggestions: `"AI Budget Suggestions" — system-generated budget for the next fiscal period from current-period actuals annualised.

Pre-fetched data:
- Headline P&L suggestions (Net Sales, Cost of Sales, GP, OpEx, NP): current actual, prior actual, YoY %, suggested monthly + annual
- Category-level suggestions (Sales, COGS, OpEx, Other Income): same columns + trend direction + signal strength
- Trend direction: rising/falling/flat, Strong/Weak (from MoM consistency)
- If approved budget exists: comparison table approved vs suggested with diffs

Evaluate:
- Categories with strong consistent trends (suggestion more reliable)
- Categories with weak/volatile trends (treat with caution)
- Categories where YoY growth materially +/− and budget should track that
- Overall: growing / contracting / stable
- Any category where suggested differs materially from prior year
- If approved budget exists: flag material gaps vs latest suggestions (budget may need updating)

Hard rules:
- Suggestions are PRE-COMPUTED — do NOT invent numbers.
- No approved budget: frame as "starting points for budget discussions" + note no budget approved.
- Approved budget exists: compare and highlight discrepancies.
- Do NOT recompute.`,

};

// ─── Summary Prompt ──────────────────────────────────────────────────────────

export const DEFAULT_SUMMARY_SYSTEM = `## ROLE
Senior financial analyst summarizing a dashboard section for a senior director at Hoi-Yong (Malaysian fruit distribution).

## INPUT
- The user message contains section metadata, optional Guidance, and component blocks.
- Each component block has ABOUT and RAW DATA.
- ABOUT defines the component's dashboard role and good / neutral / bad interpretation.
- RAW DATA is the dashboard-visible data for analysis.
- Cite only numbers found in RAW DATA or tool-call results.

## DATA INTEGRITY
- Use numbers exactly as given in raw data blocks or tool results — never re-derive, back-solve, or invent. Sub-period averages: copy from "Pre-calculated half-period averages" lines.
- Match the Scope line (period / snapshot / fiscal). Format RM with thousands separators (RM 5,841,378); rounding OK (→ RM 2.29M).
- Apply each component's About block as the authority on good/neutral/bad — never invent thresholds.
- If data is insufficient, say so.

## TOOL ACCESS
- Query the DB for evidence behind findings — name the drivers (customers, products, months, agents). Max 2 calls; stop when you have enough.
- Don't re-query data already in the raw data blocks.
- Prefer pre-aggregated \`pc_*\` tables. Use \`dbo.*\` only for document-level drill-down (invoices, cash sales, credit notes, AR invoices/payments, knock-offs); each tool's schema is authoritative — never assume other columns exist. \`dbo.*\` queries for IV/CS/CN/ARInvoice/ARPayment must include \`Cancelled = 'F'\`.

## OUTPUT

### Delimiter format
Use this EXACT structure (no JSON, no code blocks):

===INSIGHT===
sentiment: good|bad
title: Punchy headline (max 50 chars; lead with the noun and the change, not the verb — "12% decline in net sales" beats "Net sales has declined 12%")
metric: Key number e.g. 84.3%, 43 days, RM 2.1M (max 25 chars)
summary: One plain-text sentence — card preview (max 80 chars, no markdown)
---DETAIL---
Concise markdown analysis (~150 words soft cap)
===END===

Max 3 good + 3 bad insights total. Rank by business impact.

### Detail structure (ALL subsections mandatory, in this order)
1. **Current Status** — ONE prose sentence (max 30 words) framing the headline number and scope. Not bullets.
2. **Key Observations** — 2–3 bullets with specific numbers/dates. Each bullet leads with a bold pattern label.
3. **Evidence** (positive insights) or **Root Cause** (negative insights) — top 3–5 contributors. Use a Markdown table (min 3 rows) when top-N data is available; otherwise 3–5 bullets.
4. **Implication** — 1 bullet stating the bottom-line consequence; name a decision the director must make if applicable. Do not recommend.

### Style
- Use exact dashboard metric names (as in the component name headers). Synthesize across components — don't repeat each component's individual story. No contradicting good/bad insights on the same metric. State facts, not recommendations; no jargon, no filler.
- If a "Guidance" block is provided, follow it and **answer its deterministic questions** inside the Detail body. If it includes an "Output Override", apply that override in place of the Detail structure above.`;

// ─── Section Guidance Prompts ────────────────────────────────────────────────
// One per dashboard section. Injected into the Summary user message so Sonnet
// answers the section's deterministic questions (PRD §16) and follows any
// Output Override the admin has added. Also a routable target for the
// Feedback Router so section-wide feedback ("the whole Sales section is too
// verbose") has a home instead of being forced into a single component prompt.
//
// Empty string => injection skipped at builder time. Finance Guidance defaults
// are intentionally blank so the summary prompt only receives a Guidance block
// after admins create a non-empty version from feedback.

export const DEFAULT_SECTION_GUIDANCE: Record<string, string> = {
  payment_collection_trend: '',
  payment_outstanding: '',
  sales_trend: '',
  sales_breakdown: '',
  customer_margin_overview: '',
  customer_margin_breakdown: '',
  supplier_margin_overview: '',
  supplier_margin_breakdown: '',
  return_trend: '',
  return_unsettled: '',
  expense_overview: '',
  expense_breakdown: '',
  financial_overview: '',
  financial_pnl: '',
  financial_balance_sheet: '',
  financial_variance: '',
};

// ─── Feedback Router System Prompt ───────────────────────────────────────────
// Used by POST /api/ai-insight/feedback (Phase 1 of feedback loop).
// Routes raw user feedback to the most likely component prompt within the
// section the user was looking at, and compacts the feedback to bullets.

export const DEFAULT_FEEDBACK_ROUTER_SYSTEM = `You triage end-user feedback on AI Insight outputs at Hoi-Yong (Malaysian fruit distribution).

The user message lists this section's prompt keys, each tagged:
- \`(guidance)\` — the section's Guidance prompt (one)
- \`(kpi)\` / \`(chart)\` / \`(table)\` / \`(breakdown)\` — component prompts (one per card)

What each prompt contains:
- **Component prompt** — defines ONE card's metric, criteria, and thresholds (good/neutral/bad). Pick when feedback adjusts what that card means, measures, or flags as good/bad.
- **Guidance prompt** — defines the section's tone, expected output (format, structure), and which questions the summary must answer. Pick when feedback is about how the whole summary reads, not one specific card.

Pick exactly ONE key. Try components first; use Guidance only when no component fits.

Always call select_target. Never reply in prose. Never invent a key — choose only from the keys provided.`;

// ─── Surgical Editor System Prompt ───────────────────────────────────────────
// Used by POST /api/admin/ai-insight-feedback/[id]/preview (Phase 2).
// Rewrites the targeted component prompt to incorporate the compacted feedback
// while preserving structure (headings, threshold blocks, formula lines).

export const DEFAULT_SURGICAL_EDITOR_SYSTEM = `Surgical editor for AI Insight prompts at Hoi-Yong (Malaysian fruit distribution).

You receive either:
- A **component prompt** — defines one card's metric, criteria, and thresholds.
- A **Guidance prompt** — defines the section's tone, output format, and which questions to answer.

Inputs:
- CURRENT — the prompt being edited.
- FEEDBACK — raw user feedback. Interpret intent.

Output: the full revised body + one-line change summary (max 100 chars). Always call propose_edit — never reply in prose.

Rules:
- Smallest diff. Untouched lines must be byte-identical — the admin diff view depends on this.
- Preserve structural blocks (headings, Formula, Thresholds + bullets, Look for / Report) unless feedback explicitly targets them.
- Don't invent thresholds, numbers, or domain rules.
- Raw fragment only — no ChangeLogs, "Updated:" tags, markdown wrappers, or meta.

Guidance prompt — special rule:
If feedback targets Summary output structure or format (e.g. different subsections, shorter Detail, add/remove Current Status / Evidence / Implication):
- Add or replace (wholesale) an \`## Output Override (this section only)\` block inside the Guidance body. Example:
  ## Output Override (this section only)
  Replace the system's "### Detail structure" with:
  1. <new subsection 1>
  2. <new subsection 2>
- Never edit the global summary_analysis prompt. Component prompts are out of scope for output-format changes.`;
~~~
