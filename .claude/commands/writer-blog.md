---
description: "Blog pipeline — keyword research, then draft + SEO optimize in parallel. 3 commands, ~15 min."
argument-hint: [blog-topic-or-keyword]
allowed-tools: Read, Write, Bash, Task
---

# /writer:blog — Blog Pipeline

**IC super command** — chains 3 commands via DAG pipeline.

## Pipeline

```
SEQUENTIAL: /seo --keywords
    |
PARALLEL: /content --blog + /seo --optimize
    |
OUTPUT: reports/writer/blog/
        keyword-research.md
        blog-draft.md
        seo-recommendations.md
        BLOG-SUMMARY.md
```

## Trigger

Runs recipe `recipes/writer/writer-blog.json` through DAGScheduler.

## Execution

1. Read recipe DAG definition
2. Run /seo --keywords first (mode: sequential) to establish keyword targets
3. Spawn /content --blog and /seo --optimize simultaneously via Task tool (mode: parallel)
4. Wait for both to complete
5. Compile into BLOG-SUMMARY.md as publish-ready post with meta fields

## Usage

```
/writer:blog [blog-topic-or-keyword]
```

## Estimated: 8 credits, 15 minutes

## Goal context
<goal>$ARGUMENTS</goal>

Pass this goal to every sub-command as context for their analysis.
