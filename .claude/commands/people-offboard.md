---
description: "Exit checklist, access revocation, knowledge transfer. 2 commands, ~5 min."
argument-hint: [departing employee name or last day]
allowed-tools: Read, Write, Bash, Task
---

# /people:offboard — Employee Offboarding

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
[process] ─────────────────────────────────────── SEQUENTIAL
  ├── hr-management --offboard → exit-checklist.md
  └── handoff                  → knowledge-transfer.md
```

## Estimated: 3 credits, 5 minutes

## Execution

Load recipe: `recipes/people/offboard.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
