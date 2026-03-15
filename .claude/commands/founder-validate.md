---
description: "Validate business model before spending money — PMF, economics, market, moat. 5 commands, ~25 min."
argument-hint: [founder context or goal]
---

# Business Validation Sprint

> Trigger: `/founder:validate-sprint $ARGUMENTS`
> Estimated: ~25 min

## Execution

Load recipe: `recipes/founder/validate.json`

Run the DAG workflow:

### Market & Customer Research (parallel)
- `founder-validate`
- `tam`
- `swot`

### Economic Viability (parallel)
- `unit-economics`
- `moat-audit`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/validation`
5. Report completion with summary
