---
description: "Backend DB task — schema change, migration, seed, verify in 10 min"
argument-hint: [schema change or migration description]
allowed-tools: Read, Write, Bash, Task
---

# /backend:db-task — DB Task

**IC super command** — chains 3 commands via DAG pipeline.

## Pipeline

```
SEQUENTIAL: /migrate → /seed → /test --db                       (~10 min)
    |
OUTPUT: reports/backend/db-task/
```

## Estimated: 5 credits, 10 minutes

## Execution

Load recipe: `recipes/backend/backend-db-task.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
