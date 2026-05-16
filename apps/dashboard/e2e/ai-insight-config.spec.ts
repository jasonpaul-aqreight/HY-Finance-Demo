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
