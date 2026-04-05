# 09 — Design Standards & UI/UX Patterns

> **Scope:** Consolidated design system governing all pages of the Finance Dashboard. Every page spec (docs 01–08) inherits these standards. This document is tech-stack agnostic — it defines *what* the user sees and experiences, not *how* it is implemented.
>
> **Audience:** Product managers, designers, and engineers rebuilding the Finance module in a production system that already has Sales and HR modules.

---

## 1. Global Layout

### 1.1 Page Shell

The application uses a **sidebar + scrollable content** layout:

| Element | Specification |
|---------|---------------|
| **Sidebar (expanded)** | 224 px wide, fixed to the left edge of the viewport |
| **Sidebar (collapsed)** | 64 px wide (icons only); tooltip labels appear on hover to the right of each icon |
| **Toggle behavior** | A collapse/expand button at the bottom of the sidebar; state persists across sessions (stored locally) |
| **Content area** | Occupies the remaining viewport width; vertically scrollable |
| **Content max-width** | 1 600 px, horizontally centred within the content area |
| **Content padding** | 24 px on all sides |

### 1.2 Sidebar Navigation

The sidebar contains **7 primary pages** and **1 admin section**, separated by a visual divider line:

| # | Label | Icon description |
|---|-------|-----------------|
| 1 | Sales | Trending-up arrow |
| 2 | Payment | Credit card |
| 3 | Returns | Rotate/undo arrow |
| 4 | Financials | Bar chart |
| 5 | Expenses | Receipt |
| 6 | Customer Margin | People/users |
| 7 | Supplier Performance | Truck |
| — | *divider line* | |
| 8 | Data Sync *(internal)* | Refresh arrows |

**Active-page indicator:** The current page's sidebar item has a filled accent background and darker text. Inactive items use muted text (70 % opacity) with a subtle hover highlight.

**Collapsed-mode tooltips:** When the sidebar is collapsed, hovering over an icon displays the page label in a tooltip to the right with a 10 px offset.

### 1.3 Data Freshness Indicator

A global status bar appears **at the top of the content area** on all pages when the last data sync did not fully succeed. It is invisible when the sync completed successfully.

| State | Background | Text | Icon |
|-------|-----------|------|------|
| **Partial failure** | Amber-50 with amber-200 bottom border | "Some data may be outdated — last sync: {timestamp}" | Warning triangle |
| **Full failure** | Red-50 with red-200 bottom border | "Last data sync failed — {timestamp}" | X-circle |

- **Timestamp format:** `d MMM, h:mm a` in MYT (e.g., "5 Apr, 9:36 am")
- **Typography:** 14 px, font-medium, high-contrast text (amber-900 / red-900) — no muted colours
- **Layout:** Full-width bar, 8 px vertical padding, 16 px horizontal padding, icon + text inline
- **Refresh:** Fetched on page load, refreshed every 60 seconds

### 1.4 Standard Page Structure (Top → Bottom)

Most pages follow this vertical sequence:

1. **Data Freshness Indicator** — Only visible on sync failure (partial or error)
2. **Filter Bar** — Date range pickers + preset buttons (+ optional cost-type toggle)
3. **KPI Cards Row** — 3–5 metric cards in a responsive grid
4. **Primary Chart Section** — Full-width or two-column chart layout
5. **Secondary Chart(s)** — Side-by-side or tabbed chart views
6. **Data Table(s)** — Full-width table with header controls
7. **Additional Sections** — Tabbed breakdown tables, hierarchical data, etc.

**Vertical spacing between sections:** 24 px.

---

## 2. Responsive Behaviour

### 2.1 Breakpoints

| Name | Width | Behaviour |
|------|-------|-----------|
| Mobile | < 640 px | Single column; sidebar hidden or overlay; charts stack vertically |
| Tablet | 640–1 279 px | 2-column grid for KPI cards; side-by-side charts stack to single column |
| Desktop | 1 280 px + | Full multi-column layout; sidebar visible |
| XL | 1 600 px + | Content area reaches max-width; additional horizontal whitespace |

### 2.2 Responsive Grid Rules

| Component | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| KPI cards | 1 column | 2–3 columns | 4–5 columns |
| Side-by-side charts | Stacked (100 % each) | Stacked | 60 %–40 % or 50 %–50 % split |
| Tables | Full width, horizontal scroll if needed | Full width | Full width |
| Modals | ~95 % viewport | ~90 % viewport | ~90 % viewport |

---

## 3. Colour System

### 3.1 Semantic Colours

| Purpose | Colour | Hex (approximate) |
|---------|--------|-------------------|
| **Primary / Brand** | Dark navy blue | #1F4E79 |
| **Positive / Profit / Good** | Emerald green | #10B981 |
| **Negative / Loss / Bad** | Red | #EF4444 |
| **Warning / Caution** | Amber/Yellow | #F59E0B |
| **Informational / Neutral** | Blue | #2E5090 |
| **Background** | White | #FFFFFF |
| **Card background** | White | #FFFFFF |
| **Border** | Very light grey | ~#EAEAEA |
| **Text — primary** | Near-black | ~#1A1A1A |
| **Text — secondary** | Medium grey | ~#6B6B6B |
| **Text — links** | Dark blue | #2E5090 |
| **Focus ring** | Mid-grey blue | ~#B4B4B4 |

### 3.2 Revenue & Cost Colours (Charts)

| Series | Colour | Hex |
|--------|--------|-----|
| Invoice / Sales | Dark blue | #2E5090 |
| Cash Sales | Green | #548235 |
| Credit Notes / Returns | Red | #C00000 |
| Cost of Sales (COGS) | Blue (variant) | — |
| Operating Costs (OPEX) | Orange | #F97316 |
| Profit (net) | Emerald | #10B981 |

### 3.3 Risk-Level Colours

| Risk Level | Text Colour | Badge Background |
|------------|-------------|------------------|
| Low | Emerald-600 | Emerald-100 bg + Emerald-800 text |
| Moderate | Yellow-600 | Yellow-100 bg + Yellow-800 text |
| Elevated | Orange-600 | Orange-100 bg + Orange-800 text |
| High | Red-600 | Red-100 bg + Red-800 text |

### 3.4 Aging-Bucket Colours (Accounts Receivable & Returns)

| Bucket | Colour | Hex |
|--------|--------|-----|
| Not Yet Due / 0–30 days | Green | #22C55E / #10B981 |
| 1–30 / 31–60 days | Yellow / Amber | #EAB308 / #F59E0B |
| 31–60 / 61–90 days | Orange | #F97316 |
| 61–90 / 91–180 days | Light red | #F87171 / #EF4444 |
| 91–120+ / 180+ days | Dark red | #991B1B |

### 3.5 Margin-Distribution Colours

| Margin Band | Colour |
|-------------|--------|
| < 0 % | Red (#EF4444) |
| 0–5 % | Orange (#F97316) |
| 5–10 % | Yellow (#EAB308) |
| 10–15 % | Lime (#84CC16) |
| 15–20 % | Green (#22C55E) |
| 20–30 % | Emerald (#10B981) |
| 30 %+ | Dark emerald (#059669) |

### 3.6 Operating Costs Category Colours (13 categories)

Each expense category has a permanently assigned colour used in charts and legends:

| Category | Colour family |
|----------|---------------|
| People & Payroll | Blue |
| Vehicle & Transport | Amber |
| Property & Utilities | Green |
| Depreciation | Rose |
| Office & Supplies | Violet |
| Equipment & IT | Indigo |
| Insurance | Pink |
| Finance & Banking | Cyan |
| Professional Fees | Teal |
| Marketing & Entertainment | Red |
| Repair & Maintenance | Dark green |
| Tax & Compliance | Yellow |
| Other | Orange |

### 3.7 Credit Usage Colours (Credit Limit)

| Utilisation Band | Colour |
|------------------|--------|
| < 80 % (within limit) | Green (#10B981) |
| 80–100 % (near limit) | Yellow (#EAB308) |
| > 100 % (over limit) | Red (#EF4444) |
| No limit set | Grey / muted |

### 3.8 Status Indicators

| Status | Visual |
|--------|--------|
| Active | Green pulsing dot (gentle 2–3 second cycle) |
| Inactive | Red static dot (no animation) |

---

## 4. Typography

### 4.1 Font Family

| Context | Font |
|---------|------|
| Body / UI | Sans-serif (system or Geist-style) |
| Codes & account numbers | Monospace (Geist Mono-style) |

### 4.2 Type Scale

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Page title | 18 px | Semi-bold (600) | |
| Section header | 16 px | Medium (500) | Optional tinted background strip |
| Card title | 16 px | Medium (500) | |
| Card title (compact) | 14 px | Medium (500) | Used in smaller card variants |
| KPI label | 12 px | Medium (500) | UPPERCASE, wide tracking |
| KPI value | 24–36 px | Bold (700) | Tabular (monospaced) number figures |
| KPI subtitle | 12 px | Normal (400) | Muted colour |
| Table header | 12–14 px | Bold (700) | |
| Table body | 13–14 px | Normal (400) | |
| Body text | 14 px | Normal (400) | |
| Small / caption | 12 px | Normal (400) | |
| Code / account number | 10–11 px | Normal (400) | Monospace font |

### 4.3 Readability Rules

> **Critical mandate:** End users are older executives who need high readability.

- **Never** use grey, muted, or low-contrast text for important labels or data values
- All primary text must meet **WCAG AA** minimum contrast (4.5 : 1 for normal text)
- KPI values and table data use high-contrast colours (near-black on white)
- Muted colour is permitted only for secondary descriptions, subtitles, and help text — never for data
- Link text is always dark blue (#2E5090) with a persistent underline to signal clickability

---

## 5. KPI Cards

### 5.1 Card Anatomy

Each KPI card contains (top → bottom):

1. **Label** — Uppercase, small text, muted colour (the only acceptable muted usage)
2. **Value** — Large bold number with tabular (fixed-width) digit alignment
3. **Subtitle** — Formula or context description (e.g., "Invoice + Cash − Credit Notes")
4. **Optional info icon** — Hoverable tooltip explaining the calculation

### 5.2 Card Container Style

| Property | Value |
|----------|-------|
| Background | White |
| Border | Subtle ring (1 px, 10 % opacity foreground colour) |
| Corner radius | 10 px |
| Shadow | Subtle drop shadow |
| Internal padding | 16–20 px |
| Gap between cards | 16 px |

### 5.3 Conditional Colouring

KPI card values may be conditionally coloured:

| Context | Rule |
|---------|------|
| Profit / positive growth | Green text (#10B981) |
| Loss / negative growth | Red text (#EF4444) |
| Margin % | Red < 10 %, Amber 10–20 %, Green ≥ 20 % |
| Avg Collection Days | Green ≤ 30, Yellow ≤ 60, Red > 60 |
| Current ratio | Green ≥ 1.0, Red < 1.0 |
| Total outstanding (Payment) | Orange (static) |
| Neutral / informational | Blue (static, no conditional logic) |

### 5.4 Loading State

While data is loading, each card shows an **animated skeleton placeholder** matching the card's dimensions — three pulsing grey rectangles simulating label, value, and subtitle lines.

---

## 6. Charts

### 6.1 Chart Types Used

| Type | Pages where used |
|------|-----------------|
| **Line chart** | Avg Collection Days trend, margin trends, price trends, multi-series time series |
| **Vertical bar (stacked)** | Monthly net sales breakdown, cost trends, profitability bars |
| **Horizontal bar** | Top customers by net sales, top returned products |
| **Combo (bar + line overlay)** | Net sales bars + margin % line on secondary axis |
| **Donut / Pie** | Credit usage, return settlement, cost composition |
| **Stacked area** | Return value + unsettled overlay |
| **Scatter / Bubble** | Purchase vs selling price (bubble size = volume) |
| **Small multiples (2 × 4 grid)** | Multi-year P&L comparison bar charts |
| **Gauge (semi-circle)** | Credit health score, margin performance |
| **Horizontal stacked bar** | Settlement breakdown (progress-bar style) |

### 6.2 Axis Formatting

**X-axis (time):**

| Granularity | Format | Example |
|-------------|--------|---------|
| Daily | "MMM d" | "Dec 15" |
| Weekly | "W##" (ISO week) | "W50" |
| Monthly | "MMM YY" | "Jan 25" |

**Y-axis (values):**

| Range | Format |
|-------|--------|
| Millions | "X.XM" (e.g., "7.5M") |
| Thousands | "XXXK" (e.g., "350K") |
| Percentages | "XX %" |

- Primary Y-axis on the left; secondary Y-axis (e.g., margin %) on the right
- Dashed horizontal reference lines at zero, averages, or thresholds

### 6.3 Grid & Styling

Grid line direction depends on chart orientation:

| Chart orientation | Grid lines shown | Rationale |
|-------------------|-----------------|-----------|
| **Vertical bar / line charts** | Horizontal only (`vertical={false}`) | Horizontal reference lines aid value comparison |
| **Horizontal bar charts** | Vertical only (`horizontal={false}`) | Vertical reference lines aid length comparison |
| **Combo / trend charts** | Both horizontal and vertical | Both axes carry meaningful data |

All grid lines are dashed, light grey.

- Bars have **rounded top corners** (3–4 px radius) on positive bars; rounded bottom corners on negative/bottom stack segments
- Zero line drawn when data spans positive and negative values

### 6.4 Chart Heights

| Context | Height |
|---------|--------|
| Full-width primary chart (trend) | 360–380 px |
| Distribution / comparative chart | 320 px |
| Compact / secondary chart | 300 px |
| Scatter / bubble chart | 600 px |
| Horizontal bar chart | Dynamic — grows ~45–48 px per entry (min 400 px) |

### 6.5 Legends

- **Position:** Below the chart (horizontal layout, centred)
- **Format:** Coloured square swatch + label text
- **Interaction:** Display-only — legends do not toggle series visibility on click

### 6.6 Tooltips (Chart Hover)

- **Trigger:** Hover over any data point (bar, dot, line segment)
- **Content:** Period label + all non-zero series values
- **Currency format:** "RM X.XM" or "RM XXXK" (compact notation with RM prefix)
- **Percentage format:** "XX.X %"
- **Positioning:** Auto-adjusts to stay within viewport bounds

### 6.7 Toggle Controls

Charts may include toggle buttons in their card header:

| Toggle type | Options | Behaviour |
|-------------|---------|-----------|
| Granularity | Daily / Weekly / Monthly | Changes time aggregation; mutually exclusive |
| Metric | Gross Profit / Margin % | Switches Y-axis measure; mutually exclusive |
| Direction | Top / Bottom | Reverses sort order of ranked lists |
| View mode | All / By Agent / By Type | Changes chart grouping or stacking |
| Cost type | All / Cost of Sales / Operating Costs | Filters cost data shown |
| Entity | Suppliers / Items | Switches scatter-chart data set |

Toggle buttons use a **segmented button group** style: outlined, horizontal, one active (filled/highlighted), rest outlined/neutral.

---

## 7. Data Tables

### 7.1 Core Rules

> These rules apply to **every** data table in the application without exception.

| Rule | Specification |
|------|---------------|
| **Alignment** | Text columns left-aligned. Numeric and currency columns right-aligned with monospace digits on financial/detail tables (P&L, Balance Sheet, Cost of Sales, Operating Costs, Credit Note Impact, Supplier Comparison, Return Top Debtors). Primary analysis tables (Payment Customers, Customer Margin, Sales Group-By, Supplier Analysis) keep all columns left-aligned. |
| **Sorting** | All columns sortable. Toggle cycle: unsorted (bi-directional arrow) → descending (down arrow) → ascending (up arrow). |
| **Clickable elements** | Only entity names (customer / supplier) are clickable — styled as **blue underlined links**. Rows are NOT clickable. |
| **Pagination** | Server-side. Default page size: 25 rows. Options: 10, 25, 50. |
| **Pagination display** | "Showing X–Y of Z items" with Previous / Next buttons. |
| **Page size selector** | Dropdown in the pagination row. |
| **Export** | "Export Excel" button exports all sorted/filtered rows (not just the current page) as **.xlsx** format. Never CSV. |
| **Search** | Case-insensitive substring matching. Placeholder: "Search by [entity] code or name". Resets to page 1 on change. Real-time (no submit button). Clear button (X icon). |
| **Alternating rows** | Subtle tint on every other row for readability. Applied on most tables (Sales Group-By, Supplier Analysis, Cost of Sales, Supplier Comparison); not all tables implement this consistently. |
| **Container height** | Stable minimum height — when filters reduce visible rows, the container maintains its height to prevent page jumping. |

### 7.2 Table Header Controls Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [🔍 Search input]  [Filter dropdown(s)]     [Export Excel]  │
│  ← left-aligned                              right-aligned → │
└──────────────────────────────────────────────────────────────┘
```

- Search input on the left
- Filter dropdowns inline, next to search
- Export button on the right
- Optional settings / config buttons (outline style, small) alongside export

### 7.3 Column Specifications

| Column type | Width guidance | Format |
|-------------|---------------|--------|
| Entity name (link) | ~200–280 px | Blue underlined text; truncated with hover tooltip if too long |
| Entity code | ~120 px | Monospace, small text (10–11 px) |
| Currency value | ~130 px | "RM X,XXX" (no decimals); negative in red with minus sign |
| Percentage | ~100 px | "X.X %" with 1 decimal; signed (+/−) for changes |
| Count / integer | ~80 px | Comma-separated thousands (e.g., "1,234") |
| Unit price | ~100 px | "RM X.XX" (2 decimals) |
| Date | ~120 px | "DD MMM YYYY" (e.g., "01 Jan 2024") |
| Status badge | ~100 px | Pill-shaped badge with colour fill |
| Sparkline | ~120 px | Mini trend line within cell |
| Arrow indicator | ~40 px | Up (green) or down (red) arrow |

### 7.4 Sort Behaviour on State Changes

| Action | Sort behaviour |
|--------|---------------|
| User clicks column header | Sort applied; reset to page 1 |
| User changes a filter | Sort preserved; reset to page 1 |
| User changes dimension/group-by | Sort and selection reset to defaults |
| User changes search text | Sort preserved; reset to page 1 |

### 7.5 Exception: Hierarchical / Financial Tables

The P&L Statement and Balance Sheet tables do **not** use standard pagination or search. Instead:

- Collapsible row groups (disclosure triangle ▶ / ▼)
- Alternating row shading for readability
- Export via "Export Excel" only (full hierarchy)
- Fixed total / subtotal rows at group boundaries

---

## 8. Filters & Controls

### 8.1 Date Range Filter (Standard)

Used on all pages except Financial Statements:

| Element | Specification |
|---------|---------------|
| **Components** | Two month-year picker inputs (Start, End) |
| **Bounds** | Earliest available data date → latest available data date |
| **Default range** | 12 months ending at the latest data date (not today's date) |
| **Preset buttons** | 3M, 6M, 12M, YTD — all relative to latest data date |
| **Button layout** | Horizontal row, below or beside the pickers |
| **Range summary** | Displayed as "MMM yyyy — MMM yyyy (N months)" |

### 8.2 Financial Year Selector (Financial Statements Only)

| Element | Specification |
|---------|---------------|
| **Component** | Single dropdown |
| **Label format** | "Financial Year 2025 (Mar 2024 – Feb 2025)" |
| **Financial year definition** | March to February; the named year is the end year |
| **Default** | 2nd most recent financial year (most complete data) |
| **Range** | Selected FY plus 3 prior years (up to 4 years total) |

### 8.3 Dropdown Filters

| Type | Behaviour |
|------|-----------|
| **Single-select** | Customer Type, Status, Type, Cost Type — one option active at a time; "All [Type]" option to clear |
| **Multi-select (combobox)** | Customer, Supplier, Item, Product, Variant — searchable text input within dropdown; checkbox-based selection; badge showing selected count; clear-all button |
| **Cascading** | Product → Country → Variant. Changing a parent filter clears child selections and narrows child options |

### 8.4 Filter Logic

- All active filters combine with **AND** logic
- Changing any filter resets table pagination to page 1 but preserves current sort
- Filters update chart and table data simultaneously

### 8.5 Toggle Buttons

- Displayed as a **segmented button group** (horizontal bar of options)
- One option active at a time (mutually exclusive)
- Active option: filled/highlighted background + bold text
- Inactive options: outlined border, neutral background
- Used for: granularity, metric, direction, view mode, cost type

### 8.6 Search Inputs

- Real-time filtering (no submit button, no debounce delay visible to users)
- Case-insensitive substring matching across multiple fields (code + name)
- Clear button (X icon) to reset search text
- Placeholder text follows pattern: "Search by [entity] code or name"

---

## 9. Modals & Dialogs

### 9.1 Profile Modals (Customer / Supplier)

**Trigger:** Clicking any blue-underlined entity name link in any table.

**Dimensions:** ~90 % viewport width × ~90 % viewport height, centred.

**Backdrop:** Semi-transparent overlay (dark, ~10 % opacity) with slight blur.

**Structure:**

```
┌─────────────────────────────────────────────────┐
│  [← Back]  Entity Name                    [X]   │  ← Sticky header
│            Entity Code                          │
│            [CUSTOMER] badge   ● Active          │
├─────────────────────────────────────────────────┤
│                                                 │
│  Scrollable body — varies by current view       │
│                                                 │
│  [Outstanding Invoices (3)]  [Returns (1)]  ... │  ← Navigation buttons
│                                                 │
└─────────────────────────────────────────────────┘
```

**Header elements:**
- Large bold entity name
- Smaller code (monospace) below name
- Entity type badge: "CUSTOMER" (blue pill) or "SUPPLIER" (indigo pill)
- Status dot: Active (green pulsing) or Inactive (red static)
- Close button (X icon, top-right, minimum 40 × 40 px touch target)

### 9.2 Multi-View Architecture

Modals use a **view-switching** pattern (not persistent tabs):

| Entity | Views |
|--------|-------|
| **Customer** | Profile → Outstanding Invoices → Returns → Sales |
| **Supplier** | Profile → Items Supplied |

- Only one view is visible at a time
- Navigation buttons at the bottom of Profile view show count badges (red for invoices, amber for returns)
- Clicking a navigation button replaces the entire body content
- Back arrow (←) returns to Profile view
- Each view maintains independent scroll position and can have its own date filter

### 9.3 Default View by Calling Page

When a profile modal opens, the initial view depends on where the user clicked:

| Calling page | Customer default view | Supplier default view |
|--------------|-----------------------|-----------------------|
| Payment Collection | Outstanding Invoices | — |
| Returns | Returns | — |
| Sales Report | Sales | — |
| Customer Margin | Sales | — |
| Supplier Performance | — | Items Supplied |

### 9.4 Section-Level Loading

Each section within a modal fetches data independently:
- One section can display data while another is still loading
- Loading state: skeleton placeholders per section
- Error state: per-section error message with a "Retry" button — one section's failure does not block others

### 9.5 Settings Dialog

Triggered by a button (e.g., "Score & Risk") in a table header — not a separate page.

- Wider than typical dialogs (~900 px max width) to accommodate the multi-column weight/threshold layout
- Contains form inputs (numeric sliders/fields for weights, threshold values)
- Live validation (e.g., total weight counter turns green at 100 %, red otherwise)
- "How It Works" collapsible section with methodology explanation
- Role-based access: admin users can edit; non-admin users see read-only view
- Save button persists to database; Cancel discards unsaved changes; Reset restores defaults

### 9.6 Close Behaviour

- Close button (X) always available in header
- Clicking the backdrop dismisses the modal (Customer modal and Settings dialog). **Exception:** Supplier modal uses a custom overlay where backdrop click does **not** close the modal — close via the X button only.
- No unsaved-changes warning (data is read-only in profile modals; settings dialog has explicit Save/Cancel)
- Closing and reopening re-fetches current data

---

## 10. Data Formatting Conventions

### 10.1 Currency (MYR)

| Context | Format | Example |
|---------|--------|---------|
| Tables & KPI cards | "RM " + thousands separator, no decimals | RM 1,234,567 |
| Unit prices | "RM " + 2 decimals | RM 3.50 |
| Chart tooltips | "RM " + compact notation | RM 1.2M, RM 500K |
| Chart Y-axis | Compact notation only (no "RM" prefix) | 7.5M, 350K |
| Negative values | Minus sign prefix, red text | −RM 1,013,268 (in red) |

### 10.2 Percentages

| Context | Format | Example |
|---------|--------|---------|
| Growth / change indicators | Signed, 1 decimal | +12.3 %, −4.1 % |
| Margin values | Unsigned, 1 decimal | 18.5 % |
| Colour coding | Green (positive), Red (negative), Muted (null/zero) | |

### 10.3 Dates

| Context | Format | Example |
|---------|--------|---------|
| Table cells | DD MMM YYYY | 01 Jan 2024 |
| Chart X-axis (monthly) | MMM YY | Jan 25 |
| Month-year picker display | MMM yyyy | Mar 2025 |
| Financial year label | "FY20XX (MMM YYYY – MMM YYYY)" | FY2025 (Mar 2024 – Feb 2025) |
| Range summary | "MMM yyyy — MMM yyyy (N months)" | Jan 2024 — Dec 2024 (12 months) |

### 10.4 Numbers

| Context | Format |
|---------|--------|
| Counts | Thousands separator, no decimals (e.g., "1,234") |
| Days | "X days" (e.g., "45 days") |
| Locale | Malaysian English (en-MY) — comma as thousands separator, period as decimal |

### 10.5 Null, Empty, and Special Values

| Condition | Display |
|-----------|---------|
| Null / missing data | "—" (em-dash) |
| Division by zero | "—" (em-dash) |
| Zero in specific contexts | "—" (em-dash) — not "0" |
| No data for selected period | "—" for computed values; "0" for raw counts |
| Uncategorised product | "(Uncategorized)" |
| Unassigned category | "(Unassigned)" |
| Unknown classification | "(Unknown)" |
| Estimated / attributed values | "Est." prefix on label (e.g., "Est. Margin %") with info-icon tooltip |

### 10.6 Text Truncation

- Long entity names truncated at container width (~200–280 px) with ellipsis
- Full text shown in hover tooltip
- Entity codes always fully visible (monospace, small text)
- Original case preserved (no forced uppercase except KPI labels)

---

## 11. Loading, Empty, and Error States

### 11.1 Loading States

| Context | Loading pattern |
|---------|----------------|
| **First page load** | Skeleton placeholders matching the final layout (pulsing grey rectangles) |
| **Filter / date change** | Keep old data visible during the transition; do NOT flash empty states |
| **Section-level** | Each major section (KPI row, chart, table) loads independently; skeleton per section |
| **Modal sections** | Independent loading per section — partial data display is normal |

**Skeleton anatomy:**
- KPI card: Three pulsing rectangles (label, value, subtitle) in a card container
- Chart: Single tall pulsing rectangle matching chart height
- Table: Multiple pulsing rows of alternating widths

**Skeleton colour:** Light grey with pulsing opacity animation.

### 11.2 Empty States

| Context | Empty state |
|---------|-------------|
| No data for selected period | Centred text: "No [entity] data for the selected period" + optional "Adjust your date range or filters" hint |
| Chart with no data | Empty chart area with centred empty-state message (chart structure still visible) |
| Table with no data | Table header row visible + centred empty-state message in body area |
| KPI cards | "—" (em-dash) for computed values; "0" for count values |

### 11.3 Error States

| Context | Error pattern |
|---------|---------------|
| Section-level failure | Error message within the section + "Try again" retry button |
| Fallback behaviour | Show last known good data if available |
| Non-blocking | One section's error does not prevent other sections from rendering |

---

## 12. Interactive Patterns

### 12.1 Buttons

**Variants:**

| Variant | Use case | Style |
|---------|----------|-------|
| Default (primary) | Primary actions (Save, Apply) | Filled background, white text |
| Outline | Secondary actions (Export, Filter, Settings) | Border only, transparent background |
| Ghost | Tertiary actions | No border, no background; hover reveals tint |
| Destructive | Dangerous actions (Delete) | Red-tinted background, red text |
| Link | Inline text actions | Underlined text, no border/background |

**Sizes:**

| Size | Height | Typical use |
|------|--------|-------------|
| Extra-small | 24 px | Inline tags, mini controls |
| Small | 28 px | Table header buttons, filter pills |
| Default | 32 px | Most buttons |
| Large | 36 px | Primary page-level actions |
| Icon-only | Square (24–36 px) | Close, collapse, single-icon actions |

**Press feedback:** Buttons shift down 1 px on active press.

### 12.2 Tooltips

- **Trigger:** Hover (mouse) or focus (keyboard)
- **Appearance:** Dark background, white text, rounded corners
- **Max width:** 320 px
- **Font size:** 12 px
- **Padding:** 12 px horizontal, 6 px vertical
- **Arrow:** Small triangular pointer toward the trigger element
- **Default position:** Above the trigger; auto-adjusts if near viewport edge
- **Animation:** Fade + slight zoom on entrance; same in reverse on exit
- **Delay:** Appears after a brief pause (standard tooltip delay)

### 12.3 Popovers

- **Trigger:** Click (not hover)
- **Width:** 288 px (standard)
- **Background:** White with subtle shadow and ring border
- **Content:** Structured data, mini-charts, or data tables
- **Dismissal:** Click outside or press Escape
- **Use case:** Sparkline click → expanded chart + monthly data table in popover

### 12.4 Dropdowns (Select)

- **Trigger height:** 32 px (default), 28 px (small)
- **Dropdown content:** Rounded container with shadow
- **Items:** Left-padded, hover highlight on focus
- **Scroll:** Overflow scroll with scroll buttons if the list exceeds viewport
- **Selected indicator:** Check mark icon to the right of the selected item

### 12.5 Collapsible Sections

- **Indicator:** Disclosure triangle (▶ collapsed, ▼ expanded)
- **Toggle:** Click the section header
- **Animation:** Smooth expand/collapse transition
- **Default state:** Varies by context (e.g., Cost of Sales table expanded; settings help collapsed; P&L account details collapsed)

### 12.6 Tabs

Two visual variants:

| Variant | Style | Use case |
|---------|-------|----------|
| **Background tabs** | Pill-shaped buttons with filled active state | Tabbed data tables (e.g., "By Customer" / "Credit Note Impact") |
| **Underline tabs** | Bottom border indicator on active tab | Detailed breakdowns, financial sub-sections |

- Height-locked container: switching tabs does not change the section height (prevents layout shift)
- Content swaps immediately on tab click

### 12.7 Sparklines (In-Table Trend Indicators)

- Mini line charts rendered within table cells (~120 px wide)
- Show 6–12 months of directional trend
- Accompanied by an arrow indicator (up = green, down = red)
- **Clickable:** Clicking a sparkline opens a popover with an expanded chart and monthly data table

---

## 13. Accessibility & Interaction Standards

### 13.1 Keyboard Navigation

- All interactive elements reachable via Tab key
- Focus rings: visible blue outline on focus (3 px ring)
- Escape key closes modals, popovers, and dropdowns
- Enter/Space activates buttons, toggles, and links

### 13.2 Touch Targets

- Minimum interactive area: 40 × 40 px (even if the visual element is smaller)
- Close buttons, checkboxes, and icon buttons extend their click area beyond their visual bounds

### 13.3 Contrast Requirements

- Normal text: minimum 4.5 : 1 contrast ratio (WCAG AA)
- Large text (≥ 18 px or ≥ 14 px bold): minimum 3 : 1
- Interactive elements: distinguishable from surrounding content without relying on colour alone (underlines on links, borders on buttons)

---

## 14. Export Standards

### 14.1 Excel Export

| Property | Specification |
|----------|---------------|
| **Format** | .xlsx (Excel workbook) — never CSV |
| **Scope** | All rows matching current sort + filter — not limited to current page |
| **Trigger** | "Export Excel" button (outline style, small size) with download icon |
| **Header row** | Bold font, light grey (#F2F2F2) background fill |
| **Column widths** | Default 18 characters; entity names 30 characters; numeric columns 12–16 characters |
| **File naming** | Descriptive name (e.g., "customer-margins.xlsx", "supplier-comparison.xlsx") |
| **Download** | Generates file client-side and triggers browser download |

---

## 15. Cross-Page Consistency Rules

### 15.1 Elements That Must Be Identical Across All Pages

- Sidebar appearance and behaviour
- Date range filter component (where used)
- Preset button set (3M, 6M, 12M, YTD)
- KPI card container styling
- Table sorting UX (arrow icons, toggle cycle)
- Table pagination component
- Export button style and file format
- Entity name link styling (blue, underlined)
- Profile modal header and navigation pattern
- Tooltip and popover appearance
- Button variant styles
- Loading skeleton appearance
- Empty-state messaging pattern
- Number, currency, and date formatting

### 15.2 Intentional Per-Page Variations

Some patterns are intentionally different on specific pages:

| Page | Variation | Reason |
|------|-----------|--------|
| Financial Statements | Financial year dropdown instead of date range pickers | Data is structured by financial year, not arbitrary date ranges |
| Financial Statements | No table pagination or search; collapsible row hierarchy instead | Hierarchical accounting data requires tree-style navigation |
| Financial Statements | FY defaults to 2nd most recent (not latest) | Most recent FY is typically incomplete |
| Expenses | Cost-type toggle (All / Cost of Sales / Operating Costs) between filters and KPI cards | Unique to this page's dual cost-structure analysis |
| Supplier Performance | "Est." prefix on all KPI labels | Supplier margins are attributed estimates, not direct calculations |
| Payment Collection | Two distinct sections (Period + Snapshot) | Data has different temporal scopes requiring visual separation |

---

## 16. Design Anti-Patterns (What NOT to Do)

These are patterns that were **explicitly removed or avoided** based on real-world user feedback:

| Anti-pattern | Correct approach |
|--------------|-----------------|
| Making entire table rows clickable | Only the entity name (blue link) is clickable — avoids conflicts with text selection, checkboxes, and sparkline clicks |
| Right-aligning numerics on primary analysis tables | Primary analysis tables (Payment, Customer Margin, Sales, Supplier Analysis) keep all columns left-aligned for consistent scanning. Financial/detail tables (P&L, Balance Sheet, Cost of Sales, Operating Costs, Credit Note Impact, Supplier Comparison, Return Top Debtors) right-align numeric columns for decimal alignment. |
| Using grey/muted text for data labels | High-contrast text for all labels — older executives need readability |
| CSV export | Always .xlsx (Excel) — matches the user base's workflow |
| Collapsing sidebar by default | Expand by default — labels help users learn the navigation |
| Showing "0" for missing data | Em-dash "—" — clearly distinguishes "no data" from "zero" |
| Flashing empty state during filter changes | Keep old data visible during loading transition |
| Blocking the entire page on section error | Each section handles its own error independently |
| Ghost-style action buttons | Outline-style buttons — visible and discoverable |
| Opening profile to generic overview | Open to context-appropriate default view (e.g., Outstanding Invoices from Payment page) |

---

*Document generated Session 11. Screenshots will be captured in Session 12 and linked to page specs.*
