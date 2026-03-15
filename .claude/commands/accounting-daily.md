---
description: "Transaction review, categorize, reconcile, flag anomalies. 2 commands, ~8 min."
argument-hint: [date or period to reconcile]
allowed-tools: Read, Write, Bash, Task
---

# /accounting:daily — Daily Bookkeeping

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
[process] ─────────────────────────────────────── SEQUENTIAL
  ├── expense --review         → transactions.md
  └── cashflow --daily         → reconciliation.md
```

## Estimated: 3 credits, 8 minutes

## Execution

Load recipe: `recipes/accounting/daily.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
