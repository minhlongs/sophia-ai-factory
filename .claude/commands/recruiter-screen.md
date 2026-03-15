---
description: "Resume analysis, score candidates, interview questions. 2 commands, ~8 min."
argument-hint: [candidate name or batch]
allowed-tools: Read, Write, Bash, Task
---

# /recruiter:screen — Candidate Screening

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
[process] ─────────────────────────────────────── SEQUENTIAL
  ├── performance-review --candidate → candidate-scores.md
  └── schedule --interviews    → interview-schedule.md
```

## Estimated: 5 credits, 8 minutes

## Execution

Load recipe: `recipes/recruiter/screen.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
