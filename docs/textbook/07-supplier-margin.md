# Chapter 7: Supplier Profit Margin — Who Gives You the Best Deals

You buy fruits from over a hundred suppliers. Some give you fantastic prices that let you mark up generously. Others squeeze you so tight that you barely break even. This page tells you exactly who is who — and which specific products are making you money versus bleeding it away.

If the Sales Report (Chapter 1) tells you how much money is coming in, this page tells you how much of that money you actually get to keep after paying your suppliers.

![Supplier Profit Margin page](../screenshots/supplier_margin/default.png)

---

## 1. What This Page Tells You

Let's start with the most important concept on this page: **margin**.

Imagine you buy a box of apples from a supplier for RM 5, then sell it to a supermarket for RM 6. You made RM 1 of profit on that sale. But how "good" is that profit? That's what margin tells you — it expresses your profit as a percentage of what you sold it for:

> **Margin = (Selling Price - Purchase Price) / Selling Price**

In our apple example: (RM 6 - RM 5) / RM 6 = **16.7% margin**.

Why divide by the selling price and not the purchase price? Because the selling price is the total amount of money that changed hands. Out of every RM 6 your customer paid, RM 1 stayed in your pocket. That's 16.7 cents per ringgit of revenue — and that's what margin measures.

**Higher margin = you buy cheap and sell at a good price = more profit per ringgit of sales.**

This page answers questions like:

- Which of your 107 suppliers give you the fattest margins?
- Which individual products are you selling at a loss without realizing it?
- Is a particular supplier getting more expensive over time?
- If you buy the same product from three different suppliers, who gives you the cheapest price?

> **Why should you care?**
>
> Revenue is vanity, profit is sanity. You could sell RM 100 million worth of fruit, but if you paid RM 99 million to buy it, you only made RM 1 million. This page is where you find out if your purchasing decisions are actually making the company money — or quietly destroying it.

---

## 2. The 5 KPI Cards

At the top of the page, five cards give you the executive summary for whatever date range you've selected. Think of them as the "vital signs" of your supplier economics.

### 2.1 Gross Sales — RM 75.6M

**What it means:** The total selling value of everything you sold that you also have purchase records for. This is calculated from invoices (IV) and cash sales (CS), excluding credit notes.

**Why "gross"?** Because no costs have been subtracted yet. This is the raw revenue number before you account for what you paid suppliers.

**Important nuance:** This only includes items that also appear in your purchase records. If you sold something but have no record of buying it from a supplier, it won't show up here. This makes the margin calculation accurate — you're only comparing items where you know both the selling price and the buying price.

### 2.2 Purchase Cost — RM 68.6M

**What it means:** What you paid your suppliers for the goods you sold. Technically, it's the average purchase price of each item (from purchase invoices) multiplied by how many units you sold.

**Why "average" purchase price?** Because you might buy the same item at different prices throughout the year — maybe RM 3.50 in January and RM 3.80 in June. The system averages those out across the entire selected period so you get a stable, fair picture.

### 2.3 Gross Profit — RM 7.0M

**What it means:** The money left over after paying your suppliers. Simple subtraction:

> **Gross Profit = Gross Sales - Purchase Cost = RM 75.6M - RM 68.6M = RM 7.0M**

This card turns **green** when profit is positive (good!) and **red** when it's negative (you're losing money overall — that's an emergency).

### 2.4 Overall Margin — 9.3%

**What it means:** Your gross profit expressed as a percentage of sales. The single most important number on this page.

> **For every RM 100 of fruit Hoi-Yong sold, RM 9.30 is profit.**

The remaining RM 90.70 went back to suppliers. That RM 9.30 still has to cover your warehouse rent, staff salaries, electricity, truck fuel, and everything else — so it's not "take-home" money yet. But it's the starting point.

**Color coding tells you how healthy this number is:**
- **Green** (>= 20%): Excellent margins — you have plenty of room to cover operating costs
- **Amber** (10-19.9%): Moderate — workable, but not much cushion
- **Red** (< 10%): Thin margins — proceed with caution

At 9.3%, Hoi-Yong's overall margin shows up in red. That's typical for a fruit distributor (fresh produce is a low-margin business), but it means every percentage point matters enormously. Improving from 9.3% to 10.3% on RM 75.6M of sales is an extra RM 756,000 of profit.

### 2.5 Active Suppliers — 107

**What it means:** The number of distinct suppliers you purchased from during the selected period. This comes from counting unique supplier codes on non-cancelled purchase invoices.

> **How to read this:** If this number is dropping over time, you might be consolidating to fewer suppliers (which can be good for negotiating bulk discounts, or risky if you become too dependent on one source). If it's growing, you're diversifying — more options, but also more relationships to manage.

---

## 3. Profitability Trend Chart

Below the KPI cards sits a full-width chart that shows how your supplier margins have behaved month by month. It combines two things in one view:

- **Green bars** = Gross Profit in RM for each month (read against the left Y-axis)
- **Red line** = Margin percentage for each month (read against the right Y-axis)

### How to read this

The bars tell you the absolute amount of profit. The line tells you the efficiency. You want both to be high — but they don't always move together.

**Scenario 1: Bars going up, line going up.** Best case. You're selling more AND keeping a bigger slice. This might happen during a season when certain high-margin fruits are in demand.

**Scenario 2: Bars going up, line going down.** You're selling more, but your margins are shrinking. Maybe supplier prices went up, or you're discounting to move volume. More revenue, less profit per ringgit — a yellow flag.

**Scenario 3: Bars going down, line going up.** You're selling less, but what you do sell has great margins. Maybe you dropped some low-margin products. Efficiency is up, but the business is smaller.

**Scenario 4: Bars going down, line going down.** Worst case. Both volume and efficiency are declining. Time for a serious procurement review.

> **Red flags:**
>
> - A sudden spike in one month could mean a one-off bulk deal with great pricing — nice, but don't expect it to repeat.
> - A steady downward slope in the red line over several months means supplier prices are creeping up faster than your selling prices. That's the kind of slow bleed that kills margins quietly.

---

## 4. Top 10 Suppliers / Items Chart

On the left side below the trend chart, you'll find a horizontal bar chart that's surprisingly powerful because of its toggle buttons. Three sets of toggles let you slice the data differently:

### Toggle 1: Suppliers vs Items

- **Suppliers** — shows the top (or bottom) 10 suppliers as entities
- **Items** — shows the top (or bottom) 10 individual products (e.g., "Red Dragon Fruit," "Cavendish Banana")

### Toggle 2: Gross Profit vs Margin %

- **Gross Profit** — ranks by absolute ringgit profit (big bars = lots of money)
- **Margin %** — ranks by efficiency (which supplier/item gives you the best percentage)

These tell very different stories. A supplier might give you only 5% margin but contribute RM 2M in gross profit because of sheer volume. Another might give you 40% margin but only RM 10,000 profit because you barely buy from them.

### Toggle 3: Highest vs Lowest

- **Highest** — the best performers (default)
- **Lowest** — the worst performers (this is where the trouble is)

### Practical examples

**"Top 10 Suppliers by Gross Profit"** might show AARTSEN ASIA LIMITED (USD) at the top. They're an international supplier, and international suppliers often have higher margins because of bulk import pricing and specialized products that local competitors can't match.

**"Bottom 10 Items by Margin %"** is where you find the products you're actually losing money on. If you see a popular item with a negative margin, that's a pricing mistake that needs fixing immediately.

> **When someone asks you:** "Which supplier gives us the best margin?"
>
> Toggle to Suppliers + Margin % + Highest. There's your answer. But also check Gross Profit to make sure it's not a tiny supplier with misleading percentages.

---

## 5. Supplier Margin Distribution (Donut Chart)

On the right side, next to the top 10 chart, sits a donut chart that answers a different question: **"How are our suppliers distributed across margin tiers?"**

Instead of naming specific suppliers, this chart groups all 107 suppliers (or all items, if you toggle) into margin buckets:

| Bucket | Color | What it means |
|--------|-------|---------------|
| < 0% | Red | You're LOSING money buying from these suppliers |
| 0-5% | Orange | Razor-thin margins — barely breaking even |
| 5-10% | Yellow | Below average for Hoi-Yong |
| 10-15% | Lime | Around average, decent |
| 15-20% | Green | Good margins |
| 20-30% | Emerald | Great margins |
| 30%+ | Dark emerald | Exceptional — make sure these relationships stay strong |

### How to read this

You want the donut to be mostly green. If it's mostly red and orange, your overall purchasing strategy needs work.

**Toggle between Suppliers and Items** to see the picture from both angles. You might have mostly healthy suppliers, but a handful of loss-making items dragging things down — or vice versa.

> **Red flags:**
>
> - A large red slice (< 0% bucket) means you have multiple suppliers where you're literally paying more than you're earning. Every sale through these suppliers loses money.
> - If the < 0% and 0-5% slices together make up more than a third of the donut, your procurement team needs to renegotiate or find alternative suppliers.

---

## 6. Purchase vs Selling Price Scatter Chart

This is the most visually striking chart on the page — and one of the most useful. Every dot represents one product in your catalog.

### The axes

- **X-axis (horizontal):** Average purchase price — what you pay the supplier
- **Y-axis (vertical):** Average selling price — what you charge the customer
- **Dot size:** Revenue volume — bigger dots = more popular products

### The diagonal line

A dashed line runs diagonally from the bottom-left to the top-right. This is the **break-even line** — where the purchase price equals the selling price.

> **Dots ABOVE the line = profit.** You're selling for more than you paid.
>
> **Dots BELOW the line = loss.** You're selling for less than you paid. That's a problem.

### The colors

Dots are colored by margin health:
- **Green:** Healthy margin (> 5%)
- **Amber:** Low margin (0-5%) — barely profitable
- **Red:** Loss (< 0%) — you're losing money on this product

### What to look for

**Big red dots below the line** are your worst nightmare. A big dot means high sales volume. A red dot below the line means you're losing money on it. Put those together and you have a popular product that's hemorrhaging cash. Every unit sold makes you poorer.

**Big green dots high above the line** are your stars. Popular products with healthy margins. Protect these supplier relationships.

**Small dots near the line** are low-volume, low-margin items. Individually they don't matter much, but if you have hundreds of them, they add up.

### Filters within the chart

You can narrow down what you see:
- **All Items / Outliers Only** — "Outliers" shows only items with margin below 0% or above 40%, helping you focus on extremes
- **Supplier filter** — see only items from specific suppliers
- **Item filter** — find specific products

Click any dot to see its details: item name, code, supplier names, exact prices, margin, and revenue.

> **When someone asks you:** "What products are we losing money on?"
>
> Switch to "Outliers Only" and look for red dots below the diagonal. Those are your loss-making items. Click each one to find out which supplier is involved and how much revenue is at stake.

---

## 7. Supplier Analysis Table

Below the charts, you'll find a tabbed section. The first tab — **Supplier Analysis** — is a detailed table listing every supplier with their financial performance.

### Columns explained

| Column | What it tells you |
|--------|-------------------|
| **Code** | The supplier's account number in AutoCount (e.g., "300-C001") |
| **Supplier Name** | Company name |
| **Type** | Category of supplier (e.g., Local, International) |
| **Items** | How many different products you buy from them |
| **Revenue** | How much revenue their products generated (attributed proportionally if multiple suppliers sell the same item) |
| **Purchase Cost** | What you paid them |
| **Profit** | Revenue minus cost — in bold because it's the number that matters |
| **Trend** | A tiny sparkline chart showing how their margin has moved month by month, plus an arrow |
| **Margin %** | The percentage, color-coded (green/amber/red) |

### The sparkline and arrow

Each supplier row has a miniature chart (100 pixels wide) that shows their monthly margin trajectory. If the line trends upward, it's green — things are getting better with this supplier. If it trends downward, it's red — they're getting more expensive relative to your selling prices.

The arrow next to the sparkline compares the current period's margin to the previous period:
- **Green up arrow:** Margin improved by more than 0.5 percentage points
- **Red down arrow:** Margin dropped by more than 0.5 percentage points
- **Dash:** Roughly flat (within 0.5pp)

### Sorting and searching

Default sort is by revenue (highest first), but you can click any sortable column header. Sorting by Margin % descending shows your most efficient suppliers. Sorting by Profit descending shows who contributes the most ringgit.

Use the search box to find specific suppliers by name or code. The **Export CSV** button downloads the full table for analysis in Excel.

### Row click = Supplier Profile

Click any row to open a detailed modal for that supplier (covered in Section 9 below).

> **How to read this:** Start with the default revenue sort. Your top-revenue suppliers are the ones that matter most — even a small margin change on a high-revenue supplier has a big impact. Then check their Trend column. A top-revenue supplier with a red downward sparkline is a flashing warning sign.

---

## 8. Item Pricing Tab — The Procurement Tool

Switch to the second tab — **Item Pricing** — and you'll find the most actionable tool on the entire page. This is where you compare supplier prices for specific products.

### How it works

1. **Search for a product** using the search box (by item code or description, e.g., "dragon fruit" or "FRT-001")
2. The dropdown shows each item with how many suppliers carry it
3. Select an item and two things appear:

### 8.1 Price Trend by Supplier (Line Chart)

A multi-line chart where each colored line represents one supplier's monthly average purchase price for the selected item.

- **X-axis:** Month (e.g., "2025-01", "2025-02")
- **Y-axis:** Purchase price in RM
- **Each line:** One supplier

If the lines are close together, all your suppliers price similarly. If one line is way below the others, that supplier is giving you a significantly better deal on this product.

Click the legend entries to show/hide specific suppliers if the chart gets crowded.

### 8.2 Supplier Comparison Table

Below the chart, a table ranks every supplier who sells that item, **sorted by average price with the cheapest first**.

| Column | What it tells you |
|--------|-------------------|
| **Supplier Code** | With a colored dot matching their line on the chart above |
| **Supplier Name** | Company name |
| **Avg Price** | Average unit price across the selected period |
| **Latest Price** | What they charged most recently |
| **Min / Max** | Price range — how much their pricing fluctuates |
| **Qty** | How much you've bought from them |
| **Trend** | Arrow showing if their price is going up or down |
| **Last Purchase** | Date of the most recent transaction |

**The cheapest supplier row is highlighted in green.** That's your best deal at a glance.

> **When someone asks you:** "Should we switch suppliers for [product]?"
>
> Search for that product in the Item Pricing tab. Look at:
> 1. Who has the lowest average price (highlighted row)
> 2. Whether the cheapest supplier's price is stable or trending up (Trend column)
> 3. How much volume each supplier can handle (Qty column)
> 4. When you last bought from the cheapest option (Last Purchase — if it's months ago, that relationship may have gone stale)
>
> A supplier with a slightly higher average price but a downward trend might be a better long-term bet than one who's cheap today but trending up.

---

## 9. Supplier Profile Modal

Click any row in the Supplier Analysis table and a detailed modal pops up. Think of it as a "dossier" on one specific supplier.

### Header

- **Supplier name** (large and bold) with an Active/Inactive badge
- **Supplier code** in monospace
- **Two important numbers:**
  - **Items Supplied** — how many different products they provide
  - **Single Supplier Items** (with a warning icon) — products where this is your ONLY source

That second number deserves attention. If a supplier provides 5 items that nobody else sells to you, you're completely dependent on them for those products. If they raise prices, you have no leverage. If they go out of business, you're stuck. The warning icon is there for a reason.

### KPI cards within the modal

Four cards specific to this supplier:
- **Revenue** — how much their products earned
- **Total Spend** — what you paid them
- **Gross Profit** — the difference
- **Margin** — the percentage, color-coded

### Purchase Items table

A sortable table of every item you buy from this supplier, with:

| Column | What it tells you |
|--------|-------------------|
| **Item Code / Description** | The product |
| **Qty Purchased** | How much you bought |
| **Avg Purchase Price** | Their average price to you |
| **Revenue** | What you earned selling it |
| **COGS** | Cost of goods sold (what you effectively paid) |
| **Margin %** | Profit margin on this item from this supplier |
| **Price Trend** | Mini sparkline of monthly average purchase prices |

**Single-supplier items are flagged with a warning icon** so you can immediately see your vulnerability.

### Price trend sparklines in the modal

Each item row has a tiny sparkline showing how that item's purchase price has moved over time:
- **Green line:** Price decreased or stayed flat — good news
- **Red line:** Price increased — this supplier is charging you more for this item

> **Red flags:**
>
> - Multiple items with red (upward) price sparklines from the same supplier: they're systematically raising prices on you. Time to renegotiate or source alternatives.
> - A supplier with many single-supplier items AND rising prices: you're locked in and they know it. This is a strategic risk.
> - An item with high revenue but low or negative margin: you're selling a lot of something at a loss. Check if the selling price needs to go up or if you should switch suppliers.

---

## 10. When Someone Asks You...

Here's a quick reference for the most common questions you'll face and exactly where to find the answers.

### "Which supplier gives us the best margin?"

Go to the Top 10 chart. Toggle to **Suppliers + Margin % + Highest**. But be careful — a tiny supplier with 50% margin on RM 1,000 of sales is less meaningful than a mid-size supplier with 15% margin on RM 5M. Always cross-reference with the Supplier Analysis table to check revenue volume.

### "Should we switch suppliers for [product]?"

Go to the **Item Pricing** tab. Search for the product. Compare average prices, latest prices, and trends. The cheapest supplier is highlighted in green. But also consider: reliability (do they always have stock?), price stability (wild min-max swings suggest inconsistent pricing), and recency (when was the last purchase?).

### "Are supplier prices going up?"

Two places to look:
1. **Profitability Trend chart** — if the red margin line is trending downward over months while revenue bars stay flat or grow, supplier costs are rising faster than selling prices.
2. **Supplier Profile modal** — click on a specific supplier and look at the price trend sparklines for their items. Red lines mean rising prices.

### "What's our overall margin on fruits?"

Look at the Overall Margin KPI card. In the screenshot: **9.3%** — meaning RM 7.0M profit on RM 75.6M of gross sales. For a fruit distributor, single-digit margins are normal but tight. Every fraction of a percent matters at this scale.

### "Which products are we losing money on?"

Go to the **Purchase vs Selling Price scatter chart**. Switch to **Outliers Only**. Look for red dots below the diagonal line. Click them to see the item name, supplier, and how much revenue is at risk.

### "We depend too much on one supplier — is that true?"

Open the **Supplier Profile modal** for that supplier. Look at the **Single Supplier Items** count. If it's high, yes — you have concentration risk. Each of those items has no backup source if this supplier raises prices, runs out of stock, or goes under.

### "What's the difference between this margin and the one on the Customer Margin page?"

Both pages calculate margin (selling price minus cost, divided by selling price), but they slice it differently:
- **Customer Margin** tells you which *customers* give you the best margins — some customers buy premium products, others only buy cheap items.
- **Supplier Margin** tells you which *suppliers* give you the best margins — some suppliers sell you goods cheaply, letting you mark up generously.

Same formula, different lens. One looks at who you sell to, the other at who you buy from.

---

## Summary

The Supplier Profit Margin page is where purchasing strategy meets financial reality. The KPI cards give you the big picture (9.3% margin, 107 active suppliers). The trend chart shows you whether things are getting better or worse. The scatter plot reveals hidden problems — products selling at a loss. The supplier table lets you evaluate every supplier systematically. The item pricing tab is your procurement weapon for negotiating better deals. And the supplier profile modal gives you the full story on any individual supplier.

In a low-margin business like fruit distribution, the difference between a good year and a bad year often comes down to purchasing decisions. This page gives you the data to make those decisions well.
