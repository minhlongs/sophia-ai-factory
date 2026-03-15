---
description: "Market scan + competitor deep dive + positioning strategy. 4 commands, ~25 min."
argument-hint: [product context or goal]
---

# Competitive Intelligence

> Trigger: `/product:competitive-intel $ARGUMENTS`
> Estimated: ~25 min

## Execution

Load recipe: `recipes/product/competitive-intel.json`

Run the DAG workflow:

### Market Scan (parallel)
- `competitor`
- `market-analysis`

### Positioning (sequential)
- `pricing`
- `swot`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/competitive-intel`
5. Report completion with summary
