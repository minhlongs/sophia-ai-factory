---
description: "Interview script, discussion guide, insight synthesis. 2 commands, ~10 min."
argument-hint: [user segment or research question]
allowed-tools: Read, Write, Bash, Task
---

# /ux:interview — UX Interview

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
[process] ─────────────────────────────────────── SEQUENTIAL
  ├── persona --interview-guide → interview-script.md
  └── brainstorm               → insight-synthesis.md
```

## Estimated: 5 credits, 10 minutes

## Execution

Load recipe: `recipes/ux/interview.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
