---
description: "Lead qualify & handoff — score lead then prep AE handoff brief. 2 commands, ~8 min."
argument-hint: [lead-name-or-company]
allowed-tools: Read, Write, Bash, Task
---

# /sdr:lead-qualify — Lead Qualify & Handoff

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
SEQUENTIAL: /customer-research --qualify
    |
SEQUENTIAL: /pipeline --handoff
    |
OUTPUT: reports/sdr/qualify/
        qualification-scorecard.md
        ae-handoff-brief.md
        QUALIFY-SUMMARY.md
```

## Trigger

Runs recipe `recipes/sdr/sdr-lead-qualify.json` through DAGScheduler.

## Execution

1. Read recipe DAG definition
2. Run /customer-research --qualify first (mode: sequential)
3. Run /pipeline --handoff using qualification output as context
4. Compile into QUALIFY-SUMMARY.md with BANT analysis and AE brief

## Usage

```
/sdr:lead-qualify [lead-name-or-company]
```

## Estimated: 5 credits, 8 minutes

## Goal context
<goal>$ARGUMENTS</goal>

Pass this goal to every sub-command as context for their analysis.
