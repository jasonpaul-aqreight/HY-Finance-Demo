# Chapter 5: Cost Tracking — Where Your Money Goes

Selling RM 88 million worth of fruit sounds impressive. But if it costs you RM 86 million to do it, you only keep RM 2 million. That is why cost tracking matters just as much as revenue tracking — maybe even more. This chapter walks you through the Cost Tracking page, which answers one fundamental question: **where is all the money going?**

---

## 1. What This Page Tells You

The Cost Tracking page (`/expenses`) breaks down every ringgit Hoi-Yong spends into two buckets:

### COGS — Cost of Goods Sold

This is the cost of buying the fruits you turn around and sell. At Hoi-Yong, COGS accounts for roughly **88.4% of total costs**. That makes sense — you are a fruit distributor, so the single biggest thing you spend money on is... fruit.

COGS includes the purchase price of goods, freight charges to ship them in, and any adjustments like supplier discounts or returns of bad produce.

### OPEX — Operating Expenses

This is everything else: staff wages, warehouse rent, electricity to keep the cold rooms running, truck fuel, packaging materials, insurance, bank loan interest, and so on. OPEX is about **11.6% of total costs**.

### The restaurant analogy

Think of it this way. If Hoi-Yong were a restaurant:

- **COGS** = the cost of ingredients (meat, vegetables, spices)
- **OPEX** = kitchen rent + staff wages + the electricity bill + napkins

You cannot run the restaurant without both, but the ingredients are by far the larger expense. Same principle here — fruit purchasing dwarfs everything else.

> **Why should you care?**
>
> Because revenue alone does not tell you whether the business is healthy. You could have record sales and still lose money if costs grow faster. This page is the early-warning system for that scenario. When COGS creeps up by 3% but sales only grow by 2%, the gap between revenue and cost is shrinking — and so is profit. The Cost Tracking page makes that visible before it becomes a crisis.

---

## 2. The 4 KPI Cards

At the top of the page, four summary cards give you the headline numbers for the selected date range. These cards are always visible and are **not** affected by the COGS/OPEX toggle lower on the page — they always show the full picture.

![Cost Tracking page screenshot showing KPI cards, cost trend chart, and composition donut](/docs/screenshots/expenses/default.png)

### Card 1: Total Costs

- **Value shown:** RM 85,982,244
- **Subtext:** "COGS 88.4% . OPEX 11.6%"

This is the grand total of everything Hoi-Yong spent during the selected period. The subtext tells you the split at a glance — nearly 9 out of every 10 ringgit goes to buying goods.

### Card 2: COGS

- **Value shown:** RM 75,971,727
- **Subtext:** "Cost of Goods Sold"

The total spent on purchasing inventory — fruits, freight, minus any supplier discounts or purchase returns.

### Card 3: OPEX

- **Value shown:** RM 10,010,517
- **Subtext:** "Operating Expenses"

Everything that is not directly tied to buying the products. Think of this as the "cost of keeping the lights on and the trucks running."

### Card 4: YoY Change

- **Value shown:** +0.8%
- **Subtext:** "vs same period last year"
- **Color coding:** Positive values appear in **red** (costs going up = bad). Negative values appear in **green** (costs going down = good). This is the opposite of the Sales page, where growth is green. For costs, less is better.

A +0.8% YoY change means total costs grew slightly compared to the same period one year ago. On its own, that sounds harmless. But here is the important context: if sales only grew 2.3% while costs grew 0.8%, the margin improved slightly. If costs had grown *faster* than sales, that would be a margin squeeze — a red flag.

### How to read these cards

Read all four cards together, not in isolation. The key question is always: **"Are costs growing faster or slower than revenue?"** Compare the YoY Change card here with the YoY Change on the Sales page. If costs are outpacing revenue, profits are shrinking even if the business looks busy.

---

## 3. Cost Trend Chart (Stacked Bar)

Below the KPI cards sits a stacked bar chart titled "Cost Trend." Each bar represents one time period (monthly by default), and the bar is split into two colored segments:

- **Blue** = COGS
- **Orange** = OPEX

### What you see

The blue section dominates every single bar. That is normal — fruit purchasing is the overwhelming majority of costs. The orange sliver on top is OPEX. You can hover over any bar to see the exact RM values for each category and the total.

### The toggles

**Granularity toggle** (top-right of the chart): Switch between Daily, Weekly, and Monthly views. Monthly is the default and usually the most useful for spotting trends. Daily is helpful if you want to investigate a specific spike.

**Cost type toggle** (above the chart): This is the powerful one.

| Toggle setting | What the bars show |
|---|---|
| **All** (default) | Two segments per bar: COGS (blue) and OPEX (orange) |
| **COGS** | Each segment is an individual COGS account (Purchases, Freight Charges, etc.) |
| **OPEX** | Each segment is an OPEX sub-category (Payroll, Fuel, Rental, etc.) |

Switching to "OPEX" mode is particularly useful because it lets you see whether payroll is steady, whether electricity spiked in a hot month, or whether fuel costs are climbing.

### How to read this chart

Look for two things:

1. **The overall height of the bars** — is total spending growing, shrinking, or stable month to month?
2. **Changes in the color proportions** — if the orange slice (OPEX) suddenly gets thicker in one month, something changed. Did you hire new staff? Did a cold room break down and the repair bill spiked?

---

## 4. Cost Composition Donut

To the right of the trend chart sits a donut chart titled "Cost Composition." It shows the same data as the KPI cards, but as a visual pie.

- **Blue slice:** 88.4% — COGS
- **Orange slice:** 11.6% — OPEX

**For every RM 1 the company spends, 88 sen goes to buying fruits.** The remaining 12 sen covers salaries, rent, electricity, trucks, and everything else combined.

This donut also responds to the cost type toggle:

- Set it to **COGS** and the donut breaks COGS into individual GL accounts (Purchases, Freight, etc.)
- Set it to **OPEX** and the donut shows the OPEX sub-categories (Payroll, Depreciation, Rental, etc.)

This is a quick way to see relative proportions without reading a table.

---

## 5. Top 10 Expenses Chart

Below the trend and donut charts is a horizontal bar chart showing the ten biggest (or smallest) expense accounts.

### Default view (All, Top)

| Rank | Account | Approximate Value | Type |
|------|---------|-------------------|------|
| 1 | Purchases | RM 80M+ | COGS |
| 2 | Depreciation | — | OPEX |
| 3 | Staff Salaries | — | OPEX |
| 4 | Rental | — | OPEX |
| 5 | Seafreight | — | COGS |
| 6 | Electricity | — | OPEX |

Each bar is color-coded: **blue** for COGS accounts, **orange** for OPEX accounts.

Purchases (the act of buying fruit from suppliers) towers over everything else. It is not even close. This is expected for a distributor — their main job is buying and reselling, so the purchasing account dominates.

### The toggles

This chart has its own local toggles, separate from the global cost type toggle:

- **Cost type:** All / COGS / OPEX — filters which accounts appear
- **Direction:** Top / Bottom — flip between the highest-cost and lowest-cost accounts

Switching to **OPEX only + Top** gives you the ten biggest operating expenses, which is useful when you want to focus on controllable costs (you cannot really "cut" the cost of buying fruit without selling less, but you can potentially reduce OPEX).

Switching to **Bottom** shows the smallest expense accounts — useful for auditing whether tiny accounts are even worth tracking separately.

### How to read this chart

The main insight is relative scale. Purchases at RM 80M+ makes everything else look tiny. But if you filter to OPEX only, you can finally see the meaningful differences between payroll, depreciation, rental, and other operating costs.

---

## 6. COGS Breakdown Table

Below the charts, the page switches to detailed tables. The first is the **COGS Breakdown** — a flat table listing every Cost of Goods Sold account.

### What the rows mean

| Account | Net Cost (RM) | % of COGS | What it means |
|---------|--------------|-----------|---------------|
| Purchases | ~80,100,000 | 105.4% | The gross cost of all fruit bought from suppliers |
| Discount Received | ~-3,400,000 | negative | Supplier discounts — these *reduce* COGS |
| Purchases Return | ~-1,900,000 | negative | Returning bad or unwanted goods to suppliers |

### Wait, how can something be 105.4% of COGS?

Good catch. The percentages in the COGS table are each row's share of **net** COGS (the total after all additions and subtractions). Purchases is *above* 100% because the other accounts are negative — they bring the total down.

Here is the logic:

```
Gross Purchases:      RM  80,100,000
- Discount Received:  RM  -3,400,000
- Purchases Return:   RM  -1,900,000
+ Other COGS items:   RM  +1,200,000 (freight charges, etc.)
─────────────────────────────────────
= Net COGS:           RM  75,971,727
```

So the net amount Hoi-Yong actually pays for its goods is about RM 76M, even though the gross purchase figure is RM 80M. The RM 4M+ difference comes from negotiated discounts and returning produce that did not meet quality standards.

### How to read this table

- **Negative values appear in red** — they represent money coming *back* (discounts, returns). These are good.
- The table is **sortable** by any column. Click a header to toggle ascending/descending.
- There is an **Export CSV** button if you need to pull the data into Excel for further analysis.

---

## 7. OPEX Breakdown Table (Grouped by Category)

The second table is the **OPEX Breakdown**, and it is organized differently from the COGS table. Instead of a flat list, OPEX accounts are **grouped into categories** with collapsible sections. By default, all categories are collapsed — you see only the category name, its subtotal, and its percentage of total OPEX.

### The categories (in display order)

| Category | % of OPEX | What it covers |
|----------|-----------|----------------|
| **Payroll** | 40.1% | Staff salaries, EPF (employer pension contributions), SOCSO (social security), bonuses |
| **Depreciation** | 24.4% | The accounting wear-and-tear on trucks, cold rooms, forklifts, and other equipment |
| **Rental** | 8.1% | Warehouse and factory rent |
| **Electricity & Water** | 5.5% | Keeping the cold rooms running is not cheap |
| **Packaging Materials** | 3.7% | Boxes, labels, shrink wrap, and other packing supplies |
| **Finance Costs** | 3.7% | Bank interest on loans and credit facilities |
| **Vehicle & Equipment Upkeep** | — | Truck servicing, tire replacement, forklift maintenance |
| **Fuel** | — | Diesel and petrol for the delivery fleet |
| **Repair & Maintenance** | — | Fixing broken equipment, building maintenance |
| **Insurance** | — | Vehicle insurance, fire insurance, workers' insurance |
| **Other OPEX** | — | Everything that does not fit the above categories |

### Understanding each category

**Payroll (40.1%)** is the biggest OPEX item. For every RM 10 spent on operating expenses, RM 4 goes to staff. This includes not just base salaries but also statutory contributions (EPF and SOCSO — think of these as Malaysia's equivalent of social security and pension contributions that employers must pay).

**Depreciation (24.4%)** deserves a special explanation because it confuses people. Depreciation is **not actual cash going out the door**. It is an accounting concept. When Hoi-Yong buys a cold room for RM 500,000, they do not record the full RM 500,000 as an expense in the year of purchase. Instead, they "spread" the cost over the useful life of the asset — say, 10 years. So each year, RM 50,000 appears as depreciation expense. The cash was spent years ago; the depreciation entry is just the accounting system recognizing that the cold room is one year older and worth a bit less. This matters because high depreciation means the company owns a lot of expensive assets (trucks, cold rooms, forklifts) — which makes sense for a distributor with a cold chain.

**Electricity & Water (5.5%)** might seem modest at first, but remember — this is a fruit distributor. Cold storage runs 24/7. If this percentage starts climbing, it could signal that the cold rooms are losing efficiency (aging compressors, damaged seals) or that electricity tariffs went up.

**Packaging Materials (3.7%)** covers all the boxes, labels, and wrapping needed to pack fruit for delivery. This tends to scale with sales volume — more fruit sold, more boxes needed.

### Expanding a category

Click any category row to expand it and see the individual GL (General Ledger) accounts underneath. For example, expanding "Payroll" would reveal separate line items for Staff Salary, EPF Contribution, SOCSO Contribution, Bonus, and so on. Each line shows its own RM value and percentage of total OPEX.

This drill-down is useful when you spot something odd at the category level and want to know exactly which account is responsible.

### Export

Like the COGS table, there is an **Export CSV** button. The export includes the category, account number, account name, net cost, and percentage — everything you need for further analysis in a spreadsheet.

---

## 8. Red Flags — What to Watch For

Here are the warning signs that should make you sit up and pay attention:

### COGS growing faster than sales

This is the number-one red flag. If COGS increases by 5% but revenue only increases by 2%, the company's gross margin is shrinking. This could mean:
- Supplier prices went up and Hoi-Yong has not raised its own prices to match
- The product mix shifted toward lower-margin items
- Fewer supplier discounts were negotiated

**How to spot it:** Compare the YoY Change card on this page (+0.8%) with the YoY Change on the Sales page. If costs are growing faster than revenue, investigate immediately.

### Any single OPEX category spiking unexpectedly

If Payroll was steady at RM 300K/month and suddenly jumps to RM 450K, something happened — new hires, bonuses, or overtime. Use the trend chart in OPEX mode to spot month-over-month jumps, then drill into the OPEX breakdown table to find the specific account.

### Electricity costs rising

For a cold-chain business, electricity is a leading indicator of equipment health. Rising electricity costs without a corresponding increase in sales volume could mean:
- Cold room compressors are aging and working harder
- Door seals are damaged, letting cold air escape
- A new cold room was added (which would be planned and expected)

### Discount Received shrinking

In the COGS breakdown table, if the Discount Received line (which is negative, remember — it reduces costs) gets smaller over time, it means Hoi-Yong is losing negotiating power with its suppliers. Fewer discounts = higher effective purchase cost.

### Purchases Return increasing

A rising Purchases Return figure means Hoi-Yong is sending more produce back to suppliers. That could mean quality issues in the supply chain — fruit arriving overripe, damaged, or not meeting specifications.

---

## 9. When Someone Asks You...

Here is a cheat sheet for the questions you are most likely to get, and how to answer them using this page.

### "What's our biggest expense?"

**Answer:** Purchasing fruits — about RM 80 million per year. It accounts for 88% of all costs. This is normal for a distributor; the product itself is always the dominant cost.

**Where to look:** The Top 10 Expenses chart (Purchases is #1 by a huge margin), or the COGS Breakdown table for the exact figure.

### "How much do we spend on staff?"

**Answer:** About RM 4 million per year, which is 40% of OPEX. That includes salaries, EPF, SOCSO, and bonuses.

**Where to look:** OPEX Breakdown table, expand the Payroll category. You will see every payroll-related GL account with its individual amount.

### "Are costs going up?"

**Answer:** Total costs grew +0.8% year-over-year — a very slight increase. But the important comparison is against revenue growth. If sales grew 2.3% while costs only grew 0.8%, the company is actually becoming slightly more efficient. If it were the other way around, you would have a problem.

**Where to look:** The YoY Change KPI card for the headline number. The Cost Trend chart to see which months drove the change.

### "Can we cut costs?"

**Answer:** Look at OPEX — that is where the controllable costs live. Payroll and depreciation are the two biggest items (together about 65% of OPEX), but they are also the hardest to cut. Depreciation cannot be "cut" at all — it is an accounting entry for assets you already own. Payroll cuts mean laying people off.

More realistically, look at:
- **Rental** — can you renegotiate the lease?
- **Fuel** — can delivery routes be optimized?
- **Electricity** — can cold room efficiency be improved?
- **Packaging** — can you switch to a cheaper supplier?

**Where to look:** OPEX Breakdown table, sorted by net cost descending. Focus on categories where small percentage improvements translate to meaningful RM savings.

### "Why is COGS percentage over 100% in the table?"

**Answer:** Because some COGS accounts are negative (discounts and returns reduce the total). The percentages are calculated against the *net* COGS figure, so the gross Purchases line exceeds 100% while the negative lines bring the total back to 100.0%.

**Where to look:** Section 6 of this chapter for the full explanation.

---

## 10. Filters and Navigation

### Date range

The date range picker at the top of the page defaults to the most recent 12 months of data. You can adjust it manually or use the quick presets: **3M**, **6M**, **12M**, or **YTD** (Year to Date). All four KPI cards, both charts, and both tables update when you change the date range.

### Cost type toggle

The segmented button (All / COGS / OPEX) above the charts controls how the trend chart and donut chart group their data. It does **not** affect the KPI cards or the breakdown tables (those always show their respective data regardless of the toggle).

### URL persistence

Every filter choice is saved in the URL. That means you can bookmark a specific view (say, OPEX mode for the last 6 months) and come back to it later, or share the link with a colleague and they will see exactly what you see.

---

## Summary

The Cost Tracking page answers "Where is the money going?" in increasing levels of detail:

1. **KPI cards** — the headline numbers (total costs, COGS, OPEX, YoY change)
2. **Cost Trend chart** — how costs move over time
3. **Cost Composition donut** — the proportional split at a glance
4. **Top 10 Expenses** — which specific accounts cost the most
5. **COGS Breakdown table** — every cost-of-goods account with exact figures
6. **OPEX Breakdown table** — every operating expense grouped by category, expandable to individual accounts

The single most important habit is to **always compare cost growth against revenue growth**. Costs going up is not inherently bad — but costs going up *faster than revenue* means the business is becoming less profitable, and that is the red flag this page is designed to catch.
