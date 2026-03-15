---
description: "Meeting follow-up — follow-up email + next steps scheduled in parallel. 2 commands, ~5 min."
argument-hint: [meeting-summary-or-deal-name]
allowed-tools: Read, Write, Bash, Task
---

# /ae:follow-up — Meeting Follow-Up

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
PARALLEL: /email --follow-up + /schedule --next-steps
    |
OUTPUT: reports/ae/follow-up/
        follow-up-email.md
        next-steps.md
        FOLLOW-UP-SUMMARY.md
```

## Trigger

Runs recipe `recipes/ae/ae-follow-up.json` through DAGScheduler.

## Execution

1. Read recipe DAG definition
2. Spawn both subagents simultaneously via Task tool (mode: parallel)
3. Wait for both to complete
4. Compile into FOLLOW-UP-SUMMARY.md with send-ready email and calendar items

## Usage

```
/ae:follow-up [meeting-summary-or-deal-name]
```

## Estimated: 3 credits, 5 minutes

## Goal context
<goal>$ARGUMENTS</goal>

Pass this goal to every sub-command as context for their analysis.
