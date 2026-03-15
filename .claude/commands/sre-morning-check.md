---
description: "SRE morning check — health, status, benchmark in parallel, 5 min"
argument-hint: [optional: service name or environment]
allowed-tools: Read, Write, Bash, Task
---

# /sre:morning-check — Morning Check

**IC super command** — chains 3 commands via DAG pipeline.

## Pipeline

```
PARALLEL: /health --all + /status + /benchmark --quick          (~5 min)
    |
OUTPUT: reports/sre/morning-check/
```

## Estimated: 3 credits, 5 minutes

## Execution

Load recipe: `recipes/sre/sre-morning-check.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
