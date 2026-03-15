---
description: "Release pre-release — full test suite, changelog, version bump, tag in 10 min"
argument-hint: [version number e.g. v1.2.0]
allowed-tools: Read, Write, Bash, Task
---

# /releng:pre-release — Pre-Release

**IC super command** — chains 3 commands via DAG pipeline.

## Pipeline

```
PARALLEL: /test --all + /docs-changelog                         (~6 min)
    |
SEQUENTIAL: /git-tag                                            (~4 min)
    |
OUTPUT: reports/releng/pre-release/
```

## Estimated: 5 credits, 10 minutes

## Execution

Load recipe: `recipes/releng/releng-pre-release.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
