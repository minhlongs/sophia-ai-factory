---
description: "Close report — win/loss analysis then CRM update. 2 commands, ~5 min."
argument-hint: [deal-name-and-outcome]
allowed-tools: Read, Write, Bash, Task
---

# /ae:close-report — Close Report

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
SEQUENTIAL: /close
    |
SEQUENTIAL: /crm --update
    |
OUTPUT: reports/ae/close/
        win-loss-analysis.md
        crm-update.md
        CLOSE-REPORT-SUMMARY.md
```

## Trigger

Runs recipe `recipes/ae/ae-close-report.json` through DAGScheduler.

## Execution

1. Read recipe DAG definition
2. Run /close first (mode: sequential) to produce win/loss analysis
3. Run /crm --update using analysis output as context
4. Compile into CLOSE-REPORT-SUMMARY.md with lessons learned and CRM fields

## Usage

```
/ae:close-report [deal-name-and-outcome]
```

## Estimated: 3 credits, 5 minutes

## Goal context
<goal>$ARGUMENTS</goal>

Pass this goal to every sub-command as context for their analysis.
