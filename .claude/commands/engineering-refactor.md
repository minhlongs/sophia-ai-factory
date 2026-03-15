---
description: "Audit → plan → refactor → test → verify. Safe large-scale refactoring. 5 commands, ~40 min."
argument-hint: [engineering context or goal]
---

# Refactor Pipeline

> Trigger: `/engineering:refactor $ARGUMENTS`
> Estimated: ~40 min

## Execution

Load recipe: `recipes/engineering/refactor.json`

Run the DAG workflow:

### Analyze & Plan (parallel)
- `audit`
- `coverage`

### Refactor (sequential)
- `refactor`
- `test`

### Verify (sequential)
- `review`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/refactor`
5. Report completion with summary
