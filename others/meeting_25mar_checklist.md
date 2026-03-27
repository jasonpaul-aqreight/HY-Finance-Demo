# Meeting Checklist — 25 Mar

---

## Sales Page

- [ ] Fix checkbox glitch (check/uncheck — sometimes works, sometimes doesn't)
- [ ] **Group By**: change from buttons/tabs to a **dropdown**
  - Dropdown options: `Customer`, `Customer Category`, `Fruit`, `Sales Agent`, `Outlet`
- [ ] Remove `Country` and `Variant` from Group By options
- [ ] Remove **"Stack By"** section entirely
- [ ] Add **Advanced Filters** (for Fruits only): `Country`, `Variant`
- [ ] Remove quick date-range preset buttons (MTD, QTD, etc.) — buggy, boss said remove to keep it simple

---

## Payment Page

- [ ] **DSO card**: keep for now; **Plan B** is to replace with "Average Payment Days" — note this for client feedback
- [ ] Invoice vs Collection chart — confirmed fine, no changes
- [ ] **Delete the "Score" column** from the customer table
- [ ] **Fix table alignment** — standardise all columns (either center or left-align, pick one and be consistent)
- [ ] Rename **"Credit Score"** → **"Credit Health Score"** everywhere
- [ ] Fix credit health score calculation — currently everything shows "High", scoring is broken
- [ ] Populate with **latest data** (current data only up to Oct 2025, outdated)
- [ ] Invoice vs Collection — verify utilisation display
- [ ] Search customer — confirm working

---

## Payment Settings Page

- [ ] Update credit health score threshold ranges (e.g. High ≥ 80, Low ≤ 35)
- [ ] **Moderate Risk range**: auto-calculated as "in between" — greyed out, not user-editable
  - Example: if High ≥ 80 and Low ≤ 35, then Moderate = 36–79 (shown automatically)
- [ ] Add a **description/explanation** for what each score level means (higher score = lower risk, etc.)
- [ ] Use strict boundaries (clear cutoffs, not ambiguous "smaller or equal to")

---

## Customer Profile Page

### Profile Header — Static Info Section

- [ ] Move **Credit Limit** and **Payment Terms** up to the header/static section
- [ ] Add **Contact Person / PIC** name
- [ ] Add **Contact Number**
- [ ] Add **Email Address**
- [ ] Check customer table for any other fields worth adding — confirm with boss
- [ ] Show **Join Date** (created date / first transaction date) at top of profile
- [ ] Show **Last Updated** timestamp on the profile page

### Labels & Naming

- [ ] Rename "Outstanding" → **"Outstanding Payment"**
- [ ] Rename "Aging Count" → **"Aging Count of Invoice"**
- [ ] Rename all "Credit Score" → **"Credit Health Score"** (global rename)
- [ ] Rename the data section to **"Transaction Record"**

### Data Period & Filters

- [ ] Dynamic data (credit utilisation, outstanding, aging, etc.) **cannot** be "since creation" — changes continuously
- [ ] Add **start date / end date filter** to the entire customer profile page
- [ ] Static info (credit limit, payment terms, contact) stays outside the filter — always visible
- [ ] Remove "last 12 months" logic from profile — standardise to "since join"
- [ ] Add **(Since Creation)** label/bracket on relevant sections so users know the time range
- [ ] Default: show relevant period; let users filter for granularity

### Navigation & UX

- [ ] Review layout — page feels messy, too much scrolling, reduce clutter
- [ ] Add **clickable links** from profile sections to their detail pages (e.g. return trend, sales trend)
- [ ] If long-term/consistent data is needed, can create a separate **"Overview"** tab later
- [ ] Design with extensibility — boss may add more sections in future

### Detail Pages (Return Trend, Sales, etc.)

- [ ] Add **customer filter** on detail pages (e.g. return trend page) — filter by individual customer
- [ ] Add **date range filter** on detail pages for flexible period selection
- [ ] Detail pages are where users go for 12-month views, custom ranges, etc. (not in profile)

### Other Decisions

- [ ] Credit limit is **read-only** (from AutoCount customer table) — no editing in this dashboard
- [ ] Credit health score is AI-calculated based on weightage — confirm formula aligns with settings page
- [ ] **Snapshot table**: start fresh from now, accumulate calculated scores going forward for future historical tracking
- [ ] Add **Last Updated** timestamp to **every page** across the dashboard

---

## Finance Page

### Naming

- [ ] Rename **"Net Profit"** → **"Profit/Loss"**
- [ ] All other naming (Sales Adjustment, Return Inwards, Discount Amount, etc.) — keep as-is, matches AutoCount terms

### P&L Table — Simplify Expense Breakdown

- [ ] **Group similar expense line items** into categories for a higher-level view:
  - Director's Salary + Director's EPF → group under **"Director's Salary"**
  - All Petrol items → group under **"Petrol"**
  - All Diesel items → group under **"Diesel"**
  - All Commercial items (8–11 items) → group under **"Commercial"**
- [ ] This finance page = **simplified/higher-level view**
- [ ] Detailed breakdown remains in the **Expenses page** (no changes to expenses page)
- [ ] Revenue section, Other Income section — confirmed fine, no changes

---

## Customer Margin Page

### Data Issues

- [ ] Lots of "loss" and "no margin" showing — caused by **data anomalies**
- [ ] 100% margin entries = no cost data available (cost is zero) — investigate and fix
- [ ] Some pricing data is outrageous — lack of documentation means AI made assumptions about cost fields
- [ ] **Tag James** about cost data issues — confirm he responded, follow up
- [ ] Need proper documentation of what data fields mean (data dictionary) before numbers can be trusted

### Performance

- [ ] Page is **slow to load** (lots of data) — investigate ways to make it faster
- [ ] Look into **caching** — first load will still be slow, but subsequent loads should be faster
- [ ] Talk to WoJK about performance optimisation

---

## Supplier Profile

### Items Supplied Section

- [ ] Specify **"Since Creation"** label for items supplied
- [ ] **"Single Supplier Items"** — items only this supplier provides (exclusive SKUs)
- [ ] Add **tooltip (?) icon** on confusing labels — hover shows more detail/explanation
  - e.g. "Single Supplier Items" tooltip: "Number of SKUs only supplied by this supplier"

### Naming Changes

- [ ] Rename revenue-related field → **"Total Purchase"** (amount spent purchasing from this supplier)
- [ ] Rename purchase cost column → **"Total Purchase Cost"**
- [ ] Rename average cost column → **"Average Cost / Unit"**

### Revenue / Margin Calculation

- [ ] Revenue on supplier profile is **estimated** (sales data linked to customers, not suppliers)
- [ ] Current method: average selling price × quantity = estimated revenue
- [ ] **Document this limitation** — make clear to users that revenue is an estimate

### Items Table

- [ ] Table is too long — add **pagination** (show top 10 per page, next/previous)
- [ ] Enable **text wrapping** for long product names (currently truncated)
- [ ] Add ability to **filter by single-supplier items**

### Scatter Plot

- [ ] Scatter plot looks good — confirmed
- [ ] Bug: very few SKUs showing on chart — **investigate**, may be a filtering bug
- [ ] Users can toggle between average purchase cost and average selling cost on the chart

### Profile Header

- [ ] Add **supplier info header** (same format as customer profile): PIC, contact details, etc.
- [ ] Add **join date** info for suppliers

---

## Supplier Margin Page

### Navigation & Naming

- [ ] Rename page/section to **"Supplier Management"** (so users know where to find specific suppliers)

### New Feature: Supplier Price Comparison

- [ ] Build a view: given an **item/SKU**, show **all suppliers** who can supply it
- [ ] Show each supplier's **price over time** for that item
- [ ] Purpose: help procurement decide which supplier to choose
- [ ] Name: **"Supplier Price Comparison"**

### Filters

- [ ] Add **advanced filters** to both Supplier Analysis and Item Pricing sections:
  - Fruit Type
  - Country
  - Variant
- [ ] Currently can only search by SKU — need broader filtering (e.g. "show me all Apple suppliers")

### Bugs & UX Fixes

- [ ] Fix: **cannot scroll past certain point** when no pagination — gets stuck
- [ ] Fix: **cannot uncheck** items when stuck (only "Clear" works) — annoying UX bug
- [ ] Fix: buggy interactions when clicking between suppliers on scatter plot
- [ ] Remove any leftover debug/placeholder elements

---

## Cross-Page / General

- [ ] Send **meeting minutes** and **tag boss in the group chat** (was missed last week)
- [ ] **PRD**: currently being written — will incorporate into HR dashboard too
- [ ] **Friday review**: focus on corrections and continue implementing changes
- [ ] **Big changes**: Customer Profile and Supplier Profile are the largest items
- [ ] Supplier Profile components already built as reusable components — keep and reuse
- [ ] **Catch up on outstanding items from previous meeting** — not all addressed yet
- [ ] Return page — confirmed fine, no changes needed
