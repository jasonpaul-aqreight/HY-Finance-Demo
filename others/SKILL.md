---
name: aqreight-uat-test-v1
description: >
  Comprehensive UAT test runner. Reads PRD(s) and change docs, extracts all
  requirements (FR/NFR/User Stories grouped by Epic), writes Playwright E2E
  tests, runs them against staging (headed mode) covering frontend, backend
  API, and RBAC layers, performs adversarial exploratory testing beyond PRD
  scope with inferred organizational personas, and produces a structured
  markdown report with evidence appendix. Use when the user provides a PRD
  and staging URL and wants rigorous, independent testing.
metadata:
  model: opus
---

## Use this skill when

- User provides PRD(s), change docs, or review notes AND a staging URL with login credentials
- User asks to test, verify, or audit a staging environment against requirements
- User says "run UAT", "test against staging", "verify PRD", "test FRs/user stories", "RBAC test"

## Do not use this skill when

- Writing code, fixing bugs, or implementing features (not testing)
- No PRD or requirements document provided
- No staging/live environment to test against

---

## Phase 1: Requirements Extraction

### 1.1 Read ALL Documents
- Read every PRD, review note, change log provided — **every line, every section**
- If multiple documents exist, treat the **latest as authoritative**
- Where documents overlap, the newer version supersedes
- Flag any contradictions found between documents (informational only, don't block)

### 1.2 Extract and Categorize
Extract every requirement into a structured inventory:

| Extract | Format | Example |
|---------|--------|---------|
| Functional Requirements | FR# + one-line description + Epic mapping | FR87 (Epic 4): Customer data merge with name normalization |
| Non-Functional Requirements | NFR# + one-line description + category | NFR16 (Performance): Leads page <2s |
| User Stories | Story# + title + acceptance criteria | Story 1: Siti (Sales Rep) — full customer picture |
| Change Items | Item# + description + source doc | R5-6: Rename Financial Summary → Sales Summary |

### 1.3 Group by Epic
Organize ALL FRs and NFRs into their Epic groupings from the PRD. Example:
```
Epic 1: Infrastructure — FR1, NFR1-NFR4, NFR8-9, NFR14
Epic 2: Auth & RBAC — FR2, FR73, FR74
Epic 3: Master Data — FR21, FR22, FR49-FR51
Epic 4: Customer & Lead — FR12, FR54, FR70-72, FR76-78, FR82-83, FR86-91
Epic 5: Sales Operations — FR25, FR52-56, FR58-64, FR68-69, FR84-85, FR105-119
```

### 1.4 Present Counts
Before proceeding, present to the user:
- Total FRs, NFRs, User Stories, Change Items
- Count per Epic
- Ask user to confirm before writing tests

---

## Phase 2: Categorize Testability

Split every requirement into exactly one category:

| Category | Definition | Method |
|----------|-----------|--------|
| **Frontend-testable** | Has visible UI elements on staging | Playwright browser tests |
| **Backend-API-testable** | Has an API endpoint that responds with JSON | Network interception from authenticated browser context |
| **RBAC-testable** | Requires multi-role login to verify access control | Separate `browser.newContext()` per role |
| **Not testable from outside** | Requires infra access, DB queries, cron runtime, or ML training data | Document as "Not Testable" with specific reason |

### Categorization Rules
- If a requirement touches BOTH frontend and backend, test BOTH layers
- If a requirement mentions role-based access, it MUST be RBAC-tested (not just admin)
- "Not testable" must always state WHY (e.g., "requires AWS console", "needs 6 months of data", "cron job — no observable side effect within test window")

---

## Phase 3: Environment Discovery

### 3.1 Playwright Setup
- Configure `playwright.config.ts` with staging baseURL, timeouts, headed mode defaults
- Create `auth.setup.ts` that logs in with provided credentials and saves storage state
- Verify login works before proceeding

### 3.2 Page Discovery
For every page in the app:
- Navigate and capture `document.body.innerText`
- Click every button, tab, dropdown — capture what opens (modals, drawers, forms)
- Extract all column headers, filter labels, form field labels
- Record which pages exist vs return 404

### 3.3 API Discovery
Intercept all JSON API calls the frontend makes:
```typescript
// CORRECT: intercept from authenticated browser (tokens transfer automatically)
page.on('response', async (response) => {
  const ct = response.headers()['content-type'] || '';
  if (ct.includes('json') && !response.url().includes('_next/')) {
    captured.push({ method: response.request().method(), url: response.url(), status: response.status(), data: await response.json() });
  }
});
await page.goto('/some-page');
```

**DO NOT** use `fetch()` from `page.evaluate()` — auth tokens may not transfer to direct backend paths.
**DO NOT** use the Playwright `request` fixture without stored auth — gets 401.

Log every unique endpoint: method, path, status code, response structure sample.

### 3.4 RBAC Discovery
1. Navigate to admin user management — list ALL existing accounts with roles
2. Navigate to admin roles page — list ALL roles with levels and permission counts
3. Check for RBAC matrix page — capture expected permission matrix if it exists
4. Count total roles in system. Identify which have testable accounts (can log in)
5. For missing roles, attempt account creation via admin UI
6. Verify each created account can actually log in
7. If creation fails, **identify root cause** and report as a finding (e.g., "Add User form creates DB record but does not provision auth identity — users cannot log in")
8. Account for EVERY role — if 14 roles exist, report status for all 14, not just the ones you tested

### 3.5 Cleanup
Delete ALL discovery test files after extracting information. Only keep real test files.

---

## Phase 4: Write Tests

### 4.1 File Structure
```
tests/
  auth.setup.ts                       # Login + save session
  fr-{epic}-{module}.spec.ts          # FR tests grouped by Epic + module
  nfr.spec.ts                         # Non-functional requirements
  user-story-{N}-{name}.spec.ts       # One file per user story
  review-changes.spec.ts              # Change items from review/change docs
  api-backend-frs.spec.ts             # Backend API tests via network interception
  rbac-full.spec.ts                   # Multi-role RBAC tests (all available roles)
  adversarial.spec.ts                 # Exploratory tests beyond PRD scope
```

### 4.2 Frontend Test Standards (non-negotiable)
- **Actually click** buttons — don't just check `toBeVisible()`
- **Actually fill** filters — verify the data changes (row count, content)
- **Actually open** modals/drawers — verify their content fields, then cancel/close
- **Verify CSS values** — for color-coded elements, extract `getComputedStyle()` and assert specific RGB values
- **Verify data counts** — "9,262 customers" not just "table exists"
- **Test all entry points** — if a page is reachable from 2+ places, test both
- **Click through all tabs** — verify each loads without errors
- **Test filter interactions** — apply filter, verify rows change, verify row content matches filter

### 4.3 Backend API Test Standards
```typescript
// Capture API calls via network interception (rides existing auth)
async function captureApiCalls(page, navigateTo, waitMs = 3000) {
  const captured = [];
  page.on('response', async (response) => {
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json') && !response.url().includes('_next/')) {
      try {
        captured.push({ status: response.status(), url: response.url(), data: await response.json() });
      } catch {}
    }
  });
  await page.goto(navigateTo);
  await page.waitForTimeout(waitMs);
  return captured;
}
```

For each API endpoint verify:
- Status code (200, 403, 404)
- Response has expected top-level keys (`data`, `meta`, `total`)
- Data items have expected fields (field names from PRD spec)
- Pagination works (`page`, `limit`, `total`, `totalPages`)

### 4.4 RBAC Test Standards
```typescript
// MUST use fresh browser context per role — session bleed causes false results
test.use({ storageState: { cookies: [], origins: [] } });

// For serial login tests — parallel causes form interference
test.describe.configure({ mode: 'serial' });

// Each role gets its own context
const ctx = await browser.newContext();
const page = await ctx.newPage();
await loginAs(page, roleEmail);
// ... test sidebar, page access, API access ...
await ctx.close();
```

Test for EVERY role that has a testable account:
1. **Sidebar visibility** — which menu items appear vs hidden
2. **Page access** — navigate to every route, record 200 vs 403 vs 404
3. **API access** — specific endpoints that should be role-restricted
4. **Data scoping** — do different roles see different record counts (branch isolation)
5. **Operation access** — can this role create/edit/delete? Open admin forms?

Compare results against:
- RBAC matrix in admin panel (if exists)
- PRD role specifications
- Flag any mismatch (sidebar shows link but API returns 403, or vice versa)

### 4.5 Adversarial Test Standards

After completing ALL PRD-based tests, run adversarial tests in two layers:

#### Layer A: Functional Adversarial (Inferred Personas)
1. **Infer personas** from the PRD domain — read what the product does and infer real-world organizational roles that would use it beyond what's explicitly documented
2. **Label as "Inferred Personas"** in the report — keep them separate from documented personas
3. Test realistic edge cases per persona:
   - Empty form submission — does validation catch it?
   - Boundary values — 0, negative numbers, extremely long text
   - Duplicate submission — double-click submit buttons
   - Navigation edge cases — browser back button after form submit
   - Cross-role data leakage — can one user access another's data by changing URL IDs?
   - Orphaned references — what happens when linked data is missing?
   - Feature interaction — does using Feature A break Feature B?

#### Layer B: Light Security
- Direct URL manipulation — `/admin/users` as non-admin role
- API endpoint probing — attempt destructive paths without auth
- Auth token expiry — does the session handle timeout gracefully?
- XSS basics — enter `<script>alert(1)</script>` in text fields
- SQL injection basics — enter `'; DROP TABLE customers; --` in search fields

---

## Phase 5: Run Tests

### 5.1 Execution Order
1. **Auth setup** first
2. **FR tests by Epic** — parallel (`--workers=4`, `--headed`)
3. **NFR tests** — parallel, headed
4. **User Story tests** — parallel, headed
5. **Backend API tests** — parallel, headed
6. **RBAC tests** — **serial** (`--workers=1`, `--headed`) to avoid session interference
7. **Adversarial tests** — serial, headed (may create/modify test data)

### 5.2 Commands
```bash
# FR + NFR + User Story tests
npx playwright test tests/fr-*.spec.ts tests/nfr.spec.ts tests/user-story-*.spec.ts --headed --reporter=list

# Backend API tests
npx playwright test tests/api-backend-frs.spec.ts --headed --reporter=list

# RBAC tests (serial)
npx playwright test tests/rbac-full.spec.ts --workers=1 --headed --reporter=list

# Adversarial tests (serial)
npx playwright test tests/adversarial.spec.ts --workers=1 --headed --reporter=list
```

### 5.3 Fix and Re-run
- Fix selector issues (strict mode violations — use `.first()`, `getByRole()`, or scoped locators)
- Fix timing issues (add `waitForTimeout` or `waitForLoadState('networkidle')` for heavy pages)
- Re-run until stable — do not ship a report with flaky test results
- Capture full console output with all `console.log` evidence

### 5.4 Test Data Hygiene
For any test that creates data:
- Prefix test records with `[UAT-TEST]` or `test.` in name/email fields
- After test completes, delete created records via API or UI
- If cleanup fails, log it as a finding — never leave test data silently

---

## Phase 6: Produce Report

Output the report as a **markdown file** in the project directory.

### 6.1 Result Labels

| Label | Meaning | When to use |
|-------|---------|-------------|
| **Pass** | In PRD + correctly implemented on staging | All assertions pass with evidence |
| **Fail** | In PRD + exists on staging but incomplete or incorrect | Feature exists but doesn't match spec (wrong label, missing field, partial) |
| **Not Implemented** | In PRD but not on staging at all | 404, no UI element, endpoint doesn't exist |
| **Out of Scope** | On staging but not in PRD | Feature exists that nobody asked for |
| **Not Testable** | Cannot verify from outside | Always state WHY |

### 6.2 Main Report: `uat-report.md`

**Section 1: Executive Summary**
- Date, staging URL, total test count, overall pass/fail/not-implemented counts
- Top 5 critical issues (one line each)

**Section 2: FR Results by Epic**
For each Epic:
- Epic name and scope
- Table: FR# | Description | Layer (FE/BE/RBAC) | Result | Evidence

**Section 3: NFR Results**
- Table: NFR# | Description | Category (Performance/Security/Data/Integration/Process) | Result | Evidence

**Section 4: User Story Results**
- Table: Story# | Title | Test Count | Result | Key Verification Points

**Section 5: RBAC Results**
- 5a. Sidebar Visibility Matrix: ALL roles × modules (✓/✗)
- 5b. Page Access Matrix: ALL roles × pages (✓/403/404)
- 5c. RBAC-Specific Findings: FR-mapped checks with pass/fail + root cause
- 5d. Untestable Roles: which roles, why, what's needed to unblock

**Section 6: Change Item Results** (if review/change docs provided)
- Table: Item# | Description | Result | Evidence

**Section 7: Adversarial Findings**
- 7a. Functional Edge Cases: what was tried, what broke
- 7b. Inferred Persona Tests: persona name, scenario, result
- 7c. Light Security Findings: XSS, injection, URL manipulation results

**Section 8: Bugs Discovered** (proactive findings not mapped to any FR)
- Table: Bug# | Description | Severity | Root Cause | Impact | Recommended Fix

**Section 9: Summary Table**

| Category | Total | Pass | Fail | Not Implemented | Out of Scope | Not Testable |
|----------|-------|------|------|-----------------|-------------|-------------|
| FR (by Epic) | | | | | | |
| NFR | | | | | | |
| User Stories | | | | | | |
| RBAC Roles | | | | | | |
| Change Items | | | | | | |
| Adversarial | | | | | | |

**Section 10: Issues Requiring Attention**
Prioritized list (HIGH / MEDIUM / LOW), each with:
- FR/NFR number (if applicable)
- What's wrong
- Root cause category
- Who's affected
- Recommended action

### 6.3 Evidence Appendix

Create an `evidence/` directory alongside the report:

| File | Contents |
|------|----------|
| `evidence/api-responses.md` | Raw JSON snippets from every API endpoint tested (status, response sample) |
| `evidence/rbac-matrix-actual.md` | Full role × page × API access matrix with exact results |
| `evidence/console-logs.md` | All console.log output from test runs (timings, counts, field lists) |
| `evidence/screenshots/` | Playwright failure screenshots + key state screenshots per role |
| `evidence/selectors.md` | All CSS selectors/locators used (for future test maintenance) |
| `evidence/adversarial-log.md` | Raw input/output from adversarial tests (what was submitted, what happened) |

### 6.4 Bug Discovery & Root Cause Standards

When something fails, always identify:

1. **What was expected** — cite specific FR/NFR number and text from PRD
2. **What actually happened** — cite specific evidence (status code, visible text, CSS value, API response)
3. **Root cause category:**

| Category | Example |
|----------|---------|
| **RBAC mismatch** | Sidebar shows menu item but API returns 403 |
| **Endpoint not implemented** | API returns 404 for a PRD-specified endpoint |
| **Permission misconfigured** | Role gets 403 but RBAC matrix says access granted |
| **Integration gap** | Form submits to DB but doesn't call external service (e.g., auth provider not provisioned) |
| **Data not populated** | Field exists in UI but shows N/A / empty / wrong value |
| **Not built yet** | Zero UI or API evidence of a PRD feature |
| **Rename not applied** | PRD says rename X→Y but staging still shows X |
| **Partial implementation** | Feature exists but missing fields/buttons/tabs specified in PRD |

4. **Impact** — who is affected and how (e.g., "all 94 sales reps cannot see their goals")
5. **Action required** — specific fix needed (e.g., "add SALES to allowed roles in goal-scores controller")

---

## Key Rules

### Strictness
- **Partial implementation = Fail** — always detail what's missing
- **Untested = "Not Testable"** — never mark as Pass
- **Evidence required** — every result must cite element text, API response, CSS value, or status code
- **Count everything** — if PRD says 14 roles, account for all 14. "6 of 14 tested" not "all roles tested"

### Thoroughness
- **Speed is not a virtue** — thoroughness matters more than finishing fast
- **Run headed** — user must see browsers clicking through the app
- **Test all roles** — not just admin
- **Test all entry points** — not just the happy path
- **Click every button** — not just check it exists

### Independence
- **Trust the PRD** as source of truth for requirements
- **Do NOT trust** developer claims, commit messages, or "it works on my machine"
- **Only verify** what is observable on staging
- **Discover proactively** — if a feature is broken in a way nobody asked about, report it anyway

### Adversarial Mindset
- **Infer real users** from the PRD domain — test as those users would actually behave
- **Label inferred personas** separately from documented ones
- **Try to break things** — empty forms, bad data, cross-role access, URL manipulation
- **Report what you find** even if outside PRD scope — label as "Out of Scope" or "Adversarial Finding"

### Test Data Hygiene
- **Create test data when needed** — prefix with `[UAT-TEST]` or `test.`
- **Clean up after** — delete test records via API or UI
- **If cleanup fails, log it** — never leave test data silently

---

## Limitations & Risks

### Patchable Within This Skill

| Limitation | Patch |
|-----------|-------|
| PRD may have gaps (missing requirements) | Adversarial layer infers personas and tests beyond PRD |
| PRD may be ambiguous | Skill flags ambiguity as a finding with specific text cited |
| Single browser can't test concurrency | RBAC tests use multiple fresh browser contexts |
| Frontend-only testing misses backend logic | API interception layer validates response structure and data |
| RBAC testing limited to available accounts | Skill attempts to create missing role accounts; reports gap AND root cause if it can't |
| Test selectors break when UI changes | Evidence appendix includes `selectors.md`; prefer role/label selectors over CSS classes |
| Staging data may differ from production | Report documents exact data state (counts, samples) for context |

### NOT Patchable Within This Skill

| Limitation | Why | Workaround |
|-----------|-----|-----------|
| **Infrastructure testing** (uptime, scaling, encryption, WAF) | Requires cloud console access | Mark "Not Testable — requires infra access" |
| **Database-level assertions** (schema validation, orphaned records) | No direct DB access from browser | Infer from API responses where possible |
| **Cron job / background worker verification** (auto-alerts, scheduled tasks) | Side effects on timer, not on-demand | Create trigger, wait, check for effect; if inconclusive, flag |
| **ML/AI accuracy** (scoring accuracy, prediction quality) | Requires months of operational data | Mark "Not Testable — requires operational data" |
| **Mobile device testing** (specific phones, network conditions) | Playwright runs desktop browsers | Can test responsive viewport, not real device |
| **External service availability** (third-party API uptime) | Depends on third-party state | If 503/timeout, report as "external service unavailable" not "feature broken" |
| **Multi-user concurrency** (race conditions, locking) | No real concurrency pressure from single browser | Note limitation; recommend load testing tools (k6, Artillery) |
| **Production data fidelity** (seed data vs real data) | Staging has test data | Document data state; flag if results depend on specific data conditions |
