# Tech Lead Tips — AI Insight Optimization

Source: Team lead's parallel project (Haiku-only, reliable results)

---

## 1. Optimize the Prompt (Input)

Split into 3 parts:
- **System prompt** — Same for all insights. Persona + global rules. He said "make this a skill" (unclear if Anthropic feature or just reusable module — need to clarify).
- **User prompt 1** — Context about the info + tools that can be used (unique per insight type)
- **User prompt 2** — Pass the data

Create compact prompt with high-quality inputs. Wrap everything into JSON structure before passing to LLM.

## 2. Optimize Tooling

- If the AI can narrate/interpret using only data in the prompt, no need for tools.
- Study tooling and optimize — provide quality data, don't overwhelm.
- Use minimum tooling and API calls. Give a sequence of tools; if sufficient context, no need to search further.
- Combine and reduce tooling, narrow the columns. All tooling is SQL queries.

## 3. Reduce the API Calls

Minimize total LLM round-trips per analysis click.

## 4. Optimize the Output

Fixed JSON output format (input JSON, output JSON) to control token usage on the response side. Two output schemas:
- Individual dashboard component insight
- AI Panel — negative and positive insights

## 5. Combine Component Calls (Key Insight)

Instead of one LLM call per KPI/table/chart, combine into ONE call. Since output is JSON, match keys to the right component. Pass all relevant data, all pre-computed/aggregated, so Haiku doesn't need to compute anything — and no tooling needed since all info is provided.

Reminder: Dashboard component insight is just narrate/interpret what the user sees.

---

## My Assessment of These Tips

| Tip | Valid? | Notes |
|-----|--------|-------|
| #1 Split prompts | Yes | Aligns with prompt caching strategy. 3-part split maximizes cache-able prefix. "Skill" likely means reusable prompt module, not Anthropic feature. |
| #2 Eliminate tools | Yes | Our `payment_outstanding` has tool policy `'full'` but tools often re-query already-fetched data. Pre-fetch everything. |
| #3 Reduce API calls | Yes | Currently 7 calls (6 components + 1 summary). Tip #5 reduces to 2 (1 combined component + 1 summary) or even 1. |
| #4 JSON output | Partially | JSON output helps parse reliably. JSON input — test it; markdown tables may actually be clearer for financial data. Don't assume JSON is always better. |
| #5 Combine components | Yes, biggest win | This is the highest-impact change. System prompt sent once instead of 7 times. Eliminates per-call overhead. But: test quality — one large prompt vs six focused prompts may produce different quality. |
