import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.AI_INSIGHT_THRESHOLDS_USE_DEFAULTS = '1';

const { getComponentPrompt } = await import('../src/lib/ai-insight/prompt-loader');
const { getRenderedComponentInfo } = await import('../src/lib/ai-insight/component-info-renderer');
const {
  allowedThresholds,
  invalidateThresholdCache,
  renderThresholdText,
} = await import('../src/lib/ai-insight/threshold-config');
const { runNumericGuard } = await import('../src/lib/ai-insight/numeric-guard');

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, '../test-snapshots/ai-insight-thresholds-default.json');

const PROMPT_COMPONENTS = [
  'avg_collection_days',
  'collection_rate',
  'overdue_amount',
  'aging_analysis',
  'bs_statement',
  'fin_pnl_summary',
  'cm_margin_distribution',
  'sm_supplier_table',
  'ex_top_expenses',
] as const;

const COMPONENT_INFO_COMPONENTS = [
  'avg_collection_days',
  'collection_rate',
  'overdue_amount',
  'cm_margin_distribution',
  'ex_top_expenses',
  'bs_statement',
] as const;

const DATA_SAMPLE_SOURCES: Record<string, string> = {
  avg_collection_days:
    'Pre-calculated gaps (use these values directly — do not recompute):\n' +
    '- Days above {{avg_collection_days.good_days}}-day (Good) benchmark: +7 days\n' +
    '- Days above {{avg_collection_days.warning_days}}-day (Warning) benchmark: -23 days\n' +
    '- Months above {{avg_collection_days.good_days}}-day benchmark: 2 of 6\n' +
    '- Months above {{avg_collection_days.warning_days}}-day benchmark: 0 of 6\n',
  bs_statement:
    'Thresholds:\n' +
    '- Current Ratio: < {{bs_statement.severe_below_ratio}} Severe · ' +
    '{{bs_statement.severe_below_ratio}}-{{bs_statement.thin_below_ratio}} Thin · ' +
    '{{bs_statement.thin_below_ratio}}-{{bs_statement.healthy_below_ratio}} Healthy · ' +
    '> {{bs_statement.healthy_below_ratio}} Strong\n',
  ex_top_expenses:
    'Thresholds: Top 1 > {{ex_top_expenses.top_1_severe_pct}}% Severe · ' +
    '{{ex_top_expenses.top_1_concentrated_pct}}-{{ex_top_expenses.top_1_severe_pct}}% Concentrated · ' +
    'Top 10 > {{ex_top_expenses.top_10_concentrated_pct}}% Concentrated · ' +
    '< {{ex_top_expenses.top_10_diversified_pct}}% Diversified\n',
};

async function buildSnapshot() {
  invalidateThresholdCache();

  const prompts: Record<string, string> = {};
  for (const key of PROMPT_COMPONENTS) {
    prompts[key] = await getComponentPrompt(key);
  }

  const componentInfo: Record<string, unknown> = {};
  for (const key of COMPONENT_INFO_COMPONENTS) {
    componentInfo[key] = await getRenderedComponentInfo(key);
  }

  const dataSamples: Record<string, string> = {};
  for (const [componentKey, source] of Object.entries(DATA_SAMPLE_SOURCES)) {
    dataSamples[componentKey] = await renderThresholdText(source, componentKey);
  }

  return { prompts, componentInfo, dataSamples };
}

async function assertNumericGuardAllowsNonSafeThreshold() {
  process.env.AI_INSIGHT_THRESHOLD_TEST_OVERRIDES = JSON.stringify({
    avg_collection_days: { good_days: 37 },
  });
  invalidateThresholdCache();

  const allowed = await allowedThresholds('avg_collection_days');
  const has37 = allowed.some((entry) => entry.unit === 'days' && entry.value === 37);
  assert.equal(has37, true, 'allowedThresholds(avg_collection_days) should include live 37-day threshold');

  const configuredGuard = runNumericGuard('Configured benchmark: 37 days.', allowed);
  assert.equal(configuredGuard.ok, true, 'numeric guard should allow configured non-SAFE 37-day threshold');

  const bareGuard = runNumericGuard('Configured benchmark: 37 days.', []);
  assert.equal(bareGuard.ok, false, '37 days should not pass only via SAFE_INTEGERS');

  delete process.env.AI_INSIGHT_THRESHOLD_TEST_OVERRIDES;
  invalidateThresholdCache();
}

async function assertOverridePropagation() {
  process.env.AI_INSIGHT_THRESHOLD_TEST_OVERRIDES = JSON.stringify({
    avg_collection_days: { good_days: 37, warning_days: 74 },
    bs_statement: { thin_below_ratio: 1.4 },
    ex_top_expenses: { top_1_severe_pct: 31 },
  });
  invalidateThresholdCache();

  const avgPrompt = await getComponentPrompt('avg_collection_days');
  assert.equal(avgPrompt.includes('≤37 = Good'), true, 'avg_collection_days prompt should render overridden good_days');
  assert.equal(avgPrompt.includes('≤74 = Warning'), true, 'avg_collection_days prompt should render overridden warning_days');

  const avgData = await renderThresholdText(DATA_SAMPLE_SOURCES.avg_collection_days, 'avg_collection_days');
  assert.equal(avgData.includes('37-day (Good) benchmark'), true, 'data sample should render overridden avg_collection_days good_days');
  assert.equal(avgData.includes('74-day (Warning) benchmark'), true, 'data sample should render overridden avg_collection_days warning_days');

  const avgInfo = await getRenderedComponentInfo('avg_collection_days');
  assert.equal(avgInfo?.indicator?.includes('≤37 days = Good'), true, 'component info should render overridden avg_collection_days good_days');

  const bsPrompt = await getComponentPrompt('bs_statement');
  assert.equal(bsPrompt.includes('1.4–2.0 Healthy'), true, 'bs_statement prompt should render overridden ratio token');
  const bsAllowed = await allowedThresholds('bs_statement');
  assert.equal(
    bsAllowed.some((entry) => entry.unit === 'ratio' && entry.value === 1.4),
    true,
    'bs_statement allowed thresholds should include overridden ratio token',
  );

  const exPrompt = await getComponentPrompt('ex_top_expenses');
  assert.equal(exPrompt.includes('Top 1 >31% = Severe'), true, 'ex_top_expenses prompt should render overridden concentration token');

  delete process.env.AI_INSIGHT_THRESHOLD_TEST_OVERRIDES;
  invalidateThresholdCache();
}

function normalizeSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const snapshot = normalizeSnapshot(await buildSnapshot());

if (process.env.UPDATE_THRESHOLD_FIXTURE === '1') {
  writeFileSync(fixturePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Updated ${fixturePath}`);
} else {
  if (!existsSync(fixturePath)) {
    throw new Error(`Missing fixture: ${fixturePath}. Run UPDATE_THRESHOLD_FIXTURE=1 npm run test:thresholds first.`);
  }
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  assert.deepEqual(snapshot, fixture);
  await assertNumericGuardAllowsNonSafeThreshold();
  await assertOverridePropagation();
  console.log('AI Insight threshold regression passed.');
}
