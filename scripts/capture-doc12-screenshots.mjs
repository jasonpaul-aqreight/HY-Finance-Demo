/* eslint-disable */
// Standalone capture script for doc 12 (finance-domain-config).
// Bypasses the (often wedged) Playwright MCP. Uses repo-local Playwright.
// Run from repo root: node scripts/capture-doc12-screenshots.mjs

import { chromium } from '../apps/dashboard/node_modules/playwright/index.mjs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const OUT = resolve(REPO, 'ai-insight-docs/assets');
const BASE = process.env.BASE_URL || 'http://localhost:3000';

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

// App's RoleProvider defaults to admin, but set explicitly to be safe.
await ctx.addInitScript(() => {
  try { localStorage.setItem('user-role', 'admin'); } catch {}
});

const page = await ctx.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('[browser error]', msg.text());
});

console.log(`→ navigate ${BASE}/financial`);
await page.goto(`${BASE}/financial`, { waitUntil: 'networkidle', timeout: 30_000 });

// Wait for the KPI band to render.
await page.waitForSelector('text=NET SALES', { timeout: 15_000 });
await page.waitForTimeout(800); // settle paint

// ── Capture 1: Financial KPI cards (top band) ──────────────────────────────
// Scroll to top and clip to the KPI band height. The four primary cards sit
// inside a grid; we capture the surrounding container.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);

// Locate the row that contains "NET SALES" and grab its parent grid for a
// clean crop of the four-card band.
const kpiClip = await page.evaluate(() => {
  const heading = Array.from(document.querySelectorAll('*'))
    .find(el => /^NET SALES$/i.test((el.textContent || '').trim()));
  if (!heading) return null;
  // Walk up to find the grid container (the row of 4 cards).
  let node = heading;
  for (let i = 0; i < 6 && node; i++) {
    const r = node.getBoundingClientRect();
    if (r.width > 1000 && r.height > 80) {
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    node = node.parentElement;
  }
  return null;
});

if (!kpiClip) throw new Error('Could not locate KPI grid container');

const kpiPath = resolve(OUT, '12-financial-kpi-cards.png');
await page.screenshot({
  path: kpiPath,
  clip: {
    x: Math.max(0, kpiClip.x - 8),
    y: Math.max(0, kpiClip.y - 8),
    width: Math.min(1440, kpiClip.width + 16),
    height: kpiClip.height + 16,
  },
});
console.log(`✓ wrote ${kpiPath} (${Math.round(kpiClip.width)}×${Math.round(kpiClip.height)})`);

// ── Capture 2: Budget Setting dialog ───────────────────────────────────────
// Click the Budget Setting button in the page header.
console.log('→ open Budget Setting dialog');
const budgetButton = page.getByRole('button', { name: /budget setting/i }).first();
await budgetButton.waitFor({ state: 'visible', timeout: 5_000 });
await budgetButton.click();

// Wait for the dialog title.
await page.waitForSelector('text=/^Budget Setting$/', { timeout: 5_000 });
await page.waitForTimeout(500); // settle paint + dialog animation

const dialogClip = await page.evaluate(() => {
  // The dialog usually has role="dialog"; if not, find a wide centered modal
  // that contains "Annual Budget" header.
  const dialog =
    document.querySelector('[role="dialog"]') ||
    Array.from(document.querySelectorAll('*'))
      .find(el =>
        /Annual Budget/i.test(el.textContent || '') &&
        el.getBoundingClientRect().width > 600 &&
        el.getBoundingClientRect().width < 1100,
      );
  if (!dialog) return null;
  const r = dialog.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});

if (!dialogClip) throw new Error('Could not locate Budget Setting dialog');

const dlgPath = resolve(OUT, '12-budget-setting-dialog.png');
await page.screenshot({
  path: dlgPath,
  clip: {
    x: Math.max(0, dialogClip.x - 8),
    y: Math.max(0, dialogClip.y - 8),
    width: Math.min(1440, dialogClip.width + 16),
    height: Math.min(900 - Math.max(0, dialogClip.y - 8), dialogClip.height + 16),
  },
});
console.log(`✓ wrote ${dlgPath} (${Math.round(dialogClip.width)}×${Math.round(dialogClip.height)})`);

await browser.close();
console.log('done.');
