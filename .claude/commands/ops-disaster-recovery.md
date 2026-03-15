---
description: "Backup → test restore → verify integrity → document. 3 commands, ~15 min."
argument-hint: [ops context or goal]
---

# Disaster Recovery Test

> Trigger: `/ops:disaster-recovery $ARGUMENTS`
> Estimated: ~15 min

## Execution

Load recipe: `recipes/ops/disaster-recovery.json`

Run the DAG workflow:

### Backup & Verify (sequential)
- `health`

### Restore Test (sequential)
- `smoke`
- `report`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/disaster-recovery`
5. Report completion with summary
