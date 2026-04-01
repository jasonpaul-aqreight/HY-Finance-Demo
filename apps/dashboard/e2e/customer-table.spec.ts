import { test, expect } from '@playwright/test';

test.describe('Customer Margin Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/customer-margin');
    // Wait for the customer table to load
    await page.waitForSelector('table tbody tr', { timeout: 30_000 });
  });

  test('renders table with Trend column header', async ({ page }) => {
    // The Customer Analysis table is inside a Card with "Customer Analysis" title
    const card = page.locator('text=Customer Analysis').locator('..').locator('..');
    const table = card.locator('table').first();
    await expect(table).toBeVisible({ timeout: 15_000 });
    const headers = table.locator('thead th');
    const headerTexts = await headers.allTextContents();
    expect(headerTexts).toContain('Trend');
    expect(headerTexts.some(h => h.includes('Revenue'))).toBeTruthy();
    expect(headerTexts.some(h => h.includes('Margin %'))).toBeTruthy();
  });

  test('trend indicators are visible next to sparklines', async ({ page }) => {
    // Wait for sparkline data and trend arrows to load
    await page.waitForTimeout(3000);
    // Look for trend arrows in the Trend column cells (last td in each row)
    const trendIndicators = page.locator('table tbody tr td:last-child span');
    const count = await trendIndicators.count();
    expect(count).toBeGreaterThan(0);
    const texts = await trendIndicators.allTextContents();
    const validIndicators = texts.filter(t => ['▲', '▼', '—'].includes(t));
    expect(validIndicators.length).toBeGreaterThan(0);
  });

  test('pagination controls work', async ({ page }) => {
    const pageInfo = page.locator('text=/Page \\d+ of \\d+/');
    await expect(pageInfo).toBeVisible();

    const nextBtn = page.locator('button', { hasText: 'Next' });
    await expect(nextBtn).toBeVisible();
  });
});
