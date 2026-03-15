---
description: "Backend API build — schema, implement, test, docs. Full API cycle in 12 min"
argument-hint: [API endpoint or resource name]
allowed-tools: Read, Write, Bash, Task
---

# /backend:api-build — API Build

**IC super command** — chains 3 commands via DAG pipeline.

## Pipeline

```
SEQUENTIAL: /schema → /cook --api → /test --api                 (~12 min)
    |
OUTPUT: reports/backend/api-build/
```

## Estimated: 8 credits, 12 minutes

## Execution

Load recipe: `recipes/backend/backend-api-build.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
