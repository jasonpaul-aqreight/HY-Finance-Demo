# Chapter 8: Settings & Profiles — Configuration and Deep Dives

So far, every chapter has focused on a dashboard page: Sales, Payment, Returns, and so on. But there are a few features that cut across *all* of those pages. This chapter covers them:

1. **Payment Settings** — the page where you tune how the system judges customer risk.
2. **Customer Profile Modal** — the pop-up that gives you everything about one customer in a single view.
3. **Supplier Profile Modal** — the same idea, but for suppliers.

Think of the settings page as the "rules engine" and the profile modals as the "X-ray machines." Together, they let you configure *how* the system thinks and then drill deep into any individual customer or supplier.

---

## 1. Payment Settings Page

**URL:** `/payment/settings`

You reach this page from the Payment dashboard. There is a back-arrow link in the header that takes you back to `/payment`.

### What does this page do?

Remember the credit scores and risk tiers from the Payment chapter? Every customer gets a score from 0 to 100, and then a risk label (Low, Moderate, or High). The Settings page is where you control *how* that score is calculated and *where* the risk cutoffs are.

There are two sections on the page:

- **Credit Score Weights** — five sliders that must add up to 100%.
- **Risk Level Thresholds** — three numbers that define the cutoff points.

### 1.1 Credit Score Weights

The credit score is a weighted average of five factors. Each factor gets a sub-score from 0 to 100, and then the weights determine how much each factor counts toward the final number.

Here are the five factors and their defaults:

| Factor | Default Weight | What it measures | Plain English |
|--------|---------------|-----------------|---------------|
| Credit Utilization | **35%** | Outstanding balance / Credit limit | "How close is the customer to maxing out their credit?" If a customer has a RM 50,000 limit and owes RM 40,000, that is 80% utilization — not great. |
| Overdue Days | **25%** | Age of the oldest unpaid-past-due invoice | "How long has this customer been late?" If their oldest overdue invoice is 90 days past due, that is a serious red flag. |
| Payment Consistency | **15%** | Months with payments / Months with invoices (last 12 months) | "Does this customer pay regularly, or do they go silent for months?" A customer who buys every month but only pays every third month scores poorly here. |
| Payment Timeliness | **15%** | Average days late across paid invoices (last 12 months) | "When they *do* pay, is it on time?" If the average invoice is paid 20 days late, that drags this score down. |
| Overdue Limit Breach | **10%** | Has the outstanding balance exceeded the overdue limit? | "Have they crossed the line?" This is a binary check — either they have breached or they have not. Breach = 0, no breach = 100. |

The page shows a live counter beneath the weight fields: **"Sum: N/100"**. It turns red when the weights do not add up to 100 and green when they do. You cannot save until the sum is exactly 100.

#### How each sub-score works

Each factor is first converted to a 0-100 sub-score before the weighted average is computed. Here is how each one maps:

**Credit Utilization:**

| Utilization % | Sub-Score |
|--------------|-----------|
| 0-50% | 90-100 (excellent) |
| 51-80% | 60-89 (okay) |
| 81-100% | 30-59 (concerning) |
| Over 100% (over-limit) | 0-29 (danger) |
| No credit limit set | 0 (neutral) |

**Overdue Days** (based on the oldest overdue invoice):

| Days Past Due | Sub-Score |
|--------------|-----------|
| 0 (nothing overdue) | 100 |
| 1-30 days | 80 |
| 31-60 days | 60 |
| 61-90 days | 40 |
| 91-120 days | 20 |
| More than 120 days | 0 |

**Payment Consistency** (ratio of months-with-payment to months-with-invoices):

| Ratio | Sub-Score |
|-------|-----------|
| 90%+ | 100 |
| 70-89% | 75 |
| 50-69% | 50 |
| Below 50% | 25 |

**Payment Timeliness** (average days late):

| Avg Days Late | Sub-Score |
|--------------|-----------|
| On time or early | 100 |
| 1-7 days late | 80 |
| 8-14 days late | 60 |
| 15-30 days late | 40 |
| 31-60 days late | 20 |
| Over 60 days late | 0 |

**Overdue Limit Breach:**

| Condition | Sub-Score |
|-----------|-----------|
| Within limit (or no limit set) | 100 |
| Exceeded limit | 0 |

The final credit score is then:

```
Score = (Utilization Weight x Utilization Sub-Score)
      + (Overdue Days Weight x Overdue Sub-Score)
      + (Consistency Weight x Consistency Sub-Score)
      + (Timeliness Weight x Timeliness Sub-Score)
      + (Breach Weight x Breach Sub-Score)
```

All weights are divided by 100 first, so if Utilization weight is 35 and its sub-score is 90, that contributes 0.35 x 90 = 31.5 to the final score.

#### Why would you change the weights?

The defaults are a reasonable starting point, but every business is different. Here are some scenarios:

- **"We care most about how late people are."** Increase Overdue Days from 25% to 40% and reduce something else to keep the total at 100.
- **"We are lenient about timing, but we cannot tolerate limit breaches."** Increase Breach from 10% to 25% and decrease Timeliness.
- **"Consistency matters more than anything — we need predictable cash flow."** Bump Consistency up to 30%.

The key insight: these weights let you tell the system what *your* business values most when evaluating customer risk.

### 1.2 Risk Level Thresholds

Once the credit score is computed, it falls into one of three risk tiers. The thresholds define the boundaries:

| Threshold | Default | Meaning |
|-----------|---------|---------|
| Low Risk (score >=) | **85** | Scores 85-100 are Low risk (green badge) |
| Moderate (score >=) | **65** | Scores 65-84 are Moderate risk (yellow badge) |
| High Risk (score <) | **35** | Scores 0-64 are High risk (red badge) |

Validation: the thresholds must be in descending order (Low > Moderate > High).

You might lower the Low threshold to 75 if you want to classify more customers as "safe," or raise it to 90 if you want to be extra cautious about who gets the green badge.

### 1.3 Saving and Resetting

- **Save** persists your changes to a JSON file on disk (`data/settings.json`). The button is disabled until the weights sum to 100 and thresholds are in valid order.
- **Reset to Defaults** restores the factory settings *in the form only*. You still need to click Save to persist the reset.
- Changes take effect immediately — the next time any page fetches credit score data, it uses the updated weights and thresholds. No page reload required.

---

## 2. Customer Profile Modal

This is the single most information-dense feature in the entire dashboard. When you click on a customer row in *any* table across the application, a full-screen modal opens with everything you need to know about that customer.

### Where does it appear?

| Dashboard Page | What you click | Tab that opens first |
|---------------|----------------|---------------------|
| Payment (`/payment`) | A row in the Customer Table | Payment tab |
| Return (`/return`) | A row in the Top Debtors Table | Returns tab |
| Sales (`/sales`) | A row in the Group-By Table (customer dimension) | Sold Items tab |
| Customer Margin (`/customer-margin`) | A row in the Customer Margin Table | Sold Items tab |

The system is smart about context: if you click a customer from the Returns page, it opens the Returns tab first. If you click from Sales, it opens Sold Items. You always land on the most relevant tab.

### 2.1 Modal Header

The top of the modal shows key identity information at a glance:

- **Company name** in large bold text (e.g., "MY HERO HYPERMARKET SDN BHD")
- **Active/Inactive badge** — a green "Active" or red "Inactive" pill
- **Entity label** — "Customer"
- **Customer code** — the DebtorCode in monospaced text (e.g., "300-A0001")
- **Debtor type** — e.g., "WHOLESALE" or "RETAIL"
- **Sales agent** — the sales rep assigned to this customer

This header stays fixed at the top while you scroll through the rest of the modal.

### 2.2 Summary KPI Panels

Below the header are three side-by-side panels, each with a colored header. Think of these as three "report cards" for the customer — one for payments, one for returns, and one for sales. All data loads when the modal opens.

#### Payment Panel (blue header)

| Metric | What it tells you | Example |
|--------|------------------|---------|
| Credit Limit | Maximum credit the customer is allowed | RM 1,200,000 |
| Outstanding | How much they currently owe | RM 2,212,000 (shown in orange) |
| Credit Utilization | Outstanding as a % of credit limit | 184% with a red progress bar (way over limit) |
| Aging Count | Number of overdue invoices | 42 invoices, with "(Oldest: 135 days)" |
| Credit Score | The 0-100 composite score from the five factors | 11 / 100 |
| Risk Tier | Low, Moderate, or High | "High" with a red badge |
| Payment Term | The agreed payment terms | "Net 30" |
| Avg Payment Period | How many days on average they take to pay | "30 DAYS M.L." (last 12 months) |

At a glance, you can see whether this customer is financially healthy or in trouble. In the example above, the customer is well over their credit limit, has 42 overdue invoices going back 135 days, and scores an 11 out of 100. That is a customer who needs attention.

#### Returns Panel (amber header)

| Metric | What it tells you | Example |
|--------|------------------|---------|
| Return Count | Total number of return credit notes | 5 total |
| Unresolved | RM value of returns not yet settled | RM 72,174 (shown in red) |
| Return Trend | Line chart of monthly returns (last 12 months) | Green if stable/declining, red if increasing |

The return trend chart is particularly useful. If a customer who used to never return goods suddenly has returns spiking upward, that could signal a quality issue or a relationship problem.

#### Sales Performance Panel (green header)

| Metric | What it tells you | Example |
|--------|------------------|---------|
| Profit Margin | (Revenue - COGS) / Revenue | 3.23% (red — below the 10% threshold) |
| Period Revenue | Total sales in the last 12 months | RM 11,659,032 |
| Revenue Trend | Line chart of monthly revenue (last 12 months) | Blue line showing the trajectory |

The margin percentage is color-coded: green if 20% or above, amber if 10-19%, and red if below 10%. For a fruit distributor like Hoi-Yong, margins on high-volume wholesale customers can be razor-thin, so a 3.23% margin is not unusual — but it is worth monitoring.

### 2.3 Pending Payment Tab

The first tab shows a sortable table of all outstanding invoices for this customer. Each row is an unpaid invoice:

| Column | What it shows |
|--------|--------------|
| Invoice No. | The document number (e.g., "IV-00001") |
| Invoice Date | When the invoice was issued |
| Due Date | When payment was due |
| Total (RM) | The original invoice amount |
| Outstanding (RM) | How much is still unpaid |
| Days Overdue | How many days past the due date (red if overdue, green if not yet due) |

The table is sorted by Days Overdue (most overdue first) by default. This makes it easy to identify which invoices need the most urgent follow-up.

If there are no outstanding invoices, you see a simple message: "No outstanding invoices." That is the best possible state — it means the customer has paid everything.

### 2.4 Return Records Tab

This tab lists every credit note of type RETURN for the customer:

| Column | What it shows |
|--------|--------------|
| Doc No | The credit note number |
| Date | When the return was recorded |
| Amount | The total credit note value |
| Knocked Off | How much has been applied against other invoices |
| Refunded | How much was refunded in cash (shown in blue) |
| Unresolved | Amount still not settled — green "Settled" if zero, red if fully unresolved, amber if partially settled |
| Reason | Why the goods were returned (truncated, hover for full text) |

Sorted by date (newest first). The Unresolved column is the key one — it tells you whether there is still money tied up in this return.

### 2.5 Sold Items Tab

This tab shows every product sold to the customer within a date range, with margin analysis:

| Column | What it shows |
|--------|--------------|
| Item Code | The product code |
| Description | What the product is |
| Group | Product category |
| Qty Sold | How many units were sold |
| Revenue | Total selling price |
| Cost | Total cost (COGS) |
| Margin % | (Revenue - Cost) / Revenue, color-coded |

A date range picker at the top lets you adjust the period. If you opened the modal from the Sales or Customer Margin page, the date range carries over automatically.

This tab answers questions like: "What are we selling to this customer? Are we making money on it? Which products have the best and worst margins?"

### 2.6 The one-stop shop

The Customer Profile Modal is designed to be your single source of truth for any customer. Instead of jumping between the Payment, Returns, and Sales dashboards, you click one row and get everything in one place.

**Practical example:** Your sales agent calls to say a customer wants to increase their order. Before approving, you open their profile. You see their credit utilization is at 150%, they have RM 200,000 in overdue invoices, and their return rate has been climbing. Armed with this data, you might say: "Let us collect on the overdue invoices first, then we can discuss the bigger order."

---

## 3. Supplier Profile Modal

The Supplier Profile Modal works similarly to the Customer Profile, but it focuses on the *supply* side. It opens when you click a supplier row on the Supplier Margin page (`/supplier-margin`).

### 3.1 Modal Header

The header shows:

- **Company name** — the supplier's name in large bold text
- **Active/Inactive badge** — green or red pill
- **Entity label** — "Supplier"
- **Supplier code** — the CreditorCode in monospaced text

Below the identity info, two KPI cards appear:

| KPI | What it tells you |
|-----|------------------|
| Items Supplied | How many distinct products you buy from this supplier (e.g., 47 items) |
| Single Supplier Items | How many of those items come *only* from this supplier (shown with an amber warning icon) |

The "Single Supplier Items" metric is about **supply chain risk**. If you buy mangoes from three different suppliers, losing one supplier is manageable. But if you buy dragon fruit from only *one* supplier and they raise prices or cannot deliver, you have a problem. This number highlights exactly that vulnerability.

### 3.2 Purchase Items Tab

This is the only tab in the Supplier Profile Modal. It contains:

1. **Period KPI cards** — Revenue, Total Spend (COGS), Gross Profit, and Margin for the selected period.
2. **A search bar** — filter items by code or description.
3. **A date range picker** — adjust the time period.
4. **The items table** — every product purchased from this supplier.

The items table columns:

| Column | What it shows |
|--------|--------------|
| Warning icon | Amber triangle if this is a single-supplier item |
| Item Code | The product code |
| Description | Product name |
| Qty Purchased | How many units you bought |
| Avg Purchase | Average price per unit you paid |
| Price Trend | A sparkline showing how the purchase price has moved over time |
| Revenue | How much you earned selling this item |
| Purchase Cost | How much you spent buying it |
| Margin % | (Revenue - Cost) / Revenue, color-coded |

Single-supplier items are highlighted with a light amber background row, so they stand out visually.

### 3.3 Using the Supplier Profile for negotiation

The Price Trend sparkline is the most powerful column in this table. It shows a tiny line chart of monthly average purchase prices. Here is how to read it:

- **Green sparkline (flat or declining):** Prices are stable or going down. Good news.
- **Red sparkline (increasing):** Prices have been creeping up. Time to ask questions.

**Practical example:** You open the profile for your top fruit supplier. You notice that the price trend for bananas has been steadily climbing over the last six months — the sparkline is red and trending upward. Meanwhile, the margin on bananas has dropped from 15% to 8%.

Now you have data to support a conversation: "We have been buying bananas from you for years, but the average purchase price has gone up 20% in six months. Our margin is getting squeezed. Can we work something out?"

Without this dashboard, you might only notice the problem when margins on the whole business start to slip. With the supplier profile, you can catch it item by item, month by month.

### 3.4 Identifying supply chain risk

Look at the Single Supplier Items count in the header. If it is high relative to the total items supplied, you are heavily dependent on this supplier. The amber warning triangles in the table tell you exactly which items are at risk.

**What to do about it:** For each single-supplier item, consider whether you can find a second source. You do not need to switch suppliers — just having a backup relationship gives you negotiating leverage and protects you from disruptions.

---

## Summary

| Feature | Where to find it | What it does |
|---------|-----------------|-------------|
| Payment Settings | `/payment/settings` | Configure credit score weights and risk thresholds |
| Customer Profile Modal | Click any customer row | 360-degree view: payment health, returns, sold items |
| Supplier Profile Modal | Click a supplier row on Supplier Margin | Items supplied, price trends, margin analysis, supply chain risk |

These three features are the "power tools" of the dashboard. The settings page lets you calibrate the system to match your business priorities. The profile modals let you drill deep into any customer or supplier without leaving the context of whatever dashboard you are on.
