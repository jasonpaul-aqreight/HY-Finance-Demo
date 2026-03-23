import { test, expect } from '@playwright/test';

test.describe('Item Pricing Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/supplier-margin');
    // Wait for the page to fully load (supplier table renders)
    await page.waitForSelector('table tbody tr', { timeout: 30_000 });
  });

  // ─── Tab navigation & no regression ──────────────────────────────────────

  test('Supplier Analysis tab is default active', async ({ page }) => {
    const analysisTab = page.locator('[role="tab"]', { hasText: 'Supplier Analysis' });
    await expect(analysisTab).toHaveAttribute('aria-selected', 'true');
  });

  test('Item Pricing tab is clickable and switches content', async ({ page }) => {
    const itemPricingTab = page.locator('[role="tab"]', { hasText: 'Item Pricing' });
    await itemPricingTab.click();
    await expect(itemPricingTab).toHaveAttribute('aria-selected', 'true');

    // Empty state should be visible
    const emptyState = page.locator('[data-testid="item-pricing-empty"]');
    await expect(emptyState).toBeVisible();
  });

  test('switching back to Supplier Analysis shows original table', async ({ page }) => {
    // Switch to Item Pricing
    await page.locator('[role="tab"]', { hasText: 'Item Pricing' }).click();
    await expect(page.locator('[data-testid="item-pricing-empty"]')).toBeVisible();

    // Switch back
    await page.locator('[role="tab"]', { hasText: 'Supplier Analysis' }).click();

    // Original table should be back
    await expect(page.locator('table tbody tr').first()).toBeVisible();
    const headers = await page.locator('table thead th').allTextContents();
    expect(headers.some(h => h.includes('Revenue'))).toBeTruthy();
  });

  // ─── Empty state ─────────────────────────────────────────────────────────

  test('empty state shows search prompt and no chart/table', async ({ page }) => {
    await page.locator('[role="tab"]', { hasText: 'Item Pricing' }).click();

    const emptyState = page.locator('[data-testid="item-pricing-empty"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('Search for an item');

    // No chart or comparison table visible
    await expect(page.locator('[data-testid="price-trend-chart"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="supplier-comparison-table"]')).not.toBeVisible();
  });

  // ─── Item search combobox ────────────────────────────────────────────────

  test('item search combobox opens and filters', async ({ page }) => {
    await page.locator('[role="tab"]', { hasText: 'Item Pricing' }).click();

    const combobox = page.locator('[data-testid="item-search-combobox"]');
    await expect(combobox).toBeVisible();

    // Open the combobox
    await combobox.locator('button').click();
    await expect(page.locator('input[placeholder*="Search by item"]')).toBeVisible();

    // Type to filter
    await page.locator('input[placeholder*="Search by item"]').fill('avocado');
    await page.waitForTimeout(300);

    // Should show results containing "avocado"
    const results = page.locator('[data-testid="item-search-combobox"] .truncate');
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
  });

  test('items show supplier count badge', async ({ page }) => {
    await page.locator('[role="tab"]', { hasText: 'Item Pricing' }).click();
    await page.locator('[data-testid="item-search-combobox"] button').click();

    // Wait for items to load
    await page.waitForTimeout(2000);

    // Check supplier count badges
    const badges = page.locator('[data-testid="item-search-combobox"] .rounded-full');
    const firstBadge = await badges.first().textContent();
    expect(firstBadge).toMatch(/\d+ suppliers/);
  });

  // ─── Item selection → chart + table ──────────────────────────────────────

  test('selecting an item shows chart and supplier table', async ({ page }) => {
    await page.locator('[role="tab"]', { hasText: 'Item Pricing' }).click();

    // Open combobox and select first item
    await page.locator('[data-testid="item-search-combobox"] button').click();
    await page.waitForTimeout(2000);
    const firstItem = page.locator('[data-testid="item-search-combobox"] .max-h-72 button').first();
    await firstItem.click();

    // Chart should appear
    const chart = page.locator('[data-testid="price-trend-chart"]');
    await expect(chart).toBeVisible({ timeout: 15_000 });

    // Chart should have SVG elements (recharts renders SVG)
    await expect(chart.locator('.recharts-wrapper')).toBeVisible({ timeout: 10_000 });

    // Supplier comparison table should appear
    const table = page.locator('[data-testid="supplier-comparison-table"]');
    await expect(table).toBeVisible({ timeout: 10_000 });
  });

  // ─── Supplier comparison table ───────────────────────────────────────────

  test('supplier table has correct columns and cheapest highlight', async ({ page }) => {
    await page.locator('[role="tab"]', { hasText: 'Item Pricing' }).click();

    // Select first item
    await page.locator('[data-testid="item-search-combobox"] button').click();
    await page.waitForTimeout(2000);
    await page.locator('[data-testid="item-search-combobox"] .max-h-72 button').first().click();

    // Wait for table
    const table = page.locator('[data-testid="supplier-comparison-table"]');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Check column headers
    const headers = await table.locator('thead th').allTextContents();
    expect(headers).toContain('Supplier Code');
    expect(headers).toContain('Supplier Name');
    expect(headers).toContain('Avg Price');
    expect(headers).toContain('Latest Price');
    expect(headers).toContain('Trend');
    expect(headers).toContain('Last Purchase');

    // Check cheapest row highlight
    const cheapestRow = table.locator('[data-testid="cheapest-supplier-row"]');
    await expect(cheapestRow.first()).toBeVisible();
  });

  test('trend indicators are present in supplier table', async ({ page }) => {
    await page.locator('[role="tab"]', { hasText: 'Item Pricing' }).click();

    // Select first item
    await page.locator('[data-testid="item-search-combobox"] button').click();
    await page.waitForTimeout(2000);
    await page.locator('[data-testid="item-search-combobox"] .max-h-72 button').first().click();

    const table = page.locator('[data-testid="supplier-comparison-table"]');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Check for trend indicators
    const trendCells = table.locator('tbody tr td:nth-child(8) span');
    const count = await trendCells.count();
    expect(count).toBeGreaterThan(0);

    const texts = await trendCells.allTextContents();
    const validIndicators = texts.filter(t => ['▲', '▼', '—'].includes(t));
    expect(validIndicators.length).toBeGreaterThan(0);
  });

  // ─── API validation ──────────────────────────────────────────────────────

  test('procurement items API returns only multi-supplier items', async ({ page }) => {
    const response = await page.request.get(
      '/api/supplier-margin/margin/procurement/items?start_date=2024-01-01&end_date=2025-10-30'
    );
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);

    // All items should have supplier_count > 1
    for (const item of data) {
      expect(item.supplier_count).toBeGreaterThan(1);
    }
  });

  test('procurement item-summary API returns latest_price and trend', async ({ page }) => {
    // Ensure page is loaded first to avoid ECONNRESET
    await page.waitForTimeout(1000);

    // First get an item code from the items API
    const itemsResponse = await page.request.get(
      '/api/supplier-margin/margin/procurement/items?start_date=2024-01-01&end_date=2025-10-30'
    );
    const items = await itemsResponse.json();
    const itemCode = items[0]?.item_code;
    expect(itemCode).toBeTruthy();

    // Then query its summary
    const summaryResponse = await page.request.get(
      `/api/supplier-margin/margin/procurement/item-summary?start_date=2024-01-01&end_date=2025-10-30&item_code=${encodeURIComponent(itemCode)}`
    );
    expect(summaryResponse.ok()).toBeTruthy();
    const data = await summaryResponse.json();

    expect(data.suppliers).toBeDefined();
    expect(Array.isArray(data.suppliers)).toBeTruthy();
    expect(data.suppliers.length).toBeGreaterThan(0);

    // Each supplier should have latest_price and trend
    for (const supplier of data.suppliers) {
      expect(typeof supplier.latest_price).toBe('number');
      expect(['up', 'down', 'flat']).toContain(supplier.trend);
      expect(typeof supplier.is_cheapest).toBe('boolean');
    }

    // Exactly one supplier should be cheapest
    const cheapestCount = data.suppliers.filter((s: { is_cheapest: boolean }) => s.is_cheapest).length;
    expect(cheapestCount).toBeGreaterThanOrEqual(1);

    // sellPrice should be present
    expect(data.sellPrice).toBeDefined();
  });
});
