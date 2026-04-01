import { test, expect } from '@playwright/test';

test.describe('Supplier Analysis Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/supplier-margin');
    // Wait for table to load (skeleton disappears, table rows appear)
    await page.waitForSelector('table tbody tr', { timeout: 30_000 });
  });

  test('renders table with Trend column header', async ({ page }) => {
    const headers = page.locator('table thead th');
    const headerTexts = await headers.allTextContents();
    expect(headerTexts).toContain('Trend');
    // Verify other key headers still present
    expect(headerTexts.some(h => h.includes('Revenue'))).toBeTruthy();
    expect(headerTexts.some(h => h.includes('Margin %'))).toBeTruthy();
    expect(headerTexts.some(h => h.includes('Profit'))).toBeTruthy();
  });

  test('sparkline SVG elements render in table rows', async ({ page }) => {
    // Recharts renders SVG with .recharts-wrapper class
    const sparklines = page.locator('table tbody .recharts-wrapper');
    // Wait for at least one sparkline to appear (they load async)
    await expect(sparklines.first()).toBeVisible({ timeout: 15_000 });
    const count = await sparklines.count();
    expect(count).toBeGreaterThan(0);
  });

  test('trend indicators are visible', async ({ page }) => {
    // Wait for trend arrows/dashes to appear
    await page.waitForTimeout(2000); // allow sparkline data to load
    const trendIndicators = page.locator('table tbody tr td:nth-child(9) span');
    const count = await trendIndicators.count();
    expect(count).toBeGreaterThan(0);
    // Verify at least one has arrow or dash text
    const texts = await trendIndicators.allTextContents();
    const validIndicators = texts.filter(t => ['▲', '▼', '—'].includes(t));
    expect(validIndicators.length).toBeGreaterThan(0);
  });

  test('sorting by Revenue works', async ({ page }) => {
    // Get first supplier name before sort
    const firstRowName = await page.locator('table tbody tr:first-child td:nth-child(3)').textContent();

    // Click Revenue header twice (already sorted desc, click for asc)
    const revenueHeader = page.locator('table thead th', { hasText: 'Revenue' });
    await revenueHeader.click();
    await page.waitForTimeout(500);

    // First row should change after sort direction change
    const newFirstRowName = await page.locator('table tbody tr:first-child td:nth-child(3)').textContent();
    expect(newFirstRowName).not.toBe(firstRowName);
  });

  test('search filtering works', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Get initial count from pagination text
    const paginationText = await page.locator('text=/\\d+ suppliers/').textContent();
    const initialCount = parseInt(paginationText?.match(/(\d+) suppliers/)?.[1] ?? '0');

    // Type a search term
    await searchInput.fill('a');
    await page.waitForTimeout(300);

    // Count should be <= initial (filtered)
    const filteredText = await page.locator('text=/\\d+ suppliers/').textContent();
    const filteredCount = parseInt(filteredText?.match(/(\d+) suppliers/)?.[1] ?? '0');
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('pagination controls are present', async ({ page }) => {
    // Should show page info and buttons
    const pageInfo = page.locator('text=/page \\d+ of \\d+/');
    await expect(pageInfo).toBeVisible();

    const prevBtn = page.locator('button', { hasText: 'Prev' });
    const nextBtn = page.locator('button', { hasText: 'Next' });
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();
  });
});
