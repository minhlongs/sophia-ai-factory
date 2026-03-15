---
description: "Scaffold → implement → test → deploy. New microservice from zero. 6 commands, ~45 min."
argument-hint: [engineering context or goal]
---

# New Service Bootstrap

> Trigger: `/engineering:new-service $ARGUMENTS`
> Estimated: ~45 min

## Execution

Load recipe: `recipes/engineering/new-service.json`

Run the DAG workflow:

### Architecture & Design (sequential)
- `arch`
- `schema`

### Implement (sequential)
- `cook`
- `api`

### Test & Deploy (sequential)
- `test`
- `deploy-staging`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/new-service`
5. Report completion with summary
