# AI Insight Production Handoff

Use this as the entry point for the production developer (human or AI agent) implementing Finance AI Insight from `ai-insight-docs/`.

## Readiness

The implementation-readiness audit is complete. `IMPLEMENTATION_READINESS_TRACKER.md` records no remaining P0/P1 documentation blockers. The remaining items below are production/product decisions and hardening tasks, not documentation gaps.

Primary tracker:

- `ai-insight-docs/IMPLEMENTATION_READINESS_TRACKER.md`

## What to include in the implementer bundle

**In scope (read these):**

- `00`–`09` + `04a` — the engine spec (build sequence below).
- `12-finance-domain-config.md` — Finance domain pack (Budget Setting + Variance KPI).
- `11-validation-and-tuning.md` — model quality and numeric-trust acceptance.
- `assets/` — reference screenshots (non-load-bearing confirmation artefacts, linked from `07`/`08`/`09`/`12` §7). The wireframes, state matrix, and per-step assertions in the docs are the normative spec; the images only confirm them.
- `IMPLEMENTATION_READINESS_TRACKER.md` — open decisions and hardening list.

**Available but optional:**

- `10-adding-a-domain-pack.md` — Spine guide for putting a *second* domain on the unchanged engine (HR, etc.). Not needed to implement Finance; read only if you also need to add another pack. **See the HR Transfer Warning below before treating this as an HR implementation plan.**

**Exclude (not specification):**

- `_TEMPLATE.md` — empty 8-part scaffold used while writing the docs; not an implementation artefact.

## Build Order

Build the shared engine in this order:

1. `00-overview.md`
2. `01-storage.md`
3. `02-domain-catalog-and-thresholds.md`
4. `03-model-provider.md`
5. `04-insight-generation-and-prompts.md` and `04a-prompt-catalog.md`
6. `05-batch-orchestration.md`
7. `06-api.md`
8. `07-frontend.md`
9. `08-admin.md`
10. `09-end-to-end-walkthrough.md`

Then apply Finance-specific work:

1. `12-finance-domain-config.md`
2. `11-validation-and-tuning.md`

## Must Resolve Before Production Enablement

1. **RDS dialect and driver.** Choose one concrete dialect for `query_rds_table`. The reference uses a Node `pg` pool, but the drill-down SQL shape is SQL Server-like (`dbo.*`, `SELECT TOP`, bracket-quoted columns). Align driver, generated SQL, examples, and tests before enabling production drill-down tools.
2. **Other Income budget row.** Decide whether `Other Income` is editable. If yes, add it to the Budget Setting dialog, save whitelist, variance-KPI route, screenshots, and verification. If no, remove it from the production migration seed and treat it as unsupported.
3. **Financial variance prompt drift.** Update `fv_variance_summary` in `prompts-defaults.ts` after product approval so it matches the current Budget Setting contract: Net Sales, Cost of Sales, Operating Costs, saved tolerance per row, and no fixed +/-5/15 budget rule.
4. **Production auth.** Replace the sandbox `x-user-role` admin gate with real server-side authentication and authorization.

## Production Hardening Tasks

- Reject negative annual budgets on both client and server.
- Add explicit `Cache-Control: no-store` to budget, variance-KPI, and all admin routes.
- Decide whether saving Budget Setting must immediately revalidate variance-KPI cards.
- Add request-key/cancel protection to the section insight hook if the reference hook remains the rebuild base.
- If the batch trigger runs outside a long-lived server process, move it to a durable worker or queue instead of relying on an in-process promise.
- Refresh or parameterize `AI_Insight_Study/HOW_TO_RUN_ITERATION.md` before using it for the next optimization iteration.

## Verification

Use the verification checkpoints inside each doc, then run the full path in `09-end-to-end-walkthrough.md`.

For Finance Budget Setting and Variance KPI, the binding acceptance checks are in `12-finance-domain-config.md` section 8.

For model quality and numeric trust, use `11-validation-and-tuning.md`. Quality and trust remain non-negotiable: every RM, percent, days, and count citation must trace to raw data or tool results.

## HR Transfer Warning

Do not copy Finance AI Insight into `Hoi-Yong_HR` without a separate HR design decision. HR needs at least:

- PII filtering before model exposure.
- Server-side RBAC scope filtering.
- Role/user-specific caching.
- A decision on whether HR should use the Finance two-phase pattern or a simpler HR briefing pattern.

Finance AI Insight is a strong reference, not a complete HR production design.
