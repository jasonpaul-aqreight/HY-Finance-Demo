# Chapter 1: Sales Report — How Much Money Is Coming In

Welcome to the Sales Report page. This is the single most important page on the dashboard because it answers the most fundamental question any business has: **"How much did we sell?"**

If you only ever look at one page, make it this one.

![Sales Report page](../screenshots/sales/default.png)

---

## 1. What This Page Tells You

Every business tracks two big numbers: how much money comes in (revenue) and how much goes out (costs). The Sales Report page is entirely about the first one — the money coming in, also called the **"top line."**

Why "top line"? Because on an old-fashioned income statement, total revenue is literally the first line at the top of the page. Everything else — costs, expenses, profit — comes below it. You can't understand any of those without understanding this number first.

**In Hoi-Yong's case, this means:** How many ringgit worth of fruit did we sell to our customers — supermarkets, wholesalers, and walk-in buyers — over a given time period?

### Three ways money comes in (and one way it goes back out)

Not all sales are the same. Hoi-Yong records sales in three different buckets:

1. **Invoice Sales** — A customer orders fruit, Hoi-Yong delivers it, and sends a bill (an invoice). The customer pays later, usually within 30 days. This is called selling "on credit" — not because anyone uses a credit card, but because you're extending trust (credit) that they'll pay you later.

2. **Cash Sales** — A customer walks in, picks up fruit, and pays on the spot. This also includes POS (Point-of-Sale) transactions — those are already counted here, so don't worry about them separately.

3. **Credit Notes** — Sometimes things go wrong. The fruit arrives bruised. The price was wrong on the invoice. The customer returns a box. When any of this happens, Hoi-Yong issues a "credit note" — basically an official "we owe you" slip that reduces what the customer owes. Think of it as a refund counter.

The magic formula that ties them all together:

> **Net Sales = Invoice Sales + Cash Sales - Credit Notes**

That subtraction is important. Credit notes *reduce* your revenue because you're giving money back (or forgiving a debt). They show up in red on the dashboard for exactly this reason.

---

## 2. The Date Range Filter

Before diving into the numbers, you need to understand the camera at the top of the page.

### Think of it like a camera lens

Every number on this page depends on the time window you select. The date range filter is like choosing how wide to set your camera lens — you decide how far back in time to look.

- Want to see just the last quarter? Use **3M** (3 months).
- Want a half-year view? Use **6M**.
- Want the full year picture? Use **12M** (this is the default).
- Want everything from January 1st of this year? Use **YTD** (Year-To-Date).

You can also set custom start and end months using the two date pickers.

**Key thing to remember:** When you change the date range, *everything* on the page changes — the KPI cards, the trend chart, and the breakdown table all update to show data only for your selected period. It's like rewinding or fast-forwarding a movie — you're always watching the same story, just a different part of it.

The current range is displayed clearly in the center: something like "Nov 2024 -- Oct 2025 (12 months)" so you always know what window you're looking at.

> **Why should you care?**
>
> Comparing "total sales" without specifying the time period is meaningless. RM 88 million over 12 months is very different from RM 88 million over 6 months. Always check which date range you're looking at before drawing any conclusions. If someone asks you "what are our sales?" — your first question back should be "over what time period?"

---

## 3. KPI Cards — The Four Numbers That Matter Most

Right below the date filter, you'll see four large cards. These are your KPI cards — KPI stands for "Key Performance Indicator," which is just a fancy way of saying "the numbers the boss wants to see first."

Each card shows one big number for the entire selected date range.

### 3.1 Net Sales

**The number:** RM 88,213,960 (over 12 months, in the screenshot)

**What it means:** This is the final answer to "How much did we sell?" after accounting for everything — invoices sent out, cash received, and credit notes given back. It's the single most important number on the page.

**The formula:** Invoice Sales + Cash Sales - Credit Notes

**The subtitle on the card:** "Invoice + Cash Sales - Credit Notes" — a handy reminder.

> **Why should you care?**
>
> This is the number that gets reported to management. When someone says "sales are up" or "sales are down," they're talking about this number. If it's shrinking month over month, that's a serious conversation. If it's growing, that's worth celebrating (but also worth investigating — is it because of higher prices? More customers? One big order?).

---

### 3.2 Invoice Sales

**The number:** RM 83,692,902 (over 12 months)

**What it means:** The total value of all invoices sent to customers who will pay later. These are credit-term sales — the customer gets the fruit now and pays within an agreed period (typically 30 days).

**In Hoi-Yong's case, this means:** This is the bread and butter of the business. Supermarkets, restaurant chains, and wholesale buyers don't pay cash — they get invoiced. At RM 83.7 million out of RM 88.2 million total, invoice sales make up roughly **95%** of all revenue.

> **Why should you care?**
>
> Because invoice sales are paid *later*, this number tells you how much money customers *owe* you (or will owe you soon). A high invoice number with slow payments can create cash flow problems — you delivered the fruit, but the money hasn't arrived yet. That's why this page pairs with the Payment Report (Chapter 3).

---

### 3.3 Cash Sales

**The number:** RM 5,534,326 (over 12 months)

**What it means:** Revenue from customers who paid immediately — walk-in buyers, small orders, POS transactions.

**In Hoi-Yong's case, this means:** Cash sales are only about **6%** of total revenue. This is normal for a wholesale fruit distributor — most of the business runs on invoices. But cash sales are nice because the money is already in your hands. No waiting, no chasing.

> **Why should you care?**
>
> Cash sales are a small piece of the pie, but they're the *safest* piece — there's zero risk of the customer not paying. If cash sales start growing, it might mean more retail/walk-in traffic. If they drop, it might mean the POS counter is quieter. Either way, it's a signal worth noticing.

---

### 3.4 Credit Notes

**The number:** -RM 1,013,268 (over 12 months, shown in red)

**What it means:** The total value of returns, refunds, and price adjustments. This number is shown with a minus sign and in red because it *reduces* your revenue.

**In Hoi-Yong's case, this means:** About **1.1%** of gross sales came back as credit notes. For a fruit business, some returns are inevitable — produce is perishable, and occasionally a delivery won't meet the customer's standards.

**Analogy:** Imagine you sold 100 boxes of mangoes for RM 10 each (RM 1,000). Then 2 boxes were bruised and the customer returned them. You issue a credit note for RM 20. Your net sales are RM 980. That RM 20 is your credit note amount.

> **Why should you care?**
>
> A small, steady credit note amount is normal. But if credit notes start growing — either as a total or as a percentage of sales — something is going wrong. Maybe quality control is slipping. Maybe a specific customer is returning too much. Maybe the delivery trucks need better cooling. The trend matters more than any single number.

---

### Red flags to watch for (KPI Cards)

- **Net Sales declining month over month** — Is the business shrinking? Check the trend chart.
- **Credit Notes growing faster than sales** — Returns are eating into revenue. Investigate which customers or products are driving it.
- **Cash Sales suddenly dropping to near-zero** — Is the POS system down? Did a major walk-in customer leave?
- **Invoice Sales jumping suddenly** — Could be a great month, or could be one giant order that won't repeat. Dig into the breakdown table to find out.

---

## 4. Net Sales Trend Chart — The Big Picture Over Time

Below the KPI cards is a bar chart that shows how sales have changed over time. If the KPI cards are a snapshot, the trend chart is a movie — it shows you the story of your sales, month by month (or week by week, or day by day).

### How to read this chart

**Step 1: Look at the axes.**
- The horizontal axis (X-axis) shows time — months by default (e.g., "Nov 24", "Dec 24", "Jan 25").
- The vertical axis (Y-axis) shows revenue in RM. Large numbers are abbreviated: "7.5M" means RM 7,500,000.

**Step 2: Understand the bars.**

Each bar is split into colored segments, stacked on top of each other:

- **Blue segment (bottom):** Invoice Sales — the biggest piece for most months.
- **Green segment (top):** Cash Sales — usually a thin sliver on top.
- **Red segment (below the zero line):** Credit Notes — these hang below zero because they're subtractions.

The total height of the blue + green portion, minus the red portion, equals net sales for that period.

**Step 3: Look for patterns.**
- Are the bars generally getting taller over time? Sales are growing.
- Are they getting shorter? Sales are declining.
- Is there a dip every year around the same month? That's a seasonal pattern (e.g., Chinese New Year in January/February often disrupts supply chains).
- Is there one bar that's dramatically different from the rest? Investigate that month.

### Granularity toggle

In the top-right corner of the chart card, you'll see three buttons: **Daily**, **Weekly**, **Monthly**.

- **Monthly** (default): Best for seeing the big picture and long-term trends. Each bar = one month.
- **Weekly**: Good for spotting patterns within a month. Each bar = one week (labeled "W01", "W02", etc.).
- **Daily**: Maximum detail. Each bar = one day. Useful for investigating a specific week but can get noisy over long periods.

### "Show Prior Period" toggle

This is a powerful comparison tool. When you click "Show Prior Period":

- A **dashed grey line** appears on the chart, showing what net sales looked like during the *same period one year ago*.
- The bars change color to make comparison easy:
  - **Green bars**: This period's sales are *higher* than the same period last year (growth).
  - **Red bars**: This period's sales are *lower* than last year (decline).

This is like putting two photos side by side — this year vs. last year — so you can instantly see if the business is doing better or worse.

> **Why should you care?**
>
> A single month's sales number means nothing in isolation. RM 7 million in March — is that good or bad? If March last year was RM 5 million, it's great (40% growth). If March last year was RM 9 million, it's worrying (22% decline). The prior period overlay gives you that context instantly.

### Red flags to watch for (Trend Chart)

- **A sudden, steep drop in one month** — Did you lose a major customer? Was there a supply disruption?
- **Red bars growing larger over time** — Credit notes are increasing, meaning more returns or adjustments.
- **All bars turning red when "Show Prior Period" is on** — The business is consistently underperforming vs. last year. Time for a strategy discussion.
- **Extreme spikes followed by extreme dips** — Could indicate one-time large orders that aren't sustainable.

---

## 5. Sales Breakdown Section — Who, What, and Where

This is where things get really interesting. The bottom section of the page lets you slice your sales data by different dimensions — basically asking "show me the same total, but broken down by ______."

### The "Group By" picker

At the top of the Sales Breakdown card, you'll see toggle buttons for seven different views:

| Group By | What it answers | Example from Hoi-Yong |
|----------|----------------|-----------------------|
| **Customer** | Which customer bought the most? | "AEON supermarket bought RM 5.2M of fruit" |
| **Customer Category** | Which *type* of customer buys the most? | "Supermarkets as a group bought more than wholesalers" |
| **Fruit** | Which fruit is our bestseller? | "Bananas outsold mangoes by 2x" |
| **Country** | Where does our fruit come from? | "Thai imports make up 40% of sales" |
| **Variant** | Which specific variety sells best? | "Fuji apples outsell Granny Smith 3-to-1" |
| **Sales Agent** | Which salesperson brings in the most revenue? | "Agent A001 handles 30% of all sales" |
| **Outlet** | Which warehouse/location sells the most? | "The KL outlet does more business than Penang" |

### The horizontal bar chart

When you select a group-by dimension, a horizontal bar chart appears showing the top performers. The longest bar = the highest seller. Each bar has its RM value labeled at the end.

**How to read this chart:**

1. Look at which item has the longest bar — that's your biggest contributor.
2. Compare bar lengths to get a sense of proportion. Is the top customer 2x the second? 10x?
3. The bars are colored differently just to help you tell them apart visually.

**Advanced feature — "Stack By":** You can add a second dimension to see composition within each bar. For example, if you group by Customer and stack by Fruit, each customer's bar splits into colored segments showing *which fruits* that customer buys. This answers questions like "Does our biggest customer only buy one fruit, or do they buy everything?"

### The data table

Below the chart sits a detailed table with all the numbers. The exact columns depend on which dimension you've selected, but you'll always see:

- **Total Sales** — Net sales for that row
- **Invoice Sales** — How much came from invoices
- **Cash Sales** — How much was paid in cash
- **Credit Notes** — How much was returned/adjusted

Some dimensions have extra columns:
- **Customer** also shows the customer code and category
- **Fruit**, **Country**, and **Variant** also show quantity sold (number of units)
- **Sales Agent** shows how many unique customers they serve
- **Customer Category** shows how many customers are in each category

**Sorting:** Click any column header to sort. Click again to reverse the order. By default, everything is sorted by Total Sales (highest first).

**Checkbox selection:** Each row has a checkbox. The chart above only shows the rows you've checked (up to 10 at a time). By default, the top 10 are pre-selected. You can uncheck some and check others to customize what the chart displays.

### Filtering the table

Depending on the dimension, you'll see a search box and sometimes a dropdown filter above the table:

- **Customer view:** Search by code or name, and filter by category (e.g., show only "Supermarket" customers).
- **Variant view:** Search by name, and filter by fruit (e.g., show only apple variants).
- **Sales Agent view:** Search by name, and filter by status (Active/Inactive).

These filters only affect the table rows — they don't change the KPI cards or trend chart.

> **Why should you care?**
>
> The KPI cards and trend chart tell you *how much* and *when*. The breakdown section tells you *who*, *what*, and *where*. That's where actionable insights live. "Sales dropped 10% last month" is a fact. "Sales dropped 10% because Customer X stopped ordering bananas" is something you can actually act on.

### Red flags to watch for (Breakdown Section)

- **One customer dominates** — If a single customer accounts for 20%+ of total sales, that's a concentration risk. If they leave, it hurts badly.
- **A top customer's credit notes are unusually high** — They might be unhappy with quality.
- **An entire fruit category has zero cash sales** — Normal for wholesale items, but worth verifying.
- **A sales agent has high sales but also high credit notes** — They might be overselling or promising things the warehouse can't deliver.
- **"(Uncategorized)" or "(Unassigned)" appearing frequently** — Data quality issue. Customers or agents aren't being properly tagged in the accounting system.

---

## 6. Customer Profile Modal — The Deep Dive

When you're in the **Customer** view of the breakdown table, you can click on any customer row (anywhere except the checkbox) to open a popup — the Customer Profile modal.

This is like pulling up a customer's complete file in one click. The modal shows three key areas:

1. **Payment Information** — How well does this customer pay? Are they on time or always late? (More on this in Chapter 3: Payment Report.)

2. **Return History** — How many credit notes have been issued for this customer? Is the return rate normal or concerning? (More in Chapter 4: Return Report.)

3. **Sales Performance** — A monthly trend of this customer's purchases over the selected date range. Is this customer buying more over time, or fading away?

**In Hoi-Yong's case, this means:** If you're reviewing your top 10 customers and notice that #3 has been declining for three months straight, you can click their row, see the monthly trend, and bring that data to the next sales meeting.

> **Why should you care?**
>
> Individual customer data turns abstract numbers into real conversations. "Customer ABC's purchases dropped 40% since July and their credit notes doubled" is the kind of insight that prompts a phone call. The profile modal makes it easy to get there without running separate reports.

---

## 7. When Someone Asks You...

Here's a quick-reference guide for the most common questions you'll get, and exactly where to find the answer on this page.

**"What are our total sales?"**
Look at the **Net Sales** KPI card. Make sure the date range matches the period they're asking about (use the presets: 3M, 6M, 12M, YTD, or set a custom range).

**"Are sales growing or shrinking?"**
Look at the **Net Sales Trend** chart. If the bars are generally getting taller from left to right, sales are growing. For a more precise answer, turn on "Show Prior Period" — green bars mean growth vs. last year, red bars mean decline.

**"Who's our biggest customer?"**
Go to Sales Breakdown, select **Customer** as the group-by, and sort by Total Sales (descending — this is the default). The first row is your biggest customer.

**"What fruit sells the most?"**
Switch the group-by to **Fruit**. The top row in the table (and the longest bar in the chart) is your bestseller.

**"Why did sales drop last month?"**
Start with the trend chart — is it seasonal? (Chinese New Year in Jan/Feb, for example, often disrupts Malaysia's supply chain.) Then check if credit notes spiked (growing red bars). Finally, look at the Customer breakdown to see if a specific customer stopped ordering.

**"How much of our sales are cash vs. credit?"**
Compare the **Cash Sales** card to the **Net Sales** card. In Hoi-Yong's case, cash is roughly 6% of total — RM 5.5M out of RM 88.2M. The rest comes from invoiced credit sales.

**"Which salesperson is performing best?"**
Switch the group-by to **Sales Agent** and sort by Total Sales. But don't stop there — also look at how many customers each agent serves. An agent with RM 10M in sales from 2 customers is in a very different position than one with RM 10M from 50 customers.

**"Are returns getting worse?"**
Look at the **Credit Notes** KPI card for the total, then check the trend chart for the red bars below the zero line. If those red bars are getting bigger over time, returns are growing. Switch to Customer or Fruit breakdown to find out *where* the returns are concentrated.

---

## Summary

The Sales Report page is your starting point for understanding the business. Here's what to remember:

- **Net Sales** is the headline number — it's Invoices + Cash Sales - Credit Notes.
- **The date range** changes everything — always check which period you're looking at.
- **The trend chart** shows you direction — are things getting better or worse?
- **The breakdown section** tells you who, what, and where — that's where the actionable insights are.
- **The customer profile** lets you deep-dive into any individual customer's story.

When in doubt, start with the big picture (KPI cards), zoom into the timeline (trend chart), then drill down into the details (breakdown table). That top-to-bottom flow is exactly how the page is designed to be read.

---

*Next up: Chapter 2 — Customer Margin Report: Are We Actually Making Money?*
