---
description: "Welcome email, access setup, day-1 schedule. 2 commands, ~5 min."
argument-hint: [new hire name or start date]
allowed-tools: Read, Write, Bash, Task
---

# /people:onboard — Employee Onboarding

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
[process] ─────────────────────────────────────── PARALLEL
  ├── email --welcome          → welcome-email.md
  └── schedule --first-week    → day-1-schedule.md
```

## Estimated: 3 credits, 5 minutes

## Execution

Load recipe: `recipes/people/onboard.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
