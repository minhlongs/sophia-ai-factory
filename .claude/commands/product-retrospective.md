---
description: "Review sprint → gather feedback → improvement plan → next sprint prep. 3 commands, ~15 min."
argument-hint: [product context or goal]
---

# Sprint Retrospective

> Trigger: `/product:retrospective $ARGUMENTS`
> Estimated: ~15 min

## Execution

Load recipe: `recipes/product/retrospective.json`

Run the DAG workflow:

### Review Performance (parallel)
- `retrospective`
- `feedback`

### Improvement Plan (sequential)
- `standup`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/retro`
5. Report completion with summary
