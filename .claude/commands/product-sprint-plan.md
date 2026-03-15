---
description: "Backlog grooming → sprint scope → task breakdown → assignments. 4 commands, ~20 min."
argument-hint: [product context or goal]
---

# Sprint Planning

> Trigger: `/product:sprint-plan $ARGUMENTS`
> Estimated: ~20 min

## Execution

Load recipe: `recipes/product/sprint-plan.json`

Run the DAG workflow:

### Backlog Grooming (parallel)
- `feedback`
- `roadmap`

### Sprint Definition (sequential)
- `sprint`
- `estimate`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/sprint`
5. Report completion with summary
