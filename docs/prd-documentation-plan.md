# Finance Dashboard — PRD Documentation Plan

> **Goal:** Reverse-engineer the Finance demo dashboard into tech-stack agnostic documentation that a PM can use to create a PRD for rebuilding the Finance module in a Production app (which already has Sales and HR modules).
>
> **Created:** 2026-04-03
> **Last Updated:** 2026-04-03 (Session 11 completed)

---

## Context

- **Demo dashboard:** This repo (`Hoi-Yong_Finance`) — Next.js + React + TypeScript + PostgreSQL + Recharts
- **Production system:** Different tech stack (undecided). Already has Sales and HR dashboard modules built
- **Existing docs:** Comprehensive per-page specs already exist in `docs/pages/` but contain tech-specific references (API routes, component names, TypeScript types, SQL). These must be rewritten as pure business + UX specs.
- **Existing assets:** Screenshots in `docs/screenshots/`, user textbook in `docs/textbook/`

---

## Output Structure

All PRD-ready docs will be written to `docs/prd/`:

```
docs/prd/
  00-business-domain.md          # Business context, rules, data model (plain English)
  01-sales.md                    # Sales Report page spec
  02-payment.md                  # Payment Collection page spec
  03-return.md                   # Credit Note / Return / Refund page spec
  04-financial-statements.md     # P&L and Balance Sheet page spec
  05-expenses.md                 # Cost Tracking page spec
  06-customer-margin.md          # Customer Profit Margin page spec
  07-supplier-margin.md          # Supplier Profit Margin page spec
  08-settings-and-profiles.md    # Payment Settings + Customer/Supplier Profile modals
  09-design-standards.md         # UI/UX patterns, layout rules, lessons learned
  screenshots/                   # Captured via Playwright (linked from page specs)
```

---

## Per-Page Document Template

Every page spec (docs 01-08) follows this structure:

1. **Purpose & User Goals** — What business questions does this page answer?
2. **Page Layout** — Top-to-bottom wireframe description (grid positions, responsive behavior, section ordering)
3. **KPI Cards** — Each card: label, formula in plain English, formatting, color rules
4. **Charts** — Each chart: type, axes, data series, interactions (hover, click), legends
5. **Tables** — Each table: columns, sorting, pagination, search, export, row click behavior
6. **Filters & Controls** — All user-adjustable parameters, presets, defaults
7. **Cross-Page Navigation** — Links/modals triggered from this page (e.g., customer profile)
8. **Business Rules** — Domain-specific logic, edge cases, data conventions
9. **Screenshot References** — Links to captured screenshots

**What to EXCLUDE from all docs:**
- API route paths (e.g., `/api/sales/trend`)
- Component or file names (e.g., `SalesTrendChart.tsx`)
- SQL queries or column names
- TypeScript types or interfaces
- Library names (e.g., Recharts, shadcn/ui)
- Framework-specific patterns (e.g., App Router, server components)

**What to INCLUDE:**
- Business logic in plain English
- Layout descriptions (positions, sizes, responsive behavior)
- Data relationships in business terms
- User interaction flows
- Formatting rules (currency, dates, percentages)
- Design decisions and rationale from lessons learned

---

## Design Standards & Lessons Learned (Doc 09)

Consolidated from project memory. These inform all page specs:

### Table Standards
- All columns sortable with toggle sort indicator
- All data left-justified (directive from tech lead — no right-aligned numbers)
- Entity names (customer/supplier) are the ONLY clickable element in a row — styled as blue underlined links. Rows themselves are NOT clickable (eliminates edge cases with text selection, checkboxes, sparklines)
- Stable container height — when filters reduce rows, container maintains minimum height to prevent page jumping
- Server-side pagination with selectable page sizes (10, 25, 50). Exception: hierarchical/financial tables (P&L, Balance Sheet) use Excel export only
- Excel export (.xlsx) button on all data tables — never CSV
- Action buttons use consistent outline styling, never ghost/muted

### Readability Rules
- Never use gray or muted text for important labels — end users are older executives who need high readability
- High contrast throughout; all text must be easily readable

### Navigation Behaviors
- Clicking customer from Payment page opens Outstanding Invoices tab (not profile overview) — context-appropriate default tab
- Customer/Supplier profile modals open to different default tabs depending on calling page

### Layout Patterns
- Fixed sidebar (collapsible: 64px collapsed, 224px expanded)
- Main content max-width 1600px, centered
- Page banner at top (title + description)
- KPI cards row below banner
- Charts and tables in main body
- Responsive: multi-column desktop, single-column mobile

---

## Session Plan & Progress

### Session 1: Master Plan
- [x] Assess existing documentation completeness
- [x] Identify tech-specific content to purge
- [x] Collect design standards and lessons from memory
- [x] Create this master plan document
- [x] Create `docs/prd/` directory structure

### Session 2: Business Domain & Rules (Doc 00) — COMPLETED 2026-04-03
- [x] Reverse-engineered from live codebase (existing docs were outdated)
- [x] Tech-agnostic business overview with company profile, target users, module overview
- [x] Plain-English data model (entities, transaction types, product taxonomy, ~5.2K words)
- [x] All business rules & formulas: revenue, margin, credit scoring, DSO, return reconciliation, supplier attribution, P&L structure, expense categorization
- [x] Navigation structure, shared features (date filter, customer/supplier profile modals)
- [x] Data sync architecture and schedule documented
- [x] Data conventions summary table
- **Output:** `docs/prd/00-business-domain.md`

### Session 3: Sales Report (Doc 01) — COMPLETED 2026-04-03
- [x] Reverse-engineered from live codebase (not old docs — found significant drift)
- [x] Tech-agnostic page spec: purpose, layout, KPI cards, charts, tables, filters, navigation, business rules
- [x] Discovered and documented actual vs. documented differences:
  - UI has 4 group-by dimensions (not 7) — fruit includes country/variant as sub-filters
  - Stack-by feature not implemented in current version
  - Prior period overlay not implemented in current version
  - Table uses pagination (10/25/50/100), not 500px scroll
  - Only customer name (blue link) is clickable, not entire row
- [x] Screenshots deferred to Session 12 (per plan)
- **Output:** `docs/prd/01-sales.md`

### Session 4: Payment Collection (Doc 02) — COMPLETED 2026-04-03
- [x] Reverse-engineered from live codebase (not old docs — found major drift)
- [x] Tech-agnostic page spec: purpose, layout, KPI cards, charts, tables, filters, navigation, business rules
- [x] Discovered and documented actual vs. documented differences:
  - Credit scoring completely replaced: V1 (5-factor) → V2 (4-factor model)
  - V2 factors: Utilization 40%, Overdue Days 30%, Timeliness 20%, Double Breach 10% (V1 had Consistency + Breach as separate factors)
  - Risk thresholds changed: V2 uses Low ≥75 / High ≤30 (V1 used Low ≥85 / Moderate ≥65)
  - Page layout restructured into two distinct sections (Period vs Snapshot) — old docs showed 5 zones in a single flow
  - KPI cards split: 3 period + 3 snapshot (not 6 in one row)
  - Table has category + risk level filter dropdowns (not documented in old specs)
  - Table page size is 25 (not 20), exports Excel (not CSV)
  - Only customer name (blue link) is clickable, not entire row
  - Customer profile opens to Outstanding Invoices tab (not "payment" tab)
  - Settings dialog has visual risk threshold bar and expandable scoring explanation
- [x] Screenshots deferred to Session 12 (per plan)
- **Output:** `docs/prd/02-payment.md`

### Session 5: Return / Credit Note (Doc 03) — COMPLETED 2026-04-03
- [x] Reverse-engineered from live codebase (not old docs — found significant drift)
- [x] Tech-agnostic page spec: purpose, layout, KPI cards, charts, tables, filters, navigation, business rules
- [x] Discovered and documented actual vs. documented differences:
  - UI has 4 KPI cards (not 5) — Return Records count merged as subtitle of Total Returns
  - Page uses two named sections ("Return Trends" + "Unresolved Returns") with section headers, not single scroll with visual separator
  - Table has 7 columns (added Code column), default sort is unresolved desc (not total_return_value)
  - Table has status filter dropdown (Unresolved/Resolved/All), search, and defaults to "Unresolved" view
  - Table page sizes: 25/50/100 (not 20), includes Excel export
  - Only customer name (blue link) is clickable, not entire row
  - Product exclusions expanded: also excludes RE-* prefix and ZZ-ZZ-ZZPL (pallet) items
  - Refund log (from API) is not displayed in the UI — only settlement summary shown
- [x] Screenshots deferred to Session 12 (per plan)
- **Output:** `docs/prd/03-return.md`

### Session 6: Financial Statements (Doc 04) — COMPLETED 2026-04-03
- [x] Reverse-engineered from live codebase (not old docs — found drift in route, filters, data scope)
- [x] Tech-agnostic page spec: purpose, layout, KPI cards (8 in 2 rows), charts (3), tables (3), filters, business rules
- [x] Discovered and documented actual vs. documented differences:
  - Route is `/financial` (docs said `/pnl`)
  - Project filter not rendered in UI (exists in API but unused)
  - Range control (fy/last12/ytd) is internal state only — no UI control exposed
  - KPI data uses YTD totals from full P&L statement (not latest-month values)
  - Multi-year comparison limited to ±3 years around selected FY (not all years)
  - FY defaults to 2nd most recent (most complete data), not latest
  - BS table uses alternating row shading for readability
- [x] Screenshots deferred to Session 12 (per plan)
- **Output:** `docs/prd/04-financial-statements.md`

### Session 7: Expenses / Cost Tracking (Doc 05) — COMPLETED 2026-04-03
- [x] Reverse-engineered from live codebase (not old docs — found significant drift)
- [x] Tech-agnostic page spec: purpose, layout, KPI cards, charts, tables, filters, business rules
- [x] Discovered and documented actual vs. documented differences:
  - OPEX categories completely restructured: 11 → 13 categories with different names (e.g., "Payroll" → "People & Payroll", new: Office & Supplies, Equipment & IT, Professional Fees, Marketing & Entertainment, Tax & Compliance)
  - No granularity toggle — trend chart is monthly only (old docs showed Daily/Weekly/Monthly)
  - Export format is Excel (.xlsx), not CSV as old docs stated
  - OPEX table categories expanded by default (old docs said collapsed)
  - Breakdown tables use tabbed interface with height-locking (not separate sections)
  - All data left-justified per project standard (old docs said right-aligned numbers)
  - No URL parameter persistence (old docs documented URL params)
  - Data sourced from pre-computed monthly table (not direct GL joins)
  - Shared category legend below charts (not documented before)
  - Category mapping uses parent-child account hierarchy (not pattern matching)
- [x] Screenshots deferred to Session 12 (per plan)
- **Output:** `docs/prd/05-expenses.md`

### Session 8: Customer Margin (Doc 06) — COMPLETED 2026-04-03
- [x] Reverse-engineered from live codebase (not old docs — found significant drift)
- [x] Tech-agnostic page spec: purpose, layout, KPI cards (5), charts (3 with toggles), tables (2 tabbed), filters, business rules
- [x] Discovered and documented actual vs. documented differences:
  - 7 components built but unwired from shell (MarginByTypeChart, ProductGroupMarginChart, TopByMarginChart, TopByProfitChart, ProductCustomerMatrix, MonthlyPivotTable, DataQualityPanel)
  - Customer/type/agent/product group filters fully built in backend but not exposed in UI
  - Multi-select customer combobox added in table header (not in old docs)
  - Credit Note Impact default sort is margin_lost desc (old docs said return_rate)
  - Sparkline + arrow trend indicator per customer row (not documented before)
  - Profile modal uses redesigned version with "Sales" tab default
  - Export is Excel (.xlsx), not CSV
  - All data left-justified per project standard
- [x] Documented item-level costing vs GL-based costing caveat
- [x] Documented red flags guide for business users
- [x] Screenshots deferred to Session 12 (per plan)
- **Output:** `docs/prd/06-customer-margin.md`

### Session 9: Supplier Margin (Doc 07) — COMPLETED 2026-04-03
- [x] Reverse-engineered from live codebase (not old docs — found significant drift)
- [x] Tech-agnostic page spec: purpose, layout, KPI cards (5 with "Est." prefix), charts (4 types), tables (2 tabbed), filters, business rules
- [x] Discovered and documented actual vs. documented differences:
  - Page title changed: "Supplier Profit Margin Report" → "Supplier Performance Report"
  - KPI labels carry "Est." prefix to highlight attribution-based estimates; formula subtitles shown
  - Distribution chart is vertical bar chart (not donut as documented)
  - Item Pricing tab renamed "Price Comparison" with complete layout redesign: 4-column filter row (Search, Fruit, Country, Variant) + side-by-side item list / charts layout
  - Supplier Comparison table reduced from 9 to 6 columns (no Trend arrow, no Last Purchase)
  - Supplier profile modal redesigned: two-view architecture (Profile + Items) with supplier details, margin gauge, supply dependency bar, purchase trend chart, top 5 items chart
  - Items view has sole source toggle, fruit/variant filters, clickable sparkline popovers with expanded charts + monthly data tables
  - Only supplier name (blue link) is clickable, not entire row
  - Export is Excel (.xlsx), not CSV; page size 25 (not 20)
  - URL parameter persistence not implemented; granularity is monthly only (not configurable)
  - Supplier/item group filters exist in backend but not exposed in UI
  - Data sourced from pc_supplier_margin pre-computed table (not live joins)
  - Non-product items (ZZ-ZZ%) excluded
  - All data left-justified per project standard
- [x] Documented multi-supplier attribution model in plain English
- [x] Documented red flags guide for business users
- [x] Screenshots deferred to Session 12 (per plan)
- **Output:** `docs/prd/07-supplier-margin.md`

### Session 10: Settings & Profiles (Doc 08) — COMPLETED 2026-04-03
- [x] Reverse-engineered from live codebase (not old docs — found massive drift)
- [x] Tech-agnostic spec: settings dialog, customer profile modal (4 views), supplier profile modal (2 views)
- [x] Discovered and documented actual vs. documented differences:
  - Settings is a dialog (not separate page), triggered from "Score & Risk" button in customer table header
  - V2 credit model: 4 factors (Utilization 40%, Overdue 30%, Timeliness 20%, Double Breach 10%) — V1 had 5 factors with different weights
  - "Payment Consistency" factor removed entirely; "Overdue Limit Breach" → "Double Breach" (both limits)
  - Risk thresholds simplified: 3 tiers (Low ≥75, Moderate, High ≤30) — V1 had 4 tiers
  - Settings stored in database (not JSON file)
  - Role-based access: admin vs non-admin (read-only) — not documented before
  - "How It Works" collapsible accordion with full methodology — not documented before
  - Customer profile completely redesigned: 4-view architecture (Profile/Outstanding/Returns/Sales) replacing 3-panel + 3-tab layout
  - Profile view has statistics cards (Credit Health Gauge, Utilization Donut, Aging Bar, Returns Donut) and 4 trend charts — all new
  - Default view from Payment page is "Outstanding Invoices" (not "payment" tab)
  - Only customer name (blue link) is clickable, not entire row
  - Supplier profile redesigned: 2-view architecture (Profile + Items) with Margin Gauge, Supply Dependency Bar, Purchase Trend chart, Top 5 Items chart
  - Items view has Sole Supplier Toggle, Fruit/Variant searchable dropdowns — not documented before
  - Sparkline is clickable → popover with expanded chart + monthly data table — not documented before
- [x] Documented cross-page integration matrix and default view logic
- [x] Documented "Est." label convention for attributed costing
- [x] Screenshots deferred to Session 12 (per plan)
- **Output:** `docs/prd/08-settings-and-profiles.md`

### Session 11: Design Standards (Doc 09) — COMPLETED 2026-04-03
- [x] Consolidated all UI/UX patterns from page specs (docs 00–08) and project memory
- [x] Reverse-engineered additional patterns from live codebase (globals, components, utilities)
- [x] Documented: global layout, responsive breakpoints, colour system (7 palettes), typography scale
- [x] Documented: KPI card anatomy & conditional colouring, 10+ chart types with axis/legend/tooltip specs
- [x] Documented: table core rules (7 mandatory), filter patterns, modal/dialog architecture
- [x] Documented: data formatting (currency/percentage/date/null conventions), loading/empty/error states
- [x] Documented: button variants/sizes, tooltip/popover/dropdown/tab/sparkline interaction patterns
- [x] Documented: accessibility standards (keyboard, touch targets, contrast), export standards
- [x] Documented: cross-page consistency rules + intentional per-page variations
- [x] Documented: 10 explicit design anti-patterns (what NOT to do, from real user feedback)
- **Output:** `docs/prd/09-design-standards.md` (~16 sections, ~750 lines)

### Session 12: Screenshot Capture — COMPLETED 2026-04-06
- [x] Captured default state of all 7 pages
- [x] Captured key interactions (modals, tabs, profiles, settings)
- [x] Saved to `docs/prd/screenshots/{page_name}/` (43 screenshots across 7 page folders)
- [x] All page specs (01–08) include screenshot references
- [x] Audit cleanup: deleted 1 duplicate (`payment/customer-profile-trends.png`), fixed filename typo (`price-comparison:png.png` → `price-comparison.png`), renamed misleading file (`customer-margin/customer-profile-overview.png` → `table-and-top10.png`), updated doc references

### Session 13: PRD Creation
- [ ] Use `bmad-create-prd` skill with all docs/prd/ artifacts as input
- [ ] Validate with `bmad-validate-prd`
- [ ] Final review and handoff

---

## How to Resume

When starting a new session:

1. Read this file (`docs/prd-documentation-plan.md`) to check progress
2. Find the next unchecked session
3. Read the listed **source files** for that session
4. Follow the **per-page document template** above
5. Write output to `docs/prd/{filename}`
6. Mark tasks as complete in this file
7. Update "Last Updated" date at the top

---

## Notes

- `/experiment-growth` and `/admin/sync` are internal/dev pages — excluded from PRD
- `/preview/customer-profile-revamp` and `/preview/supplier-profile-revamp` are design previews — reference for future enhancements but not part of current PRD scope
- The existing `docs/textbook/` chapters are excellent plain-English references — use them alongside the technical page specs when rewriting
- Existing `docs/screenshots/` has baseline images but new captures should be taken for the PRD to reflect current state
