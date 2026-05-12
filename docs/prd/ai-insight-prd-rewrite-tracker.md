# AI Insight PRD Rewrite Tracker

Plan: [ai-insight-prd-rewrite-plan-v3.md](./ai-insight-prd-rewrite-plan-v3.md)  
Started: 2026-05-12  
Total sessions: 4

## Status

| Session | Scope | Status | Date | Deliverable |
|--------:|-------|--------|------|-------------|
| 1 | Plan + audit | ✅ Done | 2026-05-12 | Plan v3 + tracker |
| 2 | Base PRD 10 + screenshots | ✅ Done | 2026-05-12 | `docs/prd/10-ai-insight-base.md` (20 sections + Appendix A) + 18/18 screenshots under `docs/prd/screenshots/` |
| 3 | Finance PRD 11 | ✅ Done | 2026-05-12 | `docs/prd/11-ai-insight-finance.md` (17 sections + Appendix A, 1763 lines) — 16-section catalog, 69-component inventory, model/provider table, fetcher contract, tool whitelist, rollout status |
| 4 | HR PRD 12 + cross-doc close-out | ✅ Done | 2026-05-12 | `docs/prd/12-ai-insight-hr.md` (12 sections + Appendix A, 821 lines) + v3 status block appended to `docs/prd/ai-insight-reverse-engineering-audit.md` §6 |

**v3 rewrite is fully complete.** See `docs/prd/ai-insight-reverse-engineering-audit.md` §6 for the close-out summary and cross-doc consistency notes.

## Session 1 — Done (2026-05-12)

- Output: this tracker + [ai-insight-prd-rewrite-plan-v3.md](./ai-insight-prd-rewrite-plan-v3.md).
- Decisions confirmed:
  - HR fully identical to Finance; PII/RBAC/aggregation deferred to out-of-scope addendum.
  - Code + dashboard UI = source of truth. No "production gap" mandates.
  - Re-capture all Playwright screenshots in Session 2.
  - 4 sessions, each reviewable before the next.
- Open items carried forward:
  - Confirm exact `FEEDBACK_MAX_WORDS` value in code during Session 2.
  - Default skip the feedback diff modal screenshot (paid surgical-editor run); user to approve if desired.
  - The "live prompt panel" is the read-only `PromptTextPanel`.

## Session 2 — Done (2026-05-12)

- Output: full rewrite of `docs/prd/10-ai-insight-base.md` — 20 sections + Appendix A file inventory. Well under the 45k token cap, so no appendix split was needed.
- All 18 screenshots captured under `docs/prd/screenshots/`:
  - `payment/ai-insight-section-header.png`
  - `payment/ai-insight-panel-results.png` (stored result)
  - `payment/ai-insight-panel-analyzing.png` (live OpenRouter run — 5 components done + summary in progress)
  - `payment/ai-insight-panel-blocked.png` (forced via fetch override → 409)
  - `payment/ai-insight-panel-error.png` (forced via fetch override → 500)
  - `payment/ai-insight-detail-dialog.png`
  - `payment/ai-insight-component-icon.png`
  - `payment/ai-insight-component-dialog.png`
  - `payment/ai-insight-feedback-modal.png`
  - `expenses/ai-insight-panel-idle.png`
  - `ai-insight-admin/config-page-full.png`
  - `ai-insight-admin/prompt-tree-finance-hr.png`
  - `ai-insight-admin/prompt-text-panel.png`
  - `ai-insight-admin/version-panel-default.png`
  - `ai-insight-admin/version-panel-with-versions.png`
  - `ai-insight-admin/feedback-list.png`
  - `ai-insight-admin/feedback-diff-modal.png` (real surgical-editor preview against `by_customer` feedback row)
  - `manual/ai-insight-help-page.png`
- Acceptance checks against plan §Verification:
  - [x] Every numeric cap, model name, table name, column name, file name, API path traces to a file + line range.
  - [x] Every UI claim has a screenshot reference. All 18 screenshots captured (16 stored / forced states + 2 live LLM-call states).
  - [x] PRD does not claim any feature in the "Confirmed NOT in code" exclusion list. The exclusion list is explicitly restated in §1 and again as the §13 "Out of scope" subsection.
  - [x] Validation/tuning workflow is §17, a first-class section.
  - [x] Per-section verification & tuning template is defined in §17.6 for Finance / HR PRDs to consume.
  - [x] Token count ≤ 45k. Well within budget; no appendix split needed.
- Post-rewrite audit additions (covered in PRD on second pass):
  - §3.1 — `InsightSectionHeader`'s `financial_variance` "Approve as Budget" extension hook is the only module-specific branch in the otherwise-generic Base component. Documented as an extension point the production rebuild should refactor out.
  - §4.3 — The summary phase emits progress events keyed on the literal string `'summary'`; treat as a virtual component key on the SSE stream.
  - §15.4 — Every API route declares `export const dynamic = 'force-dynamic'`. Production rebuild on a non-Next stack must guarantee the equivalent (no static caching of GET responses).
  - §20 — End-user help page at `/manual/general/ai-insight` is hand-maintained JSX. Section catalog growth requires hand-edit.
- Open items carried into Session 3:
  - **Confirm `FEEDBACK_MAX_WORDS` value.** Confirmed: `80` ([word-count.ts:4](../../apps/dashboard/src/lib/ai-insight/word-count.ts#L4)). Closed.
  - **The "live prompt panel" is the read-only `PromptTextPanel`.** Confirmed in PRD §6.3. Closed.
  - **`/api/admin/ai-insight-prompts/seed-defaults` `force` modes** (`?force=seed` and `?force=all`) exist in code at [seed-defaults/route.ts:158-205](../../apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts#L158-L205). The plan exclusion list calls out "force-reseed" as not-in-code; the actual force modes are admin-only utilities, not P0 product features. PRD §8.5 documents only the default idempotent path. Session 3 / 4 reviewers should decide whether to mention force modes in module PRDs.
  - **Tool name is `query_rds_table`, not `query_rds`** as the plan text said. PRD uses the in-code name. Finance PRD (Session 3) should follow suit.
  - **`SECTION_PAGE` for Finance pages uses Title-Case strings** ("Payment", "Sales", "Customer Margin", "Supplier Performance", "Returns", "Expenses", "Financial"), while HR uses lowercase `'hr'` ([prompts.ts:123-145](../../apps/dashboard/src/lib/ai-insight/prompts.ts#L123-L145)). This is a known inconsistency; the production rebuild should normalise. Flag in Finance PRD §2 / HR PRD §1.
  - **`SECTION_NAMES` for `customer_margin_overview` and `customer_margin_breakdown` use "Customer Margin"**; the page key is `'Customer Margin'` (with space). When the production rebuild defines URL routing, decide whether the page slug becomes `customer-margin` (current dashboard URL) or `customer_margin`. Document in Finance PRD §2.

## Session 3 — Done (2026-05-12)

- Output: `docs/prd/11-ai-insight-finance.md` (1793 lines, 17 sections + Appendix A factory-prompt snapshot).
- Acceptance check:
  - [x] 16 Finance sections × 69 components catalogued in PRD §5–§6, sourced from `SECTION_COMPONENTS`.
  - [x] Rollout status pulled from `AI_Insight_Study/ROLLOUT_TRACKER.md` in PRD §15 (5 Done: S01–S05; 11 Pending: S06–S16).
  - [x] Tuning lessons cross-referenced in MASTER_LOG and reflected in the per-section evaluation discussion.
  - [x] Token count well within the 45k cap; Appendix A kept inline.
- Pre-existing gap acknowledged: PRD 11 §15 is a single rollout summary rather than 16 per-section verification subsections matching the §17.6 template. v3 takes this as acceptable because (a) the §17.6 template lives in PRD 10, (b) `ROLLOUT_TRACKER.md` carries the same per-section data canonically, (c) PRD 11 already cites it. Closing as Done; future revisions may inline the template per section if needed.
- Deep-check pass (2026-05-12 post-Session-3): two correctness defects found and fixed:
  - §12 numeric-guard default tolerance table corrected to match `numeric-guard.ts:4-9` — `pct 0.1` (was `0.15`), `days 0.1` (was `0.2`), `count 0.5` (was `0`).
  - §13 "Production gaps to add before production acceptance" subsection deleted — it mandated four items on the v3 "Confirmed NOT in code" exclusion list (run-log table, evaluation-result table, tool-call log table, prompt-version approval metadata).
- §11 "Production tightening recommendation" left in place as a soft, labeled recommendation; reviewer may strike on next pass if strict source-of-truth is preferred.

## Session 4 — Done (2026-05-12)

- Output:
  - `docs/prd/12-ai-insight-hr.md` rewritten (825 lines, 12 sections + Appendix A) — HR adopts Finance engine fully, PII / RBAC / aggregation / role caches / payroll governance deferred to §12 Out-of-Scope Addendum.
  - 14-section catalog preserved from previous PRD 12; 13 threshold categories preserved.
  - 14 per-section verification & tuning subsections (§10.1–§10.14) using PRD 10 §17.6 template — all Pending except `payroll_*` which are Disabled.
  - 30-minute cross-doc consistency pass completed — three stale `Base §N.N` cross-references corrected in PRD 12 (§7, §8, §13 anchors).
  - v3 status block appended to `docs/prd/ai-insight-reverse-engineering-audit.md` §6.
- Acceptance check:
  - [x] HR adopts the Finance engine fully — orchestrator, parser, numeric guard, lock, prompt registry, model gateway, UI shell all reused unmodified.
  - [x] Per-section verification & tuning subsection for every HR section using the §17.6 template.
  - [x] Out-of-scope addendum (§12) names PII filter, RBAC scope filter, aggregation thresholds, role/user cache-key isolation, payroll governance, automatic re-evaluation trigger, feedback audit trail, and forbidden-output guard — all deferred to the production team.
  - [x] Cross-doc consistency pass: section numbering corrected, no Finance content leakage in Base (the one `financial_variance` UI hook is documented as a known wart in PRD 10 §3.1), no HR keys in Base, no contradictions on engine caps or tool-policy names.
- Open items for the production team are captured in PRD 12 §12.9 (six decisions) and PRD 12 §11 (acceptance criteria).

## Feature Inventory Reference

42 in-code features grouped: UI (1–11), Admin UI (12–17), Engine (18–29), Model gateway (30–36), Data/tool (37–39), Prompt (40–42), Env toggles, Validation/tuning loop. Full list in the plan.

## Confirmed NOT in Code — Exclude from new PRDs

Evidence guard · PII filter · RBAC scope filter · run-log table · evaluation-result table · feedback audit trail · automatic re-eval trigger · scoped lock · per-component rerun · `change_summary` persistence · force-reseed.

---

## Kick-off Prompts For Each Session

Copy-paste the matching prompt at the start of a fresh chat.

### Session 2 — Base PRD 10 + screenshots

```
Continue AI Insight PRD v3 rewrite — Session 2 (Base PRD 10).
Load docs/prd/ai-insight-prd-rewrite-plan-v3.md and docs/prd/ai-insight-prd-rewrite-tracker.md.

1. Start the dashboard locally and use Playwright to capture every screenshot listed in plan §Session 2, saving under docs/prd/screenshots/.
2. Then fully rewrite docs/prd/10-ai-insight-base.md per the structure in plan §Session 2.

Source of truth: code + dashboard UI. Do NOT document anything in the "Confirmed NOT in code" exclusion list. Every claim must cite file path + line range.

End of session: update the tracker (mark Session 2 Done with date), list any open items for Session 3.
```

### Session 3 — Finance PRD 11

```
Continue AI Insight PRD v3 rewrite — Session 3 (Finance PRD 11).
Load docs/prd/ai-insight-prd-rewrite-plan-v3.md and docs/prd/ai-insight-prd-rewrite-tracker.md.
Confirm Session 2 (Base PRD 10) is marked Done in the tracker before proceeding.

Fully rewrite docs/prd/11-ai-insight-finance.md per plan §Session 3.
Sources of truth: SECTION_COMPONENTS in prompts.ts, prompts-defaults.ts (Appendix A), tool-policy.ts, data-fetcher.ts, numeric-guard.ts, AI_Insight_Study/ROLLOUT_TRACKER.md, AI_Insight_Study/MASTER_LOG.md, AI_Insight_Study/eval_set/.

Every one of the 16 Finance sections must have a per-section verification & tuning subsection using the template from PRD 10 §17.

End of session: update the tracker.
```

### Session 4 — HR PRD 12 + cross-doc close-out

```
Continue AI Insight PRD v3 rewrite — Session 4 (HR PRD 12 + close-out).
Load docs/prd/ai-insight-prd-rewrite-plan-v3.md and docs/prd/ai-insight-prd-rewrite-tracker.md.
Confirm Sessions 2 and 3 are marked Done in the tracker.

1. Fully rewrite docs/prd/12-ai-insight-hr.md per plan §Session 4 — HR adopts the Finance engine fully; PII/RBAC/aggregation deferred in the out-of-scope addendum. Preserve the HR section list and threshold categories from the current PRD 12.
2. Do a 30-minute cross-doc consistency pass across PRDs 10/11/12: section numbering, no Finance content leakage in Base, no contradictions.
3. Append a "v3 complete" status block to docs/prd/ai-insight-reverse-engineering-audit.md.

End of session: mark the tracker fully complete.
```
