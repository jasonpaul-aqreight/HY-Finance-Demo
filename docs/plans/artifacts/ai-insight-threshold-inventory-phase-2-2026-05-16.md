# AI Insight Threshold Inventory - Phase 2

Date: 2026-05-16
Scope: `prompts-defaults.ts`, `data-fetcher.ts`, `component-info.ts`, numeric-guard threshold literals.
Exclusions: `customer_credit_health` stays owned by `app_settings.credit_score_v2`; `fv_*` budget/variance tolerance stays owned by Budget Setting / saved budget tolerance.

## Registry-Backed Configurable Thresholds

These thresholds are now represented in `threshold-config.ts` and seeded by migration `025_ai_insight_thresholds.sql`. Phase 3 will replace literal prompt/data text with the matching tokens.

| Component | Tokens | Status |
|---|---|---|
| `avg_collection_days` | collection_days_band: good_days=30 days, warning_days=60 days | Registered |
| `collection_rate` | collection_rate_band: good_pct=80 pct, warning_pct=50 pct | Registered |
| `collection_days_trend` | collection_days_spike: critical_spike_days=60 days | Registered |
| `overdue_amount` | overdue_share_band: acceptable_pct=20 pct, critical_pct=40 pct | Registered |
| `credit_limit_breaches` | breach_count_band: good_count=0 count | Registered |
| `aging_analysis` | bad_debt_risk: old_120_share_pct=30 pct | Registered |
| `credit_usage_distribution` | credit_usage_band: within_limit_pct=80 pct, over_limit_pct=100 pct | Registered |
| `net_sales` | sales_mix: invoice_share_normal_pct=90 pct; credit_note_ratio: credit_note_good_pct=1 pct, credit_note_monitor_pct=3 pct | Registered |
| `invoice_sales` | invoice_share: normal_share_pct=90 pct | Registered |
| `credit_notes` | credit_note_ratio: good_pct=1 pct, monitor_pct=3 pct | Registered |
| `net_sales_trend` | trend_streak: consecutive_months=3 count; spike_or_drop: period_average_variance_pct=20 pct | Registered |
| `by_customer` | customer_concentration: good_pct=15 pct, neutral_pct=25 pct, peak_season_bad_pct=30 pct | Registered |
| `by_product` | product_concentration: good_pct=20 pct, neutral_pct=35 pct | Registered |
| `by_agent` | agent_decline: decline_flag_pct=10 pct | Registered |
| `by_outlet` | outlet_concentration: good_pct=50 pct | Registered |
| `cm_net_sales` | growth_band: good_growth_pct=5 pct, flag_decline_pct=10 pct | Registered |
| `cm_cogs` | cogs_share_benchmark: typical_min_pct=80 pct, typical_max_pct=90 pct | Registered |
| `cm_margin_pct` | gross_margin_band: good_pct=15 pct, neutral_pct=10 pct | Registered |
| `cm_margin_trend` | profit_streak: growth_months=3 count, profit_decline_months=3 count; margin_decline: margin_decline_months=2 count | Registered |
| `cm_margin_distribution` | portfolio_shape: sub_10_bad_pct=40 pct, premium_good_pct=15 pct | Registered |
| `cm_top_customers` | gp_concentration: top_1_bad_pct=15 pct, top_10_bad_pct=60 pct, top_10_good_pct=40 pct; margin_quality: thin_margin_pct=10 pct, top_margin_revenue_floor_rm=10000 RM, niche_premium_revenue_rm=50000 RM | Registered |
| `cm_customer_table` | at_risk_tail: loss_makers_bad_pct=10 pct, critical_revenue_rm=100000 RM, thin_bucket_pct=10 pct | Registered |
| `cm_credit_note_impact` | credit_note_concentration: top_5_margin_lost_bad_pct=50 pct; return_impact: return_rate_bad_pct=10 pct, margin_lost_severe_pp=10 pct, acceptable_margin_lost_pp=2 pct, normal_return_rate_pct=3 pct, systemic_return_rate_pct=5 pct | Registered |
| `sp_net_sales` | growth_band: good_growth_pct=5 pct, flag_drop_pct=10 pct | Registered |
| `sp_margin_pct` | gross_margin_band: good_pct=15 pct, neutral_pct=10 pct; margin_drop: investigate_drop_pp=2 pct | Registered |
| `sp_active_suppliers` | supplier_count_change: normal_change_pct=5 pct, drop_flag_pct=10 pct, growth_flag_pct=15 pct | Registered |
| `sp_margin_trend` | profit_streak: growth_months=3 count, profit_decline_months=3 count; margin_decline: margin_decline_months=2 count | Registered |
| `sp_margin_distribution` | portfolio_shape: sub_10_bad_pct=40 pct, premium_good_pct=15 pct | Registered |
| `sm_top_bottom` | supplier_concentration: top_1_bad_pct=15 pct, top_10_bad_pct=60 pct, top_10_good_pct=40 pct; loss_makers: loss_profit_rm=0 RM | Registered |
| `sm_supplier_table` | revenue_concentration: top_10_bad_pct=60 pct, top_10_neutral_pct=40 pct; portfolio_quality: loss_margin_pct=0 pct, thin_margin_pct=5 pct, thin_active_bad_pct=10 pct, critical_revenue_rm=100000 RM | Registered |
| `sm_item_pricing` | margin_spread: arbitrage_spread_pp=10 pct, loss_margin_pct=0 pct; procurement_alignment: best_price_volume_good_pct=50 pct, best_price_volume_flag_pct=20 pct | Registered |
| `sm_price_scatter` | catalog_quality: loss_margin_pct=0 pct, thin_universe_bad_pct=20 pct, premium_universe_good_pct=10 pct, severe_revenue_rm=100000 RM | Registered |
| `rt_total_returns` | return_rate_band: healthy_pct=2 pct, concern_pct=5 pct | Registered |
| `rt_settled` | settlement_mix: knock_off_healthy_pct=70 pct, refund_concern_pct=30 pct | Registered |
| `rt_unsettled` | unsettled_share: healthy_pct=15 pct, concern_pct=30 pct | Registered |
| `rt_return_pct` | return_rate_band: healthy_pct=2 pct, concern_pct=5 pct | Registered |
| `rt_settlement_breakdown` | settlement_mix: knock_off_healthy_pct=70 pct, refund_concern_pct=30 pct, unsettled_concern_pct=30 pct, knock_off_low_pct=50 pct | Registered |
| `rt_monthly_trend` | return_count_growth: mom_concern_pct=25 pct | Registered |
| `rt_product_bar` | return_concentration: top_1_severe_pct=15 pct, top_10_concentrated_pct=60 pct, top_10_diversified_pct=40 pct | Registered |
| `ru_aging_chart` | aging_risk: old_91_watch_pct=25 pct, old_180_writeoff_pct=10 pct | Registered |
| `ru_debtors_table` | debtor_concentration: top_1_risk_pct=15 pct, top_10_concentrated_pct=60 pct | Registered |
| `ex_total_costs` | cost_yoy_band: healthy_below_pct=0 pct, watch_pct=5 pct, concern_pct=10 pct; cost_mix: cogs_typical_min_pct=60 pct, cogs_typical_max_pct=80 pct, cogs_dominated_pct=85 pct, opex_dominated_pct=50 pct | Registered |
| `ex_cogs` | cogs_share: typical_min_pct=60 pct, typical_max_pct=80 pct, margin_pressure_pct=85 pct; cogs_yoy: concern_pct=15 pct | Registered |
| `ex_opex` | opex_yoy: concern_pct=10 pct, healthy_below_pct=0 pct; opex_share: opex_dominated_pct=50 pct | Registered |
| `ex_yoy_costs` | cost_yoy_band: healthy_below_pct=0 pct, watch_pct=5 pct, concern_pct=10 pct | Registered |
| `ex_cost_trend` | cost_growth: mom_concern_pct=15 pct, mom_severe_pct=25 pct, period_yoy_severe_pct=10 pct | Registered |
| `ex_cost_composition` | cogs_share: typical_min_pct=60 pct, typical_max_pct=80 pct, cogs_dominated_pct=85 pct, opex_dominated_pct=50 pct; cogs_drift: material_drift_pp=3 pct | Registered |
| `ex_top_expenses` | expense_concentration: top_1_severe_pct=30 pct, top_1_concentrated_pct=15 pct, top_10_concentrated_pct=75 pct, top_10_diversified_pct=50 pct | Registered |
| `ex_cogs_table` | cogs_concentration: top_1_severe_pct=50 pct, top_1_concentrated_pct=30 pct, top_1_diversified_pct=15 pct, top_3_concentrated_pct=80 pct, top_3_diversified_pct=55 pct; cogs_surface: thin_account_count=5 count | Registered |
| `ex_opex_table` | category_concentration: top_category_dominant_pct=50 pct, top_category_typical_pct=30 pct, top_category_diversified_pct=20 pct; account_concentration: top_1_account_risk_pct=20 pct, top_3_accounts_concentrated_pct=50 pct | Registered |
| `fin_pnl_summary` | gross_margin_band: gross_typical_below_pct=25 pct, gross_watch_below_pct=20 pct, gross_severe_below_pct=15 pct; opex_ratio_band: opex_lean_below_pct=10 pct, opex_typical_below_pct=18 pct, opex_elevated_below_pct=25 pct; operating_margin_band: operating_healthy_below_pct=10 pct, operating_thin_below_pct=5 pct, operating_severe_below_pct=0 pct; net_margin_band: net_healthy_below_pct=7 pct, net_thin_below_pct=3 pct, net_severe_below_pct=0 pct; cogs_share: typical_min_pct=60 pct, typical_max_pct=80 pct, margin_pressure_pct=85 pct | Registered |
| `fin_monthly_trend` | loss_months: concern_pct=30 pct; operating_profit_decline: severe_pct=25 pct | Registered |
| `fin_pl_statement` | group_yoy: flat_pct=5 pct, material_pct=15 pct; margin_drift: gross_material_pp=3 pct, gross_severe_pp=5 pct, net_material_pp=2 pct, net_severe_pp=3 pct | Registered |
| `fin_yoy_comparison` | net_sales_cagr: growing_upper_pct=15 pct, flat_upper_pct=5 pct, declining_below_pct=-5 pct; profit_direction: streak_years=3 count; margin_drift: gross_material_pp=3 pct, net_material_pp=2 pct | Registered |
| `bs_trend` | asset_trajectory: growing_upper_pct=15 pct, flat_upper_pct=5 pct, shrinking_below_pct=-5 pct; liability_divergence: material_pct=10 pct, severe_pct=20 pct; gearing_drift: material_pp=3 pct, severe_pp=5 pct; equity_decline: severe_months=3 count | Registered |
| `bs_statement` | line_yoy: flat_pct=5 pct, material_pct=15 pct; current_ratio: healthy_below_ratio=2 ratio, thin_below_ratio=1.2 ratio, severe_below_ratio=1 ratio; current_ratio_drift: current_ratio_drift_material_ratio=0.3 ratio; debt_to_equity: conservative_below_ratio=0.5 ratio, typical_below_ratio=1 ratio, leveraged_below_ratio=2 ratio; debt_to_equity_drift: debt_to_equity_drift_material_ratio=0.3 ratio; equity_ratio: healthy_below_pct=60 pct, thin_below_pct=40 pct, severe_below_pct=20 pct; equity_ratio_drift: drift_material_pp=5 pct | Registered |

## Read-Only Or Excluded Rules

- `customer_credit_health`: excluded because score weights and cutoffs are already owned by `app_settings.credit_score_v2`.
- `fv_variance_summary`, `fv_variance_breakdown`, `fv_trend_forecast`, `fv_budget_suggestions`: excluded because Budget Setting and saved budget tolerance own budget variance thresholds.
- Fixed structural bucket boundaries such as aging buckets, margin histogram buckets, and top-N list sizes remain read-only unless a later product decision turns those UI/data-shape constants into user configuration.
- Non-numeric or directional rules remain read-only: rising/falling trend semantics, sign flips, "no fixed threshold" rules, "call out by month/name" rules, and favourable/unfavourable polarity.
- Numeric guard `SAFE_INTEGERS` remains unchanged. Phase 3 must wire runtime `allowedThresholds(componentKey)` into data/component guard allowlists so live configured threshold values are allowed even when not in `SAFE_INTEGERS`.

## Phase 3 Tokenization Checklist

- Replace prompt literals in `prompts-defaults.ts` with registry tokens for all registered rows above.
- Replace emitted threshold/status strings in `data-fetcher.ts`, including inline strings outside `Thresholds:` blocks.
- Replace code-side classification literals where classification already exists today.
- Render component About/indicator text in `component-info.ts` from the same token values.
- Keep the exclusions above out of `ai_insight_thresholds`.
