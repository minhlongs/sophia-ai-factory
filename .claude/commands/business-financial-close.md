---
description: "Monthly/quarterly close — reconcile, report, forecast, tax prep. 5 commands, ~25 min."
argument-hint: [business context or goal]
---

# Financial Close

> Trigger: `/business:financial-close $ARGUMENTS`
> Estimated: ~25 min

## Execution

Load recipe: `recipes/business/financial-close.json`

Run the DAG workflow:

### Reconciliation (parallel)
- `revenue`
- `expense`
- `invoice`

### Financial Statements (sequential)
- `financial-report`
- `tax`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/financial-close`
5. Report completion with summary
