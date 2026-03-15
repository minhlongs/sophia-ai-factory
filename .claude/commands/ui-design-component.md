---
description: "Spec, design, implement, responsive check. 2 commands, ~12 min."
argument-hint: [component name or description]
allowed-tools: Read, Write, Bash, Task
---

# /ui:design-component — Component Design & Build

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
[process] ─────────────────────────────────────── SEQUENTIAL
  ├── component                → component-spec.md
  └── cook --component         → implementation.md
```

## Estimated: 5 credits, 12 minutes

## Execution

Load recipe: `recipes/ui/design-component.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
