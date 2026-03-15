---
description: "Channel audit, performance analysis, optimization plan. 3 commands, ~12 min."
argument-hint: [channels or product to optimize]
allowed-tools: Read, Write, Bash, Task
---

# /growth:channel-optimize — Channel Optimization

**IC super command** — chains 3 commands via DAG pipeline.

## Pipeline

```
[audit] ──────────────────────────────────────── PARALLEL
  ├── ads --audit              → ads-audit.md
  └── seo --audit              → seo-audit.md
         │
         ▼
[optimize] ────────────────────────────────────── SEQUENTIAL
  └── marketing-plan --optimize → optimization-plan.md
```

## Estimated: 8 credits, 12 minutes

## Execution

Load recipe: `recipes/growth/channel-optimize.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
