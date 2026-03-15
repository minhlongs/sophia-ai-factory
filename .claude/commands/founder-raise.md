---
description: "Complete fundraise preparation — from unit economics to investor targeting. 8 commands, ~45 min."
argument-hint: [founder context or goal]
---

# Fundraise Pipeline

> Trigger: `/founder:raise $ARGUMENTS`
> Estimated: ~45 min

## Execution

Load recipe: `recipes/founder/raise.json`

Run the DAG workflow:

### Validate Fundamentals (parallel)
- `unit-economics`
- `tam`
- `moat-audit`

### Prepare Materials (parallel)
- `financial-model`
- `data-room`

### Position & Target (sequential)
- `founder-vc-cap-table`
- `founder-pitch`
- `founder-vc-map`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/raise-ready-kit`
5. Report completion with summary
