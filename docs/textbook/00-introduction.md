# Chapter 0: Introduction — The Big Picture

Before we dive into charts, tables, and code, let's step back and understand *what* this dashboard is about, *why* it exists, and *how* all the pieces fit together. Think of this chapter as the "orientation day" before you start your job.

---

## 1. What is Hoi-Yong Finance?

Hoi-Yong is a **fruit and produce distributor** based in Malaysia. Here's what that means in plain English:

- **They buy fruits** — from local Malaysian farms and from international suppliers in China, Egypt, Australia, and elsewhere.
- **They sell those fruits** — to a wide variety of customers, including:
  - **Supermarkets and hypermarkets** like MY HERO HYPERMARKET and SRI TERNAK MART
  - **Wholesalers** like WONDERFRUITS and NIAN FENG who buy in bulk and resell
  - **Wet markets and fruit shops** — the traditional stalls you see at morning markets
  - **Food businesses** like SECRET RECIPE (a bakery/restaurant chain) and LABU KUNING that use fruits as ingredients
- **They track everything** using an accounting software called **AutoCount**, which stores all their financial data in a PostgreSQL database on AWS.

### How big is the business?

| Metric | Approximate Number |
|--------|-------------------|
| Annual revenue | RM 80–88 million (~USD 17–19 million) |
| Customers | ~710 |
| Suppliers | ~452 (about 107 actively supplying) |
| Products | ~6,400 different items |
| Invoices per year | Tens of thousands |

To put the revenue in perspective: RM 80 million is roughly the revenue of a mid-sized wholesale business. They're not a corner fruit stall — they're a serious operation moving container-loads of produce every week.

---

## 2. Why Does Hoi-Yong Need a Dashboard?

AutoCount is great at *recording* transactions — every invoice, every payment, every credit note gets logged. But it's terrible at *answering questions*. It's like having a filing cabinet with 200,000 receipts stuffed inside. The data is there, but good luck finding the answer to "Are we making more money this quarter compared to last quarter?"

Management needs to answer questions like these — quickly, without digging through spreadsheets:

- **"Are we making money this month?"** — Is revenue going up or down?
- **"Which customers owe us the most?"** — Who hasn't paid, and for how long?
- **"Are returns increasing?"** — Are we getting more goods sent back? That's a warning sign.
- **"Which suppliers give us the best margins?"** — Are we buying smart, or are some suppliers eating into our profit?
- **"What are our biggest expenses?"** — Where exactly is the money going?

**The dashboard turns 200,000+ raw accounting records into visual answers.** Instead of running database queries or scrolling through reports in AutoCount, the finance director opens the dashboard and sees charts, tables, and numbers that tell the story instantly.

> **Why should you care?**
>
> You built this dashboard. When someone at Hoi-Yong opens it, they're making real business decisions based on what they see — whether to chase a customer for payment, whether to switch suppliers, whether to worry about rising costs. Understanding the "why" helps you build something that actually serves their needs, not just something that looks pretty.

---

## 3. The 7 Pages of the Dashboard

The dashboard has seven main pages, each answering a different business question. Think of them as seven different "lenses" for looking at the same business.

### Page 1: Sales Report (`/sales`)

**What it answers:** "How much money is coming in?"

This is the heartbeat of the business. It shows daily, weekly, and monthly revenue trends — how much Hoi-Yong sold, broken down by time period. You can see which months are strong (durian season, anyone?), which customers buy the most, and whether revenue is growing or shrinking compared to the previous period. If there's one page the boss checks every morning, it's this one.

### Page 2: Payment Collection (`/payment`)

**What it answers:** "Who owes us money, and are they paying on time?"

Selling is only half the battle — you also need to *collect* the money. This page tracks outstanding amounts (money customers owe but haven't paid yet), how old those debts are (called "aging" — a 30-day-old unpaid invoice is normal; a 120-day-old one is a problem), and gives each customer a credit score to flag risky accounts. Think of it as a health check for cash flow.

### Page 3: Credit Note / Return / Refund (`/return`)

**What it answers:** "How much money are we giving back?"

When a customer returns spoiled fruit, or when there's a pricing error, Hoi-Yong issues a credit note — basically an "IOU" that reduces what the customer owes. This page tracks how many credit notes are being issued, their total value, and whether the trend is getting worse. Rising returns could mean quality problems, delivery issues, or disputes with customers.

### Page 4: Financial Statements (`/pnl`)

**What it answers:** "Overall, are we profitable? What do we own versus what we owe?"

This is the "report card" of the business, containing two classic financial reports:
- **Profit & Loss (P&L):** Revenue minus all expenses. Did we make a profit this month/year?
- **Balance Sheet:** What the company owns (assets like cash, inventory, receivables) versus what it owes (liabilities like loans, payables). This tells you the financial health at a snapshot in time.

### Page 5: Cost Tracking (`/expenses`)

**What it answers:** "Where is the money going?"

Revenue is only meaningful if you know what you're spending. This page breaks down expenses into categories: the cost of buying fruits (COGS — Cost of Goods Sold), staff salaries (payroll), electricity, packing materials, rent, transport, and more. It highlights the top 10 biggest expenses so management can spot areas to cut costs.

### Page 6: Customer Profit Margin (`/customer-margin`)

**What it answers:** "Which customers actually make us money?"

Not all customers are equally profitable. A customer who buys RM 1 million worth of fruits but only at razor-thin margins might be *less* valuable than a smaller customer who pays premium prices. This page calculates profit margin per customer — revenue minus the cost of goods sold to them — so management can identify who the real money-makers are and who might be costing more than they're worth.

### Page 7: Supplier Profit Margin (`/supplier-margin`)

**What it answers:** "Which suppliers give us the best deal?"

The flip side of customer margin. If Hoi-Yong buys apples from Supplier A at RM 5/kg and from Supplier B at RM 4/kg, Supplier B gives a better margin (assuming the quality is comparable). This page helps the procurement team negotiate better prices and decide which suppliers to prioritize. It also flags "single supplier items" — products where only one supplier exists, which is a supply-chain risk.

> **Why should you care?**
>
> Each of these 7 pages maps to a real conversation happening at Hoi-Yong's office. When you understand what each page is *for*, you can make better decisions about what to highlight, what to make clickable, and what deserves a prominent spot on the screen.

---

## 4. How the Dashboard Gets Its Data

### The Data Pipeline

Here's the journey from "someone creates an invoice in AutoCount" to "a chart appears on the dashboard":

```
AutoCount Accounting    →    PostgreSQL (AWS)    →    CSV Exports    →    SQLite (local)    →    Dashboard
   (user enters              (stores all              (data files          (prototype          (what you
    transactions)             records)                  for dev)            database)            see)
```

**In plain English:**

1. **AutoCount** is the accounting software that Hoi-Yong staff use daily. When a salesperson creates an invoice or a cashier rings up a cash sale, it gets saved here.
2. **PostgreSQL** is the database behind AutoCount, hosted on AWS (Amazon's cloud). It's where all 37 tables live, with over 2 million records across all tables.
3. **CSV Exports** — For the prototype/development version of the dashboard, the data was exported as CSV files (like spreadsheets without formatting). These sit in the `/data` folder.
4. **SQLite** — The dashboard loads those CSVs into a lightweight local database (SQLite) so it can run queries fast without needing an internet connection or a running PostgreSQL server.
5. **Dashboard** — The Next.js web application reads from SQLite, runs queries, and renders charts and tables.

**In production** (the "real" version), the dashboard would skip steps 3 and 4 and read directly from the PostgreSQL database on AWS.

### The Key Tables

Out of 37 tables in the system, here are the ones you'll encounter most often:

| Table | What it stores | Row Count | Used for |
|-------|---------------|-----------|----------|
| **IV** | Invoices (credit sales) | ~118,928 | Sales, Margins |
| **CS** | Cash sales (includes POS) | ~52,358 | Sales, Margins |
| **CN** | Credit notes (returns/refunds) | ~8,746 | Sales, Returns |
| **IVDTL** | Invoice line items (the individual fruits on each invoice) | ~1,067,985 | Margin calculations |
| **CSDTL** | Cash sale line items | ~378,715 | Margin calculations |
| **Debtor** | Customer master list | ~710 | All customer-related pages |
| **Creditor** | Supplier master list | ~452 | Supplier Margin |
| **Item** | Product catalog | ~6,417 | Margin, Returns |
| **GLDTL** | General Ledger detail (journal lines) | ~2,155,399 | Expenses, P&L |
| **ARInvoice** | Accounts Receivable invoices | ~171,193 | Payment tracking |
| **PI** | Purchase invoices (what Hoi-Yong buys) | ~45,267 | Supplier Margin, Expenses |

### Important Data Rules

**Timezone:** All dates in the database are stored in UTC (the global standard). Malaysia is UTC+8. So when the database says "2025-01-15 16:00:00 UTC," it actually means "2025-01-16 00:00:00 Malaysia time" (midnight). The dashboard always adds 8 hours before grouping by date. If you forget this, your daily totals will be wrong.

**Currency:** Everything is in MYR (Malaysian Ringgit), displayed with the prefix "RM." There are rare transactions in SGD (Singapore Dollars) — for those, we use the `LocalNetTotal` column (which is already converted to MYR) instead of `NetTotal`.

**Cancelled records:** Every transaction has a `Cancelled` column. `'F'` means active (F for False — it is NOT cancelled), `'T'` means cancelled (T for True — it IS cancelled). The dashboard always filters with `Cancelled = 'F'` to exclude cancelled records.

> **Why should you care?**
>
> These three rules (timezone, currency, cancelled filter) are the most common sources of bugs. If a number on the dashboard doesn't match what AutoCount shows, check these three things first. They explain 90% of data mismatches.

---

## 5. The Golden Formula — How Revenue is Calculated

If there's one formula you should tattoo on your brain, it's this:

```
Revenue = Invoice Sales + Cash Sales - Credit Notes (returns)
```

Or in database terms:

```sql
Revenue = SUM(IV.LocalNetTotal) + SUM(CS.LocalNetTotal) - SUM(CN.LocalNetTotal)
WHERE Cancelled = 'F'
```

### Breaking it down

- **Invoice Sales (IV)** — When Hoi-Yong sells to a credit customer (like a supermarket that pays 30 days later), it creates an invoice. This is the biggest chunk of revenue.
- **Cash Sales (CS)** — When someone pays on the spot (walk-in customers, POS transactions). This includes all point-of-sale transactions — don't add POS separately, it's already in CS.
- **Credit Notes (CN)** — When goods are returned, damaged, or there's a pricing dispute, Hoi-Yong issues a credit note. This *reduces* revenue, which is why we subtract it.

### A simple example

Imagine a single day at Hoi-Yong:

| Transaction | Amount |
|-------------|--------|
| Invoice to MY HERO HYPERMARKET for 500 kg of oranges | RM 5,000 |
| Invoice to SRI TERNAK MART for 200 kg of apples | RM 3,000 |
| Cash sale to a walk-in customer | RM 200 |
| Credit note to NIAN FENG for 50 kg of spoiled mangoes | RM 800 |

**Revenue for the day:**

```
= RM 5,000 + RM 3,000 + RM 200 - RM 800
= RM 7,400
```

That's it. Every revenue number on the Sales page uses this exact formula, just summed over different time periods (daily, weekly, monthly, yearly).

### Why "Net" Total?

You'll see `NetTotal` and `LocalNetTotal` in the code. "Net" means *after discounts*. If Hoi-Yong gives a 5% discount to a big customer:
- **Total** = RM 10,000 (before discount)
- **NetTotal** = RM 9,500 (after 5% discount)
- **LocalNetTotal** = same as NetTotal for MYR transactions, or the MYR-converted value for SGD transactions

We always use `LocalNetTotal` for reporting — it's the most accurate "what we actually received in MYR" number.

> **Why should you care?**
>
> Every chart, every KPI card, every trend line on the Sales page traces back to this formula. If a chart looks wrong, check whether it's including all three tables (IV, CS, CN) and filtering out cancelled records. It's the single most important calculation in the entire dashboard.

---

## 6. Navigation — How to Move Around

### Sidebar

On the left side of the screen, there's a **sidebar** with 7 navigation items:

| Icon | Label | What it opens |
|------|-------|---------------|
| Trending-up line chart | Sales | Sales Report page |
| Credit card | Payment | Payment Collection page |
| Circular arrow | Return | Credit Note / Return page |
| Bar chart | Financials | Financial Statements (P&L + Balance Sheet) |
| Receipt | Expenses | Cost Tracking page |
| People icon | Customer Margin | Customer Profit Margin page |
| Truck icon | Supplier Margin | Supplier Profit Margin page |

The sidebar can be **collapsed** (showing only icons, 64px wide) or **expanded** (showing icons + labels, 224px wide). When collapsed, hovering over an icon shows a tooltip with the page name. The header shows "Hoi-Yong Finance" branding when expanded.

### Page Banner

Every page starts with a **banner** at the top — a title and a one-line description so you always know where you are. For example, the Sales page banner says "Sales Report" with a brief description underneath.

### Date Range Picker

Most pages have a **date range picker** near the top. This is how you choose what period of data to look at.

- **Two month-year pickers** — one for the start date, one for the end date, with an arrow between them
- **Range summary** — shows the selected period, e.g., "Jan 2025 -- Dec 2025 (12 months)"
- **Preset buttons** for quick selection:
  - **3M** — Last 3 months of available data
  - **6M** — Last 6 months
  - **12M** — Last 12 months (this is the default)
  - **YTD** — Year to Date (from January 1 of the current year to the latest data)

One important detail: the presets calculate relative to the **latest data date**, not today's date. So if the most recent data is from February 2026, pressing "3M" gives you December 2025 through February 2026. This ensures you always see actual data, not empty months.

---

## 7. When Someone Asks You...

Here are the most common questions you'll get about the dashboard, with ready-made answers:

---

**Q: "What does this dashboard do?"**

A: It takes all the accounting data from Hoi-Yong's AutoCount system — invoices, payments, returns, expenses, everything — and turns it into visual charts and tables. Instead of digging through thousands of records, management can open the dashboard and instantly see how sales are trending, who owes money, which customers are most profitable, and where the expenses are going. It has 7 pages, each focused on a different aspect of the business.

---

**Q: "Where does the data come from?"**

A: From AutoCount Accounting, which is Hoi-Yong's accounting software. AutoCount stores everything in a PostgreSQL database on AWS. For the current prototype, we export that data as CSV files and load it into a local SQLite database. In production, the dashboard will connect directly to the PostgreSQL database so the data is always up to date.

---

**Q: "How often is the data updated?"**

A: In the current prototype, the data is a static snapshot — it was exported at a specific point in time and doesn't update automatically. In a production setup, it would read from the live PostgreSQL database, meaning data would be as current as whatever has been entered into AutoCount. If someone creates an invoice at 9:00 AM, the dashboard would show it the next time the page loads or refreshes.

---

**Q: "Can I trust the numbers?"**

A: Yes, with a caveat. The numbers come directly from the same database that AutoCount uses, so they reflect what's in the accounting system. The revenue formula (Invoices + Cash Sales - Credit Notes, excluding cancelled records) matches standard accounting logic. However, if data in AutoCount is entered late or incorrectly, the dashboard will reflect those issues too — it's only as accurate as the source data. Always check that you're looking at the right date range if a number seems off.

---

**Q: "What period am I looking at?"**

A: Check the date range picker at the top of the page. It shows the selected start and end months, plus a summary like "Jan 2025 -- Dec 2025 (12 months)." By default, most pages show the last 12 months of available data. You can change this using the month pickers or the preset buttons (3M, 6M, 12M, YTD).

---

**Q: "Why don't the numbers match what I see in AutoCount?"**

A: The three most common reasons:
1. **Date range mismatch** — You might be looking at a different period in the dashboard vs. AutoCount. Check both date ranges.
2. **Timezone difference** — The dashboard converts UTC dates to Malaysia time (UTC+8). If AutoCount shows data differently, the daily boundaries might shift.
3. **Cancelled records** — The dashboard excludes all cancelled transactions (`Cancelled = 'T'`). Make sure AutoCount is also excluding them in whatever report you're comparing against.

---

**Q: "What currency is everything in?"**

A: Malaysian Ringgit (MYR), displayed as "RM." For the rare transactions in SGD (Singapore Dollars), the dashboard uses the `LocalNetTotal` field, which is already converted to MYR. So every number you see is in RM, regardless of the original transaction currency.

---

*Next up: Chapter 1 — Sales Report, where we'll go page by page through every chart, table, and number on the Sales dashboard.*
