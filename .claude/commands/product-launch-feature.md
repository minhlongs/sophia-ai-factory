---
description: "Spec → build → test → ship → announce. 5 commands, ~40 min."
argument-hint: [product context or goal]
---

# Feature Launch Pipeline

> Trigger: `/product:launch-feature $ARGUMENTS`
> Estimated: ~40 min

## Execution

Load recipe: `recipes/product/launch-feature.json`

Run the DAG workflow:

### Specification (sequential)
- `scope`
- `proposal`

### Build & Test (sequential)
- `cook`
- `test`

### Ship & Announce (sequential)
- `handoff`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/feature-launch`
5. Report completion with summary
