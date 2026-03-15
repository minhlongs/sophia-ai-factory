---
description: "System-wide health audit — services, security, performance, sync status. 5 commands, ~15 min."
argument-hint: [ops context or goal]
---

# Full Health Sweep

> Trigger: `/ops:health-sweep $ARGUMENTS`
> Estimated: ~15 min

## Execution

Load recipe: `recipes/ops/health-sweep.json`

Run the DAG workflow:

### Full System Scan (parallel)
- `health`
- `security`
- `benchmark`
- `status`

### Compiled Report (sequential)
- `report`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/health-sweep`
5. Report completion with summary
