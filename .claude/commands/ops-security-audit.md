---
description: "Dependency scan → code audit → config review → remediation plan. 3 commands, ~20 min."
argument-hint: [ops context or goal]
---

# Security Audit

> Trigger: `/ops:security-audit $ARGUMENTS`
> Estimated: ~20 min

## Execution

Load recipe: `recipes/ops/security-audit.json`

Run the DAG workflow:

### Security Scan (parallel)
- `security`
- `audit`

### Remediation (sequential)
- `fix`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/security-audit`
5. Report completion with summary
