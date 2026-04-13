# Dashboard AI Insight Analysis — Concept

We already nailed down the Finance requirement in `/apps` and documented it in `docs/prd`. It's almost ready for PRD. But actually, there is one more piece we need to work on. It's related to the AI portion.

**Focus → AI Insights Analysis**

---

## Reference Images

| Image | Description |
|-------|-------------|
| Image 1 | Payment Page (with section) |
| Image 2 | Sales Page (without section) — add a section header with title so it can have a collapsible AI Panel |
| Image 3 | Icon to open dialog for individual dashboard component |
| Image 4 | AI Insight Analysis Panel (never run insight before) |
| Image 5 | AI Insight Analysis Panel (analyzing… in process) |
| Image 6 | Dialog popup — analysis for each KPI, Chart, & Table |
| Image 7 | Dialog popup — after clicking an insight in the AI Panel |

---

## 1. Idea

- This is like having an analyst in the dashboard explaining and giving insight into what the user is seeing.
- The Insight Panel is **by page section** — not the entire page — to keep the insight focused, unless there is no section for that page.
- The plan is to use the documentation in `docs/prd` for the prompt.
- We are using the **Claude SDK** as our agentic agent instead of a normal LLM single prompt.
- We want the AI Agent to explore the data (both pre-calculated tables and get more breakdown from the remote RDS).
- We **cannot** expose sensitive data to AI, so we limit what columns it can read.

> **Note:** Since we are using the section dropdown as the AI Insight Panel, what happens to pages without one? We add a **Section Header** with no section name.

---

## 2. Behaviors & Persistence

- When insight is generated, it is stored in the DB. It persists and all users logged in on different browsers can see it.
- Any user role can run it. We need the "last update" metadata.
- Metadata to include in the panel:
  - Run time
  - Token cost
  - Last updated
  - By whom
- **Concurrent runs:** If 2 or more users run/generate at the same time, only one user can generate the insight. Block the other user from running with a message on the panel.
- **Cancellation:** When the AI Analyst is analyzing, the user can stop it halfway. The generate button turns into a stop button.

---

## 3. AI Engine

- **SDK:** Claude SDK
- **Model:** Latest Haiku model
- **Prompt setup:** To be discussed — user and system prompt
- **Insight tone:** Like an analyst explaining to a senior director — no jargon, straightforward, concise, and easy to understand. This needs to be added to the system prompt.
- **Limits:**
  - Runtime — 5 minutes max (directors can't wait very long)
  - Cost — $0.50 (50 cents) per run

---

## 4. UI & Output Format

### 4.1 AI Panel (High-Level Summary — Good & Bad Insights)

- When clicking the generate button, the user can see progress as log output on the panel showing what is going on.
- If never generated before, it will show its own message (e.g., "No insights yet").
- The Section Header has a dropdown to view the AI Insight Analysis Panel.
- Bad insights are highlighted in **red**; good insights in **green**.
- Clicking an insight opens a **dialog popup** explaining the insight with evidence.
- This means the insight needs to be brief (one line), and then the user clicks to show the popup dialog with a more detailed explanation and evidence.

### 4.2 Individual Dashboard Component

- Each KPI, Chart, and Table has an **analyze icon** (see Image 3 & Image 6).
- Clicking the icon opens a dialog popup with:
  - What the component is about (info from `docs/prd`)
  - Formula
  - Good/bad indicator
  - AI-generated analysis

---

## 5. AI Insight Analysis Flow

### a. Define the Scope of Analysis

By section for pages that have sections; otherwise, the entire page.

### b. Get Insights for Each Dashboard Component (KPI, Table, and Chart)

Taking the **Payment Page** as an example:

- **Scope:** Payment Collection Trend
- **Round 1:** KPI — Avg Collection Days
  - Build the necessary prompt
  - **System prompt →** Tone & what this KPI is about (already clearly documented in `docs/prd`)
  - **User prompt →** Value/data passed to the dashboard, e.g., Avg Collection Days = 44 days
  - Save the output
- Repeat for all remaining KPIs, Charts, and Tables.

> **Why each dashboard component separately?** Each KPI, Table, and Chart has its own analyze icon. When clicked, it provides an explanation for that specific component (meaning, formula, good/bad indicator — sourced from `docs/prd`, the same info used in the system prompt) and the analysis together. Hitting 2 birds with one stone - for each dashboard component + High level summary for AI Panel

### c. Generate High-Level Summary

Once we already have all the insights for each KPI, Chart, and Table, we use those to ask the AI to generate a **high-level summary** and label each insight as **good** or **bad**.
