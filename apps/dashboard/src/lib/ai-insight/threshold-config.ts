import { getPool } from '../postgres';
import type { AllowedValue, AllowedValueUnit } from './types';

export type ThresholdUnit = 'days' | 'pct' | 'RM' | 'count' | 'ratio';
export type ThresholdDirection = 'ascending' | 'descending';
export type ThresholdValueType = 'int' | `decimal(${number})`;

export interface ThresholdTokenDefinition {
  token: string;
  label: string;
  unit: ThresholdUnit;
  valueType: ThresholdValueType;
  defaultValue: number;
  min: number;
  max: number;
  allowPctAbove100?: boolean;
  description?: string;
}

export interface ThresholdGroupDefinition {
  id: string;
  label: string;
  direction: ThresholdDirection;
  tokens: ThresholdTokenDefinition[];
  description?: string;
  enforceMonotonic?: boolean;
}

export interface ThresholdComponentDefinition {
  componentKey: string;
  groups: ThresholdGroupDefinition[];
}

export interface ThresholdTokenView extends ThresholdTokenDefinition {
  value: number;
  formattedValue: string;
}

export interface ThresholdGroupView {
  id: string;
  label: string;
  direction: ThresholdDirection;
  description?: string;
  enforceMonotonic: boolean;
  tokens: ThresholdTokenView[];
}

export interface ThresholdBusinessSettingView {
  token: string;
  displayLabel: string;
  sentencePrefix: string;
  sentenceSuffix: string;
  helpText?: string;
  validationLabel?: string;
}

export interface ThresholdRangeSegmentView {
  text?: string;
  token?: string;
  offset?: number;
  editable?: boolean;
}

export interface ThresholdBusinessRangeView {
  label: string;
  segments: ThresholdRangeSegmentView[];
  unit: string;
}

export interface ThresholdValidationConstraintView {
  leftToken: string;
  relation: 'greaterThan' | 'lessThan';
  rightToken: string;
  message: string;
}

export interface ThresholdBusinessRuleView {
  id: string;
  title: string;
  description?: string;
  settings: ThresholdBusinessSettingView[];
  ranges?: ThresholdBusinessRangeView[];
  derivedBands?: string[];
  validationConstraints?: ThresholdValidationConstraintView[];
}

export interface ThresholdComponentPresentationView {
  title: string;
  description: string;
  appliesToPromptLabel: string;
  searchAliases?: string[];
  rules: ThresholdBusinessRuleView[];
}

export interface ThresholdValidationResult {
  ok: boolean;
  errors: string[];
  values: Record<string, number>;
}

type ThresholdSnapshot = {
  expiresAt: number;
  values: Map<string, number>;
};

const CACHE_MS = 30_000;
let snapshot: ThresholdSnapshot | null = null;
let inFlight: Promise<ThresholdSnapshot> | null = null;

function intToken(
  token: string,
  label: string,
  unit: ThresholdUnit,
  defaultValue: number,
  min: number,
  max: number,
  description?: string,
): ThresholdTokenDefinition {
  return { token, label, unit, valueType: 'int', defaultValue, min, max, description };
}

function decimalToken(
  token: string,
  label: string,
  unit: ThresholdUnit,
  precision: number,
  defaultValue: number,
  min: number,
  max: number,
  description?: string,
): ThresholdTokenDefinition {
  return {
    token,
    label,
    unit,
    valueType: `decimal(${precision})`,
    defaultValue,
    min,
    max,
    description,
  };
}

function group(
  id: string,
  label: string,
  direction: ThresholdDirection,
  tokens: ThresholdTokenDefinition[],
  description?: string,
  enforceMonotonic = true,
): ThresholdGroupDefinition {
  return { id, label, direction, tokens, description, enforceMonotonic };
}

function component(componentKey: string, groups: ThresholdGroupDefinition[]): ThresholdComponentDefinition {
  return { componentKey, groups };
}

export const THRESHOLD_REGISTRY: ThresholdComponentDefinition[] = [
  component('avg_collection_days', [
    group('collection_days_band', 'Collection days band', 'descending', [
      intToken('good_days', 'Good at or below', 'days', 30, 0, 365),
      intToken('warning_days', 'Warning at or below', 'days', 60, 1, 365),
    ]),
  ]),
  component('collection_rate', [
    group('collection_rate_band', 'Collection rate band', 'ascending', [
      intToken('good_pct', 'Good at or above', 'pct', 80, 0, 100),
      intToken('warning_pct', 'Warning at or above', 'pct', 50, 0, 100),
    ]),
  ]),
  component('collection_days_trend', [
    group('collection_days_spike', 'Collection-days spike', 'descending', [
      intToken('critical_spike_days', 'Critical spike above', 'days', 60, 1, 365),
    ]),
  ]),
  component('overdue_amount', [
    group('overdue_share_band', 'Overdue share of outstanding', 'descending', [
      intToken('acceptable_pct', 'Acceptable below', 'pct', 20, 0, 100),
      intToken('critical_pct', 'Critical above', 'pct', 40, 0, 100),
    ]),
  ]),
  component('credit_limit_breaches', [
    group('breach_count_band', 'Credit-limit breach count', 'descending', [
      intToken('good_count', 'Good at exactly', 'count', 0, 0, 10_000),
    ]),
  ]),
  component('aging_analysis', [
    group('bad_debt_risk', 'Bad-debt risk', 'descending', [
      intToken('old_120_share_pct', '120+ bucket risk above', 'pct', 30, 0, 100),
    ]),
  ]),
  component('credit_usage_distribution', [
    group('credit_usage_band', 'Credit usage band', 'descending', [
      intToken('within_limit_pct', 'Within limit below', 'pct', 80, 0, 100),
      intToken('over_limit_pct', 'Over limit above', 'pct', 100, 0, 200),
    ]),
  ]),

  component('net_sales', [
    group('sales_mix', 'Sales mix', 'ascending', [
      intToken('invoice_share_normal_pct', 'Invoice share normal at or above', 'pct', 90, 0, 100),
    ]),
    group('credit_note_ratio', 'Credit-note ratio', 'descending', [
      intToken('credit_note_good_pct', 'Good at or below', 'pct', 1, 0, 100),
      intToken('credit_note_monitor_pct', 'Monitor at or below', 'pct', 3, 0, 100),
    ]),
  ]),
  component('invoice_sales', [
    group('invoice_share', 'Invoice share', 'ascending', [
      intToken('normal_share_pct', 'Normal at or above', 'pct', 90, 0, 100),
    ]),
  ]),
  component('credit_notes', [
    group('credit_note_ratio', 'Credit-note ratio', 'descending', [
      intToken('good_pct', 'Good at or below', 'pct', 1, 0, 100),
      intToken('monitor_pct', 'Monitor at or below', 'pct', 3, 0, 100),
    ]),
  ]),
  component('net_sales_trend', [
    group('trend_streak', 'Trend streak', 'ascending', [
      intToken('consecutive_months', 'Consecutive months threshold', 'count', 3, 1, 24),
    ]),
    group('spike_or_drop', 'Spike or drop', 'descending', [
      intToken('period_average_variance_pct', 'Flag above period average variance', 'pct', 20, 0, 100),
    ]),
  ]),
  component('by_customer', [
    group('customer_concentration', 'Top customer share of net sales', 'descending', [
      intToken('good_pct', 'Good below', 'pct', 15, 0, 100),
      intToken('neutral_pct', 'Neutral at or below', 'pct', 25, 0, 100),
      intToken('peak_season_bad_pct', 'Peak-season bad above', 'pct', 30, 0, 100),
    ]),
  ]),
  component('by_product', [
    group('product_concentration', 'Top product share of net sales', 'descending', [
      intToken('good_pct', 'Good below', 'pct', 20, 0, 100),
      intToken('neutral_pct', 'Neutral at or below', 'pct', 35, 0, 100),
    ]),
  ]),
  component('by_agent', [
    group('agent_decline', 'Agent decline', 'descending', [
      intToken('decline_flag_pct', 'Flag decline above', 'pct', 10, 0, 100),
    ]),
  ]),
  component('by_outlet', [
    group('outlet_concentration', 'Outlet concentration', 'descending', [
      intToken('good_pct', 'Good at or below', 'pct', 50, 0, 100),
    ]),
  ]),

  component('cm_net_sales', [
    group('growth_band', 'Growth band', 'ascending', [
      intToken('good_growth_pct', 'Good growth above', 'pct', 5, 0, 100),
      intToken('flag_decline_pct', 'Flag decline above', 'pct', 10, 0, 100),
    ], undefined, false),
  ]),
  component('cm_cogs', [
    group('cogs_share_benchmark', 'COGS share benchmark', 'descending', [
      intToken('typical_min_pct', 'Typical minimum', 'pct', 80, 0, 100),
      intToken('typical_max_pct', 'Typical maximum', 'pct', 90, 0, 100),
    ]),
  ]),
  component('cm_margin_pct', [
    group('gross_margin_band', 'Gross margin band', 'ascending', [
      intToken('good_pct', 'Good at or above', 'pct', 15, 0, 100),
      intToken('neutral_pct', 'Neutral at or above', 'pct', 10, 0, 100),
    ]),
  ]),
  component('cm_margin_trend', [
    group('profit_streak', 'Profit streak', 'ascending', [
      intToken('growth_months', 'Good growth months', 'count', 3, 1, 24),
      intToken('profit_decline_months', 'Bad decline months', 'count', 3, 1, 24),
    ], undefined, false),
    group('margin_decline', 'Margin decline', 'descending', [
      intToken('margin_decline_months', 'Flag margin decline months', 'count', 2, 1, 24),
    ]),
  ]),
  component('cm_margin_distribution', [
    group('portfolio_shape', 'Portfolio shape', 'ascending', [
      intToken('sub_10_bad_pct', 'Bad if sub-10% share above', 'pct', 40, 0, 100),
      intToken('premium_good_pct', 'Good if 20%+ share above', 'pct', 15, 0, 100),
    ]),
  ]),
  component('cm_top_customers', [
    group('gp_concentration', 'Gross-profit concentration', 'descending', [
      intToken('top_1_bad_pct', 'Top 1 bad above', 'pct', 15, 0, 100),
      intToken('top_10_bad_pct', 'Top 10 bad above', 'pct', 60, 0, 100),
      intToken('top_10_good_pct', 'Top 10 good below', 'pct', 40, 0, 100),
    ], undefined, false),
    group('margin_quality', 'Margin quality', 'ascending', [
      intToken('thin_margin_pct', 'Thin anchor below', 'pct', 10, 0, 100),
      intToken('top_margin_revenue_floor_rm', 'Top-margin revenue floor', 'RM', 10_000, 0, 10_000_000),
      intToken('niche_premium_revenue_rm', 'Niche premium below', 'RM', 50_000, 0, 10_000_000),
    ], undefined, false),
  ]),
  component('cm_customer_table', [
    group('at_risk_tail', 'At-risk customer tail', 'descending', [
      intToken('loss_makers_bad_pct', 'Bad if loss-makers above active share', 'pct', 10, 0, 100),
      intToken('critical_revenue_rm', 'Critical revenue above', 'RM', 100_000, 0, 100_000_000),
      intToken('thin_bucket_pct', 'Thin-margin bucket below', 'pct', 10, 0, 100),
    ], undefined, false),
  ]),
  component('cm_credit_note_impact', [
    group('credit_note_concentration', 'Credit-note concentration', 'descending', [
      intToken('top_5_margin_lost_bad_pct', 'Top 5 bad above', 'pct', 50, 0, 100),
    ]),
    group('return_impact', 'Return impact', 'descending', [
      intToken('return_rate_bad_pct', 'Return rate bad above', 'pct', 10, 0, 100),
      intToken('margin_lost_severe_pp', 'Margin lost severe above', 'pct', 10, 0, 100),
      intToken('acceptable_margin_lost_pp', 'Acceptable margin lost below', 'pct', 2, 0, 100),
      intToken('normal_return_rate_pct', 'Normal return-rate baseline below', 'pct', 3, 0, 100),
      intToken('systemic_return_rate_pct', 'Systemic return-rate baseline above', 'pct', 5, 0, 100),
    ], undefined, false),
  ]),

  component('sp_net_sales', [
    group('growth_band', 'Growth band', 'ascending', [
      intToken('good_growth_pct', 'Good growth at or above', 'pct', 5, 0, 100),
      intToken('flag_drop_pct', 'Flag drop above', 'pct', 10, 0, 100),
    ], undefined, false),
  ]),
  component('sp_margin_pct', [
    group('gross_margin_band', 'Gross margin band', 'ascending', [
      intToken('good_pct', 'Good at or above', 'pct', 15, 0, 100),
      intToken('neutral_pct', 'Neutral at or above', 'pct', 10, 0, 100),
    ]),
    group('margin_drop', 'Margin drop', 'descending', [
      intToken('investigate_drop_pp', 'Investigate drop above', 'pct', 2, 0, 100),
    ]),
  ]),
  component('sp_active_suppliers', [
    group('supplier_count_change', 'Supplier count change', 'ascending', [
      intToken('normal_change_pct', 'Normal change within', 'pct', 5, 0, 100),
      intToken('drop_flag_pct', 'Drop flag above', 'pct', 10, 0, 100),
      intToken('growth_flag_pct', 'Growth flag above', 'pct', 15, 0, 100),
    ], undefined, false),
  ]),
  component('sp_margin_trend', [
    group('profit_streak', 'Profit streak', 'ascending', [
      intToken('growth_months', 'Good growth months', 'count', 3, 1, 24),
      intToken('profit_decline_months', 'Bad decline months', 'count', 3, 1, 24),
    ], undefined, false),
    group('margin_decline', 'Margin decline', 'descending', [
      intToken('margin_decline_months', 'Flag margin decline months', 'count', 2, 1, 24),
    ]),
  ]),
  component('sp_margin_distribution', [
    group('portfolio_shape', 'Portfolio shape', 'ascending', [
      intToken('sub_10_bad_pct', 'Bad if sub-10% share above', 'pct', 40, 0, 100),
      intToken('premium_good_pct', 'Good if 20%+ share above', 'pct', 15, 0, 100),
    ]),
  ]),
  component('sm_top_bottom', [
    group('supplier_concentration', 'Supplier concentration', 'descending', [
      intToken('top_1_bad_pct', 'Top 1 bad above', 'pct', 15, 0, 100),
      intToken('top_10_bad_pct', 'Top 10 bad above', 'pct', 60, 0, 100),
      intToken('top_10_good_pct', 'Top 10 good below', 'pct', 40, 0, 100),
    ], undefined, false),
    group('loss_makers', 'Loss makers', 'ascending', [
      intToken('loss_profit_rm', 'Loss-making below', 'RM', 0, -100_000_000, 100_000_000),
    ]),
  ]),
  component('sm_supplier_table', [
    group('revenue_concentration', 'Revenue concentration', 'descending', [
      intToken('top_10_bad_pct', 'Bad above', 'pct', 60, 0, 100),
      intToken('top_10_neutral_pct', 'Neutral lower bound', 'pct', 40, 0, 100),
    ], undefined, false),
    group('portfolio_quality', 'Portfolio quality', 'descending', [
      intToken('loss_margin_pct', 'Loss-making margin below', 'pct', 0, -100, 100),
      intToken('thin_margin_pct', 'Thin margin below', 'pct', 5, 0, 100),
      intToken('thin_active_bad_pct', 'Thin-margin active share above', 'pct', 10, 0, 100),
      intToken('critical_revenue_rm', 'Critical revenue above', 'RM', 100_000, 0, 100_000_000),
    ], undefined, false),
  ]),
  component('sm_item_pricing', [
    group('margin_spread', 'Margin spread', 'descending', [
      intToken('arbitrage_spread_pp', 'Arbitrage opportunity above', 'pct', 10, 0, 100),
      intToken('loss_margin_pct', 'Loss-making below', 'pct', 0, -100, 100),
    ], undefined, false),
    group('procurement_alignment', 'Procurement alignment', 'ascending', [
      intToken('best_price_volume_good_pct', 'Best-price volume good above', 'pct', 50, 0, 100),
      intToken('best_price_volume_flag_pct', 'Best-price volume flag below', 'pct', 20, 0, 100),
    ], undefined, false),
  ]),
  component('sm_price_scatter', [
    group('catalog_quality', 'Catalog quality', 'descending', [
      intToken('loss_margin_pct', 'Loss-making margin below', 'pct', 0, -100, 100),
      intToken('thin_universe_bad_pct', 'Thin-margin universe share above', 'pct', 20, 0, 100),
      intToken('premium_universe_good_pct', 'Premium universe share above', 'pct', 10, 0, 100),
      intToken('severe_revenue_rm', 'Severe revenue above', 'RM', 100_000, 0, 100_000_000),
    ], undefined, false),
  ]),

  component('rt_total_returns', [
    group('return_rate_band', 'Return-rate band', 'descending', [
      intToken('healthy_pct', 'Healthy below', 'pct', 2, 0, 100),
      intToken('concern_pct', 'Concern above', 'pct', 5, 0, 100),
    ]),
  ]),
  component('rt_settled', [
    group('settlement_mix', 'Settlement mix', 'ascending', [
      intToken('knock_off_healthy_pct', 'Knock-off healthy above', 'pct', 70, 0, 100),
      intToken('refund_concern_pct', 'Refund concern above', 'pct', 30, 0, 100),
    ], undefined, false),
  ]),
  component('rt_unsettled', [
    group('unsettled_share', 'Unsettled share', 'descending', [
      intToken('healthy_pct', 'Healthy below', 'pct', 15, 0, 100),
      intToken('concern_pct', 'Concern above', 'pct', 30, 0, 100),
    ]),
  ]),
  component('rt_return_pct', [
    group('return_rate_band', 'Return-rate band', 'descending', [
      intToken('healthy_pct', 'Healthy below', 'pct', 2, 0, 100),
      intToken('concern_pct', 'Concern above', 'pct', 5, 0, 100),
    ]),
  ]),
  component('rt_settlement_breakdown', [
    group('settlement_mix', 'Settlement mix', 'ascending', [
      intToken('knock_off_healthy_pct', 'Knock-off healthy above', 'pct', 70, 0, 100),
      intToken('refund_concern_pct', 'Refund concern above', 'pct', 30, 0, 100),
      intToken('unsettled_concern_pct', 'Unsettled concern above', 'pct', 30, 0, 100),
      intToken('knock_off_low_pct', 'Knock-off low below', 'pct', 50, 0, 100),
    ], undefined, false),
  ]),
  component('rt_monthly_trend', [
    group('return_count_growth', 'Return count growth', 'descending', [
      intToken('mom_concern_pct', 'MoM concern above', 'pct', 25, 0, 100),
    ]),
  ]),
  component('rt_product_bar', [
    group('return_concentration', 'Return concentration', 'descending', [
      intToken('top_1_severe_pct', 'Top 1 severe above', 'pct', 15, 0, 100),
      intToken('top_10_concentrated_pct', 'Top 10 concentrated above', 'pct', 60, 0, 100),
      intToken('top_10_diversified_pct', 'Top 10 diversified below', 'pct', 40, 0, 100),
    ], undefined, false),
  ]),
  component('ru_aging_chart', [
    group('aging_risk', 'Aging risk', 'descending', [
      intToken('old_91_watch_pct', '91+ watch above', 'pct', 25, 0, 100),
      intToken('old_180_writeoff_pct', '180+ write-off risk above', 'pct', 10, 0, 100),
    ], undefined, false),
  ]),
  component('ru_debtors_table', [
    group('debtor_concentration', 'Debtor concentration', 'descending', [
      intToken('top_1_risk_pct', 'Top 1 risk above', 'pct', 15, 0, 100),
      intToken('top_10_concentrated_pct', 'Top 10 concentrated above', 'pct', 60, 0, 100),
    ]),
  ]),

  component('ex_total_costs', [
    group('cost_yoy_band', 'Cost YoY band', 'descending', [
      intToken('healthy_below_pct', 'Healthy below', 'pct', 0, -100, 100),
      intToken('watch_pct', 'Watch at or below', 'pct', 5, 0, 100),
      intToken('concern_pct', 'Concern at or below', 'pct', 10, 0, 100),
    ]),
    group('cost_mix', 'Cost mix', 'descending', [
      intToken('cogs_typical_min_pct', 'COGS typical minimum', 'pct', 60, 0, 100),
      intToken('cogs_typical_max_pct', 'COGS typical maximum', 'pct', 80, 0, 100),
      intToken('cogs_dominated_pct', 'COGS dominated above', 'pct', 85, 0, 100),
      intToken('opex_dominated_pct', 'OpEx dominated when COGS below', 'pct', 50, 0, 100),
    ], undefined, false),
  ]),
  component('ex_cogs', [
    group('cogs_share', 'COGS share', 'descending', [
      intToken('typical_min_pct', 'Typical minimum', 'pct', 60, 0, 100),
      intToken('typical_max_pct', 'Typical maximum', 'pct', 80, 0, 100),
      intToken('margin_pressure_pct', 'Margin pressure above', 'pct', 85, 0, 100),
    ]),
    group('cogs_yoy', 'COGS YoY', 'descending', [
      intToken('concern_pct', 'Concern above with flat sales', 'pct', 15, 0, 100),
    ]),
  ]),
  component('ex_opex', [
    group('opex_yoy', 'OpEx YoY', 'descending', [
      intToken('concern_pct', 'Concern above', 'pct', 10, 0, 100),
      intToken('healthy_below_pct', 'Healthy below', 'pct', 0, -100, 100),
    ], undefined, false),
    group('opex_share', 'OpEx share', 'descending', [
      intToken('opex_dominated_pct', 'OpEx dominated above', 'pct', 50, 0, 100),
    ]),
  ]),
  component('ex_yoy_costs', [
    group('cost_yoy_band', 'Cost YoY band', 'descending', [
      intToken('healthy_below_pct', 'Healthy below', 'pct', 0, -100, 100),
      intToken('watch_pct', 'Watch at or below', 'pct', 5, 0, 100),
      intToken('concern_pct', 'Concern at or below', 'pct', 10, 0, 100),
    ]),
  ]),
  component('ex_cost_trend', [
    group('cost_growth', 'Cost growth', 'descending', [
      intToken('mom_concern_pct', 'MoM concern above', 'pct', 15, 0, 100),
      intToken('mom_severe_pct', 'MoM severe above', 'pct', 25, 0, 100),
      intToken('period_yoy_severe_pct', 'Period YoY severe above', 'pct', 10, 0, 100),
    ], undefined, false),
  ]),
  component('ex_cost_composition', [
    group('cogs_share', 'COGS share', 'descending', [
      intToken('typical_min_pct', 'Typical minimum', 'pct', 60, 0, 100),
      intToken('typical_max_pct', 'Typical maximum', 'pct', 80, 0, 100),
      intToken('cogs_dominated_pct', 'COGS dominated above', 'pct', 85, 0, 100),
      intToken('opex_dominated_pct', 'OpEx dominated when COGS below', 'pct', 50, 0, 100),
    ], undefined, false),
    group('cogs_drift', 'COGS drift', 'descending', [
      intToken('material_drift_pp', 'Material drift above', 'pct', 3, 0, 100),
    ]),
  ]),
  component('ex_top_expenses', [
    group('expense_concentration', 'Expense concentration', 'descending', [
      intToken('top_1_severe_pct', 'Top 1 severe above', 'pct', 30, 0, 100),
      intToken('top_1_concentrated_pct', 'Top 1 concentrated above', 'pct', 15, 0, 100),
      intToken('top_10_concentrated_pct', 'Top 10 concentrated above', 'pct', 75, 0, 100),
      intToken('top_10_diversified_pct', 'Top 10 diversified below', 'pct', 50, 0, 100),
    ], undefined, false),
  ]),
  component('ex_cogs_table', [
    group('cogs_concentration', 'COGS concentration', 'descending', [
      intToken('top_1_severe_pct', 'Top 1 severe above', 'pct', 50, 0, 100),
      intToken('top_1_concentrated_pct', 'Top 1 concentrated above', 'pct', 30, 0, 100),
      intToken('top_1_diversified_pct', 'Top 1 diversified below', 'pct', 15, 0, 100),
      intToken('top_3_concentrated_pct', 'Top 3 concentrated above', 'pct', 80, 0, 100),
      intToken('top_3_diversified_pct', 'Top 3 diversified below', 'pct', 55, 0, 100),
    ], undefined, false),
    group('cogs_surface', 'COGS surface', 'ascending', [
      intToken('thin_account_count', 'Thin surface below', 'count', 5, 0, 1000),
    ]),
  ]),
  component('ex_opex_table', [
    group('category_concentration', 'Category concentration', 'descending', [
      intToken('top_category_dominant_pct', 'Top category dominant above', 'pct', 50, 0, 100),
      intToken('top_category_typical_pct', 'Top category typical above', 'pct', 30, 0, 100),
      intToken('top_category_diversified_pct', 'Top category diversified below', 'pct', 20, 0, 100),
    ], undefined, false),
    group('account_concentration', 'Account concentration', 'descending', [
      intToken('top_1_account_risk_pct', 'Top 1 account risk above', 'pct', 20, 0, 100),
      intToken('top_3_accounts_concentrated_pct', 'Top 3 accounts concentrated above', 'pct', 50, 0, 100),
    ]),
  ]),

  component('fin_pnl_summary', [
    group('gross_margin_band', 'Gross margin band', 'ascending', [
      intToken('gross_typical_below_pct', 'Typical below', 'pct', 25, 0, 100),
      intToken('gross_watch_below_pct', 'Watch below', 'pct', 20, 0, 100),
      intToken('gross_severe_below_pct', 'Severe below', 'pct', 15, 0, 100),
    ]),
    group('opex_ratio_band', 'OpEx ratio band', 'descending', [
      intToken('opex_lean_below_pct', 'Lean below', 'pct', 10, 0, 100),
      intToken('opex_typical_below_pct', 'Typical below', 'pct', 18, 0, 100),
      intToken('opex_elevated_below_pct', 'Elevated below', 'pct', 25, 0, 100),
    ]),
    group('operating_margin_band', 'Operating margin band', 'ascending', [
      intToken('operating_healthy_below_pct', 'Healthy below', 'pct', 10, 0, 100),
      intToken('operating_thin_below_pct', 'Thin below', 'pct', 5, 0, 100),
      intToken('operating_severe_below_pct', 'Severe below', 'pct', 0, -100, 100),
    ]),
    group('net_margin_band', 'Net margin band', 'ascending', [
      intToken('net_healthy_below_pct', 'Healthy below', 'pct', 7, 0, 100),
      intToken('net_thin_below_pct', 'Thin below', 'pct', 3, 0, 100),
      intToken('net_severe_below_pct', 'Severe below', 'pct', 0, -100, 100),
    ]),
    group('cogs_share', 'COGS share', 'descending', [
      intToken('typical_min_pct', 'Typical minimum', 'pct', 60, 0, 100),
      intToken('typical_max_pct', 'Typical maximum', 'pct', 80, 0, 100),
      intToken('margin_pressure_pct', 'Margin pressure above', 'pct', 85, 0, 100),
    ]),
  ]),
  component('fin_monthly_trend', [
    group('loss_months', 'Loss months', 'descending', [
      intToken('concern_pct', 'Concern above window share', 'pct', 30, 0, 100),
    ]),
    group('operating_profit_decline', 'Operating-profit decline', 'descending', [
      intToken('severe_pct', 'Severe decline above', 'pct', 25, 0, 100),
    ]),
  ]),
  component('fin_pl_statement', [
    group('group_yoy', 'Group YoY', 'descending', [
      intToken('flat_pct', 'Flat within', 'pct', 5, 0, 100),
      intToken('material_pct', 'Material above', 'pct', 15, 0, 100),
    ]),
    group('margin_drift', 'Margin drift', 'descending', [
      intToken('gross_material_pp', 'Gross margin material above', 'pct', 3, 0, 100),
      intToken('gross_severe_pp', 'Gross margin severe above', 'pct', 5, 0, 100),
      intToken('net_material_pp', 'Net margin material above', 'pct', 2, 0, 100),
      intToken('net_severe_pp', 'Net margin severe above', 'pct', 3, 0, 100),
    ], undefined, false),
  ]),
  component('fin_yoy_comparison', [
    group('net_sales_cagr', 'Net Sales CAGR', 'ascending', [
      intToken('growing_upper_pct', 'Growing upper bound', 'pct', 15, -100, 100),
      intToken('flat_upper_pct', 'Flat upper bound', 'pct', 5, -100, 100),
      intToken('declining_below_pct', 'Declining below', 'pct', -5, -100, 100),
    ]),
    group('profit_direction', 'Profit direction', 'ascending', [
      intToken('streak_years', 'Consecutive years threshold', 'count', 3, 1, 20),
    ]),
    group('margin_drift', 'Margin drift', 'descending', [
      intToken('gross_material_pp', 'Gross margin material above', 'pct', 3, 0, 100),
      intToken('net_material_pp', 'Net margin material above', 'pct', 2, 0, 100),
    ], undefined, false),
  ]),
  component('bs_trend', [
    group('asset_trajectory', 'Asset trajectory', 'ascending', [
      intToken('growing_upper_pct', 'Growing upper bound', 'pct', 15, -100, 100),
      intToken('flat_upper_pct', 'Flat upper bound', 'pct', 5, -100, 100),
      intToken('shrinking_below_pct', 'Shrinking below', 'pct', -5, -100, 100),
    ]),
    group('liability_divergence', 'Liability divergence', 'descending', [
      intToken('material_pct', 'Material above', 'pct', 10, 0, 100),
      intToken('severe_pct', 'Severe above', 'pct', 20, 0, 100),
    ]),
    group('gearing_drift', 'Gearing drift', 'descending', [
      intToken('material_pp', 'Material above', 'pct', 3, 0, 100),
      intToken('severe_pp', 'Severe above', 'pct', 5, 0, 100),
    ]),
    group('equity_decline', 'Equity decline', 'descending', [
      intToken('severe_months', 'Severe consecutive months', 'count', 3, 1, 24),
    ]),
  ]),
  component('bs_statement', [
    group('line_yoy', 'Line-item YoY', 'descending', [
      intToken('flat_pct', 'Flat within', 'pct', 5, 0, 100),
      intToken('material_pct', 'Material above', 'pct', 15, 0, 100),
    ]),
    group('current_ratio', 'Current ratio', 'ascending', [
      decimalToken('healthy_below_ratio', 'Healthy below', 'ratio', 1, 2, 0, 10),
      decimalToken('thin_below_ratio', 'Thin below', 'ratio', 1, 1.2, 0, 10),
      decimalToken('severe_below_ratio', 'Severe below', 'ratio', 1, 1, 0, 10),
    ]),
    group('current_ratio_drift', 'Current ratio drift', 'descending', [
      decimalToken('current_ratio_drift_material_ratio', 'Material drift above', 'ratio', 1, 0.3, 0, 10),
    ]),
    group('debt_to_equity', 'Debt-to-equity', 'descending', [
      decimalToken('conservative_below_ratio', 'Conservative below', 'ratio', 1, 0.5, 0, 10),
      decimalToken('typical_below_ratio', 'Typical below', 'ratio', 1, 1, 0, 10),
      decimalToken('leveraged_below_ratio', 'Leveraged below', 'ratio', 1, 2, 0, 10),
    ]),
    group('debt_to_equity_drift', 'Debt-to-equity drift', 'descending', [
      decimalToken('debt_to_equity_drift_material_ratio', 'Material drift above', 'ratio', 1, 0.3, 0, 10),
    ]),
    group('equity_ratio', 'Equity ratio', 'ascending', [
      intToken('healthy_below_pct', 'Healthy below', 'pct', 60, 0, 100),
      intToken('thin_below_pct', 'Thin below', 'pct', 40, 0, 100),
      intToken('severe_below_pct', 'Severe below', 'pct', 20, 0, 100),
    ]),
    group('equity_ratio_drift', 'Equity ratio drift', 'descending', [
      intToken('drift_material_pp', 'Material drift above', 'pct', 5, 0, 100),
    ]),
  ]),
];

export const THRESHOLD_PRESENTATION: Record<string, ThresholdComponentPresentationView> = {
  avg_collection_days: {
    title: 'Average Payment Speed Rules',
    description: '',
    appliesToPromptLabel: 'Avg Collection Days',
    searchAliases: ['Average collection days'],
    rules: [
      {
        id: 'payment_speed',
        title: 'Average Payment Speed Rules',
        settings: [
          {
            token: 'good_days',
            displayLabel: 'Good',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'good limit',
          },
          {
            token: 'warning_days',
            displayLabel: 'Warning',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'warning limit',
          },
        ],
        ranges: [
          {
            label: 'Good',
            segments: [{ text: '0' }, { text: '-' }, { token: 'good_days', editable: true }],
            unit: 'days',
          },
          {
            label: 'Warning',
            segments: [{ token: 'good_days', offset: 1 }, { text: '-' }, { token: 'warning_days', editable: true }],
            unit: 'days',
          },
          {
            label: 'Critical',
            segments: [{ token: 'warning_days' }, { text: '> above' }],
            unit: 'days',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'good_days',
            relation: 'lessThan',
            rightToken: 'warning_days',
            message: 'The warning limit must be higher than the good limit.',
          },
        ],
      },
    ],
  },
  collection_rate: {
    title: 'Collection Rate: Cash Conversion Rules',
    description: '',
    appliesToPromptLabel: 'Collection Rate',
    searchAliases: ['Cash conversion', 'Payment collection rate'],
    rules: [
      {
        id: 'cash_conversion_rate',
        title: 'Cash Conversion Rate',
        settings: [
          {
            token: 'good_pct',
            displayLabel: 'Good',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'good collection rate',
          },
          {
            token: 'warning_pct',
            displayLabel: 'Warning',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'warning collection rate',
          },
        ],
        ranges: [
          {
            label: 'Critical',
            segments: [{ text: '0' }, { text: '-' }, { token: 'warning_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Warning',
            segments: [{ token: 'warning_pct' }, { text: '-' }, { token: 'good_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Good',
            segments: [{ text: 'Above' }, { token: 'good_pct' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'good_pct',
            relation: 'greaterThan',
            rightToken: 'warning_pct',
            message: 'The good collection rate must be higher than the warning collection rate.',
          },
        ],
      },
    ],
  },
  collection_days_trend: {
    title: 'Collection Trend: Delay Spike Rules',
    description: '',
    appliesToPromptLabel: 'Avg Collection Days Trend',
    searchAliases: ['Collection days spike', 'Payment delay spike'],
    rules: [
      {
        id: 'delay_spike',
        title: 'Critical Delay Spike',
        settings: [
          {
            token: 'critical_spike_days',
            displayLabel: 'Critical spike',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'critical spike limit',
          },
        ],
        ranges: [
          {
            label: 'Normal movement',
            segments: [{ text: '0' }, { text: '-' }, { token: 'critical_spike_days', editable: true }],
            unit: 'days',
          },
          {
            label: 'Critical spike',
            segments: [{ text: 'Above' }, { token: 'critical_spike_days' }],
            unit: 'days',
          },
        ],
      },
    ],
  },
  overdue_amount: {
    title: 'Overdue Amount: Outstanding Risk Rules',
    description: '',
    appliesToPromptLabel: 'Overdue Amount',
    searchAliases: ['Overdue share', 'Outstanding risk'],
    rules: [
      {
        id: 'overdue_share',
        title: 'Overdue Share of Outstanding',
        settings: [
          {
            token: 'acceptable_pct',
            displayLabel: 'Acceptable',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'acceptable overdue limit',
          },
          {
            token: 'critical_pct',
            displayLabel: 'Critical',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'critical overdue limit',
          },
        ],
        ranges: [
          {
            label: 'Acceptable',
            segments: [{ text: '0' }, { text: '-' }, { token: 'acceptable_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Warning',
            segments: [{ token: 'acceptable_pct' }, { text: '-' }, { token: 'critical_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Critical',
            segments: [{ text: 'Above' }, { token: 'critical_pct' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'acceptable_pct',
            relation: 'lessThan',
            rightToken: 'critical_pct',
            message: 'The critical overdue limit must be higher than the acceptable overdue limit.',
          },
        ],
      },
    ],
  },
  credit_limit_breaches: {
    title: 'Credit Limit Breaches: Policy Tolerance Rules',
    description: '',
    appliesToPromptLabel: 'Credit Limit Breaches',
    searchAliases: ['Credit policy breaches', 'Limit breach tolerance'],
    rules: [
      {
        id: 'breach_tolerance',
        title: 'Allowed Credit Limit Breaches',
        settings: [
          {
            token: 'good_count',
            displayLabel: 'Good',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'allowed breach count',
          },
        ],
        ranges: [
          {
            label: 'Good',
            segments: [{ text: '0' }, { text: '-' }, { token: 'good_count', editable: true }],
            unit: 'breaches',
          },
          {
            label: 'Concern',
            segments: [{ text: 'Above' }, { token: 'good_count' }],
            unit: 'breaches',
          },
        ],
      },
    ],
  },
  aging_analysis: {
    title: 'Aging Analysis: Bad-Debt Exposure Rules',
    description: '',
    appliesToPromptLabel: 'Aging Analysis',
    searchAliases: ['120+ bucket', 'Bad debt risk'],
    rules: [
      {
        id: 'old_bucket_share',
        title: '120+ Day Outstanding Share',
        settings: [
          {
            token: 'old_120_share_pct',
            displayLabel: 'Bad-debt risk',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'bad-debt risk limit',
          },
        ],
        ranges: [
          {
            label: 'Normal exposure',
            segments: [{ text: '0' }, { text: '-' }, { token: 'old_120_share_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Bad-debt risk',
            segments: [{ text: 'Above' }, { token: 'old_120_share_pct' }],
            unit: '%',
          },
        ],
      },
    ],
  },
  credit_usage_distribution: {
    title: 'Credit Usage: Limit Utilization Rules',
    description: '',
    appliesToPromptLabel: 'Credit Usage Distribution',
    searchAliases: ['Credit utilization', 'Near limit', 'Over limit'],
    rules: [
      {
        id: 'limit_utilization',
        title: 'Credit Limit Utilization',
        settings: [
          {
            token: 'within_limit_pct',
            displayLabel: 'Healthy',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'healthy utilization limit',
          },
          {
            token: 'over_limit_pct',
            displayLabel: 'Policy breach',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'policy breach limit',
          },
        ],
        ranges: [
          {
            label: 'Healthy',
            segments: [{ text: '0' }, { text: '-' }, { token: 'within_limit_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Watch',
            segments: [{ token: 'within_limit_pct' }, { text: '-' }, { token: 'over_limit_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Policy breach',
            segments: [{ text: 'Above' }, { token: 'over_limit_pct' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'within_limit_pct',
            relation: 'lessThan',
            rightToken: 'over_limit_pct',
            message: 'The policy breach limit must be higher than the healthy utilization limit.',
          },
        ],
      },
    ],
  },
  net_sales: {
    title: 'Net Sales: Revenue Mix and Return-Impact Rules',
    description: '',
    appliesToPromptLabel: 'Net Sales',
    searchAliases: ['Revenue mix', 'Credit-note impact', 'Sales KPI'],
    rules: [
      {
        id: 'invoice_sales_mix',
        title: 'Invoice Sales Mix',
        settings: [
          {
            token: 'invoice_share_normal_pct',
            displayLabel: 'Normal invoice share',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'normal invoice share',
          },
        ],
        ranges: [
          {
            label: 'Shift to cash or retail',
            segments: [{ text: '0' }, { text: '-' }, { token: 'invoice_share_normal_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Normal credit-customer mix',
            segments: [{ text: 'At least' }, { token: 'invoice_share_normal_pct' }],
            unit: '%',
          },
        ],
      },
      {
        id: 'credit_note_impact',
        title: 'Credit Note Impact',
        settings: [
          {
            token: 'credit_note_good_pct',
            displayLabel: 'Good',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'good credit-note limit',
          },
          {
            token: 'credit_note_monitor_pct',
            displayLabel: 'Monitor',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'monitor credit-note limit',
          },
        ],
        ranges: [
          {
            label: 'Good',
            segments: [{ text: '0' }, { text: '-' }, { token: 'credit_note_good_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Monitor',
            segments: [
              { token: 'credit_note_good_pct', offset: 1 },
              { text: '-' },
              { token: 'credit_note_monitor_pct', editable: true },
            ],
            unit: '%',
          },
          {
            label: 'Concern',
            segments: [{ text: 'Above' }, { token: 'credit_note_monitor_pct' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'credit_note_good_pct',
            relation: 'lessThan',
            rightToken: 'credit_note_monitor_pct',
            message: 'The monitor limit must be higher than the good credit-note limit.',
          },
        ],
      },
    ],
  },
  invoice_sales: {
    title: 'Invoice Sales: Credit-Customer Mix Rules',
    description: '',
    appliesToPromptLabel: 'Invoice Sales',
    searchAliases: ['Credit sales mix', 'Credit-customer share', 'Sales KPI'],
    rules: [
      {
        id: 'invoice_share',
        title: 'Invoice Sales Share',
        settings: [
          {
            token: 'normal_share_pct',
            displayLabel: 'Normal',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'normal invoice-sales share',
          },
        ],
        ranges: [
          {
            label: 'Cash or retail shift',
            segments: [{ text: '0' }, { text: '-' }, { token: 'normal_share_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Normal credit-customer mix',
            segments: [{ text: 'At least' }, { token: 'normal_share_pct' }],
            unit: '%',
          },
        ],
      },
    ],
  },
  credit_notes: {
    title: 'Credit Notes: Return and Adjustment Rules',
    description: '',
    appliesToPromptLabel: 'Credit Notes',
    searchAliases: ['Credit-note ratio', 'Return adjustments', 'Sales KPI'],
    rules: [
      {
        id: 'credit_note_ratio',
        title: 'Credit Note Ratio',
        settings: [
          {
            token: 'good_pct',
            displayLabel: 'Good',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'good credit-note limit',
          },
          {
            token: 'monitor_pct',
            displayLabel: 'Monitor',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'monitor credit-note limit',
          },
        ],
        ranges: [
          {
            label: 'Good',
            segments: [{ text: '0' }, { text: '-' }, { token: 'good_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Monitor',
            segments: [{ token: 'good_pct', offset: 1 }, { text: '-' }, { token: 'monitor_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Concern',
            segments: [{ text: 'Above' }, { token: 'monitor_pct' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'good_pct',
            relation: 'lessThan',
            rightToken: 'monitor_pct',
            message: 'The monitor limit must be higher than the good credit-note limit.',
          },
        ],
      },
    ],
  },
  net_sales_trend: {
    title: 'Net Sales Trend: Growth Streak and Movement Rules',
    description: '',
    appliesToPromptLabel: 'Net Sales Trend',
    searchAliases: ['Sales growth streak', 'Sales spike or drop', 'Sales KPI'],
    rules: [
      {
        id: 'trend_streak',
        title: 'Growth or Decline Streak',
        settings: [
          {
            token: 'consecutive_months',
            displayLabel: 'Consecutive months',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'consecutive-month limit',
          },
        ],
        ranges: [
          {
            label: 'Good growth signal',
            segments: [{ token: 'consecutive_months', editable: true }, { text: 'or more' }],
            unit: 'months',
          },
          {
            label: 'Bad decline signal',
            segments: [{ token: 'consecutive_months' }, { text: 'or more' }],
            unit: 'months',
          },
        ],
      },
      {
        id: 'spike_or_drop',
        title: 'Unusual Sales Movement',
        settings: [
          {
            token: 'period_average_variance_pct',
            displayLabel: 'Flag',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'sales movement flag',
          },
        ],
        ranges: [
          {
            label: 'Normal movement',
            segments: [{ text: '0' }, { text: '-' }, { token: 'period_average_variance_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Flag for summary',
            segments: [{ text: 'Above' }, { token: 'period_average_variance_pct' }],
            unit: '%',
          },
        ],
      },
    ],
  },
  by_customer: {
    title: 'Sales by Customer: Revenue Concentration Rules',
    description: '',
    appliesToPromptLabel: 'By Customer',
    searchAliases: ['Customer concentration', 'Top customer share', 'Peak-season tolerance', 'Sales breakdown'],
    rules: [
      {
        id: 'customer_concentration',
        title: 'Top Customer Share',
        settings: [
          {
            token: 'good_pct',
            displayLabel: 'Diversified',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'diversified customer-share limit',
          },
          {
            token: 'neutral_pct',
            displayLabel: 'Moderate',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'moderate customer-share limit',
          },
          {
            token: 'peak_season_bad_pct',
            displayLabel: 'Peak-season risk',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'peak-season customer-share limit',
          },
        ],
        ranges: [
          {
            label: 'Diversified customer base',
            segments: [{ text: '0' }, { text: '-' }, { token: 'good_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Moderate concentration',
            segments: [{ token: 'good_pct' }, { text: '-' }, { token: 'neutral_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Normal-period over-reliance',
            segments: [{ text: 'Above' }, { token: 'neutral_pct' }],
            unit: '%',
          },
          {
            label: 'Peak-season high-risk trigger',
            segments: [{ text: 'Above' }, { token: 'peak_season_bad_pct', editable: true }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'good_pct',
            relation: 'lessThan',
            rightToken: 'neutral_pct',
            message: 'The moderate customer-share limit must be higher than the diversified limit.',
          },
          {
            leftToken: 'neutral_pct',
            relation: 'lessThan',
            rightToken: 'peak_season_bad_pct',
            message: 'The peak-season risk limit must be higher than the normal-period over-reliance limit.',
          },
        ],
      },
    ],
  },
  by_product: {
    title: 'Sales by Product: Product Concentration Rules',
    description: '',
    appliesToPromptLabel: 'By Product',
    searchAliases: ['Product concentration', 'Top product share', 'Sales breakdown'],
    rules: [
      {
        id: 'product_concentration',
        title: 'Top Product Share',
        settings: [
          {
            token: 'good_pct',
            displayLabel: 'Diversified',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'diversified product-share limit',
          },
          {
            token: 'neutral_pct',
            displayLabel: 'Moderate',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'moderate product-share limit',
          },
        ],
        ranges: [
          {
            label: 'Diversified product mix',
            segments: [{ text: '0' }, { text: '-' }, { token: 'good_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Moderate concentration',
            segments: [{ token: 'good_pct' }, { text: '-' }, { token: 'neutral_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Product concentration risk',
            segments: [{ text: 'Above' }, { token: 'neutral_pct' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'good_pct',
            relation: 'lessThan',
            rightToken: 'neutral_pct',
            message: 'The moderate product-share limit must be higher than the diversified limit.',
          },
        ],
      },
    ],
  },
  by_agent: {
    title: 'Sales by Sales Agent: Decline Review Rules',
    description: '',
    appliesToPromptLabel: 'By Sales Agent',
    searchAliases: ['Agent decline', 'Sales agent performance', 'Sales breakdown'],
    rules: [
      {
        id: 'agent_decline',
        title: 'Agent Sales Decline',
        settings: [
          {
            token: 'decline_flag_pct',
            displayLabel: 'Review needed',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'agent decline review limit',
          },
        ],
        ranges: [
          {
            label: 'Normal movement',
            segments: [{ text: '0' }, { text: '-' }, { token: 'decline_flag_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Review needed',
            segments: [{ text: 'Above' }, { token: 'decline_flag_pct' }],
            unit: '%',
          },
        ],
      },
    ],
  },
  by_outlet: {
    title: 'Sales by Outlet: Geographic Concentration Rules',
    description: '',
    appliesToPromptLabel: 'By Outlet',
    searchAliases: ['Outlet concentration', 'Geographic concentration', 'Sales breakdown'],
    rules: [
      {
        id: 'outlet_concentration',
        title: 'Single Outlet Share',
        settings: [
          {
            token: 'good_pct',
            displayLabel: 'Diversified',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'diversified outlet-share limit',
          },
        ],
        ranges: [
          {
            label: 'Geographically diversified',
            segments: [{ text: '0' }, { text: '-' }, { token: 'good_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Geographic concentration risk',
            segments: [{ text: 'Above' }, { token: 'good_pct' }],
            unit: '%',
          },
        ],
      },
    ],
  },
  rt_total_returns: {
    title: 'Total Returns: Return Exposure Rules',
    description: '',
    appliesToPromptLabel: 'Total Returns',
    searchAliases: ['Return exposure', 'Return rate', 'Returns KPI'],
    rules: [
      {
        id: 'return_rate',
        title: 'Return Rate of Net Sales',
        settings: [
          {
            token: 'healthy_pct',
            displayLabel: 'Healthy',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'healthy return-rate limit',
          },
          {
            token: 'concern_pct',
            displayLabel: 'Concern',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'concern return-rate limit',
          },
        ],
        ranges: [
          {
            label: 'Healthy',
            segments: [{ text: '0' }, { text: '-' }, { token: 'healthy_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Watch',
            segments: [{ token: 'healthy_pct' }, { text: '-' }, { token: 'concern_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Concern',
            segments: [{ text: 'Above' }, { token: 'concern_pct' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'healthy_pct',
            relation: 'lessThan',
            rightToken: 'concern_pct',
            message: 'The concern limit must be higher than the healthy return-rate limit.',
          },
        ],
      },
    ],
  },
  rt_settled: {
    title: 'Settled Returns: Resolution Mix Rules',
    description: '',
    appliesToPromptLabel: 'Settled',
    searchAliases: ['Settlement mix', 'Knock-off share', 'Refund share', 'Returns KPI'],
    rules: [
      {
        id: 'knock_off_share',
        title: 'Knock-Off Settlement Share',
        settings: [
          {
            token: 'knock_off_healthy_pct',
            displayLabel: 'Cash-efficient',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'cash-efficient knock-off limit',
          },
        ],
        ranges: [
          {
            label: 'Needs more knock-off settlement',
            segments: [{ text: '0' }, { text: '-' }, { token: 'knock_off_healthy_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Cash-efficient',
            segments: [{ text: 'Above' }, { token: 'knock_off_healthy_pct' }],
            unit: '%',
          },
        ],
      },
      {
        id: 'refund_share',
        title: 'Refund Exposure Share',
        settings: [
          {
            token: 'refund_concern_pct',
            displayLabel: 'Cash-draining',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'cash-draining refund limit',
          },
        ],
        ranges: [
          {
            label: 'Controlled refund exposure',
            segments: [{ text: '0' }, { text: '-' }, { token: 'refund_concern_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Cash-draining concern',
            segments: [{ text: 'Above' }, { token: 'refund_concern_pct' }],
            unit: '%',
          },
        ],
      },
    ],
  },
  rt_unsettled: {
    title: 'Unsettled Returns: Open Exposure Rules',
    description: '',
    appliesToPromptLabel: 'Unsettled',
    searchAliases: ['Open return exposure', 'Unsettled share', 'Returns KPI'],
    rules: [
      {
        id: 'unsettled_share',
        title: 'Unsettled Share of Returns',
        settings: [
          {
            token: 'healthy_pct',
            displayLabel: 'Healthy',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'healthy unsettled-share limit',
          },
          {
            token: 'concern_pct',
            displayLabel: 'Concern',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'concern unsettled-share limit',
          },
        ],
        ranges: [
          {
            label: 'Healthy',
            segments: [{ text: '0' }, { text: '-' }, { token: 'healthy_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Watch',
            segments: [{ token: 'healthy_pct' }, { text: '-' }, { token: 'concern_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Concern',
            segments: [{ text: 'Above' }, { token: 'concern_pct' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'healthy_pct',
            relation: 'lessThan',
            rightToken: 'concern_pct',
            message: 'The concern limit must be higher than the healthy unsettled-share limit.',
          },
        ],
      },
    ],
  },
  rt_return_pct: {
    title: 'Return Percentage: Sales Quality Rules',
    description: '',
    appliesToPromptLabel: 'Return %',
    searchAliases: ['Return percentage', 'Return ratio', 'Sales quality', 'Returns KPI'],
    rules: [
      {
        id: 'return_percentage',
        title: 'Return Value as Share of Net Sales',
        settings: [
          {
            token: 'healthy_pct',
            displayLabel: 'Healthy',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'healthy return-percentage limit',
          },
          {
            token: 'concern_pct',
            displayLabel: 'Concern',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'concern return-percentage limit',
          },
        ],
        ranges: [
          {
            label: 'Healthy',
            segments: [{ text: '0' }, { text: '-' }, { token: 'healthy_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Watch',
            segments: [{ token: 'healthy_pct' }, { text: '-' }, { token: 'concern_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Concern',
            segments: [{ text: 'Above' }, { token: 'concern_pct' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'healthy_pct',
            relation: 'lessThan',
            rightToken: 'concern_pct',
            message: 'The concern limit must be higher than the healthy return-percentage limit.',
          },
        ],
      },
    ],
  },
  bs_statement: {
    title: 'Balance Sheet Statement Rules',
    description: '',
    appliesToPromptLabel: 'Balance Sheet Statement',
    rules: [
      {
        id: 'line_yoy_movement',
        title: 'Line-Item YoY Movement Rules',
        settings: [
          {
            token: 'flat_pct',
            displayLabel: 'Flat',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'flat limit',
          },
          {
            token: 'material_pct',
            displayLabel: 'Material',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'material limit',
          },
        ],
        ranges: [
          {
            label: 'Flat',
            segments: [{ text: '0' }, { text: '-' }, { token: 'flat_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Moderate',
            segments: [{ token: 'flat_pct', offset: 1 }, { text: '-' }, { token: 'material_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Material',
            segments: [{ token: 'material_pct' }, { text: '> above' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'flat_pct',
            relation: 'lessThan',
            rightToken: 'material_pct',
            message: 'The material limit must be higher than the flat limit.',
          },
        ],
      },
      {
        id: 'current_ratio_liquidity',
        title: 'Balance Sheet: Current Ratio Liquidity Rules',
        settings: [
          {
            token: 'healthy_below_ratio',
            displayLabel: 'Strong',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'strong limit',
          },
          {
            token: 'thin_below_ratio',
            displayLabel: 'Healthy',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'healthy limit',
          },
          {
            token: 'severe_below_ratio',
            displayLabel: 'Severe',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'severe limit',
          },
        ],
        ranges: [
          {
            label: 'Severe',
            segments: [{ text: '0' }, { text: '-' }, { token: 'severe_below_ratio', editable: true }],
            unit: 'ratio',
          },
          {
            label: 'Thin',
            segments: [
              { token: 'severe_below_ratio', offset: 0.1 },
              { text: '-' },
              { token: 'thin_below_ratio', editable: true },
            ],
            unit: 'ratio',
          },
          {
            label: 'Healthy',
            segments: [
              { token: 'thin_below_ratio', offset: 0.1 },
              { text: '-' },
              { token: 'healthy_below_ratio', editable: true },
            ],
            unit: 'ratio',
          },
          {
            label: 'Strong',
            segments: [{ token: 'healthy_below_ratio' }, { text: '> above' }],
            unit: 'ratio',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'healthy_below_ratio',
            relation: 'greaterThan',
            rightToken: 'thin_below_ratio',
            message: 'The strong liquidity threshold must be higher than the healthy liquidity threshold.',
          },
          {
            leftToken: 'thin_below_ratio',
            relation: 'greaterThan',
            rightToken: 'severe_below_ratio',
            message: 'The healthy liquidity threshold must be higher than the severe liquidity threshold.',
          },
        ],
      },
      {
        id: 'current_ratio_drift',
        title: 'Current Ratio Drift Rules',
        settings: [
          {
            token: 'current_ratio_drift_material_ratio',
            displayLabel: 'Material drift',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'material drift limit',
          },
        ],
        ranges: [
          {
            label: 'Normal',
            segments: [{ text: '0' }, { text: '-' }, { token: 'current_ratio_drift_material_ratio', editable: true }],
            unit: 'ratio',
          },
          {
            label: 'Material',
            segments: [{ token: 'current_ratio_drift_material_ratio' }, { text: '> above' }],
            unit: 'ratio',
          },
        ],
      },
      {
        id: 'debt_to_equity',
        title: 'Debt-To-Equity Rules',
        settings: [
          {
            token: 'conservative_below_ratio',
            displayLabel: 'Conservative',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'conservative limit',
          },
          {
            token: 'typical_below_ratio',
            displayLabel: 'Typical',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'typical limit',
          },
          {
            token: 'leveraged_below_ratio',
            displayLabel: 'Leveraged',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'leveraged limit',
          },
        ],
        ranges: [
          {
            label: 'Conservative',
            segments: [{ text: '0' }, { text: '-' }, { token: 'conservative_below_ratio', editable: true }],
            unit: 'ratio',
          },
          {
            label: 'Typical',
            segments: [
              { token: 'conservative_below_ratio', offset: 0.1 },
              { text: '-' },
              { token: 'typical_below_ratio', editable: true },
            ],
            unit: 'ratio',
          },
          {
            label: 'Leveraged',
            segments: [
              { token: 'typical_below_ratio', offset: 0.1 },
              { text: '-' },
              { token: 'leveraged_below_ratio', editable: true },
            ],
            unit: 'ratio',
          },
          {
            label: 'Severe',
            segments: [{ token: 'leveraged_below_ratio' }, { text: '> above' }],
            unit: 'ratio',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'conservative_below_ratio',
            relation: 'lessThan',
            rightToken: 'typical_below_ratio',
            message: 'The typical limit must be higher than the conservative limit.',
          },
          {
            leftToken: 'typical_below_ratio',
            relation: 'lessThan',
            rightToken: 'leveraged_below_ratio',
            message: 'The leveraged limit must be higher than the typical limit.',
          },
        ],
      },
      {
        id: 'debt_to_equity_drift',
        title: 'Debt-To-Equity Drift Rules',
        settings: [
          {
            token: 'debt_to_equity_drift_material_ratio',
            displayLabel: 'Material drift',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'material drift limit',
          },
        ],
        ranges: [
          {
            label: 'Normal',
            segments: [{ text: '0' }, { text: '-' }, { token: 'debt_to_equity_drift_material_ratio', editable: true }],
            unit: 'ratio',
          },
          {
            label: 'Material',
            segments: [{ token: 'debt_to_equity_drift_material_ratio' }, { text: '> above' }],
            unit: 'ratio',
          },
        ],
      },
      {
        id: 'equity_ratio',
        title: 'Equity Ratio Rules',
        settings: [
          {
            token: 'healthy_below_pct',
            displayLabel: 'Strong',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'strong limit',
          },
          {
            token: 'thin_below_pct',
            displayLabel: 'Healthy',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'healthy limit',
          },
          {
            token: 'severe_below_pct',
            displayLabel: 'Severe',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'severe limit',
          },
        ],
        ranges: [
          {
            label: 'Severe',
            segments: [{ text: '0' }, { text: '-' }, { token: 'severe_below_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Thin',
            segments: [{ token: 'severe_below_pct', offset: 1 }, { text: '-' }, { token: 'thin_below_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Healthy',
            segments: [{ token: 'thin_below_pct', offset: 1 }, { text: '-' }, { token: 'healthy_below_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Strong',
            segments: [{ token: 'healthy_below_pct' }, { text: '> above' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'healthy_below_pct',
            relation: 'greaterThan',
            rightToken: 'thin_below_pct',
            message: 'The strong limit must be higher than the healthy limit.',
          },
          {
            leftToken: 'thin_below_pct',
            relation: 'greaterThan',
            rightToken: 'severe_below_pct',
            message: 'The healthy limit must be higher than the severe limit.',
          },
        ],
      },
      {
        id: 'equity_ratio_drift',
        title: 'Equity Ratio Drift Rules',
        settings: [
          {
            token: 'drift_material_pp',
            displayLabel: 'Material drift',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'material drift limit',
          },
        ],
        ranges: [
          {
            label: 'Normal',
            segments: [{ text: '0' }, { text: '-' }, { token: 'drift_material_pp', editable: true }],
            unit: 'pp',
          },
          {
            label: 'Material',
            segments: [{ token: 'drift_material_pp' }, { text: '> above' }],
            unit: 'pp',
          },
        ],
      },
    ],
  },
  ex_top_expenses: {
    title: 'Top Expenses: Cost Concentration Rules',
    description: '',
    appliesToPromptLabel: 'Top Expenses',
    rules: [
      {
        id: 'single_account_concentration',
        title: 'Largest Account Share',
        settings: [
          {
            token: 'top_1_severe_pct',
            displayLabel: 'Severe',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'severe limit',
          },
          {
            token: 'top_1_concentrated_pct',
            displayLabel: 'Concentrated',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'concentrated limit',
          },
        ],
        ranges: [
          {
            label: 'Spread',
            segments: [{ text: '0' }, { text: '-' }, { token: 'top_1_concentrated_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Concentrated',
            segments: [
              { token: 'top_1_concentrated_pct', offset: 1 },
              { text: '-' },
              { token: 'top_1_severe_pct', editable: true },
            ],
            unit: '%',
          },
          {
            label: 'Severe',
            segments: [{ token: 'top_1_severe_pct' }, { text: '> above' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'top_1_severe_pct',
            relation: 'greaterThan',
            rightToken: 'top_1_concentrated_pct',
            message: 'The severe limit must be higher than the concentrated limit.',
          },
        ],
      },
      {
        id: 'top_10_concentration',
        title: 'Top 10 Account Share',
        settings: [
          {
            token: 'top_10_concentrated_pct',
            displayLabel: 'Concentrated',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'concentrated limit',
          },
          {
            token: 'top_10_diversified_pct',
            displayLabel: 'Diversified',
            sentencePrefix: '',
            sentenceSuffix: '',
            validationLabel: 'diversified limit',
          },
        ],
        ranges: [
          {
            label: 'Diversified',
            segments: [{ text: '0' }, { text: '-' }, { token: 'top_10_diversified_pct', editable: true }],
            unit: '%',
          },
          {
            label: 'Normal',
            segments: [
              { token: 'top_10_diversified_pct', offset: 1 },
              { text: '-' },
              { token: 'top_10_concentrated_pct', editable: true },
            ],
            unit: '%',
          },
          {
            label: 'Concentrated',
            segments: [{ token: 'top_10_concentrated_pct' }, { text: '> above' }],
            unit: '%',
          },
        ],
        validationConstraints: [
          {
            leftToken: 'top_10_concentrated_pct',
            relation: 'greaterThan',
            rightToken: 'top_10_diversified_pct',
            message: 'The concentrated limit must be higher than the diversified limit.',
          },
        ],
      },
    ],
  },
};

const componentMap = new Map(THRESHOLD_REGISTRY.map((entry) => [entry.componentKey, entry]));
const tokenMap = new Map<string, ThresholdTokenDefinition>();

for (const entry of THRESHOLD_REGISTRY) {
  const seen = new Set<string>();
  for (const groupDef of entry.groups) {
    for (const tokenDef of groupDef.tokens) {
      if (seen.has(tokenDef.token)) {
        throw new Error(`Duplicate threshold token ${entry.componentKey}.${tokenDef.token}`);
      }
      seen.add(tokenDef.token);
      tokenMap.set(`${entry.componentKey}.${tokenDef.token}`, tokenDef);
    }
  }
}

function snapshotKey(componentKey: string, token: string) {
  return `${componentKey}.${token}`;
}

function parsePrecision(valueType: ThresholdValueType): number | null {
  const match = valueType.match(/^decimal\((\d+)\)$/);
  return match ? Number(match[1]) : null;
}

function coerceThresholdValue(token: ThresholdTokenDefinition, value: unknown): number {
  const raw = typeof value === 'string' ? Number(value) : Number(value);
  if (!Number.isFinite(raw)) return token.defaultValue;

  if (token.valueType === 'int') return Math.trunc(raw);

  const precision = parsePrecision(token.valueType) ?? 0;
  return Number(raw.toFixed(precision));
}

export function formatThresholdValue(token: ThresholdTokenDefinition, value: number): string {
  if (token.valueType === 'int') return String(Math.trunc(value));
  const precision = parsePrecision(token.valueType) ?? 0;
  return value.toFixed(precision);
}

function defaultSnapshot(): ThresholdSnapshot {
  const values = new Map<string, number>();
  for (const entry of THRESHOLD_REGISTRY) {
    for (const groupDef of entry.groups) {
      for (const tokenDef of groupDef.tokens) {
        values.set(snapshotKey(entry.componentKey, tokenDef.token), tokenDef.defaultValue);
      }
    }
  }
  return { expiresAt: Date.now() + CACHE_MS, values };
}

async function loadSnapshot(): Promise<ThresholdSnapshot> {
  const base = defaultSnapshot();

  if (process.env.AI_INSIGHT_THRESHOLDS_USE_DEFAULTS === '1') {
    applyTestOverrides(base);
    return base;
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query<{
      component_key: string;
      token: string;
      value: string;
    }>(
      `SELECT component_key, token, value::text
       FROM ai_insight_thresholds`,
    );

    for (const row of rows) {
      const tokenDef = tokenMap.get(snapshotKey(row.component_key, row.token));
      if (!tokenDef) continue;
      base.values.set(
        snapshotKey(row.component_key, row.token),
        coerceThresholdValue(tokenDef, row.value),
      );
    }
  } catch (err) {
    const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: unknown }).code) : '';
    if (code !== '42P01') {
      console.warn('AI Insight threshold config fell back to defaults:', err);
    }
  }

  applyTestOverrides(base);
  return base;
}

function applyTestOverrides(base: ThresholdSnapshot) {
  if (process.env.NODE_ENV !== 'test' && process.env.AI_INSIGHT_THRESHOLDS_USE_DEFAULTS !== '1') return;
  const raw = process.env.AI_INSIGHT_THRESHOLD_TEST_OVERRIDES;
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    for (const [componentKey, tokenValues] of Object.entries(parsed)) {
      for (const [token, rawValue] of Object.entries(tokenValues ?? {})) {
        const tokenDef = tokenMap.get(snapshotKey(componentKey, token));
        if (!tokenDef) continue;
        base.values.set(snapshotKey(componentKey, token), coerceThresholdValue(tokenDef, rawValue));
      }
    }
  } catch (err) {
    console.warn('Ignoring invalid AI_INSIGHT_THRESHOLD_TEST_OVERRIDES:', err);
  }
}

async function getSnapshot(): Promise<ThresholdSnapshot> {
  const now = Date.now();
  if (snapshot && snapshot.expiresAt > now) return snapshot;
  if (!inFlight) {
    inFlight = loadSnapshot().finally(() => {
      inFlight = null;
    });
  }
  snapshot = await inFlight;
  return snapshot;
}

export function invalidateThresholdCache() {
  snapshot = null;
  inFlight = null;
}

export function getThresholdComponent(componentKey: string): ThresholdComponentDefinition | null {
  return componentMap.get(componentKey) ?? null;
}

export function getThresholdPresentation(componentKey: string): ThresholdComponentPresentationView | null {
  return THRESHOLD_PRESENTATION[componentKey] ?? null;
}

function getPresentationSetting(
  componentKey: string,
  token: string,
): ThresholdBusinessSettingView | null {
  const presentation = getThresholdPresentation(componentKey);
  if (!presentation) return null;

  for (const rule of presentation.rules) {
    const setting = rule.settings.find((candidate) => candidate.token === token);
    if (setting) return setting;
  }
  return null;
}

function getPresentationConstraints(componentKey: string): ThresholdValidationConstraintView[] {
  return getThresholdPresentation(componentKey)?.rules.flatMap((rule) => rule.validationConstraints ?? []) ?? [];
}

function validationLabel(componentKey: string, tokenDef: ThresholdTokenDefinition): string {
  return getPresentationSetting(componentKey, tokenDef.token)?.validationLabel ?? tokenDef.label;
}

export function listThresholdSeedRows(): Array<{ componentKey: string; token: string; value: number }> {
  const rows: Array<{ componentKey: string; token: string; value: number }> = [];
  for (const entry of THRESHOLD_REGISTRY) {
    for (const groupDef of entry.groups) {
      for (const tokenDef of groupDef.tokens) {
        rows.push({ componentKey: entry.componentKey, token: tokenDef.token, value: tokenDef.defaultValue });
      }
    }
  }
  return rows;
}

export async function getThresholdGroups(componentKey: string): Promise<ThresholdGroupView[]> {
  const entry = componentMap.get(componentKey);
  if (!entry) return [];

  const current = await getSnapshot();
  return entry.groups.map((groupDef) => ({
    id: groupDef.id,
    label: groupDef.label,
    direction: groupDef.direction,
    description: groupDef.description,
    enforceMonotonic: groupDef.enforceMonotonic !== false,
    tokens: groupDef.tokens.map((tokenDef) => {
      const value = current.values.get(snapshotKey(componentKey, tokenDef.token)) ?? tokenDef.defaultValue;
      return {
        ...tokenDef,
        value,
        formattedValue: formatThresholdValue(tokenDef, value),
      };
    }),
  }));
}

export async function getThresholdValues(componentKey: string): Promise<Record<string, number>> {
  const entry = componentMap.get(componentKey);
  if (!entry) return {};

  const current = await getSnapshot();
  const values: Record<string, number> = {};
  for (const groupDef of entry.groups) {
    for (const tokenDef of groupDef.tokens) {
      values[tokenDef.token] = current.values.get(snapshotKey(componentKey, tokenDef.token)) ?? tokenDef.defaultValue;
    }
  }
  return values;
}

export async function renderThresholdText(text: string, componentKey: string): Promise<string> {
  void componentKey;
  const current = await getSnapshot();
  let rendered = text;
  for (const entry of THRESHOLD_REGISTRY) {
    for (const groupDef of entry.groups) {
      for (const tokenDef of groupDef.tokens) {
        const value = current.values.get(snapshotKey(entry.componentKey, tokenDef.token)) ?? tokenDef.defaultValue;
        rendered = rendered.replaceAll(
          `{{${entry.componentKey}.${tokenDef.token}}}`,
          formatThresholdValue(tokenDef, value),
        );
      }
    }
  }
  return rendered;
}

export async function allowedThresholds(componentKey: string): Promise<AllowedValue[]> {
  const groups = await getThresholdGroups(componentKey);
  const allowed: AllowedValue[] = [];

  for (const groupDef of groups) {
    for (const tokenDef of groupDef.tokens) {
      if (tokenDef.unit === 'ratio') {
        allowed.push({
          label: `${componentKey}.${tokenDef.token}`,
          value: tokenDef.value,
          unit: 'ratio',
        });
        continue;
      }
      allowed.push({
        label: `${componentKey}.${tokenDef.token}`,
        value: tokenDef.value,
        unit: tokenDef.unit as AllowedValueUnit,
      });
    }
  }

  return allowed;
}

export async function classifyThresholdValue(
  componentKey: string,
  metricId: string,
  value: number,
): Promise<{ label: string; token: string; direction: ThresholdDirection } | null> {
  const groups = await getThresholdGroups(componentKey);
  const groupDef = groups.find((candidate) => candidate.id === metricId);
  if (!groupDef || groupDef.tokens.length === 0) return null;

  const ordered = [...groupDef.tokens].sort((a, b) =>
    groupDef.direction === 'ascending' ? b.value - a.value : a.value - b.value,
  );
  const match = ordered.find((tokenDef) =>
    groupDef.direction === 'ascending' ? value >= tokenDef.value : value <= tokenDef.value,
  ) ?? ordered[ordered.length - 1];

  return { label: match.label, token: match.token, direction: groupDef.direction };
}

function validateOneToken(
  componentKey: string,
  tokenDef: ThresholdTokenDefinition,
  value: unknown,
): string | null {
  const label = validationLabel(componentKey, tokenDef);
  const num = Number(value);
  if (!Number.isFinite(num)) return `The ${label} value must be numeric.`;
  if (tokenDef.valueType === 'int' && !Number.isInteger(num)) {
    return `The ${label} value must be a whole number.`;
  }
  if (tokenDef.unit === 'pct' && !tokenDef.allowPctAbove100 && tokenDef.min >= 0 && (num < 0 || num > 100)) {
    return `The ${label} value must be between 0 and 100%.`;
  }
  if (num < tokenDef.min || num > tokenDef.max) {
    return `The ${label} value must be between ${tokenDef.min} and ${tokenDef.max}.`;
  }
  return null;
}

function constraintKey(leftToken: string, rightToken: string) {
  return `${leftToken}:${rightToken}`;
}

function relationIsValid(
  relation: ThresholdValidationConstraintView['relation'],
  leftValue: number,
  rightValue: number,
) {
  return relation === 'greaterThan' ? leftValue > rightValue : leftValue < rightValue;
}

export async function validateThresholdValues(
  componentKey: string,
  incomingValues: Record<string, unknown>,
): Promise<ThresholdValidationResult> {
  const entry = componentMap.get(componentKey);
  if (!entry) {
    return { ok: false, errors: [`Unknown component key: ${componentKey}`], values: {} };
  }

  const errors: string[] = [];
  const invalidTokens = new Set<string>();
  const values: Record<string, number> = {};
  const knownTokens = new Set(entry.groups.flatMap((groupDef) => groupDef.tokens.map((tokenDef) => tokenDef.token)));
  const snapshotValues = await getSnapshot();
  const presentationConstraints = getPresentationConstraints(componentKey);
  const constraintByPair = new Map(
    presentationConstraints.map((constraint) => [
      constraintKey(constraint.leftToken, constraint.rightToken),
      constraint,
    ]),
  );
  const checkedConstraintKeys = new Set<string>();

  for (const token of Object.keys(incomingValues)) {
    if (!knownTokens.has(token)) errors.push(`Unknown token for ${componentKey}: ${token}`);
  }

  for (const groupDef of entry.groups) {
    for (const tokenDef of groupDef.tokens) {
      const rawValue =
        tokenDef.token in incomingValues
          ? incomingValues[tokenDef.token]
          : snapshotValues.values.get(snapshotKey(componentKey, tokenDef.token)) ?? tokenDef.defaultValue;
      const tokenError = validateOneToken(componentKey, tokenDef, rawValue);
      if (tokenError) {
        errors.push(tokenError);
        invalidTokens.add(tokenDef.token);
      }
      values[tokenDef.token] = coerceThresholdValue(tokenDef, rawValue);
    }
  }

  for (const groupDef of entry.groups) {
    if (groupDef.tokens.length < 2 || groupDef.enforceMonotonic === false) continue;
    for (let i = 0; i < groupDef.tokens.length - 1; i += 1) {
      const left = groupDef.tokens[i];
      const right = groupDef.tokens[i + 1];
      if (invalidTokens.has(left.token) || invalidTokens.has(right.token)) continue;
      const leftValue = values[left.token];
      const rightValue = values[right.token];
      const defaultRelation = groupDef.direction === 'ascending' ? 'greaterThan' : 'lessThan';
      const key = constraintKey(left.token, right.token);
      const presentationConstraint = constraintByPair.get(key);
      const relation = presentationConstraint?.relation ?? defaultRelation;
      const valid = relationIsValid(relation, leftValue, rightValue);
      checkedConstraintKeys.add(key);
      if (!valid) {
        const comparator = defaultRelation === 'greaterThan' ? 'greater than' : 'less than';
        errors.push(
          presentationConstraint?.message ??
            `${validationLabel(componentKey, left)} must be ${comparator} ${validationLabel(componentKey, right)}.`,
        );
      }
    }
  }

  for (const constraint of presentationConstraints) {
    const key = constraintKey(constraint.leftToken, constraint.rightToken);
    if (checkedConstraintKeys.has(key)) continue;
    if (invalidTokens.has(constraint.leftToken) || invalidTokens.has(constraint.rightToken)) continue;
    if (!relationIsValid(constraint.relation, values[constraint.leftToken], values[constraint.rightToken])) {
      errors.push(constraint.message);
    }
  }

  return { ok: errors.length === 0, errors, values };
}

export async function saveThresholdValues(
  componentKey: string,
  incomingValues: Record<string, unknown>,
  updatedBy: string | null,
): Promise<ThresholdValidationResult> {
  const validation = await validateThresholdValues(componentKey, incomingValues);
  if (!validation.ok) return validation;

  const entry = componentMap.get(componentKey);
  if (!entry) return validation;

  const pool = getPool();
  const rows = entry.groups.flatMap((groupDef) => groupDef.tokens);
  const valuesSql: string[] = [];
  const params: unknown[] = [];

  rows.forEach((tokenDef, index) => {
    const offset = index * 4;
    valuesSql.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
    params.push(componentKey, tokenDef.token, validation.values[tokenDef.token], updatedBy);
  });

  await pool.query(
    `INSERT INTO ai_insight_thresholds (component_key, token, value, updated_by)
     VALUES ${valuesSql.join(', ')}
     ON CONFLICT (component_key, token) DO UPDATE
     SET value = EXCLUDED.value,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
    params,
  );

  invalidateThresholdCache();
  return validation;
}
