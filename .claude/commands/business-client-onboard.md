---
description: "New client setup — contract, project setup, kickoff deck, schedule. 4 commands, ~15 min."
argument-hint: [business context or goal]
---

# Client Onboarding

> Trigger: `/business:client-onboard $ARGUMENTS`
> Estimated: ~15 min

## Execution

Load recipe: `recipes/business/client-onboard.json`

Run the DAG workflow:

### Contract & Agreement (parallel)
- `agreement`
- `client`

### Project Kickoff (sequential)
- `project-management`
- `schedule`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/onboarding`
5. Report completion with summary
