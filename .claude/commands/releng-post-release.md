---
description: "Release post-release — smoke prod, health check, announce in 5 min"
argument-hint: [version number or release notes]
allowed-tools: Read, Write, Bash, Task
---

# /releng:post-release — Post-Release

**IC super command** — chains 3 commands via DAG pipeline.

## Pipeline

```
PARALLEL: /smoke --prod + /health --all                         (~3 min)
    |
SEQUENTIAL: /email --release-notes                              (~2 min)
    |
OUTPUT: reports/releng/post-release/
```

## Estimated: 3 credits, 5 minutes

## Execution

Load recipe: `recipes/releng/releng-post-release.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
