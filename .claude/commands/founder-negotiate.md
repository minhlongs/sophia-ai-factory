---
description: "Analyze term sheet + model dilution + plan negotiation strategy. 4 commands, ~20 min."
argument-hint: [founder context or goal]
---

# Deal Negotiation Kit

> Trigger: `/founder:negotiate $ARGUMENTS`
> Estimated: ~20 min

## Execution

Load recipe: `recipes/founder/negotiate.json`

Run the DAG workflow:

### Analyze Terms (parallel)
- `founder-vc-term-sheet`
- `dilution-sim`

### Counter-Strategy (sequential)
- `founder-vc-cap-table`
- `founder-vc-negotiate`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/negotiation`
5. Report completion with summary
