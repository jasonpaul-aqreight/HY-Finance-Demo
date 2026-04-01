import { test, expect } from '@playwright/test';

function trackSalesApiFailures(page: import('@playwright/test').Page) {
  const failures: Array<{ url: string; status: number }> = [];

  page.on('response', (response) => {
    if (response.status() >= 500 && response.url().includes('/api/sales/')) {
      failures.push({
        url: response.url(),
        status: response.status(),
      });
    }
  });

  return failures;
}

test.describe('Sales Dashboard', () => {
  test('renders customer sales breakdown without server errors', async ({ page }) => {
    const failures = trackSalesApiFailures(page);

    await page.goto('/sales');
    await expect(page.getByRole('heading', { name: 'Sales Report' })).toBeVisible();
    await expect(page.getByText(/Table \(\d+ rows\)/)).not.toContainText('Table (0 rows)', {
      timeout: 30_000,
    });
    await expect(page.getByText('No data available')).toHaveCount(0);
    expect(failures).toEqual([]);
  });

  test('switches breakdown groups without hidden 500s', async ({ page }) => {
    const failures = trackSalesApiFailures(page);

    await page.goto('/sales');
    const groupSelect = page.locator('[role="combobox"]').first();

    for (const group of ['Fruit', 'Sales Agent', 'Outlet']) {
      await groupSelect.click();
      await page.getByRole('option', { name: group }).click();
      await expect(page.getByText(/Table \(\d+ rows\)/)).not.toContainText('Table (0 rows)', {
        timeout: 30_000,
      });
    }

    expect(failures).toEqual([]);
  });
});
