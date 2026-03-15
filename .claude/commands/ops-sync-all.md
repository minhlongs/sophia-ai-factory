---
description: "Sync everything in parallel — agents, skills, MCP, artifacts, rules. 6 commands, ~10 min."
argument-hint: [ops context or goal]
---

# Full System Sync

> Trigger: `/ops:sync-all $ARGUMENTS`
> Estimated: ~10 min

## Execution

Load recipe: `recipes/ops/sync-all.json`

Run the DAG workflow:

### Parallel Sync (parallel)
- `sync-agent`
- `sync-providers`
- `sync-mcp`
- `sync-artifacts`
- `sync-rules`
- `sync-tasks`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/sync`
5. Report completion with summary
