---
description: "Audit components, check consistency, flag issues. 2 commands, ~8 min."
argument-hint: [component, page, or design system to review]
allowed-tools: Read, Write, Bash, Task
---

# /ui:design-review — Design Review

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
[process] ─────────────────────────────────────── SEQUENTIAL
  ├── review --design          → design-audit.md
  └── lint --css               → css-issues.md
```

## Estimated: 3 credits, 8 minutes

## Execution

Load recipe: `recipes/ui/design-review.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
