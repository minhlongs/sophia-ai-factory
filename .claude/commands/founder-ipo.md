---
description: "18-month IPO readiness — audit, S-1, roadshow, day-of execution. 7 commands, ~60 min."
argument-hint: [founder context or goal]
---

# IPO Preparation Pipeline

> Trigger: `/founder:ipo $ARGUMENTS`
> Estimated: ~60 min

## Execution

Load recipe: `recipes/founder/ipo.json`

Run the DAG workflow:

### Readiness Audit (sequential)
- `founder-ipo-pre-ipo-prep`

### S-1 & Roadshow (parallel)
- `founder-ipo-s1`
- `founder-ipo-roadshow`

### Execution Plan (sequential)
- `founder-ipo-ipo-day`
- `founder-ipo-insider`
- `founder-ipo-public-co`
- `founder-ipo-succession`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/ipo`
5. Report completion with summary
