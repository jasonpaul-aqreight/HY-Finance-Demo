# Outstanding Payment — Full Summary Prompt (PROPOSED CLEAN VERSION)

> Review-only. Compare against [payment-outstanding-summary-prompt.md](payment-outstanding-summary-prompt.md). When you approve, I apply.
>
> Changes vs current:
> 1. **General block**: deterministic Q&A list dropped. Only the narrative "Lean into …" hint remains.
> 2. **Per-component label**: `Rubric (good/neutral/bad criteria — apply directly, do not invent thresholds):` → `About:`
> 3. **Intro paragraph**: rewritten cleanly to introduce ABOUT + RAW DATA.
> 4. **SYSTEM prompt**: 2 lines updated to match (Rubric→About, drop "answer its deterministic questions").

---

## SYSTEM message
*(stored as `summary_system` in `ai_insight_prompts`)*

```
## ROLE
Senior financial analyst summarizing a dashboard section for a senior director at Hoi-Yong (Malaysian fruit distribution).

## DATA INTEGRITY
- Use numbers exactly as given in raw data blocks or tool results — never re-derive, back-solve, or invent. Sub-period averages: copy from "Pre-calculated half-period averages" lines.
- Match the Scope line (period / snapshot / fiscal). Format RM with thousands separators (RM 5,841,378); rounding OK (→ RM 2.29M).
- Apply each component's About block as the authority on good/neutral/bad — never invent thresholds.
- If data is insufficient, say so.

## TOOL ACCESS
- Query the DB for evidence behind findings — name the drivers (customers, products, months, agents). Max 4 calls; stop when you have enough.
- Don't re-query data already in the raw data blocks.
- Prefer pre-aggregated `pc_*` tables. Use `dbo.*` only for document-level drill-down (invoices, cash sales, credit notes, AR invoices/payments, knock-offs); each tool's schema is authoritative — never assume other columns exist. `dbo.*` queries for IV/CS/CN/ARInvoice/ARPayment must include `Cancelled = 'F'`.

## OUTPUT

### Delimiter format
Use this EXACT structure (no JSON, no code blocks):

===INSIGHT===
sentiment: good|bad
title: Punchy headline (max 50 chars; lead with the noun and the change, not the verb — "12% decline in net sales" beats "Net sales has declined 12%")
metric: Key number e.g. 84.3%, 43 days, RM 2.1M (max 25 chars)
summary: One plain-text sentence — card preview (max 80 chars, no markdown)
---DETAIL---
Concise markdown analysis (~150 words soft cap)
===END===

Max 3 good + 3 bad insights total. Rank by business impact.

### Detail structure (ALL subsections mandatory, in this order)
1. **Current Status** — ONE prose sentence (max 30 words) framing the headline number and scope. Not bullets.
2. **Key Observations** — 2–3 bullets with specific numbers/dates. Each bullet leads with a bold pattern label.
3. **Evidence** (positive insights) or **Root Cause** (negative insights) — top 3–5 contributors. Use a Markdown table (min 3 rows) when top-N data is available; otherwise 3–5 bullets.
4. **Implication** — 1 bullet stating the bottom-line consequence; name a decision the director must make if applicable. Do not recommend.

### Style
- Use exact dashboard metric names (as in the component name headers). Synthesize across components — don't repeat each component's individual story. No contradicting good/bad insights on the same metric. State facts, not recommendations; no jargon, no filler.
- If a "General" block is provided, follow its guidance. If it includes an "Output Override", apply that override in place of the Detail structure above.
```

---

## USER message
*(constructed by `buildSummaryUserPrompt` in [prompts.ts:161-227](apps/dashboard/src/lib/ai-insight/prompts.ts#L161-L227))*

```
Section: Outstanding Payment
Page: Payment
Scope: Snapshot — current state
Generated: 2026-05-07 15:39

General:
Lean into aging concentration (how much sits in the worst buckets), credit-limit breaches, and the 3–5 customers driving most of the exposure.

---

Below is the ABOUT and RAW DATA for each component in this section.
- ABOUT describes the component's role in the dashboard and is the authority on good / neutral / bad.
- RAW DATA is what the dashboard shows the user. Every number you cite must be traceable to a specific line in a Raw Data block or a tool-call result.

### Component 1: Total Outstanding (kpi)

About:
"""
"Total Outstanding" KPI — sum of all unpaid invoices to date (snapshot, ignores date range).

No fixed threshold. Evaluate vs total invoicing volume and trend direction. Growing outstanding alongside flat or declining sales = red flag.
"""

Raw Data:
Scope: SNAPSHOT — current state as of 2026-04-23.

Value: RM 11,349,862.52

Top 5 contributors (48.4% of total):
| Rank | Customer | Outstanding | % of Total |
|------|----------|-------------|------------|
| 1 | MY HERO HYPERMARKET SDN BHD | RM 2,112,369.4 | 18.6% |
| 2 | MLF TRADING SDN BHD | RM 1,137,069 | 10.0% |
| 3 | WONDERFRUITS & VEGETABLES IMPORT AND EXPORT(M) S/B | RM 1,079,871.1 | 9.5% |
| 4 | LO SIEW LIN SDN BHD | RM 807,239.1 | 7.1% |
| 5 | SEASONS AGRO SDN BHD | RM 351,476 | 3.1% |

### Component 2: Overdue Amount (kpi)

About:
"""
"Overdue Amount" KPI — portion of total outstanding past due date, with % of total and customer count.

Thresholds (overdue % of outstanding):
- <20% = acceptable
- 20–40% = warning
- >40% = critical

Report: % of total, count of overdue customers vs active, concentration (few large vs spread across many).
"""

Raw Data:
Scope: SNAPSHOT — current state as of 2026-04-23.

Value: RM 11,349,862.52
Percentage of total: 100.0%
Overdue customers: 227
Total customers: 227

Top 5 overdue customers:
| Rank | Customer | Overdue Amount | Max Overdue Days | % of Overdue |
|------|----------|----------------|-------------------|--------------|
| 1 | MY HERO HYPERMARKET SDN BHD | RM 2,112,369.4 | 440 days | 18.6% |
| 2 | MLF TRADING SDN BHD | RM 1,137,069 | 203 days | 10.0% |
| 3 | WONDERFRUITS & VEGETABLES IMPORT AND EXPORT(M) S/B | RM 1,079,871.1 | 232 days | 9.5% |
| 4 | LO SIEW LIN SDN BHD | RM 807,239.1 | 237 days | 7.1% |
| 5 | SEASONS AGRO SDN BHD | RM 351,476 | 165 days | 3.1% |

### Component 3: Credit Limit Breaches (kpi)

About:
"""
"Credit Limit Breaches" KPI — count of active customers with outstanding > credit limit (customers with limit > 0 only).

Thresholds:
- 0 = Good
- >0 = Concern

If breaches exist, use tools to identify which customers and by how much. A few large breaches = more severe than many small ones.
"""

Raw Data:
Scope: SNAPSHOT — current state as of 2026-04-23.

Value: 21 customers
Color: Red (Concern)

Top 10 breaching customers (of 21) by utilization:
| Rank | Customer | Credit Limit | Outstanding | Utilization |
|------|----------|--------------|-------------|-------------|
| 1 | SEASONS AGRO SDN BHD | RM 30,000 | RM 351,476 | 1172% |
| 2 | CS 88 FRUITS SDN BHD  | RM 20,000 | RM 118,719 | 594% |
| 3 | YZ VEGE GROUP SDN. BHD. | RM 20,000 | RM 52,807 | 264% |
| 4 | ST ROSYAM MART SDN BHD (SEMENYIH) | RM 30,000 | RM 75,170.47 | 251% |
| 5 | T & T FRESH SDN BHD  | RM 100,000 | RM 246,369.06 | 246% |
| 6 | SECRET RECIPE MANUFACTURING SDN. BHD. | RM 100,000 | RM 238,380 | 238% |
| 7 | FEUNG SEN ENTERPRISE (K. KEMUNING)*old* | RM 25,000 | RM 58,945.4 | 236% |
| 8 | JDL FRUIT SDN. BHD. (LONPAC) | RM 50,000 | RM 115,221.73 | 230% |
| 9 | LUEN SENG FRUITS STALL | RM 30,000 | RM 60,494.87 | 202% |
| 10 | PHOENIX SERIES (S) SDN. BHD. | RM 100,000 | RM 195,588 | 196% |

### Component 4: Aging Analysis (chart)

About:
"""
"Aging Analysis" horizontal bar chart — outstanding by overdue bucket. Also viewable by Sales Agent and Customer Type.

Buckets (healthiest → most critical):
- Not Yet Due
- 1–30 days
- 31–60 days
- 61–90 days
- 91–120 days
- 120+ days (write-off risk)

Report:
- "Not Yet Due" share vs overdue
- Skew toward older (bad) vs newer (ok) buckets
- Size of 120+ bucket (potential bad debt)
"""

Raw Data:
Scope: SNAPSHOT — current state as of 2026-04-23.

Data:
| Bucket | Amount | % of Total | Invoices |
|--------|--------|-----------|----------|
| 120+ | RM 11,349,862.52 | 100.0% | 3376 |

Total Outstanding: RM 11,349,862.52

### Component 5: Credit Usage Distribution (chart)

About:
"""
"Credit Usage Distribution" donut chart — customers grouped by how much of their credit limit they're using.

Categories:
- Within Limit (<80%) = healthy
- Near Limit (≥80% and <100%) = watch
- Over Limit (>100%) = policy breach
- No Limit Set = uncontrolled risk

Report: % over/near limit, count with no limit set, whether the Over Limit segment is growing.
"""

Raw Data:
Scope: SNAPSHOT — current state as of 2026-04-23.

Categories:
- Within Limit (< 80%): 300 customers
- Near Limit (80-99%): 10 customers
- Over Limit (>= 100%): 21 customers
- No Limit Set: 34 customers
Total: 365 customers

### Component 6: Customer Credit Health (table)

About:
"""
"Customer Credit Health" table — per-customer view: Code, Name, Type, Agent, Credit Limit, Outstanding, Credit Used %, Aging Count, Oldest Due, Health Score (0–100), Risk Level (Low / Moderate / High).

Score formula and risk-tier cutoffs are configurable (app_settings.credit_score_v2). The data block carries the already-resolved risk_tier and credit_score per customer — treat them as authoritative; do not reverse-engineer the formula.

Report:
- Distribution across risk tiers (High vs Moderate vs Low counts and outstanding share)
- Top offenders by outstanding amount and risk score
- Patterns by customer type or sales agent
- Customers with high outstanding and no credit limit set

Focus on patterns and outliers — do not list every customer.
"""

Raw Data:
Scope: SNAPSHOT — current state as of 2026-04-23.

Summary:
- Total customers: 375

Risk distribution:
| Risk Tier | Count | % of Customers | Outstanding | % of Outstanding |
|-----------|-------|----------------|-------------|------------------|
| High | 29 | 8% | RM 6,587,822.96 | 58.0% |
| Moderate | 141 | 38% | RM 4,422,422.32 | 39.0% |
| Low | 205 | 55% | RM 339,617.24 | 3.0% |

Top 5 by outstanding amount:
| Customer | Outstanding | Score | Risk |
|----------|-------------|-------|------|
| MY HERO HYPERMARKET SDN BHD | RM 2,112,369.4 | 20.00 | High |
| MLF TRADING SDN BHD | RM 1,137,069 | 18.00 | High |
| WONDERFRUITS & VEGETABLES IMPORT AND EXPORT(M) S/B | RM 1,079,871.1 | 58.00 | Moderate |
| LO SIEW LIN SDN BHD | RM 807,239.1 | 21.00 | High |
| SEASONS AGRO SDN BHD | RM 351,476 | 30.00 | Moderate |

Top 5 by max overdue days (most delinquent):
| Customer | Max Overdue Days | Outstanding | Risk |
|----------|-------------------|-------------|------|
| PRIMA FRESH MART SDN. BHD. (CTOS) | 1873 days | RM 13,591.6 | Moderate |
| LEONG HING TRADING | 1850 days | RM 15,000 | Moderate |
| JACKMART MALAYSIA SDN. BHD.(LONPC / CTOS) | 1850 days | RM 3,261.1 | Moderate |
| JEA TRADING (LONPAC / CTOS) | 1795 days | RM 3,000.68 | Moderate |
| BL FRESH SDN BHD (LONPAC) | 1457 days | RM 4,401.5 | Moderate |

Top 5 by utilization % (most over credit limit):
| Customer | Utilization | Credit Limit | Outstanding | Risk |
|----------|-------------|--------------|-------------|------|
| SEASONS AGRO SDN BHD | 1172% | RM 30,000 | RM 351,476 | Moderate |
| CS 88 FRUITS SDN BHD  | 594% | RM 20,000 | RM 118,719 | High |
| YZ VEGE GROUP SDN. BHD. | 264% | RM 20,000 | RM 52,807 | High |
| ST ROSYAM MART SDN BHD (SEMENYIH) | 251% | RM 30,000 | RM 75,170.47 | High |
| T & T FRESH SDN BHD  | 246% | RM 100,000 | RM 246,369.06 | High |

Score Configuration:
- Weights: Utilization 60%, Overdue Days 10%, Timeliness 20%, Double Breach 10%
- Risk Thresholds: Score >= 75 = Low Risk, Score <= 23 = High Risk, between = Moderate

---

Produce the summary now using the ===INSIGHT=== delimiter format.
```
