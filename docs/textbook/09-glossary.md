# Chapter 9: Glossary — Every Term Explained Simply

This glossary covers every financial, technical, and Hoi-Yong-specific term used in the dashboard. Terms are listed alphabetically. Each entry has a plain definition followed by a concrete example from Hoi-Yong's fruit distribution business.

---

**Accounts Receivable (AR)** — Money that customers owe you for goods or services you have already delivered. In Hoi-Yong's case, when a wholesale customer picks up RM 10,000 worth of mangoes on credit, that RM 10,000 becomes an accounts receivable entry until they pay.

**Aging** — The process of grouping unpaid invoices by how long they have been outstanding. In Hoi-Yong's case, the Payment dashboard groups overdue invoices into buckets like 1-30 days, 31-60 days, 61-90 days, and 90+ days. The further right an invoice falls, the harder it may be to collect.

**AutoCount** — The accounting software Hoi-Yong uses (AutoCount Accounting, running on PostgreSQL). It is the source system for all data in the dashboard. Every invoice, payment, credit note, and customer record originates in AutoCount.

**Balance Sheet** — A financial statement showing what a company owns (assets), what it owes (liabilities), and what is left over for the owners (equity) at a specific point in time. In Hoi-Yong's case, the P&L page includes a balance sheet view showing current assets, liabilities, and retained earnings.

**Cash Sales** — A sale where payment is received immediately (or very quickly), rather than on credit terms. In Hoi-Yong's case, walk-in customers who buy fruit at the warehouse and pay cash or card on the spot generate cash sale documents (CS records). POS transactions are included in this category.

**CN (Credit Note table)** — The database table that stores credit note transactions in the sales module. In Hoi-Yong's case, the CN table contains about 8,700 credit notes, each representing a return or adjustment to a previous sale. Fields include DocNo, DocDate, DebtorCode, NetTotal, and CNType.

**COGS (Cost of Goods Sold)** — The direct cost of purchasing the goods you sold. In Hoi-Yong's case, if you sell a box of oranges for RM 50 and you bought it from the supplier for RM 35, the COGS is RM 35. The dashboard calculates COGS from the LocalTotalCost field in invoice detail lines.

**Collection Rate** — The percentage of outstanding receivables that you successfully collected during a period. In Hoi-Yong's case, if customers owed RM 1,000,000 at the start of the month and you collected RM 800,000, your collection rate is 80%.

**Credit Limit** — The maximum amount of credit a customer is allowed to carry at one time. In Hoi-Yong's case, a wholesale customer might have a credit limit of RM 200,000. If their outstanding balance hits RM 200,000, the system flags them before extending more credit.

**Credit Note** — A document that reduces the amount a customer owes, usually because goods were returned or there was a billing error. In Hoi-Yong's case, if a customer returns RM 500 worth of spoiled durians, Hoi-Yong issues a credit note for RM 500 that offsets their outstanding balance.

**Credit Score** — A number from 0 to 100 that the dashboard calculates for each customer, summarizing their payment reliability. In Hoi-Yong's case, the score combines five factors (utilization, overdue days, consistency, timeliness, and breach) using configurable weights set on the Payment Settings page.

**Credit Utilization** — Outstanding balance divided by credit limit, expressed as a percentage. In Hoi-Yong's case, if a customer has a RM 100,000 credit limit and currently owes RM 80,000, their credit utilization is 80%. Anything over 100% means they have exceeded their limit.

**CS (Cash Sales table)** — The database table storing cash sale transactions. In Hoi-Yong's case, the CS table has about 52,000 records. It includes POS sales and has the same structure as the IV table. CS and IV are mutually exclusive — there is no double-counting risk.

**Current Assets** — Assets that are expected to be converted to cash within one year: cash, receivables, inventory. In Hoi-Yong's case, current assets include the cash in the bank, the money customers owe (AR), and the fruit sitting in the warehouse.

**Current Liabilities** — Debts or obligations due within one year: payables, short-term loans, accrued expenses. In Hoi-Yong's case, current liabilities include what Hoi-Yong owes to fruit suppliers, utility bills, and any short-term borrowings.

**Current Ratio** — Current Assets / Current Liabilities. A measure of whether you can pay your short-term bills. In Hoi-Yong's case, if current assets are RM 2,000,000 and current liabilities are RM 1,000,000, the current ratio is 2.0 — meaning you have RM 2 for every RM 1 you owe. Above 1.0 is generally healthy.

**Debtor** — Another word for a customer who owes you money. In Hoi-Yong's case, the Debtor table has about 710 records — these are all of Hoi-Yong's credit customers. Each debtor has an account code (DebtorCode), credit limit, payment terms, and an assigned sales agent.

**DebtorCode** — The unique identifier for a customer in AutoCount, stored in the Debtor.AccNo field. In Hoi-Yong's case, a debtor code looks like "300-A0001". The dashboard uses this code to link invoices, payments, and credit notes back to the correct customer.

**Depreciation** — The gradual reduction in value of a long-term asset over its useful life. In Hoi-Yong's case, if they buy a delivery truck for RM 120,000 and depreciate it over 10 years, the Expenses dashboard might show RM 12,000 per year in depreciation expense.

**DocDate** — The document date field present on every transaction record (invoices, cash sales, credit notes, payments). In Hoi-Yong's case, DocDate is stored in UTC in the database. The dashboard adds 8 hours to convert to Malaysia Time (MYT) before any date-based grouping or filtering. This is critical — without the timezone adjustment, a sale made at 11 PM Malaysian time would appear on the wrong day.

**DSO (Days Sales Outstanding)** — The average number of days it takes to collect payment after a sale. In Hoi-Yong's case, if average DSO is 45 days, it means on average customers take 45 days to pay their invoices. Lower is better — it means cash comes in faster.

**EBIT (Earnings Before Interest and Taxes)** — Net revenue minus all operating expenses, but before deducting interest payments and income tax. In Hoi-Yong's case, if revenue is RM 10,000,000, COGS is RM 8,000,000, and operating expenses are RM 1,000,000, then EBIT is RM 1,000,000.

**Equity** — The owner's stake in the business: total assets minus total liabilities. In Hoi-Yong's case, equity includes the original capital invested plus all retained earnings (profits not yet distributed).

**Expense Ratio** — A specific expense category as a percentage of total revenue. In Hoi-Yong's case, if transport costs are RM 200,000 and revenue is RM 10,000,000, the transport expense ratio is 2%. The Expenses dashboard tracks these ratios to spot categories that are growing faster than revenue.

**Fiscal Year** — The 12-month accounting period used for financial reporting, which may not match the calendar year. In Hoi-Yong's case, the fiscal year runs from March to February. So "FY2025" covers March 2025 through February 2026. This is stored in the FiscalYear table and affects how YTD and period comparisons work.

**FiscalYear (March-February)** — Hoi-Yong's specific fiscal year cycle. In Hoi-Yong's case, fiscal year boundaries start on March 1 and end on the last day of February. The dashboard's date range defaults and period comparisons are built around this schedule. If you see "FY2025," that means the period starting March 2025.

**GL (General Ledger)** — The master record of all financial transactions, organized by account. In Hoi-Yong's case, the GLDTL table has over 2 million journal lines recording every debit and credit across all accounts. The Expenses and P&L dashboards query the GL to build their reports.

**Gross Margin** — Gross Profit divided by Revenue, expressed as a percentage. In Hoi-Yong's case, if they sell RM 100,000 of fruit and the cost of that fruit was RM 75,000, the gross margin is 25%. This tells you how much of each ringgit of revenue is left after paying for the goods themselves.

**Gross Profit** — Revenue minus COGS. In Hoi-Yong's case, gross profit is what is left after you subtract the cost of buying the fruit from the revenue you earned selling it. It does not include rent, salaries, or other overheads — just the direct buying-versus-selling difference.

**Invoice** — A document requesting payment for goods or services delivered. In Hoi-Yong's case, when a credit customer receives a shipment of fruit, Hoi-Yong generates an invoice (IV record) that states how much is owed and when payment is due. The invoice amount becomes an accounts receivable entry.

**IV (Invoice table)** — The database table storing invoice transactions. In Hoi-Yong's case, the IV table has about 118,000 records spanning years of business. Key fields include DocNo, DocDate, DebtorCode, NetTotal, LocalNetTotal, and Cancelled. Only records where Cancelled = 'F' are counted in the dashboard.

**Knock Off** — AutoCount's term for applying a payment or credit note against an outstanding invoice. In Hoi-Yong's case, when a customer pays RM 5,000 and you apply it to three outstanding invoices, that is "knocking off" those invoices. The ARPaymentKnockOff table tracks which payments settle which invoices. A credit note is "knocked off" when its value is applied to offset an invoice balance.

**LocalNetTotal** — The net total amount in local currency (MYR). In Hoi-Yong's case, the dashboard always uses LocalNetTotal instead of NetTotal for reporting. This matters because Hoi-Yong occasionally has transactions in SGD (Singapore Dollars). LocalNetTotal is already converted to ringgit, so everything stays comparable.

**Margin** — The difference between selling price and cost, usually expressed as a percentage of the selling price. In Hoi-Yong's case, if you buy a case of grapes for RM 40 and sell it for RM 50, the margin is (50 - 40) / 50 = 20%. The Customer Margin and Supplier Margin dashboards track this at the item, customer, and supplier levels.

**MYR / RM** — Malaysian Ringgit, the national currency of Malaysia. MYR is the international currency code; RM is the local abbreviation (short for "Ringgit Malaysia"). In Hoi-Yong's case, all dashboard values are displayed in RM. The "Local" prefix on database fields (e.g., LocalNetTotal) means the amount is in MYR.

**MYT (Malaysia Time)** — Malaysia's timezone, UTC+8. In Hoi-Yong's case, DocDate values in the database are stored in UTC. The dashboard adds 8 hours before grouping by date or month. Without this adjustment, transactions near midnight would be assigned to the wrong day.

**Net Profit** — Revenue minus all expenses (COGS, operating expenses, interest, taxes). In Hoi-Yong's case, net profit is the bottom line on the P&L statement. It is what is left after paying for everything — fruit, rent, salaries, delivery trucks, and taxes.

**Net Sales** — Total sales minus returns (credit notes). In Hoi-Yong's case, the formula is: SUM(IV.NetTotal) + SUM(CS.NetTotal) - SUM(CN.NetTotal), counting only non-cancelled documents. If gross sales are RM 1,000,000 and returns are RM 50,000, net sales are RM 950,000.

**NetTotal** — The net total amount on a transaction document in its original transaction currency. In Hoi-Yong's case, most transactions are in MYR, so NetTotal and LocalNetTotal are usually the same. For the rare SGD transaction, NetTotal would be in SGD while LocalNetTotal would be the MYR equivalent.

**OPEX (Operating Expenses)** — The day-to-day costs of running the business that are not directly tied to producing goods: rent, salaries, utilities, transport, marketing. In Hoi-Yong's case, the Expenses dashboard breaks OPEX into categories and tracks how each one changes over time relative to revenue.

**Outstanding** — The unpaid balance on an invoice. In Hoi-Yong's case, if an invoice was for RM 10,000 and the customer has paid RM 6,000, the outstanding amount is RM 4,000. The Payment dashboard monitors total outstanding across all customers.

**Overdue** — An invoice is overdue when the current date is past its due date and it has not been fully paid. In Hoi-Yong's case, if an invoice with a "Net 30" term was issued on March 1 and it is now April 15, the invoice is 15 days overdue. The dashboard highlights overdue invoices in red.

**P&L (Profit and Loss)** — A financial statement showing revenue, costs, and expenses over a period, resulting in net profit or loss. In Hoi-Yong's case, the P&L dashboard shows revenue at the top, subtracts COGS to get gross profit, then subtracts operating expenses to arrive at net profit. Also called an "income statement."

**Payment Terms** — The agreed timeline for when a customer must pay their invoice. In Hoi-Yong's case, common terms include "Net 30" (pay within 30 days), "Net 60" (pay within 60 days), and "COD" (cash on delivery). These are stored in the debtor record and displayed as the DisplayTerm field.

**Prior Period** — The same time period from the previous year, used for comparison. In Hoi-Yong's case, if you are looking at January 2025, the prior period is January 2024. The dashboard uses prior period data to calculate YoY growth rates and show whether things are improving or declining.

**Reconciled** — A transaction that has been matched and verified against another record (e.g., a bank statement matched to a payment entry). In Hoi-Yong's case, a credit note is considered "reconciled" (or settled) when its full amount has been knocked off against invoices or refunded. The Returns dashboard tracks unreconciled credit notes.

**Retained Earnings** — Accumulated profits that have not been distributed to owners. In Hoi-Yong's case, retained earnings appear on the balance sheet. If the business earned RM 500,000 in net profit this year and the owner withdrew RM 200,000, retained earnings increase by RM 300,000.

**Revenue** — The total income from selling goods or services before any deductions. In Hoi-Yong's case, revenue comes from three sources: invoices (IV), cash sales (CS), minus credit notes (CN). The Sales dashboard displays this as the primary top-line metric.

**ROI (Return on Investment)** — Profit earned as a percentage of the money invested. In Hoi-Yong's case, if they invest RM 50,000 in a new cold storage room and it helps them save RM 20,000 per year in spoiled fruit, the annual ROI is 40%.

**Sparkline** — A tiny inline chart (usually a line chart) embedded within a table cell. In Hoi-Yong's case, the Supplier Profile Modal uses sparklines to show price trends for each item — a small line in the table cell that goes up, down, or stays flat. Green sparklines mean stable/declining prices; red means prices are rising.

**Unresolved** — The portion of a credit note that has not yet been knocked off against invoices or refunded. In Hoi-Yong's case, if a RM 1,000 credit note has had RM 600 knocked off and RM 0 refunded, the unresolved amount is RM 400. The Returns dashboard tracks this to ensure credit notes do not sit in limbo indefinitely. The formula is: LocalNetTotal - KnockOffAmt - RefundAmt.

**YoY (Year over Year)** — Comparing a metric from this year to the same period last year. In Hoi-Yong's case, if January 2025 revenue was RM 800,000 and January 2024 revenue was RM 700,000, the YoY growth is +14.3%. The Sales dashboard shows YoY percentages on key metrics with green (up) and red (down) indicators.

**YTD (Year to Date)** — The period from the start of the current fiscal year to today. In Hoi-Yong's case, since the fiscal year starts in March, "YTD" as of June 2025 covers March through June 2025. The Sales dashboard has a "Fiscal YTD" preset that automatically sets the date range to this period.
