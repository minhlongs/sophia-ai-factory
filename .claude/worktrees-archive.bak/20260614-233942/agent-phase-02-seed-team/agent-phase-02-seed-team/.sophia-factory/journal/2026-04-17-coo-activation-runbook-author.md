---
agent: coo
date: 2026-04-17
slug: activation-runbook-author
---

## Action
Author sophia-activation-runbook.md for founder post-deploy checklist.

## Decision
5-phase runbook: (1) GH Secrets provisioning, (2) CF Secrets via wrangler, (3) Better Stack + PostHog account setup, (4) branch protection enable, (5) verify cron schedules executed once. Each phase has copy-paste command + expected output + escalation path.

## Outcome
Runbook shipped (177 LOC) at docs/sophia-activation-runbook.md. Founder TODOs explicit; agent-side handoffs marked.

## Lessons
Non-tech founder needs literal commands, not 'configure X'. Each step needs both VN + EN per sophia-handover-rules.md. Time-to-production reduced from days to hours when commands are pre-baked.

