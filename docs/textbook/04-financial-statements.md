# Chapter 4: Financial Statements -- The Report Card of the Business

> **Page URL:** `/pnl`
>
> This is the hardest chapter in the book. Profit & Loss statements and Balance Sheets are the language that accountants, bankers, and investors speak. If you only read one chapter, make it this one. We will go slowly, use plain language, and tie everything back to Hoi-Yong's real numbers.

---

## 1. What This Page Tells You

The Financial Statements page has two major sections:

| Section | Question it answers | Analogy |
|---------|-------------------|---------|
| **Profit & Loss (P&L)** | "Did we make money this period?" | A **movie** -- it shows what happened over a stretch of time (a fiscal year) |
| **Balance Sheet** | "What do we own and owe RIGHT NOW?" | A **photo** -- it captures a single moment in time |

Think of it this way: the P&L is your bank statement for the year (money in, money out), while the Balance Sheet is your net worth check on one specific day.

### The Fiscal Year

Hoi-Yong does not follow the calendar year. Their fiscal year runs **March to February**:

- **FY2025** = March 2024 through February 2025
- **FY2024** = March 2023 through February 2024

Why? Many Malaysian businesses choose fiscal years that align with their business cycles rather than the calendar. When you see "FY2025" on this page, mentally translate it to "the 12 months ending February 2025."

### Page Layout at a Glance

When you open this page, you will see (top to bottom):

1. **Fiscal Year Selector** -- a dropdown to pick which year you want to examine
2. **8 KPI Cards** -- the headline numbers, color-coded green (good) or red (bad)
3. **Monthly P&L Trend Chart** -- a visual of how sales, costs, and profit moved month by month
4. **P&L Statement Table** -- the full income statement, expandable to see individual accounts
5. **Multi-Year Comparison** -- sparkline charts and a table comparing up to 4 fiscal years
6. **Balance Sheet** -- a trend chart and a comparison table (current year vs. prior year)

---

## 2. Understanding P&L -- The Waterfall

Imagine water flowing down a waterfall. At the top, a large volume of water enters. At each ledge, some water is lost -- evaporation, splashing, diversion. What reaches the bottom is what you actually keep.

That is exactly how a Profit & Loss statement works. Let us walk through Hoi-Yong's FY2025 numbers:

### The Flow

```
Sales (Revenue)                     RM 84.2M    <-- Water enters the waterfall
  minus Sales Adjustments           -RM  2.6M   <-- Returns, discounts (water evaporates)
                                    ─────────
= Net Sales                         RM 81.5M    <-- Water after evaporation

  minus Cost of Goods Sold (COGS)   -RM 75.9M   <-- The cost of buying the fruit
                                    ─────────
= Gross Profit                      RM  5.6M    <-- What is left after paying for the fruit
  (Gross Margin: 6.9%)

  minus Operating Expenses (OPEX)   -RM  9.1M   <-- Staff, rent, electricity, trucks
                                    ─────────
= Operating Profit (EBIT)          -RM  3.4M    <-- NEGATIVE. The business spent more
                                                     on operations than it earned in
                                                     gross profit.

  plus Other Income                 +RM  1.5M   <-- Miscellaneous income
                                    ─────────
= Net Profit                       -RM  2.0M    <-- LOSS. The business lost RM 2 million.
  (Net Margin: -2.4%)
```

Let us unpack each line:

**Sales (RM 84.2M):** Everything Hoi-Yong invoiced to customers -- every box of mangoes, every crate of durian. This is the "top line."

**Sales Adjustments (-RM 2.6M):** Goods returned by customers, discounts given after the sale, credit notes issued. This shrinks your revenue.

**Net Sales (RM 81.5M):** The real revenue after adjustments. This is the number everyone references when they say "Hoi-Yong did RM 81 million in sales."

**COGS (RM 75.9M):** The cost of buying the fruit that was sold. This is the single biggest expense. For every RM 1 of fruit Hoi-Yong sells, it cost about **RM 0.93** to buy it. That is the nature of fresh produce distribution -- very high cost of goods, very thin margins.

**Gross Profit (RM 5.6M) and Gross Margin (6.9%):** What is left after paying for the fruit itself. Only 6.9 sen of profit for every RM 1 of fruit sold. That is thin. A software company might have 80% gross margins; a fruit distributor lives on single digits.

**OPEX (RM 9.1M):** The overhead of running the business -- warehouse staff, delivery truck maintenance, diesel, electricity, office rent, accounting software, insurance. These costs exist whether you sell 1 box or 10,000 boxes that month.

**Operating Profit / EBIT (-RM 3.4M):** EBIT stands for "Earnings Before Interest and Tax." It is negative because OPEX (RM 9.1M) is larger than Gross Profit (RM 5.6M). The business cannot cover its overhead from fruit margins alone.

**Other Income (RM 1.5M):** Income from side activities -- perhaps rental income from a spare warehouse, interest earned, or government grants. This cushions the loss somewhat.

**Net Profit (-RM 2.0M) and Net Margin (-2.4%):** The bottom line. After everything is accounted for, Hoi-Yong **lost RM 2 million** in FY2025. For every RM 100 in sales, the business lost RM 2.40. The water that reached the bottom of the waterfall is... less than zero. The pool is draining.

---

## 3. The 8 KPI Cards

At the top of the page, two rows of cards give you the headline numbers at a glance.

### Row 1: Revenue & Costs

| Card | FY2025 Value | What it means |
|------|-------------|---------------|
| **Net Sales** | RM 81,520,336 | Total revenue after adjustments |
| **COGS** | RM 75,888,549 | What the fruit cost to buy |
| **Gross Profit** | RM 5,631,637 | Sales minus fruit cost |
| **OPEX** | RM 9,050,916 | Overhead to run the business |

### Row 2: Profitability & Ratios

| Card | FY2025 Value | What it means |
|------|-------------|---------------|
| **Operating Profit (EBIT)** | -RM 3,419,280 | Gross Profit minus OPEX. Red = loss. |
| **Net Profit** | -RM 1,961,176 | The bottom line. Red = loss. |
| **Expense Ratio** | 11.1% | OPEX as a percentage of Net Sales. "11 sen of every RM 1 in revenue goes to overhead." |
| **Current Ratio** | 0.78 | Current Assets / Current Liabilities. Below 1.0 = trouble. |

### How to Read the Colors

- **Green ring/text** = healthy (positive profit, current ratio above 1.0)
- **Red ring/text** = alarm (negative profit, current ratio below 1.0)

The Current Ratio deserves special attention. It is one of the most important numbers on this entire page. A current ratio of **0.78** means: for every RM 1 that Hoi-Yong owes in the short term (bills due within 12 months), it only has RM 0.78 in short-term assets (cash, receivables, inventory) to pay with. That is a **cash crunch**. A healthy business typically wants this number above 1.0, ideally above 1.5.

---

## 4. Monthly P&L Trend Chart

Below the KPI cards is a combo chart (bars + lines) that shows how the P&L played out month by month across the fiscal year.

### What the Lines Mean

| Element | Color | What to look for |
|---------|-------|-----------------|
| **Net Sales** line | Blue | The revenue trend. Is it growing, flat, or declining? |
| **COGS** line | Orange | The cost of goods. How closely does it track sales? |
| **OPEX** line | Purple | Overhead costs. Is it stable or creeping up? |
| **Net Profit** bars | Green (positive) / Red (negative) | Monthly profit or loss |

### How to Read This Chart

The most striking thing you will notice: **the orange line (COGS) hugs the blue line (Net Sales) extremely closely.** There is almost no daylight between them. That visual gap is your gross profit -- and it is razor-thin.

The purple OPEX line sits below both, but it is the "floor" that gross profit must exceed for the business to be profitable. In months where the gap between the blue and orange lines is smaller than the purple line's value, the business is losing money that month.

Watch for months where the orange line (COGS) actually crosses above the blue line (Net Sales). When that happens, the business is selling fruit for less than it paid -- a guaranteed loss before overhead is even counted.

The green/red bars at the bottom tell the story clearly: green bars are profitable months, red bars are loss months. In FY2025, you will see more red than green.

---

## 5. P&L Statement Table

This is the detailed income statement -- the same document an accountant or banker would review.

### Structure

The table has these columns:

| Column | What it shows |
|--------|--------------|
| **Account** | The line item name (sticky on the left so it stays visible as you scroll) |
| **Mar, Apr, May...** | One column per month of the fiscal year |
| **YTD** | Year-to-Date total (sum of all months so far) |
| **Prior YTD** | Same figure from the previous fiscal year |
| **YoY %** | Year-over-Year change (how much it grew or shrank) |

### Expandable Rows

Each major category (Sales, Cost of Goods Sold, Expenses, etc.) is a collapsible group. Click the triangle to expand it and see the individual general ledger accounts underneath. For example, expanding "Sales" might reveal:

- Fruit Sales
- Vegetable Sales
- Packaging Sales

The group header shows the subtotal; the detail rows show the breakdown.

### Account Type Groups

| Group | What it contains |
|-------|-----------------|
| **Sales (SL)** | All revenue accounts |
| **Sales Adjustments (SA)** | Returns, discounts, credit notes |
| **Cost of Goods Sold (CO)** | Direct cost of purchasing goods |
| **Other Income (OI)** | Non-core income (interest, rental, etc.) |
| **Expenses (EP)** | Operating expenses (payroll, rent, utilities, transport) |
| **Taxation (TX)** | Tax provisions |

### Computed Rows

Between the groups, the table inserts calculated rows:

- **Gross Profit / (Loss)** = Net Sales - COGS
- *Gross Margin %* = Gross Profit / Net Sales (shown in italics)
- **Net Profit / (Loss)** = Gross Profit + Other Income - Expenses
- *Net Margin %* = Net Profit / Net Sales (shown in italics)
- **Net Profit / (Loss) After Taxation** = Net Profit - Taxation (the grand total)

### Reading the YoY % Column

For monetary rows, YoY % shows the percentage change:
- `+5.3%` means "grew 5.3% compared to last year" (green text)
- `-12.1%` means "shrank 12.1%" (red text)
- `New` means this account had zero last year but has a value now

For margin rows (Gross Margin %, Net Margin %), the column shows **percentage points** instead:
- `-2.9pp` means "the margin dropped by 2.9 percentage points." This is different from a percentage change. If gross margin went from 9.8% to 6.9%, that is a drop of 2.9 percentage points (written as `-2.9pp`), but it is actually a 30% relative decline in margin. The `pp` notation is the standard way finance people express this.

### Formatting Notes

- Zero values display as an en-dash (`--`) to keep the table clean
- Negative values appear in red
- Account names are displayed in Title Case (e.g., "Cost of Goods Sold" not "COST OF GOODS SOLD")
- All monetary values are whole numbers with thousands separators (e.g., `1,234,567`)

---

## 6. Multi-Year Comparison

This section lets you zoom out and see trends across up to **4 fiscal years** (e.g., FY2022 through FY2025).

### Left Panel: Small-Multiple Bar Charts

A grid of 8 mini charts, one for each key P&L metric:

| Chart | What it shows |
|-------|--------------|
| Net Sales | Revenue trend across years |
| COGS | Cost trend across years |
| Gross Profit | Margin dollars across years |
| Other Income | Side income across years |
| OPEX | Overhead trend across years |
| Net Profit | Bottom line across years |
| Taxation | Tax provisions across years |
| NPAT | Net Profit After Tax across years |

Each chart is small (80px tall) -- the point is the trend, not the exact number. Below each chart, the latest fiscal year's value is displayed.

A horizontal reference line at zero appears when any value is negative -- making it easy to spot years where the business went into the red.

### Right Panel: Comparison Table

A table with columns for each fiscal year and a **Trend** column showing arrows:

| Arrow | Meaning |
|-------|---------|
| Green up arrow with `+5.2%` | Improved by more than 2% |
| Red down arrow with `-3.1%` | Declined by more than 2% |
| Gray right arrow | Roughly flat (change between -2% and +2%) |

For margin rows, the trend shows percentage-point change (e.g., `+1.5pp` or `-0.8pp`).

Fiscal years that are still in progress (not all 12 months of data available) are marked with an asterisk (`*`) and a footnote.

### The Hoi-Yong Story Across Years

This is where you see the big picture. Net Profit went from **RM 1.4M** in FY2024 to **-RM 2.0M** in FY2025. That is a massive swing -- a RM 3.4 million deterioration in one year. The multi-year view makes this trend impossible to miss.

---

## 7. Balance Sheet -- What You Own vs. What You Owe

If the P&L is a movie, the Balance Sheet is a photograph. It answers: "If we froze time right now, what is the company's financial position?"

### The Personal Analogy

Think about your own net worth:

```
What you OWN:    House (RM 500K) + Car (RM 80K) + Savings (RM 50K) = RM 630K
What you OWE:    Mortgage (RM 400K) + Car loan (RM 60K)            = RM 460K
                                                                     ───────
Your NET WORTH:                                                      RM 170K
```

A Balance Sheet works the same way, but for a company.

### The Fundamental Equation

This is the golden rule of accounting. It **always** holds true:

> **Assets = Liabilities + Equity**

Or rearranged: **Equity = Assets - Liabilities** (your "net worth" as a company).

If Total Assets is RM 39.3M and Total Liabilities is RM 33.8M, then Equity is RM 5.5M. The balance sheet must balance -- that is literally why it is called a balance sheet.

### Hoi-Yong's Balance Sheet (FY2025)

#### What They Own (Assets)

| Item | Amount | Plain English |
|------|--------|---------------|
| **Fixed Assets** | RM 16.1M | Buildings, cold rooms, delivery trucks, warehouse equipment. Things you can kick. |
| **Other Assets** | Small | Deposits, prepayments, intangible assets |
| **Current Assets** | RM 23.2M | Cash in the bank, inventory (fruit in the warehouse), money customers owe (receivables). Things that can become cash within 12 months. |

#### What They Owe (Liabilities)

| Item | Amount | Plain English |
|------|--------|---------------|
| **Current Liabilities** | RM 29.7M | Bills due within 12 months: supplier invoices, short-term bank loans, staff salaries owed, tax payable |
| **Long Term Liabilities** | RM 4.1M | Loans due after 12 months: equipment financing, property loans |

#### The Equity Section ("Financed By")

| Item | Amount | Plain English |
|------|--------|---------------|
| **Capital** | -- | Money the owners originally put in |
| **Retained Earnings** | RM 4.8M | Accumulated profits from all previous years (includes this year's P&L result) |

### The Critical Number: Net Current Assets

```
Current Assets          RM 23.2M
minus Current Liabilities  -RM 29.7M
                         ─────────
= Net Current Assets    -RM  6.5M   <-- NEGATIVE!
```

This is negative. It means Hoi-Yong owes more in the short term than it has in short-term assets. This is the same story the Current Ratio (0.78) told us -- the company has a short-term liquidity problem.

### Balance Sheet Trend Chart

On the left side of the Balance Sheet section, a line chart tracks three series month by month:

| Line | Color | What it represents |
|------|-------|--------------------|
| **Total Assets** | Blue | Everything the company owns |
| **Total Liabilities** | Dark red | Everything the company owes |
| **Equity** | Olive green | Assets minus Liabilities (the owners' stake) |

Watch for the gap between the blue and red lines. If the red line (liabilities) is rising faster than the blue line (assets), equity is being squeezed. If the red line crosses above the blue line, the company is technically insolvent (owes more than it owns).

### Balance Sheet Comparison Table

The table on the right shows:

| Column | Meaning |
|--------|---------|
| **Current** | Balance at the end of the selected fiscal year |
| **Prior** | Balance 12 months earlier |
| **Change** | Absolute difference (Current - Prior) |
| **%** | Percentage change |

This lets you see what moved. Did current liabilities spike? Did receivables (money owed by customers) grow faster than sales? Did the company take on new long-term debt?

---

## 8. Red Flags in Hoi-Yong's Financials

These are the warning signs that anyone -- technical person, manager, or banker -- should notice immediately:

### 1. Net Loss of RM 2 Million
The business is not profitable. It spent more than it earned. The P&L "waterfall" ran dry before reaching the bottom.

### 2. Current Ratio of 0.78
For every RM 1 in short-term obligations, Hoi-Yong has only 78 sen in short-term assets. This means the company may struggle to pay suppliers and meet loan repayments on time. A healthy current ratio is above 1.0; above 1.5 is comfortable.

### 3. COGS Growing Faster Than Sales
Sales grew +2.3% year-over-year, but COGS grew +5.3%. The cost of fruit is rising faster than Hoi-Yong can raise prices. This compresses margins. If this trend continues, gross profit will keep shrinking.

### 4. OPEX Jumped 38% Year-over-Year
Operating expenses surged. That could be new hires, higher fuel costs, a new warehouse lease, or inflation across the board. Whatever the cause, a 38% OPEX increase against only 2.3% revenue growth is unsustainable.

### 5. Gross Margin of Only 6.9%
Fresh produce distribution is inherently low-margin, but 6.9% leaves almost no room for error. A 1-2% swing in fruit purchase prices or a batch of spoiled inventory could wipe out the entire gross profit for a month.

### 6. Net Profit Swung from +RM 1.4M to -RM 2.0M
A RM 3.4 million deterioration in one year. This is not a gradual decline -- it is a sharp reversal. Something structural changed between FY2024 and FY2025.

### 7. Negative Net Current Assets (-RM 6.5M)
The company owes RM 6.5 million more in short-term obligations than it has in short-term assets. This creates dependency on credit facilities (bank overdrafts, supplier credit terms) to keep operating day-to-day.

---

## 9. When Someone Asks You...

Here is a cheat sheet for the most common questions a manager, investor, or banker might ask -- and how to answer using this page:

### "Is the company profitable?"

No. FY2025 resulted in a **net loss of RM 2.0 million**. Net margin is -2.4%. Look at the Net Profit KPI card (red) or the bottom line of the P&L Statement table.

### "What is eating the profits?"

Two things:
1. **COGS is 93% of revenue.** For every RM 1 in sales, 93 sen goes to buying the fruit. That leaves only 7 sen of gross profit.
2. **OPEX grew 38% year-over-year** to RM 9.1M -- far more than the RM 5.6M in gross profit available to cover it.

In short: margins are too thin, and overhead grew too fast.

### "Can the company pay its bills?"

The Current Ratio is **0.78**, which means no -- not comfortably. Current liabilities (RM 29.7M) exceed current assets (RM 23.2M) by RM 6.5M. The company is relying on rolling credit facilities and supplier payment terms to stay operational. Look at the Current Ratio KPI card and the Balance Sheet's Net Current Assets line.

### "Is it getting better or worse?"

Worse. FY2024 was profitable (RM 1.4M net profit). FY2025 is a loss (-RM 2.0M). The Multi-Year Comparison section makes this visible at a glance -- check the Net Profit sparkline chart and the trend arrows.

### "Where should I dig deeper?"

- **COGS breakdown:** Expand the "Cost of Goods Sold" group in the P&L table. Which product lines have the worst margins?
- **OPEX breakdown:** Expand "Expenses" to see which cost categories grew the most. Was it payroll? Transport? Depreciation?
- **Receivables vs. Payables:** Look at Current Assets (are customers paying slowly?) vs. Current Liabilities (are we stretching supplier payments?). This connects to the Payment and Return dashboards in Chapters 2 and 3.

### "What does EBIT mean?"

Earnings Before Interest and Tax. It strips out financing costs (interest on loans) and tax provisions to show you the profit from pure operations. Hoi-Yong's EBIT is -RM 3.4M, meaning the core business operations are unprofitable before even accounting for loans or taxes.

### "What is the difference between Gross Profit and Net Profit?"

**Gross Profit** = Revenue minus the cost of the goods you sold. It answers: "Do we make money on the fruit itself?"

**Net Profit** = Gross Profit plus Other Income minus Overhead minus Tax. It answers: "After paying for EVERYTHING -- fruit, staff, rent, trucks, electricity -- did we have anything left?"

You can make a gross profit but still post a net loss if your overhead exceeds your gross profit. That is exactly what happened to Hoi-Yong in FY2025.

### "Why does the Balance Sheet always balance?"

Because of double-entry bookkeeping. Every transaction is recorded twice: once as a debit and once as a credit. If Hoi-Yong buys a truck for RM 100K cash, Fixed Assets goes up RM 100K (debit) and Cash goes down RM 100K (credit). The total never changes. Assets always equal Liabilities plus Equity. If they do not balance, something is wrong with the accounting.

---

## 10. Glossary for This Chapter

| Term | Definition |
|------|-----------|
| **COGS** | Cost of Goods Sold -- what it cost to buy/produce the goods that were sold |
| **Current Assets** | Assets expected to be converted to cash within 12 months (cash, receivables, inventory) |
| **Current Liabilities** | Debts due within 12 months (supplier bills, short-term loans) |
| **Current Ratio** | Current Assets / Current Liabilities. Above 1.0 = can cover short-term debts. Below 1.0 = potential cash crunch. |
| **EBIT** | Earnings Before Interest and Tax = Operating Profit |
| **Equity** | What belongs to the owners after all debts are paid. Assets minus Liabilities. |
| **Fiscal Year (FY)** | Hoi-Yong's financial year, running March to February |
| **Gross Margin %** | (Gross Profit / Net Sales) x 100 |
| **Gross Profit** | Net Sales minus COGS |
| **Net Margin %** | (Net Profit / Net Sales) x 100 |
| **Net Profit** | The final bottom line after all income and expenses |
| **OPEX** | Operating Expenses -- the overhead of running the business |
| **pp** | Percentage points -- the absolute difference between two percentages |
| **Retained Earnings** | Accumulated profits from all previous years, kept in the business |
| **YoY** | Year-over-Year -- comparing this year's figure to last year's |
| **YTD** | Year-to-Date -- the cumulative total from the start of the fiscal year to the current month |
