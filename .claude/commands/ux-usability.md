---
description: "Usability test — test plan, task scenarios, findings, recommendations in 10 min"
argument-hint: [feature or flow to test]
allowed-tools: Read, Write, Bash, Task
---

# /ux:usability — Usability Test

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
SEQUENTIAL: /feedback --usability                                (~6 min)
    |
SEQUENTIAL: /general-report                                      (~4 min)
    |
OUTPUT: reports/ux/usability/findings.md
```

## Estimated: 5 credits, 10 minutes

## Execution

Load recipe: `recipes/ux/ux-usability.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
