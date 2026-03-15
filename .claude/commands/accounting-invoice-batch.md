---
description: "Generate invoices, send reminders, update AR. 2 commands, ~8 min."
argument-hint: [client batch or billing period]
allowed-tools: Read, Write, Bash, Task
---

# /accounting:invoice-batch — Invoice Batch Processing

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
[process] ─────────────────────────────────────── SEQUENTIAL
  ├── invoice-gen              → invoices.md
  └── email --invoice-reminders → reminders-sent.md
```

## Estimated: 3 credits, 8 minutes

## Execution

Load recipe: `recipes/accounting/invoice-batch.json`

Execute DAG groups in dependency order:
- If mode = "parallel": spawn multiple subagents simultaneously via Task tool
- If mode = "sequential": run commands one after another
- Wait for group completion before starting dependent groups

## Goal context

<goal>$ARGUMENTS</goal>
