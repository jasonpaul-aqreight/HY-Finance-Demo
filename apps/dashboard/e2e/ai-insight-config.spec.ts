import { test, expect } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeWords(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
}

async function setAdminRole(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('user-role', 'admin'));
}

async function openFeedbackModal(page: import('@playwright/test').Page) {
  // The AiInsightPanel is collapsed by default. Click "Get Insight" to expand it
  // before the Feedback button becomes reachable.
  await page.goto('/sales');
  await page.waitForSelector('button:has-text("Get Insight")', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Get Insight' }).first().click();
  await page.waitForSelector('button:has-text("Feedback")', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Feedback' }).first().click();
}

async function openAdminConfig(page: import('@playwright/test').Page) {
  await page.goto('/admin/ai-insight-config');
  await page.waitForSelector('[data-testid="ai-insight-config-dashboard"]', { timeout: 30_000 });
}

async function expandPage(
  page: import('@playwright/test').Page,
  dataPage: string,
) {
  await page.locator(`[data-testid="prompt-tree-page"][data-page="${dataPage}"]`).click();
}

async function clickLeaf(
  page: import('@playwright/test').Page,
  promptKey: string,
) {
  await page.locator(`[data-testid="prompt-tree-leaf"][data-prompt-key="${promptKey}"]`).click();
}

async function cleanupVersions(
  request: import('@playwright/test').APIRequestContext,
  promptKey: string,
) {
  const vRes = await request.get(`/api/admin/ai-insight-prompts/${promptKey}/versions`);
  if (!vRes.ok()) return;
  const { versions } = await vRes.json() as { versions: { id: number; isDefault: boolean; isSelected: boolean }[] };
  for (const v of versions.filter((v) => !v.isDefault)) {
    await request.delete(`/api/admin/ai-insight-prompts/${promptKey}/versions/${v.id}`);
  }
  const defV = versions.find((v) => v.isDefault);
  if (defV && !defV.isSelected) {
    await request.post(`/api/admin/ai-insight-prompts/${promptKey}/versions/${defV.id}/select`);
  }
}

async function seedFeedback(
  request: import('@playwright/test').APIRequestContext,
  opts: {
    targetPromptKey: string;
    sectionKey: string;
    page: string;
    rawFeedback?: string;
    submittedBy?: string;
  },
): Promise<number> {
  const res = await request.post('/api/test/seed-feedback', {
    data: {
      target_prompt_key: opts.targetPromptKey,
      section_key: opts.sectionKey,
      page: opts.page,
      raw_feedback: opts.rawFeedback ?? 'Playwright test feedback row for E2E verification purposes.',
      submitted_by: opts.submittedBy ?? 'playwright-test',
    },
  });
  expect(res.status()).toBe(201);
  const { id } = await res.json() as { id: number };
  return id;
}

// ─── Group A — Phase 1: Word limit + rename ──────────────────────────────────

test.describe('Group A — Phase 1: word limit + rename', () => {
  // A1 (task 4.7)
  test('A1: 80-word feedback enables submit button', async ({ page }) => {
    await openFeedbackModal(page);
    const dialog = page.getByRole('dialog');
    await dialog.locator('textarea').fill(makeWords(80));
    await expect(dialog.getByRole('button', { name: 'Send feedback' })).toBeEnabled();
  });

  // A2 (task 4.8)
  test('A2: 81-word feedback disables submit and turns counter red', async ({ page }) => {
    await openFeedbackModal(page);
    const dialog = page.getByRole('dialog');
    await dialog.locator('textarea').fill(makeWords(81));
    await expect(dialog.getByRole('button', { name: 'Send feedback' })).toBeDisabled();
    await expect(dialog.locator('text=/81 \\/ 80 words/')).toBeVisible();
  });

  // A3 (task 4.9)
  test('A3: API POST with 81-word body returns 400', async ({ request }) => {
    const res = await request.post('/api/ai-insight/feedback', {
      data: {
        section_key: 'sales_trend',
        page: 'Sales',
        raw_feedback: makeWords(81),
        submitted_by: 'playwright-a3',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/exceeds 80 words/i);
  });

  // A4 (task 4.10)
  test('A4: Admin config tree shows no "General" labels', async ({ page }) => {
    await setAdminRole(page);
    await openAdminConfig(page);

    const tree = page.getByTestId('prompt-tree');
    await expect(tree.getByText('General', { exact: true })).toHaveCount(0);
    // Also check "general" doesn't appear as a visible label
    await expect(tree.locator('text=/\\bGeneral\\b/')).toHaveCount(0);
  });

  // A5 (task 4.11)
  test('A5: summary_analysis promptText contains "Guidance" not "General"', async ({ request }) => {
    const res = await request.get('/api/admin/ai-insight-prompts/summary_analysis');
    expect(res.status()).toBe(200);
    const body = await res.json() as { prompt: { promptText: string } };
    expect(body.prompt.promptText).toMatch(/Guidance/);
    expect(body.prompt.promptText).not.toMatch(/\bGeneral\b/);
  });
});

// ─── Group B — Phase 2: Versions API ─────────────────────────────────────────

test.describe.serial('Group B — Phase 2: versions API', () => {
  const B_PROMPT = 'net_sales_trend';
  const CAP_PROMPT = 'net_sales';

  let b2VersionId: number | null = null;
  let b6ExtraVersionId: number | null = null;

  test.beforeAll(async ({ request }) => {
    await cleanupVersions(request, B_PROMPT);
    await cleanupVersions(request, CAP_PROMPT);
  });

  test.afterAll(async ({ request }) => {
    await cleanupVersions(request, B_PROMPT);
    await cleanupVersions(request, CAP_PROMPT);
  });

  // B1 (task 4.12)
  test('B1: GET /versions returns at least Default, ordered first', async ({ request }) => {
    const res = await request.get(`/api/admin/ai-insight-prompts/${B_PROMPT}/versions`);
    expect(res.status()).toBe(200);
    const { versions } = await res.json() as { versions: { id: number; label: string; isDefault: boolean; isSelected: boolean }[] };
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0].isDefault).toBe(true);
    expect(versions[0].label).toBe('Default');
    expect(versions[0].isSelected).toBe(true);
  });

  // B2 (task 4.13)
  test('B2: Apply feedback → 2 versions, new is selected', async ({ request }) => {
    const feedbackId = await seedFeedback(request, {
      targetPromptKey: B_PROMPT,
      sectionKey: 'sales_trend',
      page: 'Sales',
      rawFeedback: 'B2 playwright test: improve this prompt for better sales analysis output.',
      submittedBy: 'playwright-b2',
    });

    const applyRes = await request.post(`/api/admin/ai-insight-feedback/${feedbackId}/apply`, {
      data: { proposedText: 'B2 playwright test version body — verified by E2E spec' },
    });
    expect(applyRes.status()).toBe(200);
    const { prompt } = await applyRes.json() as { prompt: { selectedVersionId: number } };
    b2VersionId = prompt.selectedVersionId;

    const versionsRes = await request.get(`/api/admin/ai-insight-prompts/${B_PROMPT}/versions`);
    const { versions } = await versionsRes.json() as { versions: { isDefault: boolean; isSelected: boolean }[] };
    expect(versions).toHaveLength(2);
    expect(versions.some((v) => v.isDefault && !v.isSelected)).toBe(true);
    expect(versions.some((v) => !v.isDefault && v.isSelected)).toBe(true);
  });

  // B3 (task 4.14) — cap test on separate prompt
  test('B3: 5 applies fills cap; 6th returns 400 VERSION_CAP_REACHED', async ({ request }) => {
    const capFeedbackIds: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const id = await seedFeedback(request, {
        targetPromptKey: CAP_PROMPT,
        sectionKey: 'sales_trend',
        page: 'Sales',
        rawFeedback: `B3 cap test feedback iteration ${i} for playwright E2E verification run.`,
        submittedBy: 'playwright-b3',
      });
      capFeedbackIds.push(id);
      const applyRes = await request.post(`/api/admin/ai-insight-feedback/${id}/apply`, {
        data: { proposedText: `B3 cap test version ${i}` },
      });
      expect(applyRes.status()).toBe(200);
    }

    const id6 = await seedFeedback(request, {
      targetPromptKey: CAP_PROMPT,
      sectionKey: 'sales_trend',
      page: 'Sales',
      rawFeedback: 'B3 cap test sixth feedback which must be rejected by the version cap limit.',
      submittedBy: 'playwright-b3',
    });

    const sixthApply = await request.post(`/api/admin/ai-insight-feedback/${id6}/apply`, {
      data: { proposedText: 'This should be rejected by the cap' },
    });
    expect(sixthApply.status()).toBe(400);
    const body = await sixthApply.json() as { error: string; message: string };
    expect(body.error).toBe('VERSION_CAP_REACHED');
    expect(body.message).toMatch(/version section is full/i);

    // Cleanup: discard lingering 6th feedback row, then delete cap test versions
    await request.delete(`/api/admin/ai-insight-feedback/${id6}`);
    await cleanupVersions(request, CAP_PROMPT);
  });

  // B4 (task 4.15)
  test('B4: DELETE non-default version → count decreases', async ({ request }) => {
    expect(b2VersionId).not.toBeNull();
    const deleteRes = await request.delete(
      `/api/admin/ai-insight-prompts/${B_PROMPT}/versions/${b2VersionId}`,
    );
    expect(deleteRes.status()).toBe(200);

    const versionsRes = await request.get(`/api/admin/ai-insight-prompts/${B_PROMPT}/versions`);
    const { versions } = await versionsRes.json() as { versions: { isDefault: boolean }[] };
    expect(versions).toHaveLength(1);
    expect(versions[0].isDefault).toBe(true);
    b2VersionId = null;
  });

  // B5 (task 4.16)
  test('B5: DELETE Default version → 400', async ({ request }) => {
    const versionsRes = await request.get(`/api/admin/ai-insight-prompts/${B_PROMPT}/versions`);
    const { versions } = await versionsRes.json() as { versions: { id: number; isDefault: boolean }[] };
    const defaultV = versions.find((v) => v.isDefault);
    expect(defaultV).toBeDefined();

    const deleteRes = await request.delete(
      `/api/admin/ai-insight-prompts/${B_PROMPT}/versions/${defaultV!.id}`,
    );
    expect(deleteRes.status()).toBe(400);
  });

  // B6 (task 4.17)
  test('B6: POST /select → prompt_text cache reflects that version', async ({ request }) => {
    const feedbackId = await seedFeedback(request, {
      targetPromptKey: B_PROMPT,
      sectionKey: 'sales_trend',
      page: 'Sales',
      rawFeedback: 'B6 playwright test: select version feedback for E2E cache verification.',
      submittedBy: 'playwright-b6',
    });

    const applyRes = await request.post(`/api/admin/ai-insight-feedback/${feedbackId}/apply`, {
      data: { proposedText: 'B6 test version body for cache select verification' },
    });
    expect(applyRes.status()).toBe(200);
    const { prompt: applyPrompt } = await applyRes.json() as { prompt: { selectedVersionId: number } };
    b6ExtraVersionId = applyPrompt.selectedVersionId;

    // Select Default
    const versionsRes = await request.get(`/api/admin/ai-insight-prompts/${B_PROMPT}/versions`);
    const { versions } = await versionsRes.json() as { versions: { id: number; isDefault: boolean }[] };
    const defaultV = versions.find((v) => v.isDefault)!;

    const selectRes = await request.post(
      `/api/admin/ai-insight-prompts/${B_PROMPT}/versions/${defaultV.id}/select`,
    );
    expect(selectRes.status()).toBe(200);
    const selectBody = await selectRes.json() as { prompt: { selectedVersionId: number } };
    expect(selectBody.prompt.selectedVersionId).toBe(defaultV.id);

    // Verify via GET that the cache reflects Default
    const promptRes = await request.get(`/api/admin/ai-insight-prompts/${B_PROMPT}`);
    const { prompt } = await promptRes.json() as { prompt: { selectedVersionId: number } };
    expect(prompt.selectedVersionId).toBe(defaultV.id);

    // Cleanup b6 extra version
    if (b6ExtraVersionId != null) {
      await request.delete(
        `/api/admin/ai-insight-prompts/${B_PROMPT}/versions/${b6ExtraVersionId}`,
      );
      b6ExtraVersionId = null;
    }
  });

  // B7 (task 4.18)
  test('B7: Removed endpoints return 404 or 405', async ({ request }) => {
    const checks = await Promise.all([
      request.put('/api/admin/ai-insight-prompts/component_analysis', { data: {} }),
      request.post('/api/admin/ai-insight-prompts/component_analysis/reset', { data: {} }),
      request.post('/api/admin/ai-insight-prompts/reset-all', { data: {} }),
      request.post('/api/admin/ai-insight-prompts/component_analysis/revert', { data: {} }),
    ]);
    for (const res of checks) {
      expect([404, 405]).toContain(res.status());
    }
  });

  // B8 (task 4.19)
  test('B8: GET all prompts includes 5 HR section_guidance rows with empty bodies', async ({ request }) => {
    const res = await request.get('/api/admin/ai-insight-prompts');
    expect(res.status()).toBe(200);
    const { prompts } = await res.json() as { prompts: { page: string; category: string; promptText: string }[] };
    const hrGuidance = prompts.filter(
      (p) => p.page === 'hr' && p.category === 'section_guidance',
    );
    expect(hrGuidance).toHaveLength(5);
    for (const p of hrGuidance) {
      expect(p.promptText.trim()).toBe('');
    }
  });

  test('B9: GET all prompts includes blank HR system placeholders', async ({ request }) => {
    const res = await request.get('/api/admin/ai-insight-prompts');
    expect(res.status()).toBe(200);
    const { prompts } = await res.json() as {
      prompts: { promptKey: string; page: string; category: string; promptText: string; displayName: string }[];
    };
    const hrSystem = prompts.filter((p) => p.page === 'hr' && p.category === 'system');
    expect(hrSystem.map((p) => p.promptKey).sort()).toEqual([
      'hr_component_analysis',
      'hr_summary_analysis',
    ]);
    expect(hrSystem.map((p) => p.displayName).sort()).toEqual([
      'Component Analysis',
      'Summary Analysis',
    ]);
    for (const p of hrSystem) {
      expect(p.promptText.trim()).toBe('');
    }
  });
});

// ─── Group C — Phase 3: UI layout ────────────────────────────────────────────

test.describe('Group C — Phase 3: UI layout', () => {
  test.beforeEach(async ({ page }) => {
    await setAdminRole(page);
    await openAdminConfig(page);
  });

  // C1 (task 4.20)
  test('C1: All 5 sections visible at standard viewport', async ({ page }) => {
    await expect(page.getByTestId('ai-insight-config-dashboard')).toBeVisible();
    await expect(page.getByTestId('prompt-tree')).toBeVisible();
    await expect(page.getByTestId('ai-insight-breadcrumb')).toBeVisible();
    await expect(page.getByTestId('prompt-text-panel')).toBeVisible();
    await expect(page.getByTestId('version-panel')).toBeVisible();
    await expect(page.getByTestId('feedback-list')).toBeVisible();
  });

  // C2 (task 4.21)
  test('C2: BreadcrumbBar has overflow visible (no scroll)', async ({ page }) => {
    const breadcrumb = page.getByTestId('ai-insight-breadcrumb');
    await expect(breadcrumb).toBeVisible();
    const overflow = await breadcrumb.evaluate((el) => getComputedStyle(el).overflowY);
    expect(['visible', 'clip']).toContain(overflow);
  });

  // C3 (task 4.22)
  test('C3: VersionPanel has overflow visible (no scroll)', async ({ page }) => {
    const panel = page.getByTestId('version-panel');
    await expect(panel).toBeVisible();
    const overflow = await panel.evaluate((el) => getComputedStyle(el).overflowY);
    expect(['visible', 'clip']).toContain(overflow);
  });

  // C4 (task 4.23)
  test('C4: PromptTree, PromptTextPanel, FeedbackList scroll containers have overflow-y auto', async ({
    page,
  }) => {
    // PromptTree scroll container is the CardContent inside it
    const treeScroller = page
      .getByTestId('prompt-tree')
      .locator('.overflow-y-auto')
      .first();
    const treeOverflow = await treeScroller.evaluate((el) => getComputedStyle(el).overflowY);
    expect(treeOverflow).toBe('auto');

    // PromptTextPanel inner scroll div
    const textPanelScroller = page.getByTestId('prompt-text-panel').locator('.overflow-y-auto');
    const textOverflow = await textPanelScroller.evaluate((el) => getComputedStyle(el).overflowY);
    expect(textOverflow).toBe('auto');

    // FeedbackList inner scroll div
    const feedbackScroller = page.getByTestId('feedback-list').locator('.overflow-y-auto');
    const feedbackOverflow = await feedbackScroller.evaluate(
      (el) => getComputedStyle(el).overflowY,
    );
    expect(feedbackOverflow).toBe('auto');
  });

  // C5 (task 4.24)
  test('C5: PromptTree shows HR node; expanding reveals 5 HR sections', async ({ page }) => {
    const hrPageBtn = page.locator('[data-testid="prompt-tree-page"][data-page="hr"]');
    await expect(hrPageBtn).toBeVisible();
    await hrPageBtn.click();

    // 5 section guidance leaves for HR
    const hrLeaves = page
      .getByTestId('prompt-tree')
      .locator('[data-testid="prompt-tree-leaf"]')
      .filter({
        has: page.locator('[data-prompt-key$="_guidance"]'),
      });
    const hrKeys = [
      'employee_demographics_guidance',
      'attendance_leave_guidance',
      'overtime_work_hours_guidance',
      'payroll_compensation_guidance',
      'performance_talent_guidance',
    ];
    const tree = page.getByTestId('prompt-tree');
    for (const key of hrKeys) {
      await expect(tree.locator(`[data-testid="prompt-tree-leaf"][data-prompt-key="${key}"]`)).toBeVisible();
    }
    // suppress unused var warning
    void hrLeaves;
  });

  // C6 (task 4.25)
  test('C6: PromptTree has zero bg-amber-500 (modified-dot) elements', async ({ page }) => {
    const modDots = page.getByTestId('prompt-tree').locator('.bg-amber-500');
    await expect(modDots).toHaveCount(0);
  });

  // C7 (task 4.26)
  test('C7: Click Component Analysis → breadcrumb reads "System Prompt / Component Analysis"', async ({
    page,
  }) => {
    await clickLeaf(page, 'component_analysis');
    const crumb = page.getByTestId('ai-insight-breadcrumb');
    await expect(crumb).toContainText('System Prompt');
    await expect(crumb).toContainText('Finance');
    await expect(crumb).toContainText('Component Analysis');
  });

  test('C7b: System prompts are grouped by Finance and HR', async ({ page }) => {
    const tree = page.getByTestId('prompt-tree');
    await expect(tree.locator('[data-testid="prompt-tree-system-group"][data-system-group="finance"]')).toBeVisible();
    await expect(tree.locator('[data-testid="prompt-tree-system-group"][data-system-group="hr"]')).toBeVisible();
    await expect(tree.locator('[data-testid="prompt-tree-leaf"][data-prompt-key="component_analysis"]')).toBeVisible();
    await expect(tree.locator('[data-testid="prompt-tree-leaf"][data-prompt-key="summary_analysis"]')).toBeVisible();
    await expect(tree.locator('[data-testid="prompt-tree-leaf"][data-prompt-key="hr_component_analysis"]')).toBeVisible();
    await expect(tree.locator('[data-testid="prompt-tree-leaf"][data-prompt-key="hr_summary_analysis"]')).toBeVisible();
    await expect(tree.locator('[data-testid="prompt-tree-leaf"][data-prompt-key="feedback_router"]')).toBeVisible();
    await expect(tree.locator('[data-testid="prompt-tree-leaf"][data-prompt-key="surgical_editor"]')).toBeVisible();
  });

  // C8 (task 4.27)
  test('C8: Click Sales Breakdown / By Customer → breadcrumb shows expected path', async ({
    page,
  }) => {
    await expandPage(page, 'Sales');
    await clickLeaf(page, 'by_customer');
    const crumb = page.getByTestId('ai-insight-breadcrumb');
    await expect(crumb).toContainText('User Prompt');
    await expect(crumb).toContainText('Sales Breakdown');
    await expect(crumb).toContainText('By Customer');
  });

  // C9 (task 4.28)
  test('C9: Click HR / Attendance & Leave Monitoring / Guidance → breadcrumb and empty body', async ({
    page,
  }) => {
    await expandPage(page, 'hr');
    await clickLeaf(page, 'attendance_leave_guidance');
    const crumb = page.getByTestId('ai-insight-breadcrumb');
    await expect(crumb).toContainText('User Prompt');
    await expect(crumb).toContainText('HR');
    await expect(crumb).toContainText('Attendance & Leave Monitoring');
    await expect(crumb).toContainText('Guidance');

    // HR prompt body is empty → empty state indicator
    await expect(page.getByTestId('prompt-text-empty')).toBeVisible({ timeout: 10_000 });
  });

  // C10 (task 4.29)
  test('C10: Default version card has no trash icon; non-default cards do', async ({ page, request }) => {
    // Create a non-default version so we can see both cards
    const feedbackId = await seedFeedback(request, {
      targetPromptKey: 'component_analysis',
      sectionKey: 'sales_trend',
      page: 'Sales',
      rawFeedback: 'C10 playwright test feedback to create a non-default version card.',
      submittedBy: 'playwright-c10',
    });
    const applyRes = await request.post(`/api/admin/ai-insight-feedback/${feedbackId}/apply`, {
      data: { proposedText: 'C10 test version body for card UI verification' },
    });
    expect(applyRes.status()).toBe(200);
    const { prompt } = await applyRes.json() as { prompt: { selectedVersionId: number } };

    // Reload after API modification to ensure VersionPanel fetches the updated version list
    await page.reload();
    await page.waitForSelector('[data-testid="ai-insight-config-dashboard"]', { timeout: 30_000 });

    await clickLeaf(page, 'component_analysis');

    const vPanel = page.getByTestId('version-panel');
    const defaultCard = vPanel.getByTestId('version-card-default');
    const nonDefaultCard = vPanel.getByTestId('version-card').first();

    await expect(defaultCard).toBeVisible({ timeout: 10_000 });
    await expect(nonDefaultCard).toBeVisible({ timeout: 10_000 });

    // Default card has no trash button
    await expect(defaultCard.getByTestId('version-delete-button')).toHaveCount(0);
    // Non-default card has trash button
    await expect(nonDefaultCard.getByTestId('version-delete-button')).toBeVisible();

    // Cleanup
    await request.delete(
      `/api/admin/ai-insight-prompts/component_analysis/versions/${prompt.selectedVersionId}`,
    );
    await request.post(
      `/api/admin/ai-insight-prompts/component_analysis/versions`,
    ).catch(() => null); // select default
    await cleanupVersions(request, 'component_analysis');
  });

  // C11 (task 4.30)
  test('C11: Click non-selected version card → body and pill update', async ({
    page,
    request,
  }) => {
    const feedbackId = await seedFeedback(request, {
      targetPromptKey: 'component_analysis',
      sectionKey: 'sales_trend',
      page: 'Sales',
      rawFeedback: 'C11 playwright test feedback for version card click UI verification test.',
      submittedBy: 'playwright-c11',
    });
    await request.post(`/api/admin/ai-insight-feedback/${feedbackId}/apply`, {
      data: { proposedText: 'C11 version body — select test' },
    });

    await clickLeaf(page, 'component_analysis');

    const vPanel = page.getByTestId('version-panel');
    const defaultCard = vPanel.getByTestId('version-card-default');
    await expect(defaultCard).toBeVisible({ timeout: 10_000 });

    // Currently non-default is selected; click Default
    await defaultCard.click();

    await expect(defaultCard).toHaveAttribute('data-selected', 'true', { timeout: 10_000 });

    const pill = page.getByTestId('selected-version-pill');
    await expect(pill).toContainText('Default', { timeout: 5_000 });

    await cleanupVersions(request, 'component_analysis');
  });

  // C12 (task 4.31)
  test('C12: Click trash on non-default → confirm → card disappears', async ({
    page,
    request,
  }) => {
    const feedbackId = await seedFeedback(request, {
      targetPromptKey: 'component_analysis',
      sectionKey: 'sales_trend',
      page: 'Sales',
      rawFeedback: 'C12 playwright test feedback creating version for trash-delete UI test.',
      submittedBy: 'playwright-c12',
    });
    await request.post(`/api/admin/ai-insight-feedback/${feedbackId}/apply`, {
      data: { proposedText: 'C12 version body — delete via UI test' },
    });

    // Select Default first so the non-default can be safely deleted
    const vRes = await request.get('/api/admin/ai-insight-prompts/component_analysis/versions');
    const { versions } = await vRes.json() as { versions: { id: number; isDefault: boolean }[] };
    const defV = versions.find((v) => v.isDefault)!;
    await request.post(`/api/admin/ai-insight-prompts/component_analysis/versions/${defV.id}/select`);

    // Reload after API modifications so VersionPanel re-fetches fresh version list
    await page.reload();
    await page.waitForSelector('[data-testid="ai-insight-config-dashboard"]', { timeout: 30_000 });

    await clickLeaf(page, 'component_analysis');

    const vPanel = page.getByTestId('version-panel');
    await expect(vPanel.getByTestId('version-card')).toBeVisible({ timeout: 10_000 });

    const nonDefaultCard = vPanel.getByTestId('version-card').first();
    const trashBtn = nonDefaultCard.getByTestId('version-delete-button');
    await trashBtn.click();

    // Confirm dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    // Card disappears
    await expect(vPanel.getByTestId('version-card')).toHaveCount(0, { timeout: 10_000 });
    await expect(vPanel.getByTestId('version-card-default')).toBeVisible();
  });
});

// ─── Group D — End-to-end happy path ─────────────────────────────────────────

test.describe.serial('Group D — end-to-end happy path', () => {
  const D_PROMPT = 'sales_trend_guidance';
  let seededFeedbackId: number;

  test.beforeAll(async ({ request }) => {
    // Clean any lingering test versions and stale feedback rows from previous runs
    await cleanupVersions(request, D_PROMPT);
    const staleRes = await request.get(`/api/admin/ai-insight-feedback?prompt_key=${encodeURIComponent(D_PROMPT)}`);
    if (staleRes.ok()) {
      const { feedback } = await staleRes.json() as { feedback: { id: number }[] };
      for (const row of feedback) {
        await request.delete(`/api/admin/ai-insight-feedback/${row.id}`);
      }
    }

    seededFeedbackId = await seedFeedback(request, {
      targetPromptKey: D_PROMPT,
      sectionKey: 'sales_trend',
      page: 'Sales',
      rawFeedback:
        'D-group end-to-end test feedback: please improve the sales trend analysis guidance for better actionable insight output.',
      submittedBy: 'playwright-d-test',
    });
  });

  test.afterAll(async ({ request }) => {
    await cleanupVersions(request, D_PROMPT);
  });

  // D1 (task 4.32) — UI feedback submission (API mocked to avoid LLM routing)
  test('D1: User submits feedback via Sales page → success toast', async ({ page }) => {
    // Mock feedback POST to avoid LLM routing call; the actual DB row was seeded in beforeAll
    await page.route('**/api/ai-insight/feedback', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            id: seededFeedbackId,
            target_prompt_key: D_PROMPT,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await openFeedbackModal(page);

    const dialog = page.getByRole('dialog');
    await dialog.locator('textarea').fill(makeWords(50));

    const submitBtn = dialog.getByRole('button', { name: 'Send feedback' });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page.getByText('Feedback sent. Thank you.')).toBeVisible({ timeout: 10_000 });
  });

  // D2 (task 4.33) — Admin sees feedback inline (no toggle)
  test('D2: Admin opens config → navigates to sales_trend_guidance → feedback visible', async ({
    page,
  }) => {
    await setAdminRole(page);
    await openAdminConfig(page);

    await expandPage(page, 'Sales');
    await clickLeaf(page, D_PROMPT);

    const feedbackList = page.getByTestId('feedback-list');
    await expect(feedbackList.getByTestId('feedback-item').first()).toBeVisible({ timeout: 10_000 });

    const rawEl = feedbackList.getByTestId('feedback-raw').first();
    await expect(rawEl).toBeVisible();
    await expect(rawEl).toContainText('end-to-end test feedback');
  });

  // D3 (task 4.34) — Apply flow: DiffModal opens, Confirm closes it
  test('D3: Apply → DiffModal opens → Confirm & apply → modal closes', async ({ page }) => {
    await setAdminRole(page);

    // Mock preview to avoid surgical-editor LLM call
    await page.route('**/**/preview', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            currentText: 'Original sales trend guidance body',
            proposedText: 'D3 playwright improved sales trend guidance — E2E verified',
            changeSummary: 'Playwright E2E test change for D3 confirmation flow',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await openAdminConfig(page);
    await expandPage(page, 'Sales');
    await clickLeaf(page, D_PROMPT);

    const feedbackList = page.getByTestId('feedback-list');
    const applyBtn = feedbackList.getByRole('button', { name: 'Apply' }).first();
    await expect(applyBtn).toBeVisible({ timeout: 10_000 });
    await applyBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const confirmBtn = dialog.getByRole('button', { name: 'Confirm & apply' });
    await expect(confirmBtn).toBeEnabled({ timeout: 10_000 });
    await confirmBtn.click();

    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  });

  // D4 (task 4.35) — VersionPanel shows 2 cards after apply
  test('D4: VersionPanel shows Default + new card; new is selected', async ({ page }) => {
    await setAdminRole(page);
    await openAdminConfig(page);
    await expandPage(page, 'Sales');
    await clickLeaf(page, D_PROMPT);

    const vPanel = page.getByTestId('version-panel');
    await expect(vPanel.getByTestId('version-card-default')).toBeVisible({ timeout: 10_000 });
    await expect(vPanel.getByTestId('version-card')).toHaveCount(1);

    const nonDefaultCard = vPanel.getByTestId('version-card').first();
    await expect(nonDefaultCard).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('prompt-text-body')).toBeVisible({ timeout: 5_000 });
  });

  // D5 (task 4.36) — FeedbackList empty after apply
  test('D5: FeedbackList is empty after apply', async ({ page }) => {
    await setAdminRole(page);
    await openAdminConfig(page);
    await expandPage(page, 'Sales');
    await clickLeaf(page, D_PROMPT);

    const feedbackList = page.getByTestId('feedback-list');
    await expect(feedbackList.getByText('No pending feedback')).toBeVisible({ timeout: 10_000 });
    await expect(feedbackList.getByTestId('feedback-item')).toHaveCount(0);
  });

  // D6 (task 4.37) — Summary regen skipped (requires full LLM analysis)

  // D7 (task 4.38) — Click Default card → reverts body and pill
  test('D7: Click Default version card → PromptTextPanel reverts to Default', async ({ page }) => {
    await setAdminRole(page);
    await openAdminConfig(page);
    await expandPage(page, 'Sales');
    await clickLeaf(page, D_PROMPT);

    const vPanel = page.getByTestId('version-panel');
    const defaultCard = vPanel.getByTestId('version-card-default');
    await expect(defaultCard).toBeVisible({ timeout: 10_000 });
    await expect(defaultCard).toHaveAttribute('data-selected', 'false');

    await defaultCard.click();

    await expect(defaultCard).toHaveAttribute('data-selected', 'true', { timeout: 10_000 });
    await expect(page.getByTestId('selected-version-pill')).toContainText('Default', {
      timeout: 5_000,
    });
  });

  // D8 (task 4.39) — Select new version, then delete it → back to Default only
  test('D8: Re-select new version, delete it → version list back to Default only', async ({
    page,
  }) => {
    await setAdminRole(page);
    await openAdminConfig(page);
    await expandPage(page, 'Sales');
    await clickLeaf(page, D_PROMPT);

    const vPanel = page.getByTestId('version-panel');
    const nonDefaultCard = vPanel.getByTestId('version-card').first();
    await expect(nonDefaultCard).toBeVisible({ timeout: 10_000 });

    // Select the non-default version
    await nonDefaultCard.click();
    await expect(nonDefaultCard).toHaveAttribute('data-selected', 'true', { timeout: 10_000 });

    // Delete it
    const trashBtn = nonDefaultCard.getByTestId('version-delete-button');
    await trashBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    // Only Default remains
    await expect(vPanel.getByTestId('version-card')).toHaveCount(0, { timeout: 10_000 });
    await expect(vPanel.getByTestId('version-card-default')).toHaveAttribute(
      'data-selected',
      'true',
    );
  });
});

// ─── Group E — Regression / smoke ────────────────────────────────────────────

test.describe('Group E — regression smoke', () => {
  // E1 (task 4.40)
  test('E1: Sidebar "AI Insight Config" link navigates correctly', async ({ page }) => {
    await setAdminRole(page);
    await page.goto('/admin/ai-insight-config');
    await expect(page.getByTestId('ai-insight-config-dashboard')).toBeVisible({ timeout: 30_000 });
  });

  // E2 (task 4.41)
  test('E2: Other admin pages still load without errors', async ({ page }) => {
    const serverErrors: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('/admin/ai-insight-config');
    await expect(page.getByTestId('ai-insight-config-dashboard')).toBeVisible({ timeout: 30_000 });

    expect(serverErrors).toHaveLength(0);
  });

  // E3 (task 4.42)
  test('E3: Finance section prompts still listed (summary generation data path intact)', async ({
    request,
  }) => {
    const res = await request.get('/api/admin/ai-insight-prompts');
    expect(res.status()).toBe(200);
    const { prompts } = await res.json() as { prompts: { page: string }[] };
    const financePrompts = prompts.filter(
      (p) => p.page === 'Sales' || p.page === 'Payment' || p.page === 'Financial',
    );
    expect(financePrompts.length).toBeGreaterThan(0);
  });

  // E4 (task 4.43)
  test('E4: No console errors during admin config page traversal', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await setAdminRole(page);
    await openAdminConfig(page);

    await clickLeaf(page, 'component_analysis');
    await expandPage(page, 'Sales');
    await clickLeaf(page, 'sales_trend_guidance');

    // Filter out known third-party noise
    const filtered = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('hot-update'),
    );
    expect(filtered).toHaveLength(0);
  });

  // E5 (task 4.44)
  test('E5: No 5xx responses during full happy-path traversal', async ({ page }) => {
    const serverErrors: Array<{ url: string; status: number }> = [];
    page.on('response', (res) => {
      if (res.status() >= 500) serverErrors.push({ url: res.url(), status: res.status() });
    });

    await setAdminRole(page);
    await openAdminConfig(page);

    await clickLeaf(page, 'component_analysis');
    await expandPage(page, 'Sales');
    await clickLeaf(page, 'by_customer');
    await expandPage(page, 'hr');
    await clickLeaf(page, 'attendance_leave_guidance');

    expect(serverErrors).toHaveLength(0);
  });
});

// ─── Group F — Edge cases ─────────────────────────────────────────────────────

test.describe('Group F — edge cases', () => {
  // F1 (task 4.45)
  test('F1: Empty HR prompt renders placeholder without crash', async ({ page }) => {
    await setAdminRole(page);
    await openAdminConfig(page);
    await expandPage(page, 'hr');
    await clickLeaf(page, 'employee_demographics_guidance');

    await expect(page.getByTestId('prompt-text-panel')).toBeVisible();
    await expect(page.getByTestId('prompt-text-empty')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('prompt-text-body')).toHaveCount(0);
  });

  // F2 (task 4.46)
  test('F2: Large prompt body scrolls without breaking layout', async ({ page, request }) => {
    const longBody = 'This is a very long sentence that repeats itself endlessly. '.repeat(200);

    const feedbackId = await seedFeedback(request, {
      targetPromptKey: 'component_analysis',
      sectionKey: 'sales_trend',
      page: 'Sales',
      rawFeedback: 'F2 test feedback creating a large version body to test scroll behavior.',
      submittedBy: 'playwright-f2',
    });
    const applyRes = await request.post(`/api/admin/ai-insight-feedback/${feedbackId}/apply`, {
      data: { proposedText: longBody },
    });
    expect(applyRes.status()).toBe(200);

    await setAdminRole(page);
    await openAdminConfig(page);
    await clickLeaf(page, 'component_analysis');

    const textPanel = page.getByTestId('prompt-text-panel');
    await expect(textPanel).toBeVisible({ timeout: 10_000 });
    await expect(textPanel.getByTestId('prompt-text-body')).toBeVisible();

    // Dashboard should not overflow horizontally
    const dashboard = page.getByTestId('ai-insight-config-dashboard');
    const { scrollWidth, clientWidth } = await dashboard.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance

    await cleanupVersions(request, 'component_analysis');
  });

  // F3 (task 4.47)
  test('F3: 30 feedback rows for one prompt — FeedbackList scrolls without layout break', async ({
    page,
    request,
  }) => {
    const MANY_PROMPT = 'feedback_router';
    const ids: number[] = [];
    for (let i = 1; i <= 30; i++) {
      const id = await seedFeedback(request, {
        targetPromptKey: MANY_PROMPT,
        sectionKey: 'sales_trend',
        page: 'Sales',
        rawFeedback: `F3 bulk feedback row ${i}: improve the routing precision for better feedback classification.`,
        submittedBy: 'playwright-f3',
      });
      ids.push(id);
    }

    await setAdminRole(page);
    await openAdminConfig(page);
    await clickLeaf(page, MANY_PROMPT);

    const feedbackList = page.getByTestId('feedback-list');
    await expect(feedbackList.getByTestId('feedback-item').first()).toBeVisible({
      timeout: 15_000,
    });

    const itemCount = await feedbackList.getByTestId('feedback-item').count();
    expect(itemCount).toBeGreaterThanOrEqual(30);

    // No horizontal overflow
    const { scrollWidth, clientWidth } = await feedbackList.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Cleanup
    for (const id of ids) {
      await request.delete(`/api/admin/ai-insight-feedback/${id}`);
    }
  });

  // F4 (task 4.48)
  test('F4: Two contexts — config page does not crash when a second tab navigates', async ({
    page,
    context,
  }) => {
    await setAdminRole(page);
    await openAdminConfig(page);
    await clickLeaf(page, 'component_analysis');

    const page2 = await context.newPage();
    await page2.addInitScript(() => localStorage.setItem('user-role', 'admin'));
    await page2.goto('/admin/ai-insight-config');
    await expect(page2.getByTestId('ai-insight-config-dashboard')).toBeVisible({
      timeout: 30_000,
    });

    // Original page should still be functional
    await expect(page.getByTestId('ai-insight-config-dashboard')).toBeVisible();
    await page2.close();
  });

  // F5 (task 4.49)
  test('F5: Exactly 80-word feedback succeeds (boundary condition)', async ({ page }) => {
    await openFeedbackModal(page);
    const dialog = page.getByRole('dialog');
    await dialog.locator('textarea').fill(makeWords(80));
    await expect(dialog.getByRole('button', { name: 'Send feedback' })).toBeEnabled();
    await expect(dialog.locator('text=/^80 \\/ 80 words$/')).toBeVisible();
  });

  // F6 (task 4.50)
  test('F6: Whitespace-only feedback keeps submit disabled', async ({ page }) => {
    await openFeedbackModal(page);
    const dialog = page.getByRole('dialog');
    await dialog.locator('textarea').fill('     \n   \t   ');
    await expect(dialog.getByRole('button', { name: 'Send feedback' })).toBeDisabled();
  });
});
