---
description: "Frontend responsive fix — audit breakpoints, fix issues, test viewports in 8 min"
argument-hint: [page or component with responsive issues]
allowed-tools: Read, Write, Bash, Task
---

# /frontend:responsive-fix — Responsive Fix

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
SEQUENTIAL: /fix --responsive → /e2e-test --viewports           (~8 min)
    |
OUTPUT: reports/frontend/responsive-fix/
```

## Estimated: 5 credits, 8 minutes

## Execution

Load recipe: `recipes/frontend/frontend-responsive-fix.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
