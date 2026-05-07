# Quality Rubric — AI Insight Scoring

> Score each run's output against this rubric. Maximum total: 10 points.

## Sub-scores

### Numeric Accuracy (0-3)

| Score | Criteria |
|-------|----------|
| 3 | All numbers match expected_values.json exactly (within rounding tolerance: RM +/-1, pct +/-0.1) |
| 2 | 1-2 minor discrepancies (e.g., rounding differences in derived percentages) |
| 1 | 3+ discrepancies or 1 significant error (wrong order of magnitude, wrong customer name) |
| 0 | Hallucinated numbers present (values not in input data or tool results) |

### Relevance (0-3)

| Score | Criteria |
|-------|----------|
| 3 | Insights address the most important findings in the data. Good/bad sentiment correctly assigned. |
| 2 | Mostly relevant but misses one key finding or includes minor irrelevant observations |
| 1 | Partially relevant — misses major findings or focuses on minor details |
| 0 | Off-topic or misleading conclusions |

### Actionability (0-2)

| Score | Criteria |
|-------|----------|
| 2 | Names specific customers, amounts, and root causes. Director knows what to act on. |
| 1 | Identifies problems but vague on specifics (e.g., "some customers" without naming them) |
| 0 | Generic observations with no actionable information |

### Clarity (0-2)

| Score | Criteria |
|-------|----------|
| 2 | Well-structured, scannable. Follows the detail template (Current Status, Key Observations, Root Cause, Implication). No jargon. |
| 1 | Readable but poorly structured or overly verbose |
| 0 | Confusing, contradictory, or wall-of-text |

## Scoring Process

1. Read the insight output (both good and bad insights)
2. Cross-check every number against expected_values.json
3. Assign sub-scores independently for EACH run (2 runs per iteration)
4. Total = sum of 4 sub-scores (max 10) per run
5. Record both per-run scores AND the median in the iteration doc
6. If Run 1 and Run 2 totals differ by ≥ 2 points, add a Run 3 to break the tie

## Pass / Fail Thresholds

- **Production-ready:** >= 8/10 AND numeric accuracy = 3 AND hallucination count = 0
- **Acceptable:** >= 7/10 AND hallucination count = 0
- **Fail:** < 7/10 OR any hallucinated numbers
