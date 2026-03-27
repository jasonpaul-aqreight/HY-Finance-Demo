# Chapter 3: Credit Note / Return / Refund -- When Goods Come Back

## What This Page Tells You

If you sell fresh fruit for a living, returns are not a question of "if" but "when." A crate of grapes arrives bruised. A customer ordered Fuji apples but received Red Delicious. A pallet of mangoes sat too long in a warm truck. When any of this happens, the customer expects their money back -- or at least a reduction on their next bill.

In accounting, this correction is called a **Credit Note**. Think of it as an IOU in reverse: instead of the customer owing you money, the credit note says *you* owe *them*. At Hoi-Yong, every credit note with the type `RETURN` appears on this page.

There are three ways a credit note gets resolved:

| Resolution | What happens | How common |
|------------|-------------|------------|
| **Knock Off** | The amount is deducted from the customer's next invoice. They pay less next time. | Very common (~92%) |
| **Refund** | You give the customer actual cash or a cheque. | Rare (~0.3%) |
| **Unresolved** | Nobody has dealt with it yet. The credit note is still "open." | Needs attention (~7.5%) |

The Credit Note / Return / Refund page pulls all of this together so you can answer one question at a glance: **are returns under control, or is something going wrong?**

---

## The 5 KPI Cards

At the top of the page sit five cards. Each one gives you a single number that summarises one aspect of returns. Here is what they mean using real Hoi-Yong data (for the default 12-month window, Nov 2024 -- Oct 2025):

### Card 1: Total Returns -- RM 1,130,242

This is the total ringgit value of every credit note issued in the selected date range. It answers: "How much money did we have to give back (or promise to give back) because of returns?"

The subtitle tells you the count -- 5,133 credit notes generated that value. That means the average credit note is roughly RM 220, which is modest (think a few boxes of fruit, not an entire truckload).

### Card 2: Reconciled -- RM 1,045,589 (92.5%)

Reconciled means "dealt with." The money has either been knocked off a future invoice or refunded in cash. The number is shown in green because it is good news -- the vast majority of returns have been settled.

The subtitle breaks it down: Knocked Off + Refunded = 92.5% of total.

### Card 3: Unresolved -- RM 84,653 (7.5%)

This is the opposite of reconciled. These credit notes are still floating -- the customer is still owed money and nobody has processed it yet. The number appears in red because it demands attention.

The subtitle goes further, splitting unresolved into **partial** (some amount has been settled, but not all) and **outstanding** (nothing settled at all). Outstanding items are the most urgent.

**How the math works:**

```
Unresolved = Total Return Value - Knocked Off Amount - Refunded Amount
```

If unresolved equals zero, the credit note is "Settled." If it is between zero and the total, it is "Partial." If knocked off and refunded are both zero, it is "Outstanding."

### Card 4: Return % -- 1.3%

This is the single most important number on the page. It tells you: **for every RM 100 in sales, RM 1.30 came back as a return.**

The formula is simple:

```
Return % = Total Return Value / Total Sales * 100
```

The dashboard colour-codes this card:
- **Green** (at or below 2%) -- healthy range
- **Amber** (2% to 5%) -- worth investigating
- **Red** (above 5%) -- something is seriously wrong

At 1.3%, Hoi-Yong is comfortably in the green zone.

### Card 5: Return Records -- 5,133

A simple count of credit notes in the period. This matters because a high count of low-value returns might indicate a different problem (sloppy order-picking, for instance) than a low count of high-value returns (spoilage of premium product).

---

## Settlement Breakdown

On the left side beneath the KPI cards, three horizontal progress bars show you where the return money went:

| Bar | Colour | Amount | % of Total |
|-----|--------|--------|------------|
| **Knocked Off** (against invoices) | Green | RM 1,043,861 | 92.2% |
| **Refunded** (cash/cheque) | Blue | RM 3,726 | 0.3% |
| **Unresolved** | Red | RM 84,653 | 7.5% |

### Why should you care?

The balance between these three tells you about the business's habits:

- **Knock-off dominance (92.2%)** is normal for a B2B distributor. You do not cut a cheque every time a box of grapes is bruised -- you just deduct it from the customer's next bill. It is fast, low-friction, and keeps the relationship smooth.
- **Refunds are rare (0.3%)**. This makes sense. Cash refunds are expensive to process and usually only happen when a customer is closing their account or the amount is too large to knock off gradually.
- **Unresolved at 7.5%** means roughly RM 84,653 is sitting in limbo. Some of that is recent (credit notes from the last 30 days that simply have not been processed yet), but if old credit notes linger here, that is a problem.

### How to read this chart

Glance at the red bar. If it is visibly growing from month to month, your reconciliation process is falling behind. If the green bar dominates and the red bar is a sliver, things are running smoothly.

---

## Aging of Unresolved Returns

To the right of the settlement breakdown sits a horizontal bar chart that asks: **how old are the unresolved credit notes?**

This chart is **not filtered by date range** -- it always shows all-time unresolved returns, because an old unresolved credit note is still a current problem regardless of when it was created.

The bars are divided into five age buckets:

| Bucket | Colour | What it means |
|--------|--------|--------------|
| 0-30 days | Green | Fresh. Probably still being processed. Normal. |
| 31-60 days | Amber | Getting stale. Should be resolved soon. |
| 61-90 days | Orange | Overdue. Someone should chase this. |
| 91-180 days | Red | Seriously overdue. Possible dispute or oversight. |
| 180+ days | Dark red | These have been sitting for over six months. Either forgotten or stuck in a disagreement. |

### Why should you care?

A healthy business will have most of its unresolved value in the 0-30 day bucket (things are new and still being processed) and very little in 180+ days. If the 180+ bar is the longest, it means old credit notes are piling up unresolved -- and that is money the business effectively owes but has not dealt with.

### Red flags

- The 180+ day bucket holds a large absolute amount (check the RM value on hover).
- The majority of unresolved value is in the older buckets rather than the newest one.
- The total across all buckets keeps growing over time.

---

## Top 10 Returns by Product

Below the settlement and aging section sits a horizontal bar chart showing which products generate the most returns.

### How to read this chart

Each bar represents a product (or product group). You can toggle two things:

**Dimension toggle** (what you are grouping by):
- **All** -- individual product SKUs (the most granular view)
- **Fruit** -- grouped by fruit type (e.g., all grape varieties combined)
- **Variant** -- fruit + variety (e.g., "Grape -- Shine Muscat" vs "Grape -- Egypt Flame")
- **Country** -- country of origin (e.g., Japan, Egypt, USA)

**Metric toggle** (what the bar length represents):
- **Frequency** -- number of credit notes (how *often* a product gets returned)
- **Value (RM)** -- total return value (how *expensive* the returns are)

A product can appear at the top of the frequency list but not the value list (cheap item returned constantly) or vice versa (expensive item rarely returned, but each return hurts).

### What you will typically see

In Hoi-Yong's data, some patterns stand out:

- **PALLET** often appears near the top. This is not a fruit -- it is a logistics/packaging item. When a pallet is "returned," it usually means the wooden pallet itself was sent back or the charge was reversed. It is normal for a distributor, but worth separating mentally from actual product quality issues.
- **Grapes** (especially Shine Muscat and Egypt Flame Seedless) appear frequently. Grapes are delicate. They bruise easily, have a short shelf life, and customers are quick to reject boxes that look less than perfect.
- **Apples** (various varieties) also show up. While apples are sturdier than grapes, the sheer volume sold means even a low return rate produces a visible number of credit notes.

### Why should you care?

If one product consistently dominates this chart, it might signal a supply chain issue (poor cold chain), a supplier quality problem, or a pricing/expectation mismatch. If a new product suddenly appears in the top 10, it warrants investigation.

The tooltip on each bar reveals additional detail: the total quantity returned, how much was a physical goods return versus a credit-only adjustment (where the customer keeps the goods but gets a price reduction), and the total RM value.

---

## Monthly Return Trend

This area chart shows how returns evolve over time. Two layered areas are plotted on the same axis:

| Series | Colour | What it shows |
|--------|--------|--------------|
| **Return Value** | Indigo (purple-blue) | Total RM value of credit notes issued each month |
| **Unresolved** | Red | The portion of that month's returns that remains unresolved |

The X-axis shows months (formatted as MM/YY), and the Y-axis shows RM amounts.

### How to read this chart

The indigo area represents the total return volume each month. The red area, layered on top, shows what has not yet been resolved. In a well-managed operation, the red area should be a thin sliver compared to the indigo -- meaning most returns get reconciled quickly.

**The key signal:** look at the gap between the two areas. If total returns stay flat but the red (unresolved) area is growing, you are falling behind on reconciliation. If both lines move together, it means new returns are not being processed at all.

A spike in the indigo area for a particular month might correspond to a seasonal event (e.g., Chinese New Year when order volumes are high and mistakes multiply) or a one-off incident (a shipment that went bad).

### Red flags

- Unresolved area growing month over month while total returns stay stable -- reconciliation is slowing down.
- A sudden spike in total returns -- investigate what happened that month.
- Unresolved area nearly matching the return value area -- almost nothing is being reconciled.

---

## Customer Returns Table

Below a visual separator line (with the note: *"All return records -- not filtered by date range above"*), this table lists every customer who has ever had a return, sorted by total return value.

### Why the "not filtered" callout matters

The KPI cards and charts above respond to your date range filter. This table does **not** -- it always shows all-time data. The idea is that you want a complete picture of each customer's return history, not just the last 12 months. A customer who returned RM 200K worth of goods three years ago and still has unresolved credit notes is still relevant today.

### Table columns

| Column | What it tells you |
|--------|------------------|
| **Customer** | Company name (hover to see the full name if it is truncated) |
| **Returns** | Number of credit notes for this customer (all time) |
| **Total Value** | Total RM value of all their returns |
| **Knocked Off** | How much has been deducted from their invoices |
| **Refunded** | How much has been refunded in cash/cheque (shown in blue if > 0, a dash if zero) |
| **Unresolved** | Current unresolved balance, colour-coded (see below) |

The **Unresolved** column uses three states:
- **Green "Settled"** -- nothing outstanding. All returns have been dealt with.
- **Amber amount** -- partially settled. Some credit notes are resolved, others are not.
- **Red amount** -- fully outstanding. None of this customer's returns have been settled. This is the most urgent.

### What you will typically see

In Hoi-Yong's data, **SRI TERNAK MART** leads the table with 764 returns worth approximately RM 310,000. That sounds alarming, but context matters -- if they are also one of the highest-volume customers, a proportionally larger return count is expected. The question is whether their *return rate* (returns as a percentage of their purchases) is in line with other customers.

### Interacting with the table

- **Sort** by clicking any column header. Click again to reverse the sort. This lets you quickly find, for example, the customer with the highest unresolved balance.
- **Click a row** to open the Customer Profile Modal, which shows detailed return history for that customer, including individual credit notes, reasons, and a 12-month trend sparkline.
- **Paginate** through the list (20 rows per page) using the Prev/Next buttons at the bottom.

---

## Red Flags -- What Should Make You Worried

Here is a checklist of warning signs to look for on this page:

1. **Return % above 2-3%.** For perishable goods like fruit, some returns are inevitable, but once you cross 2%, you should be asking why. Above 5% is a serious problem that likely points to supply chain, quality, or order accuracy issues.

2. **Growing unresolved balance.** Check the monthly trend chart. If the red (unresolved) area is getting fatter each month, credit notes are piling up faster than they are being processed. This is a cash flow risk and a customer relationship risk.

3. **One customer with disproportionate returns.** If a single customer accounts for a huge share of total returns, investigate. It could be legitimate (they buy a lot, so they return a lot), or it could indicate abuse, miscommunication about product specs, or delivery issues specific to their route.

4. **Old unresolved returns (180+ days).** The aging chart should not have its biggest bar on the far right. Returns that sit unresolved for six months are either forgotten (a process failure) or disputed (a relationship problem). Either way, they need human attention.

5. **PALLET or non-fruit items dominating the product chart.** If logistics items consistently top the returns list, it might mean packaging charges are being applied and then reversed routinely -- which could indicate a pricing or billing workflow issue rather than a product quality issue.

6. **Refund rate suddenly spiking.** Normally, almost everything is knocked off. If the refund (cash/cheque) percentage jumps, it might mean customers are losing confidence and demanding immediate cash back rather than accepting invoice deductions.

---

## When Someone Asks You...

### "Are returns a problem?"

Look at the Return % card. At 1.3%, Hoi-Yong's returns are well within the healthy range for a fresh produce distributor. But do not stop there -- check the trend chart. A low average can hide a recent spike. If the last two months show Return % climbing toward 2-3%, that is an early warning even if the overall number looks fine.

### "Who returns the most?"

Open the Customer Returns table and sort by Total Value (descending). The top row is your biggest returner. But remember to check context: a customer who buys RM 5 million of fruit per year and returns RM 300K (6%) is more concerning than one who buys RM 50 million and returns RM 300K (0.6%). If you have access to the Sales dashboard, cross-reference.

### "What products get returned most?"

Use the Top 10 Returns bar chart. Start with the "All" dimension and "Frequency" metric to see which individual SKUs appear on credit notes most often. Then switch to "Value (RM)" to see which ones cost you the most. Toggle to "Fruit" dimension to see the big picture by fruit type. Grapes are almost always near the top -- that is the nature of the product.

### "Are we resolving returns?"

Two places to check. First, the Reconciled KPI card: 92.5% is solid. Second, the aging chart: if most unresolved value sits in the 0-30 day bucket, that is just normal processing lag. If it is concentrated in 90+ days, you have a backlog problem. The RM 84K currently unresolved is not alarming on its own, but it should not be allowed to grow.

### "Should I be worried about refunds?"

Probably not. At 0.3% of total returns (roughly RM 3,726), cash refunds are negligible. Knock-off is the standard resolution method at Hoi-Yong. Only flag this if the refund percentage starts climbing meaningfully, which could indicate customer dissatisfaction with the knock-off process.

### "Why is PALLET on the product returns chart?"

PALLET is a logistics/packaging item, not a fruit. Returns of pallets typically represent the physical return of wooden pallets or the reversal of pallet charges. It is a normal part of distribution operations. If it concerns you, switch the dimension toggle to "Fruit" -- this groups by fruit type and excludes non-fruit items (codes starting with `ZZ-ZZ-` or `XX-ZZ-`), giving you a cleaner picture of actual product returns.
