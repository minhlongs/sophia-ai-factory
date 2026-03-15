---
description: "Pull actuals, compare, update model, variance report. 2 commands, ~8 min."
argument-hint: [period or model to update]
allowed-tools: Read, Write, Bash, Task
---

# /analyst:forecast-update — Forecast Update

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
[process] ─────────────────────────────────────── SEQUENTIAL
  ├── forecast --update        → forecast-model.md
  └── financial-report --variance → variance-report.md
```

## Estimated: 5 credits, 8 minutes

## Execution

Load recipe: `recipes/analyst/forecast-update.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
