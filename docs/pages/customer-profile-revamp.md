# Customer Profile Revamp — Design Spec

## Overview

Revamp the existing Customer Profile dialog (`CustomerProfileModal.tsx`) into a polished, comprehensive customer profile. The profile consolidates data from Sales, Payment, Returns, and Customer Margin dashboards into a single dialog view for a specific customer.

**Format:** Dialog modal (~90% viewport width and height)
**Stack:** Next.js App Router, React, TypeScript, shadcn/ui, Tailwind, Recharts
**Data:** SQLite via better-sqlite3 (Debtor table = master customer data, 88 columns)

---

## Phase 1: Dummy Preview (Mock Data)

Create a preview route at `/preview/customer-profile` with hardcoded mock data to validate the visual design before wiring up real APIs. The preview should demonstrate all 5 sections below with realistic sample data for a fruit distributor customer.

---

## Section 1: Header

**Full-width banner bar spanning the dialog.**

| Element | Position | Details |
|---------|----------|---------|
| Label chip | Top-left | Small filled badge reading "CUSTOMER" (to distinguish from Supplier profiles) |
| Company Name | Left, large bold | e.g., "ACME FRUIT SDN BHD" |
| Debtor Code | Below name, muted | e.g., "300-C0001" |
| Status Chip | Right-aligned | **Strong pill-shaped chip with solid background fill + icon.** Green with checkmark for Active, Red with x-circle for Inactive. White text. Must be impossible to miss. |
| Close button | Top-right corner | ✕ icon to close the dialog |

**Do NOT include** Debtor Type, Sales Agent, contact info, or any other details in the header. Keep it minimal and scannable in under 2 seconds.

---

## Section 2: Customer Details

**A card with 3-column grid of label-value pairs.**

| Column: Contact | Column: Financial | Column: Account |
|-----------------|-------------------|-----------------|
| PIC (from `Attention`) | Credit Limit (from `CreditLimit`, format RM) | Customer Type (from `DebtorType`) |
| Phone (from `Phone1`) | Overdue Limit (from `OverdueLimit`, format RM) | Sales Agent (from `SalesAgent`) |
| Email (from `EmailAddress`) | Payment Terms (from `DisplayTerm`) | Join Date (from `CreatedTimeStamp`) |

**Do NOT include** address fields. Exclude unless boss specifically requests.

---

## Section 3: Statistics / Snapshot

**A row of 4 visual metric cards. Data based on last 12 months (with info note below).**

### Card 1: Credit Health Score + Risk Level
- **Visual:** Semi-circular gauge (speedometer style), score 0-100 in center
- Gauge color gradient: red (0) → amber (50) → green (100)
- Below gauge: Risk Tier chip (colored pill — green "Low", amber "Moderate", red "High")
- Below chip: "Avg Pay: X days" text
- **Data source:** Payment — `credit_score`, `risk_tier`, `avg_payment_days`

### Card 2: Credit Utilization
- **Visual:** Donut/radial chart — single ring showing used vs available credit
- Ring color: green (<80%), amber (80-100%), red (>100%)
- Center: percentage number
- Below: "RM X of RM Y" (outstanding of credit limit)
- **Data source:** Payment — `utilization_pct`, `total_outstanding`, `credit_limit`

### Card 3: Outstanding Invoices
- **Visual:** Stacked horizontal bar showing aging buckets (compact, one line)
- Buckets: Not Due | 1-30 | 31-60 | 61-90 | 91-120 | 120+ days
- Color-coded from cool (not due) to hot (120+)
- Below: Total outstanding amount (RM)
- **Data source:** Payment — aging data, `total_outstanding`, `aging_count`

### Card 4: Returns
- **Visual:** Mini donut chart — Resolved (green) vs Unresolved (red)
- Center: "X/Y" (unsettled / total)
- Below: "Unsettled" label + total unresolved amount (RM)
- **Data source:** Returns — `return_count`, `unresolved`

**Footer note:** `"Statistics based on last 12 months unless otherwise noted"`

---

## Section 4: Trends (Tabbed with Date Picker)

**Tab bar with 2 tabs + date range picker aligned right.**

### Tab 1: Sales & Margin (default)
- **Chart:** Combo chart — Revenue as vertical bars + Margin % as line overlay (dual Y-axis)
- **KPI row below chart:** Net Sales | Avg Margin % | Total COGS (for selected period)
- **Data source:** Customer Margin — `/api/customer-margin/margin/customers/[code]/monthly`

### Tab 2: Returns
- **Chart:** Line or bar chart — Monthly return count and/or value
- **KPI row below chart:** Return Count | Total Return Value | Unresolved Amount (for selected period)
- **Data source:** Returns — `/api/return/credit-v2/customer-return-trend`

**Date picker:** Same component/pattern as existing dashboard pages. Default: last 12 months.

**NOTE:** Payment trend tab is intentionally excluded (no existing per-customer payment collection API).

---

## Section 5: Logs (Clickable Links)

**A section with 3 clickable row-items. Each row navigates to a full table view within the dialog.**

| Log Item | Bracket Count | When Clicked |
|----------|---------------|--------------|
| Outstanding Invoices | (X Outstanding) — count of overdue invoices | Shows invoice table: Doc No, Doc Date, Due Date, Total (RM), Outstanding (RM), Days Overdue |
| Return Records | (X Unsettled) — count of unresolved returns | Shows return table: Doc No, Doc Date, Net Total (RM), Knocked Off, Refunded, Unresolved, Reason |
| Sales Transactions | No bracket count | Shows sold items table: Item Code, Description, Product Group, Qty, Revenue, Cost, Margin % |

### Table View Behavior
- Clicking a log item **replaces the entire dialog content** with:
  - A header: "← Back to Profile" button + table title + customer name
  - The full data table (sortable, with pagination if needed)
- Clicking "← Back to Profile" returns to the main profile view
- All transitions happen **within the dialog** (no route change, no new dialog)

### Dashboard Integration
- When a user clicks a customer row in any dashboard table (Payment, Sales, Returns, Customer Margin), the dialog opens with the **relevant log tab auto-selected** via `defaultTab` prop.
- Example: Clicking a customer in the Payment dashboard opens the profile and immediately shows the Outstanding Invoices table.

---

## Existing API Endpoints (for real implementation)

| Endpoint | Purpose |
|----------|---------|
| `/api/payment/customer-profile?debtor_code=X` | Credit health, utilization, risk, payment terms |
| `/api/payment/customer-invoices?debtor_code=X` | Outstanding invoice list |
| `/api/return/credit-v2/customer-return-summary?debtor_code=X` | Return count + unresolved |
| `/api/return/credit-v2/customer-return-trend?debtor_code=X` | 12-month return trend |
| `/api/return/credit-v2/customer-returns?debtor_code=X` | Individual return records |
| `/api/customer-margin/margin/customers/[code]/monthly` | Monthly revenue + COGS |
| `/api/customer-margin/margin/customers/[code]/products` | Sold products list |

**New fields needed from Debtor table** (not currently queried):
- `Attention` (PIC / contact person)
- `Phone1` (phone number)
- `EmailAddress` (email)
- `CreatedTimeStamp` (join date)
- `OverdueLimit` (overdue limit amount)

---

## Visual Design Notes

- **Readability is critical.** End users are older executives. Never use gray/muted text for important labels. High contrast, clear fonts.
- **Currency:** Always format as RM with thousands separator (e.g., RM 50,000)
- **Color coding is consistent across the app:**
  - Green: healthy/good/low risk/resolved
  - Amber: warning/moderate
  - Red: critical/high risk/unresolved/overdue
- **Use existing shadcn/ui components** (Card, Badge, Tabs, Dialog, Table, etc.)
- **Charts use Recharts** (already in the project)

---

## Mock Data for Preview

Use this sample data for the dummy preview page:

```typescript
const mockCustomer = {
  company_name: "SYARIKAT BUAH SEGAR SDN BHD",
  debtor_code: "300-A0023",
  is_active: true,
  // Customer Details
  attention: "Ahmad bin Ibrahim",
  phone: "03-8920 4455",
  email: "ahmad@buahsegar.com.my",
  credit_limit: 80000,
  overdue_limit: 15000,
  display_term: "30 Days",
  debtor_type: "Fruit Shop",
  sales_agent: "AGT03 - Lim Wei",
  join_date: "2019-06-15",
  // Statistics
  credit_score: 72,
  risk_tier: "Moderate",
  avg_payment_days: 38,
  utilization_pct: 65,
  total_outstanding: 52000,
  aging_buckets: { not_due: 20000, d1_30: 15000, d31_60: 10000, d61_90: 5000, d91_120: 2000, d120_plus: 0 },
  return_count: 7,
  unsettled_returns: 3,
  unresolved_amount: 4850,
  // Trends (12 months)
  monthly_sales: [
    { month: "2025-01", revenue: 42000, margin_pct: 21.5 },
    { month: "2025-02", revenue: 38500, margin_pct: 19.8 },
    { month: "2025-03", revenue: 45200, margin_pct: 23.1 },
    { month: "2025-04", revenue: 41000, margin_pct: 20.4 },
    { month: "2025-05", revenue: 47800, margin_pct: 22.7 },
    { month: "2025-06", revenue: 39500, margin_pct: 18.9 },
    { month: "2025-07", revenue: 51200, margin_pct: 24.3 },
    { month: "2025-08", revenue: 48300, margin_pct: 22.1 },
    { month: "2025-09", revenue: 44600, margin_pct: 21.0 },
    { month: "2025-10", revenue: 50100, margin_pct: 23.5 },
    { month: "2025-11", revenue: 46700, margin_pct: 22.8 },
    { month: "2025-12", revenue: 53400, margin_pct: 25.1 },
  ],
  monthly_returns: [
    { month: "2025-01", count: 1, value: 1200 },
    { month: "2025-02", count: 0, value: 0 },
    { month: "2025-03", count: 1, value: 850 },
    { month: "2025-04", count: 0, value: 0 },
    { month: "2025-05", count: 2, value: 3100 },
    { month: "2025-06", count: 0, value: 0 },
    { month: "2025-07", count: 1, value: 1500 },
    { month: "2025-08", count: 0, value: 0 },
    { month: "2025-09", count: 1, value: 2200 },
    { month: "2025-10", count: 0, value: 0 },
    { month: "2025-11", count: 1, value: 1800 },
    { month: "2025-12", count: 0, value: 0 },
  ],
  // Log tables
  outstanding_invoices: [
    { doc_no: "IV-24-00891", doc_date: "2025-10-15", due_date: "2025-11-14", total: 12500, outstanding: 12500, days_overdue: 133 },
    { doc_no: "IV-24-00923", doc_date: "2025-11-02", due_date: "2025-12-02", total: 9800, outstanding: 9800, days_overdue: 115 },
    { doc_no: "IV-24-00967", doc_date: "2025-11-28", due_date: "2025-12-28", total: 15200, outstanding: 15200, days_overdue: 89 },
    { doc_no: "IV-24-01015", doc_date: "2025-12-10", due_date: "2026-01-09", total: 8300, outstanding: 8300, days_overdue: 77 },
    { doc_no: "IV-25-00042", doc_date: "2026-01-18", due_date: "2026-02-17", total: 6200, outstanding: 6200, days_overdue: 38 },
  ],
  return_records: [
    { doc_no: "CN-25-00112", doc_date: "2025-09-20", net_total: 2200, knocked_off: 2200, refunded: 0, unresolved: 0, reason: "Quality issue" },
    { doc_no: "CN-25-00158", doc_date: "2025-11-05", net_total: 1800, knocked_off: 0, refunded: 0, unresolved: 1800, reason: "Overripe goods" },
    { doc_no: "CN-25-00189", doc_date: "2025-12-12", net_total: 1500, knocked_off: 1500, refunded: 0, unresolved: 0, reason: "Short delivery" },
    { doc_no: "CN-26-00015", doc_date: "2026-01-08", net_total: 2100, knocked_off: 0, refunded: 0, unresolved: 2100, reason: "Damaged packaging" },
    { doc_no: "CN-26-00031", doc_date: "2026-02-14", net_total: 950, knocked_off: 0, refunded: 0, unresolved: 950, reason: "Wrong item delivered" },
  ],
  sales_transactions: [
    { item_code: "FRT-001", description: "Cavendish Banana (Grade A)", product_group: "Banana", qty: 520, revenue: 15600, cost: 11700, margin_pct: 25.0 },
    { item_code: "FRT-015", description: "Musang King Durian", product_group: "Durian", qty: 85, revenue: 42500, cost: 34000, margin_pct: 20.0 },
    { item_code: "FRT-023", description: "Harumanis Mango", product_group: "Mango", qty: 310, revenue: 18600, cost: 14880, margin_pct: 20.0 },
    { item_code: "FRT-008", description: "Red Watermelon", product_group: "Melon", qty: 450, revenue: 9000, cost: 7200, margin_pct: 20.0 },
    { item_code: "FRT-031", description: "Zespri Kiwi (Green)", product_group: "Imported", qty: 200, revenue: 12000, cost: 10200, margin_pct: 15.0 },
  ],
};
```
