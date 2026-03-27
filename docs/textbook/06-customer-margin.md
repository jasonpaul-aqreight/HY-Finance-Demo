# Chapter 6: Customer Profit Margin — Which Customers Make You Money

The Sales Report (Chapter 1) told you WHO buys the most. This page tells you something far more important: **WHO is actually profitable.**

A customer who buys RM 5 million worth of fruit sounds amazing — until you find out it cost you RM 4.8 million to supply them. That "big" customer only gave you RM 200K in actual profit. Meanwhile, a smaller customer buying RM 500K might be costing you only RM 350K — netting you RM 150K at a much healthier margin.

This page is where you separate the "big spenders" from the "big earners."

![Customer Profit Margin page](../screenshots/customer_margin/default.png)

---

## 1. What This Page Tells You

The Customer Profit Margin page answers one question: **"How profitable is each customer, and how are their margins trending over time?"**

To answer that, you need to understand one concept: **margin.**

### The margin formula

> **Margin % = (Revenue - COGS) / Revenue x 100%**

Let's break that down:

- **Revenue** is how much the customer paid you (the sales number from Chapter 1).
- **COGS** stands for "Cost of Goods Sold" — how much it cost YOU to buy the fruit you sold to them.
- **Revenue - COGS = Gross Profit** — what's left over after paying for the goods.
- **Margin %** expresses that profit as a percentage of revenue.

**Example:** You sell RM 100,000 worth of durian to a customer. You bought that durian from suppliers for RM 75,000. Your gross profit is RM 25,000, and your margin is 25%. Out of every ringgit this customer pays you, you keep 25 sen.

A higher margin means you keep more of each ringgit. A negative margin means you're *paying* to serve that customer — every sale loses you money.

---

## 2. Important Note: Why the Numbers Look Alarming

When you first open this page, you'll see an overall margin of **-184.4%**. Don't panic. Let's explain why.

### Two different ways to calculate COGS

There are two fundamentally different ways to figure out "what did it cost us to sell this stuff":

1. **P&L (Profit & Loss) method** — Look at the company's general ledger. Total purchases minus inventory changes. This gives you the "official" COGS that appears on financial statements. The Expenses page (Chapter 3) uses this number.

2. **Item-level costing method** — For each item on each invoice, look up the purchase price of that specific item and multiply by the quantity sold. Add it all up across all invoices. This is what *this* page uses.

The item-level method can produce wildly different numbers from the P&L method because:

- Purchase prices in the system might be outdated or missing for some items.
- Some items may have cost records that don't match what was actually paid.
- The timing of purchases and sales may not line up neatly.

**The result on this page:** Total COGS shows RM 234M against Net Sales of RM 82.3M — producing a gross profit of negative RM 151.8M and a margin of -184.4%.

### So why is this page still useful?

Think of it this way: the P&L gives you the *official* answer. This page gives you the *relative comparison* between customers.

Even if the absolute numbers are off, the **ranking** is still meaningful. If Customer A shows a 12% margin and Customer B shows a -5% margin, Customer A is genuinely more profitable than Customer B — even if neither number matches the P&L exactly.

> **The P&L is the official number. This page is for COMPARING customers against each other.**

Use the P&L page when someone asks "what's our overall margin?" Use this page when someone asks "which customers make us the most money?"

---

## 3. The Five KPI Cards

At the top of the page, five cards give you the big picture at a glance.

### 3.1 Net Sales — RM 82.3M

The total revenue from all active customers in the selected period. Same formula as the Sales Report: Invoice revenue + Debit note revenue - Credit note revenue.

This number should match (or be very close to) the Net Sales figure on the Sales Report page for the same date range.

### 3.2 Total COGS — RM 234M

The total cost of goods sold, calculated using the item-level method. As explained above, this number is much higher than the P&L-based COGS because of how individual item costs are recorded in the system.

### 3.3 Gross Profit — -RM 151.8M

Net Sales minus Total COGS. Shown in **red** because it's negative. On a page where item-level COGS is accurate, this would show you the actual profit earned from selling goods.

The colour rule is simple: green when positive (you made money), red when negative (you didn't).

### 3.4 Overall Margin — -184.4%

Gross Profit divided by Net Sales, expressed as a percentage. The colour coding here works on a traffic-light system:

- **Red** (below 10%) — Thin or negative margins. Trouble zone.
- **Amber** (10% to 20%) — Acceptable but room for improvement.
- **Green** (above 20%) — Healthy margins.

At -184.4%, this is deep red — but remember, this is a limitation of the item-level costing method, not a reflection of actual business performance.

### 3.5 Active Customers — 319

The number of distinct customers who had at least one transaction in the selected period. This gives you a quick sense of customer base size.

> **Why should you care?**
>
> These five cards are your dashboard-at-a-glance. In a meeting, someone asks "how's customer profitability looking?" — you glance at these five numbers and you can answer in ten seconds. The key insight here is comparing Active Customers (319) against the distribution chart further down — how many of those 319 are actually profitable?

---

## 4. Profitability Trend Chart

Below the KPI cards, you'll find a combined bar-and-line chart showing how margins move over time.

### How to read it

- **Blue bars** represent Gross Profit for each month. Bars going up mean profit; bars going below the zero line mean a loss for that month.
- **Red line** traces the Margin % on the right-hand axis. This shows the *rate* of profitability — not just the amount, but how efficient the business was at turning revenue into profit.

### What to look for

The shape of this chart tells a story:

- **Bars consistently above zero with a flat or rising red line** — Business is stable and profitable. Good news.
- **Bars dipping below zero in certain months** — Seasonal losses. Fruit is a seasonal business; some months might naturally be harder. Look at whether the same months dip every year.
- **Red line trending downward over time** — Margins are eroding. This could mean costs are rising, prices are being squeezed, or the customer mix is shifting toward lower-margin buyers.
- **A sudden spike or drop in one month** — Investigate. Was there a large one-off order? A big credit note? A pricing error?

> **How to read this:** Ignore the absolute values (they're affected by the COGS calculation method). Focus on the *pattern*. Are things getting better or worse month over month? That trend is reliable even when the absolute numbers are not.

---

## 5. Top 10 Customers Chart

This horizontal bar chart answers the question: "Who are our most (or least) profitable customers?"

### The toggle controls

You get two pairs of buttons that let you slice the data four different ways:

| Metric | Direction | What it shows |
|--------|-----------|---------------|
| Gross Profit | Highest | Top 10 customers by absolute profit (RM) |
| Gross Profit | Lowest | Bottom 10 customers by absolute profit (most money lost) |
| Margin % | Highest | Top 10 customers by margin percentage (most efficient) |
| Margin % | Lowest | Bottom 10 customers by margin percentage (least efficient) |

When you switch to "Margin %," the chart automatically filters out customers with less than RM 10K in revenue. This prevents a customer with one tiny RM 50 invoice from showing a 90% margin and dominating the chart.

### Real examples from the data

- **WONDERFRUITS**: RM 745K gross profit at a 12.4% margin. This is the highest absolute profit — they buy a LOT and Hoi-Yong still makes good money on each sale.

- **NATURE-CO SUPPLY CHAIN**: RM 262K gross profit but an 89% margin. A much smaller customer, but spectacularly efficient. Almost every ringgit they pay is profit.

- The contrast between these two illustrates a critical business lesson: **Big customer does not equal most profitable customer.** Sometimes your small, steady customers are the ones keeping the lights on.

> **When someone asks you:** "Who's our best customer?" — ask them what they mean. Best by *volume* (go to the Sales page)? Best by *total profit* (sort by Gross Profit here)? Best by *efficiency* (sort by Margin %)? The answer is different each time.

---

## 6. Customer Margin Distribution (Donut Chart)

To the right of the Top 10 chart, you'll see a donut (ring-shaped pie chart) that divides all 319 customers into margin buckets.

### The buckets

| Bucket | Colour | What it means |
|--------|--------|---------------|
| **< 0%** | Red | Losing money on these customers |
| **0-5%** | Orange | Barely breaking even |
| **5-10%** | Yellow | Thin margins |
| **10-15%** | Lime | Acceptable, the "sweet spot" |
| **15-20%** | Green | Good margins |
| **20-30%** | Emerald | Strong margins |
| **30%+** | Dark emerald | Excellent margins |

Only customers with more than RM 1,000 in revenue are included — this filters out noise from near-zero accounts.

### What the numbers reveal

- **38 customers have negative margins** — you're losing money every time they place an order. That red slice demands attention.
- **65 customers sit in the 10-15% range** — this is the healthy middle ground for a fruit distributor.
- The distribution shape tells you about pricing health. A healthy business should have most customers in the green/lime/emerald zones, with only a small red slice.

> **How to read this:** If the red slice (< 0%) is growing over time, your pricing strategy needs urgent review. If most customers cluster in the 10-15% band, the business has consistent pricing. A wide spread (customers all over the spectrum) suggests inconsistent pricing or very different customer types.

> **Red flag:** If more than 20% of your customers are in the < 0% bucket, something systematic is wrong — it's not just a few bad deals, it's a pricing or cost problem across the board.

---

## 7. Customer Analysis Table

This is the main working table where you do the real analysis. Think of the charts above as the "headline" — this table is the "article."

### The columns

| Column | What it tells you |
|--------|-------------------|
| **Code** | The customer's account code in AutoCount (e.g., "300-A0123") |
| **Name** | The company name (e.g., "WONDERFRUITS SDN BHD") |
| **Type** | Customer category (shown as a small badge — e.g., "Wholesaler," "Retailer") |
| **Revenue** | Total sales to this customer in the period |
| **COGS** | Total cost of goods sold to this customer |
| **Gross Profit** | Revenue minus COGS. Green = positive, red = negative |
| **Margin %** | Gross profit as a percentage of revenue. Red below 10%, amber 10-20%, green above 20% |
| **Trend** | A tiny sparkline chart plus a direction arrow |

### The trend column explained

Each customer row includes a miniature line chart (called a sparkline) showing their margin over time, plus an arrow:

- **Green triangle pointing up** — Margin is improving compared to the prior equivalent period. Good news.
- **Red triangle pointing down** — Margin is declining. Worth investigating.
- **Grey dash** — Margin is roughly flat (within 0.5 percentage points). Stable.

The sparkline itself is colour-coded too: green if the margin ended higher than it started, red if it ended lower.

### Sorting, searching, and exporting

- **Click any column header** to sort. Want to find your worst-performing customers? Sort by Margin % ascending. Want to find the biggest profit generators? Sort by Gross Profit descending.
- **Use the search box** to filter by customer name or code. Handy when someone asks about a specific account.
- **Click "CSV"** to export the current view to a spreadsheet. Useful for offline analysis or sharing with colleagues who don't have dashboard access.

### Clicking a row

Click any customer row and a **Customer Profile Modal** pops up with three tabs:

- **Payment** — How quickly does this customer pay? Any overdue invoices?
- **Returns** — How much does this customer return? What's their credit note history?
- **Sold Items** — What specific products does this customer buy, and what's the margin on each one?

This is where you go deep. If a customer has a thin margin, the Sold Items tab will show you *which products* are dragging it down.

> **Why should you care?**
>
> The table is where decisions get made. The charts give you the overview, but the table is where you identify *specific* customers to call, renegotiate with, or celebrate. When the sales team asks "give me a list of customers we need to talk to," you sort this table, filter it, and export it.

---

## 8. Credit Note Impact Tab

Switch to the second tab in the table section to see the **Credit Note Impact** view. This answers a subtle but important question: "How much are returns hurting our margins?"

### Why this matters

A customer might look great on paper — high revenue, decent margin. But if they return a lot of product, those credit notes eat into the margin after the fact.

This table shows you the "before and after" picture for every customer who has credit notes.

### The columns

| Column | What it tells you |
|--------|-------------------|
| **Customer** | Company name |
| **IV Revenue** | Invoice revenue (before any credit notes) |
| **CN Amount** | Credit note total (always shown in red — this is money going back) |
| **Return Rate** | CN Amount / IV Revenue as a percentage. Red above 10%, amber 5-10% |
| **Margin Before** | What the margin would be if there were zero returns |
| **Margin After** | The actual margin after accounting for credit notes |
| **Margin Lost** | The difference — how many percentage points of margin the credit notes destroyed |

### Example

Imagine a customer with:
- IV Revenue: RM 1,000,000
- CN Amount: RM 150,000 (return rate: 15%)
- Margin Before: 18%
- Margin After: 12%
- Margin Lost: 6 percentage points

That 15% return rate just knocked 6 points off the margin. If this customer had fewer returns, they'd be in the "healthy" zone. This is actionable information — maybe the fruit quality going to this customer needs to be checked, or maybe they're over-ordering and returning excess stock.

The table is sorted by Return Rate (highest first) and limited to 100 customers, so you immediately see the worst offenders at the top.

> **How to read this:** Focus on customers where the Margin Lost column is large AND the IV Revenue is significant. A tiny customer with a high return rate is annoying but not urgent. A large customer with a high return rate is costing you real money.

---

## 9. Red Flags

When reviewing this page, these are the warning signs that should make you stop and investigate:

**Customers with negative margins.** These 38 customers in the < 0% bucket are losing you money on every transaction. Some might be strategic (loss leaders to win a bigger account), but most should not be. Pull up their profile and check: Is the pricing wrong? Is the COGS data accurate? Are they returning too much product?

**High-revenue customers with thin margins.** A customer buying RM 2 million per year at a 2% margin earns you only RM 40K. A small price increase (even 1%) would add RM 20K in profit. These customers are worth a pricing conversation.

**Declining trend arrows.** A red down-arrow means margins are getting worse compared to the prior period. One customer declining is a customer problem. Many customers declining is a business problem — costs might be rising across the board.

**Large red slices in the distribution donut.** If the < 0% or 0-5% slices are growing over time, the business is trending in the wrong direction. Compare the distribution across different date ranges to spot this.

**High margin-lost numbers in the Credit Note Impact tab.** If credit notes are erasing 5+ percentage points of margin for a customer, the return process needs attention. Either the product quality, the ordering process, or the credit note policies need review.

---

## 10. When Someone Asks You...

**"Which customer makes us the most money?"**
Go to the Top 10 chart or sort the Customer Analysis table by Gross Profit (descending). The answer is the customer with the highest absolute gross profit — in the current data, that's WONDERFRUITS at RM 745K.

**"Which customer has the best margin?"**
Sort by Margin % (descending). But be careful — a tiny customer with one lucky invoice can show 90% margin. Filter to customers with meaningful revenue (the Top 10 chart already does this with its RM 10K minimum when showing Margin %).

**"Are we losing money on any customers?"**
Yes — 38 of them. Filter the table for negative margins or look at the red slice in the distribution donut. Export the list and share it with the sales team.

**"Should we drop this customer?"**
This needs nuance. Look at three things:
1. **Margin trend** — Is it improving or declining? An improving negative margin might turn positive soon.
2. **Volume** — A large customer with thin margins might still be worth keeping for cash flow and warehouse utilization.
3. **Credit note pattern** — Check the Credit Note Impact tab. If returns are the problem, fixing the returns might fix the margin.

A customer with negative margin AND declining trend AND high returns is a strong candidate for a serious conversation — not necessarily dropping them, but definitely renegotiating terms or pricing.

**"Why doesn't this page match the P&L?"**
Because this page uses item-level COGS (purchase price x quantity for each line item) while the P&L uses general ledger COGS (total purchases adjusted for inventory changes). They measure the same concept differently. Use the P&L for the official company-wide answer. Use this page for customer-to-customer comparisons.

**"What's a good margin for a fruit distributor?"**
There's no universal answer, but for Hoi-Yong's business, the 10-15% bucket in the distribution chart is where most healthy customers sit. Anything above 15% is excellent. Below 5% is a concern. Below 0% is a problem.

---

## Summary

The Customer Profit Margin page transforms the sales data from "who buys the most" into "who makes us the most money." Revenue without profit is just activity — this page shows you the profit.

Key takeaways:

1. **Revenue and profit are different things.** The Sales page shows revenue. This page shows profit. A RM 5M customer at 2% margin (RM 100K profit) is less valuable than a RM 1M customer at 20% margin (RM 200K profit).

2. **The absolute numbers here may not match the P&L.** That's expected. Use this page for *relative* comparisons between customers, not for official financial reporting.

3. **38 customers have negative margins.** That's the single most actionable finding on this page. Someone should be looking at each one and asking "why?"

4. **Trends matter more than snapshots.** A customer at 8% margin but improving is healthier than a customer at 15% margin but declining. Always check the trend arrows.

5. **Credit notes can silently destroy margins.** The Credit Note Impact tab reveals customers who look profitable until you account for returns. Don't skip it.
