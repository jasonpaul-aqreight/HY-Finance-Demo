import { test, expect } from '@playwright/test';

async function setAdminRole(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('user-role', 'admin'));
}

async function openAdminConfig(page: import('@playwright/test').Page) {
  await page.goto('/admin/ai-insight-config');
  await page.waitForSelector('[data-testid="ai-insight-config-dashboard"]', { timeout: 30_000 });
}

async function expandPage(page: import('@playwright/test').Page, dataPage: string) {
  await page.locator(`[data-testid="prompt-tree-page"][data-page="${dataPage}"]`).click();
}

async function clickLeaf(page: import('@playwright/test').Page, promptKey: string) {
  await page.locator(`[data-testid="prompt-tree-leaf"][data-prompt-key="${promptKey}"]`).click();
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
  });

  test('admin config page has no feedback, version, router, editor, or guidance UI', async ({ page }) => {
    await setAdminRole(page);
    await openAdminConfig(page);

    const dashboard = page.getByTestId('ai-insight-config-dashboard');
    await expect(dashboard).toBeVisible();
    await expect(page.getByTestId('prompt-tree')).toBeVisible();
    await expect(page.getByTestId('prompt-text-panel')).toBeVisible();
    await expect(page.getByTestId('version-panel')).toHaveCount(0);
    await expect(page.getByTestId('feedback-list')).toHaveCount(0);

    await expect(dashboard.getByText('Feedback', { exact: true })).toHaveCount(0);
    await expect(dashboard.getByText('Version', { exact: true })).toHaveCount(0);
    await expect(dashboard.getByText('Guidance', { exact: true })).toHaveCount(0);
    await expect(dashboard.getByText('Feedback Router', { exact: true })).toHaveCount(0);
    await expect(dashboard.getByText('Surgical Editor', { exact: true })).toHaveCount(0);
  });

  test('selected DB prompt audit changes are preserved in code-backed prompt text', async ({ page }) => {
    await setAdminRole(page);
    await openAdminConfig(page);

    await expandPage(page, 'Sales');
    await clickLeaf(page, 'by_customer');
    await expect(page.getByTestId('prompt-text-body')).toContainText('shift to >30% during peak-season months');

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
});
