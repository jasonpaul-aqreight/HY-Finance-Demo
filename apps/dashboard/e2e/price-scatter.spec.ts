import { test, expect } from '@playwright/test';

test.describe('Purchase vs Selling Price Scatter Chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/supplier-margin');
    await page.waitForSelector('text=Purchase vs Selling Price', { timeout: 30_000 });
    // Wait for data to load — count text with non-zero total
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="scatter-count"]');
      if (!el) return false;
      const match = el.textContent?.match(/of (\d+) items/);
      return match && parseInt(match[1]) > 0;
    }, { timeout: 20_000 });
  });

  test('renders scatter chart with dots', async ({ page }) => {
    const scatterDots = page.locator('.recharts-scatter .recharts-scatter-symbol');
    await expect(scatterDots.first()).toBeVisible({ timeout: 10_000 });
    const count = await scatterDots.count();
    expect(count).toBeGreaterThan(0);
  });

  test('axis labels do not have excessive decimals', async ({ page }) => {
    const xTicks = page.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value');
    const xTexts = await xTicks.allTextContents();
    for (const t of xTexts) {
      expect(t).toMatch(/^RM\d+$/);
    }

    const yTicks = page.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value');
    const yTexts = await yTicks.allTextContents();
    for (const t of yTexts) {
      expect(t).toMatch(/^RM\d+$/);
    }
  });

  test('supplier dropdown filters items', async ({ page }) => {
    // Get initial count
    const countEl = page.locator('[data-testid="scatter-count"]');
    const initialText = await countEl.textContent();
    const totalMatch = initialText?.match(/of (\d+) items/);
    const total = parseInt(totalMatch?.[1] ?? '0');
    expect(total).toBeGreaterThan(0);

    // Open supplier dropdown and wait for options to populate
    const supplierCombo = page.locator('[data-testid="scatter-supplier-filter"]');
    await supplierCombo.locator('button').first().click();
    // Wait for dropdown options to appear (dimensions API may need to load)
    await expect(supplierCombo.locator('.max-h-60 button').first()).toBeVisible({ timeout: 10_000 });

    // Search for a known top supplier to ensure results
    const searchInput = supplierCombo.locator('input');
    await searchInput.fill('WONDERFRUITS');
    await page.waitForTimeout(300);

    // Select the matching supplier
    const matchedOption = supplierCombo.locator('.max-h-60 button').first();
    await expect(matchedOption).toBeVisible();
    await matchedOption.click();

    // Count should decrease
    await page.waitForTimeout(500);
    const filteredText = await countEl.textContent();
    const showingMatch = filteredText?.match(/Showing (\d+) of/);
    const showing = parseInt(showingMatch?.[1] ?? '0');
    expect(showing).toBeLessThanOrEqual(total);
    expect(showing).toBeGreaterThan(0);
  });

  test('item dropdown is filtered by selected supplier', async ({ page }) => {
    // Open supplier dropdown and search for a known supplier
    const supplierCombo = page.locator('[data-testid="scatter-supplier-filter"]');
    await supplierCombo.locator('button').first().click();
    await expect(supplierCombo.locator('.max-h-60 button').first()).toBeVisible({ timeout: 10_000 });
    const searchInput = supplierCombo.locator('input');
    await searchInput.fill('TCK');
    await page.waitForTimeout(300);
    await supplierCombo.locator('.max-h-60 button').first().click();

    // Close supplier dropdown by clicking outside
    await page.locator('[data-testid="scatter-count"]').click();
    await page.waitForTimeout(300);

    // Open item dropdown
    const itemCombo = page.locator('[data-testid="scatter-item-filter"]');
    await itemCombo.locator('button').first().click();
    await page.waitForTimeout(500);

    // Item dropdown should have options (filtered by supplier)
    const itemOptions = itemCombo.locator('.max-h-60 button');
    const itemCount = await itemOptions.count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('reset button clears all filters', async ({ page }) => {
    // Get initial count
    const countEl = page.locator('[data-testid="scatter-count"]');
    const initialText = await countEl.textContent();
    const totalMatch = initialText?.match(/of (\d+) items/);
    const total = parseInt(totalMatch?.[1] ?? '0');

    // Open supplier dropdown and select first supplier
    const supplierCombo = page.locator('[data-testid="scatter-supplier-filter"]');
    await supplierCombo.locator('button').first().click();
    await page.waitForTimeout(300);
    await supplierCombo.locator('.max-h-60 button').first().click();

    // Reset button should appear
    const resetBtn = page.locator('[data-testid="scatter-reset"]');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await page.waitForTimeout(300);

    // Count should be restored
    const restoredText = await countEl.textContent();
    const restoredMatch = restoredText?.match(/Showing (\d+) of/);
    const restored = parseInt(restoredMatch?.[1] ?? '0');
    expect(restored).toBe(total);

    // Reset button should be gone
    await expect(resetBtn).not.toBeVisible();
  });

  test('shows more than 50 items with raised limit', async ({ page }) => {
    const countEl = page.locator('[data-testid="scatter-count"]');
    const countText = await countEl.textContent();
    const totalMatch = countText?.match(/of (\d+) items/);
    const total = parseInt(totalMatch?.[1] ?? '0');
    expect(total).toBeGreaterThan(50);
  });

  test('shows item count text', async ({ page }) => {
    const countLabel = page.locator('[data-testid="scatter-count"]');
    await expect(countLabel).toBeVisible({ timeout: 15_000 });
  });

  test('multi-select shows badges for selected suppliers', async ({ page }) => {
    const supplierCombo = page.locator('[data-testid="scatter-supplier-filter"]');
    await supplierCombo.locator('button').first().click();
    await page.waitForTimeout(300);
    await supplierCombo.locator('.max-h-60 button').first().click();

    // Badge should appear
    const badges = supplierCombo.locator('.rounded-full');
    await expect(badges.first()).toBeVisible();
  });
});
