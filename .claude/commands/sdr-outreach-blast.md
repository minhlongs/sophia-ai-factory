---
description: "Outreach blast — cold emails + LinkedIn messages in parallel. 2 commands, ~8 min."
argument-hint: [lead-list-or-target-persona]
allowed-tools: Read, Write, Bash, Task
---

# /sdr:outreach-blast — Outreach Blast

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
PARALLEL: /email --cold-outreach + /social --linkedin
    |
OUTPUT: reports/sdr/outreach/
        cold-emails.md
        linkedin-messages.md
        OUTREACH-SUMMARY.md
```

## Trigger

Runs recipe `recipes/sdr/sdr-outreach-blast.json` through DAGScheduler.

## Execution

1. Read recipe DAG definition
2. Spawn both subagents simultaneously via Task tool (mode: parallel)
3. Wait for both to complete
4. Compile outputs into OUTREACH-SUMMARY.md with send-ready package

## Usage

```
/sdr:outreach-blast [lead-list-or-target-persona]
```

## Estimated: 5 credits, 8 minutes

## Goal context
<goal>$ARGUMENTS</goal>

Pass this goal to every sub-command as context for their analysis.
