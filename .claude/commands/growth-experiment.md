---
description: "Growth experiment — experiment design then metrics framework. 2 commands, ~10 min."
argument-hint: [hypothesis-or-growth-area]
allowed-tools: Read, Write, Bash, Task
---

# /growth:experiment — Growth Experiment

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
SEQUENTIAL: /plan --experiment
    |
SEQUENTIAL: /kpi --experiment
    |
OUTPUT: reports/growth/experiment/
        experiment-design.md
        metrics-framework.md
        EXPERIMENT-SUMMARY.md
```

## Trigger

Runs recipe `recipes/growth/growth-experiment.json` through DAGScheduler.

## Execution

1. Read recipe DAG definition
2. Run /plan --experiment first (mode: sequential) to produce experiment design
3. Run /kpi --experiment using design as context to define success metrics
4. Compile into EXPERIMENT-SUMMARY.md as growth brief with hypothesis, variants, and decision criteria

## Usage

```
/growth:experiment [hypothesis-or-growth-area]
```

## Estimated: 5 credits, 10 minutes

## Goal context
<goal>$ARGUMENTS</goal>

Pass this goal to every sub-command as context for their analysis.
