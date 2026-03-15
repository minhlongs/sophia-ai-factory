---
description: "Multi-channel marketing campaign — content, ads, email, social, SEO. 6 commands, ~35 min."
argument-hint: [business context or goal]
---

# Campaign Launch

> Trigger: `/business:campaign-launch $ARGUMENTS`
> Estimated: ~35 min

## Execution

Load recipe: `recipes/business/campaign-launch.json`

Run the DAG workflow:

### Campaign Strategy (parallel)
- `marketing-plan`
- `market-analysis`

### Content Creation (parallel)
- `content`
- `seo`
- `email`

### Launch & Track (sequential)
- `ads`


## Instructions

1. Read recipe DAG definition
2. Execute groups in dependency order
3. Parallel groups run simultaneously
4. Write outputs to `reports/campaign`
5. Report completion with summary
