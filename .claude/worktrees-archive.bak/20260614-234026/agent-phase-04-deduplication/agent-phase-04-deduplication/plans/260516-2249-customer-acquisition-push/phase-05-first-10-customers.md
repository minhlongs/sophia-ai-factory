---
title: "Phase 05 — First 10 Customers (manual close + iteration)"
description: "High-touch operator-led close for first 10 paying customers. Manual support, daily iteration on findings."
status: pending
priority: P0
effort: "ongoing — 2-4 weeks wall"
dependencies: [phase-02-landing-cro-trial-funnel, phase-03-onboarding-ux-hardening, phase-04-acquisition-channels]
created: 2026-05-16
---

# Phase 05 — First 10 Customers

## Overview

- **Priority:** P0 — north-star metric
- **Goal:** acquire first 10 paying customers. Operator personally reaches out to top trial signups, removes friction, gathers feedback.

## Requirements

### Functional

- Operator monitors Phase 01 funnel daily — picks 5 most-engaged trial users (highest event count) to outreach
- Outreach DM template: bilingual, max 80 words, offer 15-min onboarding call
- Onboarding call SOP (Notion or markdown): walk customer through BYOK setup live, capture friction in real time
- Daily standup (operator solo): triage friction → either fix in code (loop back to phase-03/04) OR add to handover doc Known Issues
- Customer feedback loop: every paying customer gets D+7 NPS-style 3-question form via email
- Refund-rate watchdog: alert if refund rate > 20% in any 7-day window → emergency review

### Non-Functional

- Operator caps DMs at 10/day to avoid burnout
- All feedback captured in single doc `plans/reports/acquisition-feedback-260516.md` (running log)
- No code changes from Phase 05 without re-spawning code-reviewer subagent

## Architecture

```
Funnel events (Phase 01) → operator daily review → top-5 outreach list
                                                  ↓
                                          DM + onboarding call
                                                  ↓
                                       friction captured in feedback log
                                                  ↓
                                P0 → loop to phase-03/04 fix
                                P1/P2 → handover known-issues update
                                                  ↓
                                D+7 NPS form → product iteration backlog
```

## Related Code Files

### Modify (only if P0 friction found)
- Setup Wizard (phase-03 territory)
- Landing copy (phase-02 territory)
- Email templates (lifecycle, NPS)

### Create
- `plans/reports/acquisition-feedback-260516.md` (running customer feedback log)
- `docs/admin-ops/first-10-onboarding-sop.md` (operator playbook)

## Implementation Steps

1. Write operator onboarding-call SOP (bilingual checklist)
2. Daily routine: funnel review → outreach list → DMs sent
3. Onboarding call: walk through BYOK setup, capture screen + voice for asynchronous review
4. Friction triage: P0 → engineering ticket; P1/P2 → docs update
5. D+7 NPS form: 3 questions (NPS 0-10, "one thing to improve", "would you recommend")
6. Weekly retro: operator + (optional) advisor review feedback log; pick top 3 product changes
7. Continue until 10 paying customers OR 4 weeks elapsed (whichever first)
8. Final cohort report: per-customer journey, AOV, refund rate, NPS distribution

## Todo List

- [ ] Onboarding SOP doc
- [ ] Daily outreach routine documented
- [ ] D+7 NPS form template
- [ ] First 5 outreach DMs sent
- [ ] First customer onboarded (paid TX)
- [ ] First friction logged + triaged
- [ ] 5 customers acquired
- [ ] 10 customers acquired
- [ ] Final cohort report

## Success Criteria

- 10 paying customers in ≤ 6 weeks
- Per-customer feedback log non-empty (every customer has at least 1 friction noted, even if trivial)
- 0 unresolved P0 issues at end of phase (else loop back)
- NPS ≥ 7 average across the 10
- Refund rate ≤ 20%
