# AI Insight Stage 2 Screenshot Inventory

Date captured: 2026-05-11  
Capture method: real dashboard at `http://localhost:3000` using Playwright.  
Paid AI calls run: none.

## Captured Screenshots

| UI evidence | Screenshot path | Source state |
|---|---|---|
| Section header with Get Insight | `docs/prd/screenshots/payment/ai-insight-section-header.png` | Payment dashboard, Outstanding Payment section |
| Completed AI panel with positive/negative cards | `docs/prd/screenshots/payment/ai-insight-panel-results.png` | Stored `payment_outstanding` result |
| Insight detail dialog | `docs/prd/screenshots/payment/ai-insight-detail-dialog.png` | Stored `payment_outstanding` result |
| Component Analyze icon | `docs/prd/screenshots/payment/ai-insight-component-icon.png` | Total Outstanding KPI card |
| Component insight dialog | `docs/prd/screenshots/payment/ai-insight-component-dialog.png` | Stored `total_outstanding` component result |
| Feedback modal | `docs/prd/screenshots/payment/ai-insight-feedback-modal.png` | Opened only; no feedback submitted |
| Expanded idle panel | `docs/prd/screenshots/expenses/ai-insight-panel-idle.png` | Expense Breakdown section with no stored result |
| Admin AI Insight Config page | `docs/prd/screenshots/ai-insight-admin/config-page.png` | Prompt config dashboard |
| Prompt version panel | `docs/prd/screenshots/ai-insight-admin/prompt-version-panel.png` | `by_customer` prompt |
| Pending feedback list | `docs/prd/screenshots/ai-insight-admin/feedback-list.png` | Existing feedback for `by_customer` prompt |

## Not Captured

| UI evidence | Reason |
|---|---|
| Expanded analyzing panel | Would require clicking Analyze and running a paid AI Insight analysis. |
| Feedback apply/diff modal | Clicking Apply calls the surgical editor LLM to generate the preview, so it was skipped without explicit paid-run approval. |

## Notes

- Screenshots are real dashboard screenshots, not synthetic mockups.
- Both Payment sections already had stored results, so the idle panel was captured from Expense Breakdown instead of Payment.
- PNG files are ignored by this repo's `.gitignore`; use `git add -f docs/prd/screenshots/...` if these screenshots should be committed.
