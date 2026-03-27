# Executive Dashboard — Meeting Action Checklist

## Sales Page (0:00 – 14:38)

### Customer Tab
- [X] Add search box — search by customer code and name
- [X] Add toggle filter by customer type
- [X] Remove "Docs" column
- [X] Rename "Cash" column to "Cash Sales"
- [X] Add "Group by Sales Agent" option (currently grouped by customer)
- [X] Add checkbox column (between Code and Customer Name) — allow selecting up to 10 customers for bar chart comparison
- [X] Default bar chart shows Top 10; add a "Reset to Top 10" button to restore default after custom selection

### Customer Category Tab (formerly "Customer Type")
- [X] Rename "Customer Type" to "Customer Category"
- [X] Remove "Docs" column
- [X] Rename "Description" column to "Category"
- ~~[ ] Add dropdown filter for category (only 7 options — no search needed)~~
- [X] Remove duplicate columns (Type & Description show same info) — keep only one

### Product Tab
- ~~[ ] Use full product name (do not attempt to split/group by fruit name — reverted from earlier attempt)~~
- [X] Add 4 advanced filters: **Brand**, **Fruit Type**, **Region/Country**, **Variant**
- [X] Filters are progressive — the more selected, the more specific the results
- [X] Add checkbox column — allow selecting up to 10 products for comparison
- [X] Remove "Lines" column (line items not useful here)
- [X] Investigate using AI to classify/label the ~50% "unclassified" products (low priority, boss said "minor")

### Sales Agent Tab
- [X] Change Active column from "T/F" to "Yes/No"
- [X] Remove duplicate columns — "Agent" and "Description" are duplicated; keep only "Sales Agent" (description)
- [X] Remove "Docs" column
- [X] Add filter by Active status (Yes/No dropdown) — only filter needed (not many agents)
- [X] Keep inactive agents visible (to see revenue from agents who left mid-year)

### Outlet Tab
- [X] Remove the dots/actions column
- [X] Investigate and fix the "-30" display issue

### Sales Per Month
- [X] No changes needed — looks good

---

## Payment Page (14:39 – 24:34)

### Chi Score / Customer Health Score
- [X] Keep current V2 layout (ignore other versions)
- [X] Chi Score = customer performance score combining: credit utilization, overdue days, payment behavior, sales contribution
- [X] Lower score = higher risk — confirm this is clearly communicated in UI

### Summary Cards
- [X] Change "Total Outstanding" card color from blue to **orange**
- [X] Keep "Overdue" card as **red**
- [***] Verify the "Average Days Sales Outstanding" (133 days) calculation — boss questions accuracy since max payment term is 60 days
- [ ] Document where each metric comes from: which data fields, which tables, how they aggregate

### Customer Profile (NEW — major feature)
- [ ] **Create a Customer Profile page** — clicking a customer opens a dedicated profile view
- [X] Profile should contain:
  - [X] Payment terms (e.g., 30 days, 60 days)
  - [X] Current average days to pay vs. payment terms
  - [X] Outstanding invoices / utang breakdown
  - [X] Chi Score and risk indicators
  - [ ] All insights consolidated in one view
- [X] Replace the current expandable/collapsible row approach — profile page is better UX (avoids long scrolling)
- [X] Return data also goes into customer profile (see Return page section)
- [X] Profile should be tab-based to organize different data sections

### Credit Utilization Distribution
- [X] Rename "Under Limit" to **"Within Limit"**
- [X] Labels: Within Limit, Near Limit, Over Limit, No Limit Set

### Aging Analysis
- [X] Current buckets look good: Not Yet Due, 1-30 days, 30+ days, 60+ days, 90+ days — keep as is

### DSO Trend
- [****] Clarify and verify the DSO trend data — boss asked "where did you get this?"

---

## Return Page (24:35 – 30:15)

### General
- [X] Context: Credit notes are mostly product returns; two settlement types — cash/cheque refund or reduce outstanding (knock-off)
- [X] "Unresolved" = haven't paid back/settled the refund yet

### Top Return Products
- [X] Change from Top 10 to **Top 15** (by value and by frequency)
- [X] Add the same 4 filters as Product tab: **Brand**, **Fruit Type**, **Region/Country**, **Variant**
- [ ] Filters let users drill down (e.g., see all orange returns across brands, or all returns from one brand)

### Return Logs
- [X] Keep return remarks/logs visible — shows reason for return
- [X] Put return logs into **Customer Profile** as well (separate tab within profile)

### Future Consideration
- [X] Boss wants ability to compare returns across time periods (e.g., this year vs. last year for same product)
- [ ] Investigate linking returns to suppliers (who supplied the returned product?) — clarify with client first

---

## Financial / Profit & Loss Page (30:16 – 35:55)

### Data Understanding (CRITICAL)
- [****] **Provide a rundown/documentation of:**
  - [ ] Net Profit — which data fields, from which tables, how calculated
  - [ ] Net Sales — which data fields, from which tables, how calculated
  - [ ] Cost of Goods Sold — which data fields, from which tables, how calculated
- [ ] Boss needs to understand what's inside each metric before presenting to client
- [ ] Understand the link between P&L items and other pages (expenses, cost of goods)

### Labels & Naming
- [ ] Keep data labels as-is from AutoCount (even if confusing like "Discount Received" instead of "Discount Given") — client is used to these terms
- [ ] Verify with client: Is this all the data? Did we miss anything? Does anything not belong here?

### P&L Line Items to Verify
- [ ] Sales Adjustment
- [ ] Return Inwards
- [ ] Purchases / Cash Purchase / Small Baskets
- [ ] Purchases Return (labeled in data — keep as-is)
- [ ] Discounts (Discount Received label from data)

---

## Expenses Page (35:56 – 37:46)

### Structure
- [X] Split into **Direct Cost** (cost of goods/product) and **Indirect Cost** (overhead like rent, etc.)
- [X] Cost of Goods breakdown should be viewable in detail

### Top 10 Expenses
- [X] Make the Top 10 expenses section **independent** — its own filters/date range, not tied to the main page filters
- [X] "Don't be like one change and everything change" — decouple filter dependencies
- [X] Keep the breakdown/detail view for drilling into expense categories

---

## Customer Margin Page (37:47 – End)

### Filters & Selection
- [Already-excluded] Add "Show Inactive Customers" toggle — need to define what counts as "inactive"
- [X] Fix **Clear button bug**: clicking Clear resets the date range too — it should ONLY clear customer selection, NOT the date
- [ ] Customer selection should accumulate (not comparison mode) when multiple selected

### Return Rate Metric
- [X] Clarify and document what "Return Rate" means — what's the formula, what's it based on?
- [X] Boss couldn't understand if higher return rate is good or bad — needs clear explanation
- [ ] Fix color coding: **Return Rate** (bad indicator) should be **orange/red**, not green
- [ ] **Overall Margin** (positive indicator) should be **green**

### Chart Changes
- [ ] Change margin visualization from **line** to **bar** chart
- [ ] Remove the separate margin line from the chart — margin % is already shown elsewhere, causes confusion
- [ ] Consider showing an **average margin line** across the bar chart instead

### Profit vs. Margin
- [ ] Add **average margin line** across the bar chart
- [X] Get AI suggestion on how to add profit into the bar chart — explore visualization options, then decide
- [ ] Top 10 customers section should be **independent** (own filters/date range, not tied to main page filters)

### Data Issues (CRITICAL — from part 2)
- [X] **Top 10 customer margin % is wrong** — showing ~100% margin, impossible for fruit business. Investigate and fix calculation
- [ ] Double-check gross profit figures
- [ ] Margin distribution chart buckets (0-5%, 5-10%, ... 30+%) — verify data correctness, currently looks wrong
- [ ] Understand why buckets stop at 30+ — document the reasoning or adjust

---

## Supplier Margin Page (part 2: 3:41 – End)

### Data Issues (CRITICAL)
- [ ] **Supplier margin calculation is WRONG** — currently comparing against COGS, should compare against **purchasing cost**
- [ ] Fix these 4 metrics: Selling Price, Purchasing Cost, Margin Percentage, Profit Figure
- [ ] Verify all supplier data correctness before next review — "no point looking at this" until fixed

### Supplier Profile (NEW — major feature)
- [ ] **Create a Supplier Profile page** — similar concept to Customer Profile
- [ ] Profile should contain:
  - [ ] Items purchased from this supplier
  - [ ] **Historical purchase price per SKU** — chronological log, year-by-year costing (e.g., 2010: RM5, 2024: RM7)
  - [ ] Simple linear log format (not sortable — just chronological order)
- [ ] Down the road: will assign AI features to supplier profiles

### Price vs. Cost Scatter Plot
- [X] Scatter plot concept is good (diagonal = break-even, above = profit, below = loss)
- [ ] Confirm: selling price captured is before discounts/refunds (boss verified this is correct)
- [ ] Investigate items showing below the line — why selling at a loss?

### Item-Level View
- [ ] For each item/SKU: show which vendors can supply it + their historical price per unit
- [ ] This may live inside supplier profile or as a separate lookup — location TBD

---

## Cross-Page Items

- [ ] **Customer Profile** is a new major feature spanning Payment + Return + Margin pages
- [ ] **Supplier Profile** is a new major feature for Supplier Margin page (+ future AI features)
- [ ] Consistently remove "Docs" column across all tabs that have it
- [ ] Consistently add checkbox selection (up to 10) for comparison charts where applicable
- [ ] Verify all calculations and data sources — be ready to explain every number to the client
- [X] Send boss the requirement brief (re-tag in Teams)
- [ ] Boss suggested: use AI to generate PRD for next review — easier for him to review
