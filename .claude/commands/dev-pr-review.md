---
description: "PR review — code review and security check in parallel, 10 min"
argument-hint: [PR number or branch name]
allowed-tools: Read, Write, Bash, Task
---

# /dev:pr-review — PR Review

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
PARALLEL: /review + /security --pr                              (~10 min)
    |
OUTPUT: reports/dev/pr-review/
```

## Estimated: 5 credits, 10 minutes

## Execution

Load recipe: `recipes/dev/dev-pr-review.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
