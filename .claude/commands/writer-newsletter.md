---
description: "Newsletter pipeline — draft content then generate subject lines. 2 commands, ~8 min."
argument-hint: [newsletter-topic-or-audience]
allowed-tools: Read, Write, Bash, Task
---

# /writer:newsletter — Newsletter Pipeline

**IC super command** — chains 2 commands via DAG pipeline.

## Pipeline

```
SEQUENTIAL: /content --newsletter
    |
SEQUENTIAL: /email --newsletter
    |
OUTPUT: reports/writer/newsletter/
        newsletter-draft.md
        subject-lines.md
        NEWSLETTER-SUMMARY.md
```

## Trigger

Runs recipe `recipes/writer/writer-newsletter.json` through DAGScheduler.

## Execution

1. Read recipe DAG definition
2. Run /content --newsletter first (mode: sequential) to produce body copy
3. Run /email --newsletter using draft as context to generate subject lines
4. Compile into NEWSLETTER-SUMMARY.md as send-ready package with 5 ranked subject lines

## Usage

```
/writer:newsletter [newsletter-topic-or-audience]
```

## Estimated: 5 credits, 8 minutes

## Goal context
<goal>$ARGUMENTS</goal>

Pass this goal to every sub-command as context for their analysis.
