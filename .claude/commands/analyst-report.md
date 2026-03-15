---
description: "Data pull, analysis, executive summary. 2 commands, ~12 min."
argument-hint: [market, segment, or topic to analyze]
allowed-tools: Read, Write, Bash, Task
---

# /analyst:report — Analyst Report

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
[process] ─────────────────────────────────────── SEQUENTIAL
  ├── market-analysis          → market-data.md
  └── general-report --executive → executive-summary.md
```

## Estimated: 5 credits, 12 minutes

## Execution

Load recipe: `recipes/analyst/report.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
