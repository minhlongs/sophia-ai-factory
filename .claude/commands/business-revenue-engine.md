---
description: "Build complete revenue pipeline — leads, CRM, sales, invoicing, analytics. 7 commands, ~40 min."
argument-hint: [business context or goal]
---

# Revenue Engine Setup

> Trigger: `/business:revenue-engine $ARGUMENTS`
> Estimated: ~40 min

## Execution

Load recipe: `recipes/business/revenue-engine.json`

Run the DAG workflow:

### Market & Pipeline Research (parallel)
- `market-analysis`
- `customer-research`
- `competitor`

### Build Sales Pipeline (parallel)
- `pipeline`
- `leadgen`

### Operationalize (sequential)
- `crm`
- `sales`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/revenue-engine`
5. Report completion with summary
