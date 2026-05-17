import { test, expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

async function setAdminRole(page: Page) {
  await page.addInitScript(() => localStorage.setItem('user-role', 'admin'));
}

async function openAdminConfig(page: Page) {
  await page.goto('/admin/ai-insight-config');
  await page.waitForSelector('[data-testid="ai-insight-config-dashboard"]', { timeout: 30_000 });
}

async function expandPage(page: import('@playwright/test').Page, dataPage: string) {
  await page.locator(`[data-testid="prompt-tree-page"][data-page="${dataPage}"]`).click();
}

async function clickLeaf(page: import('@playwright/test').Page, promptKey: string) {
  await page.locator(`[data-testid="prompt-tree-leaf"][data-prompt-key="${promptKey}"]`).click();
}

async function selectPromptBySearch(page: Page, query: string, promptKey: string) {
  await page.getByTestId('prompt-tree-search').fill(query);
  await page.locator(`[data-testid="prompt-tree-leaf"][data-prompt-key="${promptKey}"]`).click();
  await expect(page.getByTestId('configuration-panel')).toBeVisible();
}

async function readThresholdValues(request: APIRequestContext, componentKey: string) {
  const res = await request.get(`/api/admin/ai-insight-thresholds?componentKey=${componentKey}`);
  expect(res.status()).toBe(200);
  const body = await res.json() as {
    thresholdGroups: Array<{ tokens: Array<{ token: string; value: number }> }>;
  };
  return Object.fromEntries(
    body.thresholdGroups.flatMap((group) => group.tokens.map((token) => [token.token, token.value])),
  ) as Record<string, number>;
}

async function saveThresholdValues(
  request: APIRequestContext,
  componentKey: string,
  values: Record<string, number>,
) {
  const res = await request.put('/api/admin/ai-insight-thresholds', {
    headers: { 'x-user-role': 'admin' },
    data: { componentKey, values, updatedBy: 'Playwright' },
  });
  expect(res.status()).toBe(200);
}

async function editPromptThreshold(params: {
  page: Page;
  request: APIRequestContext;
  search: string;
  promptKey: string;
  token: string;
  value: number;
  expectedBusinessLabel: string;
  expectedConfigText: string;
  expectedPromptText: string;
}) {
  const {
    page,
    request,
    search,
    promptKey,
    token,
    value,
    expectedBusinessLabel,
    expectedConfigText,
    expectedPromptText,
  } = params;
  await selectPromptBySearch(page, search, promptKey);

  await expect(page.getByTestId('configuration-panel')).toContainText(expectedBusinessLabel);
  await expect(page.getByTestId('prompt-text-panel')).toContainText('AI Prompt Preview');
  const input = page.getByTestId(`threshold-input-${token}`);
  await expect(input).toBeVisible();
  await input.fill(String(value));
  await expect(page.getByTestId('threshold-save-button')).toBeEnabled();
  await page.getByTestId('threshold-save-button').click();
  await expect(page.getByText('Your values are saved!')).toBeVisible();
  await expect.poll(async () => {
    const values = await readThresholdValues(request, promptKey);
    return values[token];
  }, { timeout: 10_000 }).toBe(value);

  await page.reload();
  await page.waitForSelector('[data-testid="ai-insight-config-dashboard"]', { timeout: 30_000 });
  await selectPromptBySearch(page, search, promptKey);
  await expect(page.getByTestId(`threshold-input-${token}`)).toHaveValue(String(value));
  await expect(page.getByTestId('configuration-panel')).toContainText(expectedConfigText);
  await expect(page.getByTestId('prompt-text-body')).toContainText(expectedPromptText);
}

test.describe('AI Insight Config after feedback removal', () => {
  test('GET config returns code-backed prompts only', async ({ request }) => {
    const res = await request.get('/api/admin/ai-insight-config');
    expect(res.status()).toBe(200);

    const body = await res.json() as {
      prompts: Array<{
        promptKey: string;
        category: string;
        renderedPromptText: string;
        thresholdGroups?: Array<{ id: string; direction: 'ascending' | 'descending' }>;
        thresholdPresentation?: { title: string; rules: Array<{ id: string }> } | null;
      }>;
    };
    const keys = body.prompts.map((prompt) => prompt.promptKey);

    expect(keys).toContain('component_analysis');
    expect(keys).toContain('summary_analysis');
    expect(keys).toContain('by_customer');
    expect(keys).not.toContain('feedback_router');
    expect(keys).not.toContain('surgical_editor');
    expect(keys.some((key) => key.endsWith('_guidance'))).toBe(false);

    const categories = new Set(body.prompts.map((prompt) => prompt.category));
    expect([...categories].sort()).toEqual(['component', 'system']);

    const avgCollectionDays = body.prompts.find((prompt) => prompt.promptKey === 'avg_collection_days');
    expect(avgCollectionDays?.thresholdGroups?.[0]).toMatchObject({
      id: 'collection_days_band',
      direction: 'descending',
    });
    expect(avgCollectionDays?.thresholdPresentation).toMatchObject({
      title: 'Average Payment Speed Rules',
    });

    const collectionRate = body.prompts.find((prompt) => prompt.promptKey === 'collection_rate');
    expect(collectionRate?.thresholdPresentation).toMatchObject({
      title: 'Collection Rate: Cash Conversion Rules',
    });

    const salesKpiTitles = Object.fromEntries(
      ['net_sales', 'invoice_sales', 'credit_notes', 'net_sales_trend'].map((key) => {
        const prompt = body.prompts.find((candidate) => candidate.promptKey === key);
        return [key, prompt?.thresholdPresentation?.title];
      }),
    );
    expect(salesKpiTitles).toEqual({
      net_sales: 'Net Sales: Revenue Mix and Return-Impact Rules',
      invoice_sales: 'Invoice Sales: Credit-Customer Mix Rules',
      credit_notes: 'Credit Notes: Return and Adjustment Rules',
      net_sales_trend: 'Net Sales Trend: Growth Streak and Movement Rules',
    });

    const salesBreakdownTitles = Object.fromEntries(
      ['by_customer', 'by_product', 'by_agent', 'by_outlet'].map((key) => {
        const prompt = body.prompts.find((candidate) => candidate.promptKey === key);
        return [key, prompt?.thresholdPresentation?.title];
      }),
    );
    expect(salesBreakdownTitles).toEqual({
      by_customer: 'Sales by Customer: Revenue Concentration Rules',
      by_product: 'Sales by Product: Product Concentration Rules',
      by_agent: 'Sales by Sales Agent: Decline Review Rules',
      by_outlet: 'Sales by Outlet: Geographic Concentration Rules',
    });

    const returnsKpiTitles = Object.fromEntries(
      ['rt_total_returns', 'rt_settled', 'rt_unsettled', 'rt_return_pct'].map((key) => {
        const prompt = body.prompts.find((candidate) => candidate.promptKey === key);
        return [key, prompt?.thresholdPresentation?.title];
      }),
    );
    expect(returnsKpiTitles).toEqual({
      rt_total_returns: 'Total Returns: Return Exposure Rules',
      rt_settled: 'Settled Returns: Resolution Mix Rules',
      rt_unsettled: 'Unsettled Returns: Open Exposure Rules',
      rt_return_pct: 'Return Percentage: Sales Quality Rules',
    });

    const returnsChartTableTitles = Object.fromEntries(
      ['rt_settlement_breakdown', 'rt_monthly_trend', 'rt_product_bar', 'ru_aging_chart', 'ru_debtors_table'].map((key) => {
        const prompt = body.prompts.find((candidate) => candidate.promptKey === key);
        return [key, prompt?.thresholdPresentation?.title];
      }),
    );
    expect(returnsChartTableTitles).toEqual({
      rt_settlement_breakdown: 'Settlement Breakdown: Return Resolution Rules',
      rt_monthly_trend: 'Monthly Return Trend: Growth Warning Rules',
      rt_product_bar: 'Top Returns by Item: Item Concentration Rules',
      ru_aging_chart: 'Unsettled Returns Aging: Follow-Up Risk Rules',
      ru_debtors_table: 'Customer Returns: Debtor Concentration Rules',
    });

    const expensesKpiTitles = Object.fromEntries(
      ['ex_total_costs', 'ex_cogs', 'ex_opex', 'ex_yoy_costs'].map((key) => {
        const prompt = body.prompts.find((candidate) => candidate.promptKey === key);
        return [key, prompt?.thresholdPresentation?.title];
      }),
    );
    expect(expensesKpiTitles).toEqual({
      ex_total_costs: 'Total Costs: Cost Growth and Mix Rules',
      ex_cogs: 'Cost of Sales: Cost Share and Growth Rules',
      ex_opex: 'Operating Costs: Structural Cost Rules',
      ex_yoy_costs: 'vs Last Year: Total Cost Growth Rules',
    });

    const expensesChartTitles = Object.fromEntries(
      ['ex_cost_trend', 'ex_cost_composition'].map((key) => {
        const prompt = body.prompts.find((candidate) => candidate.promptKey === key);
        return [key, prompt?.thresholdPresentation?.title];
      }),
    );
    expect(expensesChartTitles).toEqual({
      ex_cost_trend: 'Cost Trend: Monthly and Prior-Year Growth Rules',
      ex_cost_composition: 'Cost Composition: Cost Mix and Drift Rules',
    });

    const expensesTableTitles = Object.fromEntries(
      ['ex_cogs_table', 'ex_opex_table'].map((key) => {
        const prompt = body.prompts.find((candidate) => candidate.promptKey === key);
        return [key, prompt?.thresholdPresentation?.title];
      }),
    );
    expect(expensesTableTitles).toEqual({
      ex_cogs_table: 'Cost of Sales Breakdown: Account Concentration Rules',
      ex_opex_table: 'Operating Costs Breakdown: Category and Account Concentration Rules',
    });

    const customerMarginKpiTitles = Object.fromEntries(
      ['cm_net_sales', 'cm_cogs', 'cm_margin_pct', 'cm_margin_trend'].map((key) => {
        const prompt = body.prompts.find((candidate) => candidate.promptKey === key);
        return [key, prompt?.thresholdPresentation?.title];
      }),
    );
    expect(customerMarginKpiTitles).toEqual({
      cm_net_sales: 'Customer Margin Net Sales: Growth and Decline Rules',
      cm_cogs: 'Customer Margin Cost of Sales: COGS Share Rules',
      cm_margin_pct: 'Customer Margin Percentage: Gross Margin Rules',
      cm_margin_trend: 'Customer Margin Trend: Profitability Streak Rules',
    });

    const customerMarginChartTableTitles = Object.fromEntries(
      ['cm_margin_distribution', 'cm_top_customers', 'cm_customer_table', 'cm_credit_note_impact'].map((key) => {
        const prompt = body.prompts.find((candidate) => candidate.promptKey === key);
        return [key, prompt?.thresholdPresentation?.title];
      }),
    );
    expect(customerMarginChartTableTitles).toEqual({
      cm_margin_distribution: 'Customer Margin Distribution: Portfolio Margin Shape Rules',
      cm_top_customers: 'Top Customers: Profit Concentration and Anchor Quality Rules',
      cm_customer_table: 'Customer Margin Table: At-Risk Customer Rules',
      cm_credit_note_impact: 'Credit Note Impact: Margin Erosion Rules',
    });

    const supplierKpiTitles = Object.fromEntries(
      ['sp_net_sales', 'sp_margin_pct', 'sp_active_suppliers'].map((key) => {
        const prompt = body.prompts.find((candidate) => candidate.promptKey === key);
        return [key, prompt?.thresholdPresentation?.title];
      }),
    );
    expect(supplierKpiTitles).toEqual({
      sp_net_sales: 'Supplier Net Sales: Growth and Decline Rules',
      sp_margin_pct: 'Supplier Margin Percentage: Gross Margin Rules',
      sp_active_suppliers: 'Active Suppliers: Supplier Base Movement Rules',
    });

    const supplierChartTitles = Object.fromEntries(
      ['sp_margin_trend', 'sp_margin_distribution'].map((key) => {
        const prompt = body.prompts.find((candidate) => candidate.promptKey === key);
        return [key, prompt?.thresholdPresentation?.title];
      }),
    );
    expect(supplierChartTitles).toEqual({
      sp_margin_trend: 'Supplier Profitability Trend: Profit and Margin Streak Rules',
      sp_margin_distribution: 'Supplier Margin Distribution: Margin Shape Rules',
    });

    const supplierBreakdownTitles = Object.fromEntries(
      ['sm_top_bottom', 'sm_supplier_table', 'sm_item_pricing', 'sm_price_scatter'].map((key) => {
        const prompt = body.prompts.find((candidate) => candidate.promptKey === key);
        return [key, prompt?.thresholdPresentation?.title];
      }),
    );
    expect(supplierBreakdownTitles).toEqual({
      sm_top_bottom: 'Top and Bottom Suppliers and Items: Profit Concentration Rules',
      sm_supplier_table: 'Supplier Analysis Table: Revenue Concentration and Margin Quality Rules',
      sm_item_pricing: 'Item Price Comparison: Procurement Alignment Rules',
      sm_price_scatter: 'Purchase vs Selling Price: Catalog Margin Rules',
    });
  });

  test('admin config page has no feedback, version, router, editor, or guidance UI', async ({ page }) => {
    await setAdminRole(page);
    await openAdminConfig(page);

    const dashboard = page.getByTestId('ai-insight-config-dashboard');
    await expect(dashboard).toBeVisible();
    await expect(page.getByTestId('prompt-tree')).toBeVisible();
    await expect(page.getByTestId('configuration-panel')).toBeVisible();
    await expect(page.getByTestId('prompt-text-panel')).toBeVisible();
    await expect(page.getByTestId('prompt-text-panel')).toContainText('AI Prompt Preview');
    await expect(page.getByTestId('prompt-text-panel')).not.toContainText('Exact instruction sent to AI Insight');
    await expect(page.getByTestId('version-panel')).toHaveCount(0);
    await expect(page.getByTestId('feedback-list')).toHaveCount(0);

    await expect(dashboard.getByText('Feedback', { exact: true })).toHaveCount(0);
    await expect(dashboard.getByText('Version', { exact: true })).toHaveCount(0);
    await expect(dashboard.getByText('Guidance', { exact: true })).toHaveCount(0);
    await expect(dashboard.getByText('Feedback Router', { exact: true })).toHaveCount(0);
    await expect(dashboard.getByText('Surgical Editor', { exact: true })).toHaveCount(0);
  });

  test('selected prompt parents can collapse and search reopens matching branches', async ({ page }) => {
    await setAdminRole(page);
    await openAdminConfig(page);

    const tree = page.getByTestId('prompt-tree');
    const avgCollectionDaysLeaf = page.locator('[data-testid="prompt-tree-leaf"][data-prompt-key="avg_collection_days"]');

    await selectPromptBySearch(page, 'Average collection days', 'avg_collection_days');
    await page.getByTestId('prompt-tree-search').fill('');
    await tree.getByRole('button', { name: 'Payment Collection Trend' }).click();
    await expect(avgCollectionDaysLeaf).toBeHidden();

    await page.locator('[data-testid="prompt-tree-page"][data-page="Payment"]').click();
    await expect(avgCollectionDaysLeaf).toBeHidden();

    await page.getByTestId('prompt-tree-search').fill('Average collection days');
    await expect(avgCollectionDaysLeaf).toBeVisible();
    await expect(tree.locator('[data-testid="prompt-tree-page"][data-page="Payment"]')).toBeVisible();
  });

  test('selected DB prompt audit changes are preserved in code-backed prompt text', async ({ page }) => {
    await setAdminRole(page);
    await openAdminConfig(page);

    await expandPage(page, 'Sales');
    await clickLeaf(page, 'by_customer');
    await expect(page.getByTestId('prompt-text-body')).toContainText(/shift to >\d+% during peak-season months/);

    await expandPage(page, 'Payment');
    await clickLeaf(page, 'aging_analysis');
    await expect(page.getByTestId('prompt-text-body')).toContainText('exceeds 30% of total outstanding');
  });

  test('AI Insight panel exposes Analyze without Feedback control', async ({ page }) => {
    await setAdminRole(page);
    await page.goto('/sales');
    await page.waitForSelector('button:has-text("Get Insight")', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Get Insight' }).first().click();

    await expect(page.getByRole('button', { name: 'Analyze' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Feedback' })).toHaveCount(0);
  });

  test('sales KPI metadata is business-readable and updates the prompt preview', async ({ page, request }) => {
    const originals = {
      net_sales: await readThresholdValues(request, 'net_sales'),
    };
    const nextInvoiceShare = originals.net_sales.invoice_share_normal_pct >= 100
      ? 99
      : originals.net_sales.invoice_share_normal_pct + 1;

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Revenue mix', 'net_sales');
      const configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Net Sales: Revenue Mix and Return-Impact Rules');
      await expect(configPanel).toContainText('Invoice Sales Mix');
      await expect(configPanel).toContainText('Credit Note Impact');
      await expect(configPanel).toContainText('Normal credit-customer mix');
      await expect(configPanel).not.toContainText('Invoice share normal at or above');
      await expect(configPanel).not.toContainText('invoice_share_normal_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Invoice share normal at or above');

      await editPromptThreshold({
        page,
        request,
        search: 'Revenue mix',
        promptKey: 'net_sales',
        token: 'invoice_share_normal_pct',
        value: nextInvoiceShare,
        expectedBusinessLabel: 'Invoice Sales Mix',
        expectedConfigText: 'Normal credit-customer mix',
        expectedPromptText: `invoice ≥${nextInvoiceShare}% of net is normal`,
      });
    } finally {
      await saveThresholdValues(request, 'net_sales', originals.net_sales);
    }
  });

  test('sales breakdown metadata is business-readable and updates the prompt preview', async ({ page, request }) => {
    const originals = {
      by_customer: await readThresholdValues(request, 'by_customer'),
    };
    const nextGoodPct = Math.max(0, Math.min(
      originals.by_customer.neutral_pct - 1,
      originals.by_customer.good_pct + 1,
    ));

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Customer concentration', 'by_customer');
      const configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Top Customer Share');
      await expect(configPanel).toContainText('Peak-season high-risk trigger');
      await expect(configPanel).not.toContainText('Top customer share of net sales');
      await expect(configPanel).not.toContainText('peak_season_bad_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Top customer share of net sales');

      await editPromptThreshold({
        page,
        request,
        search: 'Customer concentration',
        promptKey: 'by_customer',
        token: 'good_pct',
        value: nextGoodPct,
        expectedBusinessLabel: 'Top Customer Share',
        expectedConfigText: 'Peak-season high-risk trigger',
        expectedPromptText: `<${nextGoodPct}% = Good`,
      });
    } finally {
      await saveThresholdValues(request, 'by_customer', originals.by_customer);
    }
  });

  test('returns KPI metadata is business-readable and updates the prompt preview', async ({ page, request }) => {
    const originals = {
      rt_return_pct: await readThresholdValues(request, 'rt_return_pct'),
    };
    const nextHealthyPct = Math.max(0, Math.min(
      originals.rt_return_pct.concern_pct - 1,
      originals.rt_return_pct.healthy_pct + 1,
    ));

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Sales quality', 'rt_return_pct');
      const configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Return Value as Share of Net Sales');
      await expect(configPanel).toContainText('Healthy');
      await expect(configPanel).toContainText('Watch');
      await expect(configPanel).toContainText('Concern');
      await expect(configPanel).not.toContainText('Return-rate band');
      await expect(configPanel).not.toContainText('Healthy below');
      await expect(configPanel).not.toContainText('healthy_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Return-rate band');

      await editPromptThreshold({
        page,
        request,
        search: 'Sales quality',
        promptKey: 'rt_return_pct',
        token: 'healthy_pct',
        value: nextHealthyPct,
        expectedBusinessLabel: 'Return Value as Share of Net Sales',
        expectedConfigText: 'Return Value as Share of Net Sales',
        expectedPromptText: `<${nextHealthyPct}% = Healthy`,
      });
    } finally {
      await saveThresholdValues(request, 'rt_return_pct', originals.rt_return_pct);
    }
  });

  test('returns chart metadata is business-readable and updates the prompt preview', async ({ page, request }) => {
    const originals = {
      rt_product_bar: await readThresholdValues(request, 'rt_product_bar'),
    };
    const nextDiversifiedPct = Math.max(0, Math.min(
      originals.rt_product_bar.top_10_concentrated_pct - 1,
      originals.rt_product_bar.top_10_diversified_pct + 1,
    ));

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Item concentration', 'rt_product_bar');
      const configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Top Returns by Item: Item Concentration Rules');
      await expect(configPanel).toContainText('Single Item Share');
      await expect(configPanel).toContainText('Top 10 Item Share');
      await expect(configPanel).toContainText('Diversified return spread');
      await expect(configPanel).not.toContainText('Top 1 severe above');
      await expect(configPanel).not.toContainText('Return concentration');
      await expect(configPanel).not.toContainText('top_10_diversified_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Top 1 severe above');

      await editPromptThreshold({
        page,
        request,
        search: 'Item concentration',
        promptKey: 'rt_product_bar',
        token: 'top_10_diversified_pct',
        value: nextDiversifiedPct,
        expectedBusinessLabel: 'Top 10 Item Share',
        expectedConfigText: 'Diversified return spread',
        expectedPromptText: `<${nextDiversifiedPct}% = Diversified`,
      });
    } finally {
      await saveThresholdValues(request, 'rt_product_bar', originals.rt_product_bar);
    }
  });

  test('expenses KPI metadata is business-readable and updates the prompt preview', async ({ page, request }) => {
    const originals = {
      ex_cogs: await readThresholdValues(request, 'ex_cogs'),
    };
    const nextCogsConcernPct = originals.ex_cogs.concern_pct >= 100
      ? originals.ex_cogs.concern_pct - 1
      : originals.ex_cogs.concern_pct + 1;

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Total cost growth', 'ex_total_costs');
      let configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Total Costs: Cost Growth and Mix Rules');
      await expect(configPanel).toContainText('Total Cost Growth');
      await expect(configPanel).toContainText('Cost of Sales Mix');
      await expect(configPanel).toContainText('Operating-cost-dominated base');
      await expect(configPanel).not.toContainText('Cost YoY band');
      await expect(configPanel).not.toContainText('COGS typical minimum');
      await expect(configPanel).not.toContainText('cogs_typical_min_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Cost YoY band');

      await selectPromptBySearch(page, 'Cost of Sales benchmark', 'ex_cogs');
      configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Cost of Sales: Cost Share and Growth Rules');
      await expect(configPanel).toContainText('Cost of Sales Share of Total Costs');
      await expect(configPanel).toContainText('Cost of Sales Growth vs Sales');
      await expect(configPanel).toContainText('Review if sales are flat or declining');
      await expect(configPanel).not.toContainText('Margin pressure above');
      await expect(configPanel).not.toContainText('Concern above with flat sales');
      await expect(configPanel).not.toContainText('typical_min_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Margin pressure above');

      await selectPromptBySearch(page, 'Operating cost share', 'ex_opex');
      configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Operating Costs: Structural Cost Rules');
      await expect(configPanel).toContainText('Operating Cost Growth Discipline');
      await expect(configPanel).toContainText('Operating Costs Share of Total Costs');
      await expect(configPanel).toContainText('Balanced or Cost-of-Sales-led base');
      await expect(configPanel).not.toContainText('OpEx YoY');
      await expect(configPanel).not.toContainText('OpEx dominated above');
      await expect(configPanel).not.toContainText('healthy_below_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('OpEx dominated above');

      await selectPromptBySearch(page, 'Expense YoY', 'ex_yoy_costs');
      configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Total Cost YoY Movement');
      await expect(configPanel).toContainText('Severe cost growth');
      await expect(configPanel).not.toContainText('Cost YoY band');
      await expect(configPanel).not.toContainText('Healthy below');
      await expect(configPanel).not.toContainText('healthy_below_pct');

      await editPromptThreshold({
        page,
        request,
        search: 'Cost of Sales growth',
        promptKey: 'ex_cogs',
        token: 'concern_pct',
        value: nextCogsConcernPct,
        expectedBusinessLabel: 'Cost of Sales Growth vs Sales',
        expectedConfigText: 'Review if sales are flat or declining',
        expectedPromptText: `COGS YoY >${nextCogsConcernPct}% with flat/declining sales = Concern`,
      });
    } finally {
      await saveThresholdValues(request, 'ex_cogs', originals.ex_cogs);
    }
  });

  test('expenses chart metadata is business-readable and updates the prompt preview', async ({ page, request }) => {
    const originals = {
      ex_cost_trend: await readThresholdValues(request, 'ex_cost_trend'),
      ex_cost_composition: await readThresholdValues(request, 'ex_cost_composition'),
    };
    const nextPeriodYoySeverePct = originals.ex_cost_trend.period_yoy_severe_pct >= 100
      ? originals.ex_cost_trend.period_yoy_severe_pct - 1
      : originals.ex_cost_trend.period_yoy_severe_pct + 1;
    const nextMaterialDriftPp = originals.ex_cost_composition.material_drift_pp >= 100
      ? originals.ex_cost_composition.material_drift_pp - 1
      : originals.ex_cost_composition.material_drift_pp + 1;

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Monthly cost growth', 'ex_cost_trend');
      let configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Cost Trend: Monthly and Prior-Year Growth Rules');
      await expect(configPanel).toContainText('Monthly Cost Growth');
      await expect(configPanel).toContainText('Period vs Last Year Growth');
      await expect(configPanel).toContainText('Stable monthly cost movement');
      await expect(configPanel).not.toContainText('MoM concern above');
      await expect(configPanel).not.toContainText('Period YoY severe above');
      await expect(configPanel).not.toContainText('mom_concern_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('MoM concern above');

      const invalidMomSevere = Math.max(0, originals.ex_cost_trend.mom_concern_pct - 1);
      await page.getByTestId('threshold-input-mom_severe_pct').fill(String(invalidMomSevere));
      await expect(page.getByTestId('threshold-validation-error').first()).toContainText(
        'The monthly severe limit must be higher than the concern limit.',
      );
      await expect(configPanel).not.toContainText('MoM severe above');
      await page.getByRole('button', { name: 'Reset' }).click();

      await selectPromptBySearch(page, 'Cost composition chart', 'ex_cost_composition');
      configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Cost Composition: Cost Mix and Drift Rules');
      await expect(configPanel).toContainText('Cost of Sales Share of Total Costs');
      await expect(configPanel).toContainText('Typical fruit-distribution mix');
      await expect(configPanel).toContainText('Cost-of-sales-dominated margin pressure');
      await expect(configPanel).toContainText('Cost of Sales Share Drift');
      await expect(configPanel).toContainText('Material drift in either direction');
      await expect(configPanel).not.toContainText('COGS dominated above');
      await expect(configPanel).not.toContainText('COGS-dominated margin pressure');
      await expect(configPanel).not.toContainText('Material drift above');
      await expect(configPanel).not.toContainText('typical_min_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('COGS dominated above');

      await editPromptThreshold({
        page,
        request,
        search: 'Period YoY cost growth',
        promptKey: 'ex_cost_trend',
        token: 'period_yoy_severe_pct',
        value: nextPeriodYoySeverePct,
        expectedBusinessLabel: 'Period vs Last Year Growth',
        expectedConfigText: 'Severe prior-year increase',
        expectedPromptText: `Period YoY total >${nextPeriodYoySeverePct}% = Severe`,
      });

      await editPromptThreshold({
        page,
        request,
        search: 'Cost of Sales share drift',
        promptKey: 'ex_cost_composition',
        token: 'material_drift_pp',
        value: nextMaterialDriftPp,
        expectedBusinessLabel: 'Cost of Sales Share Drift',
        expectedConfigText: 'Material drift in either direction',
        expectedPromptText: `COGS drift >+${nextMaterialDriftPp}pp with flat sales = Margin compression`,
      });
    } finally {
      await saveThresholdValues(request, 'ex_cost_trend', originals.ex_cost_trend);
      await saveThresholdValues(request, 'ex_cost_composition', originals.ex_cost_composition);
    }
  });

  test('expenses table metadata is business-readable and updates the prompt preview', async ({ page, request }) => {
    const originals = {
      ex_cogs_table: await readThresholdValues(request, 'ex_cogs_table'),
      ex_opex_table: await readThresholdValues(request, 'ex_opex_table'),
    };
    const nextCogsTop3ConcentratedPct = originals.ex_cogs_table.top_3_concentrated_pct >= 100
      ? originals.ex_cogs_table.top_3_concentrated_pct - 1
      : originals.ex_cogs_table.top_3_concentrated_pct + 1;
    const nextOpexAccountRiskPct = originals.ex_opex_table.top_1_account_risk_pct >= 100
      ? originals.ex_opex_table.top_1_account_risk_pct - 1
      : originals.ex_opex_table.top_1_account_risk_pct + 1;

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Largest COGS account', 'ex_cogs_table');
      let configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Cost of Sales Breakdown: Account Concentration Rules');
      await expect(configPanel).toContainText('Largest COGS Account Share');
      await expect(configPanel).toContainText('Top-Three COGS Account Share');
      await expect(configPanel).toContainText('COGS Account Surface');
      await expect(configPanel).toContainText('Diversified account base');
      await expect(configPanel).toContainText('Normal surface');
      await expect(configPanel).not.toContainText('COGS concentration');
      await expect(configPanel).not.toContainText('Top 1 severe above');
      await expect(configPanel).not.toContainText('Top 3 concentrated above');
      await expect(configPanel).not.toContainText('Thin surface below');
      await expect(configPanel).not.toContainText('top_1_severe_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Top 1 severe above');

      const invalidTop1Severe = Math.max(0, originals.ex_cogs_table.top_1_concentrated_pct - 1);
      await page.getByTestId('threshold-input-top_1_severe_pct').fill(String(invalidTop1Severe));
      await expect(page.getByTestId('threshold-validation-error').first()).toContainText(
        'The severe single-account limit must be higher than the concentrated account limit.',
      );
      await expect(configPanel).not.toContainText('Top 1 severe above');
      await page.getByRole('button', { name: 'Reset' }).click();

      await selectPromptBySearch(page, 'Operating cost categories', 'ex_opex_table');
      configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Operating Costs Breakdown: Category and Account Concentration Rules');
      await expect(configPanel).toContainText('Operating Cost Category Share');
      await expect(configPanel).toContainText('Operating Cost Account Share');
      await expect(configPanel).toContainText('Dominant cost center');
      await expect(configPanel).toContainText('Normal single-account exposure');
      await expect(configPanel).not.toContainText('Category concentration');
      await expect(configPanel).not.toContainText('Top category dominant above');
      await expect(configPanel).not.toContainText('Top 1 account risk above');
      await expect(configPanel).not.toContainText('top_category_dominant_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Top category dominant above');

      await editPromptThreshold({
        page,
        request,
        search: 'Top-three COGS accounts',
        promptKey: 'ex_cogs_table',
        token: 'top_3_concentrated_pct',
        value: nextCogsTop3ConcentratedPct,
        expectedBusinessLabel: 'Top-Three COGS Account Share',
        expectedConfigText: 'Concentrated top-three exposure',
        expectedPromptText: `Top 3 >${nextCogsTop3ConcentratedPct}% = Concentrated`,
      });

      await editPromptThreshold({
        page,
        request,
        search: 'Single-account OpEx risk',
        promptKey: 'ex_opex_table',
        token: 'top_1_account_risk_pct',
        value: nextOpexAccountRiskPct,
        expectedBusinessLabel: 'Operating Cost Account Share',
        expectedConfigText: 'Single-account risk',
        expectedPromptText: `Top 1 account >${nextOpexAccountRiskPct}% of total OpEx = Single-account risk`,
      });
    } finally {
      await saveThresholdValues(request, 'ex_cogs_table', originals.ex_cogs_table);
      await saveThresholdValues(request, 'ex_opex_table', originals.ex_opex_table);
    }
  });

  test('customer margin KPI metadata is business-readable and updates the prompt preview', async ({ page, request }) => {
    const originals = {
      cm_margin_pct: await readThresholdValues(request, 'cm_margin_pct'),
    };
    const nextNeutralPct = Math.max(0, Math.min(
      originals.cm_margin_pct.good_pct - 1,
      originals.cm_margin_pct.neutral_pct + 1,
    ));

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Gross margin quality', 'cm_margin_pct');
      const configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Gross Margin Quality');
      await expect(configPanel).toContainText('Bad margin');
      await expect(configPanel).toContainText('Neutral margin');
      await expect(configPanel).toContainText('Good margin');
      await expect(configPanel).not.toContainText('Gross margin band');
      await expect(configPanel).not.toContainText('Good at or above');
      await expect(configPanel).not.toContainText('neutral_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Gross margin band');

      await editPromptThreshold({
        page,
        request,
        search: 'Gross margin quality',
        promptKey: 'cm_margin_pct',
        token: 'neutral_pct',
        value: nextNeutralPct,
        expectedBusinessLabel: 'Gross Margin Quality',
        expectedConfigText: 'Bad margin',
        expectedPromptText: `${nextNeutralPct}–${originals.cm_margin_pct.good_pct}% = Neutral`,
      });
    } finally {
      await saveThresholdValues(request, 'cm_margin_pct', originals.cm_margin_pct);
    }
  });

  test('customer margin chart metadata is business-readable and updates the prompt preview', async ({ page, request }) => {
    const originals = {
      cm_margin_distribution: await readThresholdValues(request, 'cm_margin_distribution'),
    };
    const nextSubTenPct = originals.cm_margin_distribution.sub_10_bad_pct >= 100
      ? originals.cm_margin_distribution.sub_10_bad_pct - 1
      : originals.cm_margin_distribution.sub_10_bad_pct + 1;

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Portfolio margin shape', 'cm_margin_distribution');
      const configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Customer Margin Distribution: Portfolio Margin Shape Rules');
      await expect(configPanel).toContainText('Thin-Margin Customer Share');
      await expect(configPanel).toContainText('Premium-Margin Customer Share');
      await expect(configPanel).toContainText('Controlled thin-margin exposure');
      await expect(configPanel).not.toContainText('Portfolio shape');
      await expect(configPanel).not.toContainText('Bad if sub-10% share above');
      await expect(configPanel).not.toContainText('sub_10_bad_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Bad if sub-10% share above');

      await editPromptThreshold({
        page,
        request,
        search: 'Portfolio margin shape',
        promptKey: 'cm_margin_distribution',
        token: 'sub_10_bad_pct',
        value: nextSubTenPct,
        expectedBusinessLabel: 'Thin-Margin Customer Share',
        expectedConfigText: 'Thin-margin portfolio',
        expectedPromptText: `>${nextSubTenPct}% in sub-10% bands = Bad`,
      });
    } finally {
      await saveThresholdValues(request, 'cm_margin_distribution', originals.cm_margin_distribution);
    }
  });

  test('supplier KPI metadata is business-readable and updates the prompt preview', async ({ page, request }) => {
    const originals = {
      sp_margin_pct: await readThresholdValues(request, 'sp_margin_pct'),
    };
    const nextNeutralPct = Math.max(0, Math.min(
      originals.sp_margin_pct.good_pct - 1,
      originals.sp_margin_pct.neutral_pct + 1,
    ));

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Supplier margin quality', 'sp_margin_pct');
      const configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Supplier Margin Percentage: Gross Margin Rules');
      await expect(configPanel).toContainText('Gross Margin Quality');
      await expect(configPanel).toContainText('Margin Percentage Decline');
      await expect(configPanel).toContainText('Investigation flag');
      await expect(configPanel).not.toContainText('Gross margin band');
      await expect(configPanel).not.toContainText('Good at or above');
      await expect(configPanel).not.toContainText('investigate_drop_pp');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Gross margin band');
      await expect(page.getByTestId('prompt-text-body')).toContainText(`Drop ≥${originals.sp_margin_pct.investigate_drop_pp}% vs prior`);
      await expect(page.getByTestId('prompt-text-body')).not.toContainText('pp vs prior');

      await editPromptThreshold({
        page,
        request,
        search: 'Supplier margin quality',
        promptKey: 'sp_margin_pct',
        token: 'neutral_pct',
        value: nextNeutralPct,
        expectedBusinessLabel: 'Gross Margin Quality',
        expectedConfigText: 'Bad margin',
        expectedPromptText: `${nextNeutralPct}–${originals.sp_margin_pct.good_pct}% = Neutral`,
      });
    } finally {
      await saveThresholdValues(request, 'sp_margin_pct', originals.sp_margin_pct);
    }
  });

  test('supplier chart metadata is business-readable and updates the prompt preview', async ({ page, request }) => {
    const originals = {
      sp_margin_distribution: await readThresholdValues(request, 'sp_margin_distribution'),
    };
    const nextSubTenPct = originals.sp_margin_distribution.sub_10_bad_pct >= 100
      ? originals.sp_margin_distribution.sub_10_bad_pct - 1
      : originals.sp_margin_distribution.sub_10_bad_pct + 1;

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Supplier margin shape', 'sp_margin_distribution');
      const configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Supplier Margin Distribution: Margin Shape Rules');
      await expect(configPanel).toContainText('Thin-Margin Supplier and Item Share');
      await expect(configPanel).toContainText('Premium-Margin Supplier and Item Share');
      await expect(configPanel).toContainText('Controlled thin-margin exposure');
      await expect(configPanel).not.toContainText('Portfolio shape');
      await expect(configPanel).not.toContainText('Bad if sub-10% share above');
      await expect(configPanel).not.toContainText('sub_10_bad_pct');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Bad if sub-10% share above');

      await editPromptThreshold({
        page,
        request,
        search: 'Supplier margin shape',
        promptKey: 'sp_margin_distribution',
        token: 'sub_10_bad_pct',
        value: nextSubTenPct,
        expectedBusinessLabel: 'Thin-Margin Supplier and Item Share',
        expectedConfigText: 'Thin-margin sourcing base',
        expectedPromptText: `>${nextSubTenPct}% in sub-10% bands = Bad`,
      });
    } finally {
      await saveThresholdValues(request, 'sp_margin_distribution', originals.sp_margin_distribution);
    }
  });

  test('supplier breakdown metadata is business-readable and updates the prompt preview', async ({ page, request }) => {
    const originals = {
      sm_item_pricing: await readThresholdValues(request, 'sm_item_pricing'),
    };
    const nextSpreadPp = originals.sm_item_pricing.arbitrage_spread_pp >= 100
      ? originals.sm_item_pricing.arbitrage_spread_pp - 1
      : originals.sm_item_pricing.arbitrage_spread_pp + 1;

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Supplier profit concentration', 'sm_top_bottom');
      let configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Top and Bottom Suppliers and Items: Profit Concentration Rules');
      await expect(configPanel).toContainText('Top Supplier Profit Share');
      await expect(configPanel).toContainText('Top 10 Supplier Profit Share');
      await expect(configPanel).toContainText('Loss-Making Supplier and Item Floor');
      await expect(configPanel).toContainText('Diversified sourcing profit spread');
      await expect(configPanel).not.toContainText('Supplier concentration');
      await expect(configPanel).not.toContainText('Top 1 bad above');
      await expect(configPanel).not.toContainText('loss_profit_rm');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Top 1 bad above');

      await selectPromptBySearch(page, 'Supplier revenue concentration', 'sm_supplier_table');
      configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Supplier Analysis Table: Revenue Concentration and Margin Quality Rules');
      await expect(configPanel).toContainText('Top 10 Supplier Revenue Share');
      await expect(configPanel).toContainText('Supplier Margin Quality');
      await expect(configPanel).toContainText('Critical revenue trigger');
      await expect(configPanel).not.toContainText('Revenue concentration');
      await expect(configPanel).not.toContainText('Neutral lower bound');
      await expect(configPanel).not.toContainText('critical_revenue_rm');

      await selectPromptBySearch(page, 'Catalog margin quality', 'sm_price_scatter');
      configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Purchase vs Selling Price: Catalog Margin Rules');
      await expect(configPanel).toContainText('Catalog Margin Shape');
      await expect(configPanel).toContainText('Controlled thin-margin catalog');
      await expect(configPanel).not.toContainText('Catalog quality');
      await expect(configPanel).not.toContainText('Thin-margin universe share above');
      await expect(configPanel).not.toContainText('thin_universe_bad_pct');

      await editPromptThreshold({
        page,
        request,
        search: 'Anchor item procurement',
        promptKey: 'sm_item_pricing',
        token: 'arbitrage_spread_pp',
        value: nextSpreadPp,
        expectedBusinessLabel: 'Cross-Supplier Margin Spread',
        expectedConfigText: 'Significant arbitrage opportunity',
        expectedPromptText: `Margin spread >${nextSpreadPp}pp = Significant arbitrage opportunity`,
      });
    } finally {
      await saveThresholdValues(request, 'sm_item_pricing', originals.sm_item_pricing);
    }
  });

  test('admin edits thresholds for simple and complex prompts', async ({ page, request }) => {
    const originals = {
      avg_collection_days: await readThresholdValues(request, 'avg_collection_days'),
      collection_rate: await readThresholdValues(request, 'collection_rate'),
      bs_statement: await readThresholdValues(request, 'bs_statement'),
      ex_top_expenses: await readThresholdValues(request, 'ex_top_expenses'),
    };

    await setAdminRole(page);
    await openAdminConfig(page);

    try {
      await selectPromptBySearch(page, 'Top Expenses', 'ex_top_expenses');
      const configPanel = page.getByTestId('configuration-panel');
      await expect(configPanel).toContainText('Top Expenses: Cost Concentration Rules');
      await expect(configPanel).toContainText('Largest Account Share');
      await expect(configPanel).toContainText('Top 10 Account Share');
      await expect(configPanel).not.toContainText('Top 1 severe above');
      await expect(configPanel).not.toContainText('Composite rule');
      await expect(configPanel).not.toContainText('Severe single-account risk');
      await expect(page.getByTestId('prompt-tree')).not.toContainText('Top 1 severe above');

      const invalidTop1Severe = Math.max(0, originals.ex_top_expenses.top_1_concentrated_pct - 1);
      await page.getByTestId('threshold-input-top_1_severe_pct').fill(String(invalidTop1Severe));
      await expect(page.getByTestId('threshold-validation-error').first()).toContainText(
        'The severe limit must be higher than the concentrated limit.',
      );
      await expect(configPanel).not.toContainText('Top 1 severe above');
      await page.getByRole('button', { name: 'Reset' }).click();

      await editPromptThreshold({
        page,
        request,
        search: 'Avg Collection Days',
        promptKey: 'avg_collection_days',
        token: 'good_days',
        value: 31,
        expectedBusinessLabel: 'Average Payment Speed Rules',
        expectedConfigText: 'Critical',
        expectedPromptText: 'Good: 0-31 days',
      });

      const collectionWarningPct = Math.max(0, originals.collection_rate.good_pct - 1);
      await editPromptThreshold({
        page,
        request,
        search: 'Cash conversion',
        promptKey: 'collection_rate',
        token: 'warning_pct',
        value: collectionWarningPct,
        expectedBusinessLabel: 'Cash Conversion Rate',
        expectedConfigText: 'Critical',
        expectedPromptText: `Warning: ≥${collectionWarningPct}% to below ${originals.collection_rate.good_pct}%`,
      });

      await editPromptThreshold({
        page,
        request,
        search: 'Balance Sheet Statement',
        promptKey: 'bs_statement',
        token: 'thin_below_ratio',
        value: 1.3,
        expectedBusinessLabel: 'Balance Sheet: Current Ratio Liquidity Rules',
        expectedConfigText: 'Strong',
        expectedPromptText: 'Thin: >1.0 to 1.3 ratio.',
      });
      await expect(page.getByTestId('configuration-panel')).toContainText('Line-Item YoY Movement Rules');
      await expect(page.getByTestId('configuration-panel')).toContainText('Debt-To-Equity Rules');
      await expect(page.getByTestId('configuration-panel')).toContainText('Equity Ratio Rules');
      await expect(page.getByTestId('prompt-text-body')).toContainText('Full Balance Sheet Statement');
      await expect(page.getByTestId('prompt-text-body')).not.toContainText('Full BS');
      await expect(page.getByTestId('prompt-text-body')).toContainText('Debt-to-Equity Leverage Rules');
      await expect(page.getByTestId('prompt-text-body')).toContainText('Formula: Total Liabilities ÷ Total Equity.');
      await expect(page.getByTestId('prompt-text-body')).toContainText('Equity Ratio Solvency Rules');
      await expect(page.getByTestId('prompt-text-body')).toContainText('Formula: Total Equity ÷ Total Assets × 100.');

      await editPromptThreshold({
        page,
        request,
        search: 'Largest account share',
        promptKey: 'ex_top_expenses',
        token: 'top_1_severe_pct',
        value: 31,
        expectedBusinessLabel: 'Largest Account Share',
        expectedConfigText: 'Spread',
        expectedPromptText: 'Largest account share >31% = Severe',
      });

      const componentRes = await request.get('/api/ai-insight/component/expense_overview/ex_top_expenses');
      expect(componentRes.status()).toBe(200);
      const componentBody = await componentRes.json() as {
        componentInfo?: { indicator?: string; about?: string };
      };
      expect(componentBody.componentInfo?.indicator).toContain('Top 1 > 31%');
      expect(componentBody.componentInfo?.about).toContain('> 31% of total cost');

      await page.screenshot({ path: 'test-results/ai-insight-config-client-ready-thresholds.png', fullPage: true });
    } finally {
      await saveThresholdValues(request, 'avg_collection_days', originals.avg_collection_days);
      await saveThresholdValues(request, 'collection_rate', originals.collection_rate);
      await saveThresholdValues(request, 'bs_statement', originals.bs_statement);
      await saveThresholdValues(request, 'ex_top_expenses', originals.ex_top_expenses);
    }
  });
});
