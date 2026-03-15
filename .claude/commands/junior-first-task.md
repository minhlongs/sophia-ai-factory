---
description: "Junior first task — codebase overview, starter issue, guided implementation in 15 min"
argument-hint: [task or area of interest]
allowed-tools: Read, Write, Bash, Task
---

# /junior:first-task — First Task

**IC super command** — chains 3 commands via DAG pipeline.

## Pipeline

```
SEQUENTIAL: /docs-readme → /kanban --good-first-issue           (~8 min)
    |
SEQUENTIAL: /cook --guided                                       (~7 min)
    |
OUTPUT: reports/junior/first-task/
```

## Estimated: 5 credits, 15 minutes

## Execution

Load recipe: `recipes/junior/junior-first-task.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
