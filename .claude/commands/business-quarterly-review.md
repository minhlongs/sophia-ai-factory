---
description: "QBR across all departments — revenue, expenses, KPIs, team, forecast. 6 commands, ~30 min."
argument-hint: [business context or goal]
---

# Quarterly Business Review

> Trigger: `/business:quarterly-review $ARGUMENTS`
> Estimated: ~30 min

## Execution

Load recipe: `recipes/business/quarterly-review.json`

Run the DAG workflow:

### Financial Snapshot (parallel)
- `revenue`
- `cashflow`
- `expense`

### Performance Review (parallel)
- `performance-review`
- `pipeline`

### Forward Planning (sequential)
- `forecast`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/qbr`
5. Report completion with summary
