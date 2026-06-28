---
title: "Phase 06 — Post-Acquisition Iteration + Scale Signal"
description: "Analyze first-10 data → decide scale-up direction. Build the next 90-day plan from real customer signal."
status: pending
priority: P1
effort: "4-6h"
dependencies: [phase-05-first-10-customers]
created: 2026-05-16
---

# Phase 06 — Post-Acquisition Iteration + Scale Signal

## Overview

- **Priority:** P1 — gates next 90-day workstream
- **Goal:** consolidate signal from first 10 customers into a "scale-or-pivot" decision document.

## Requirements

### Functional

- Cohort report: AOV, LTV-projection, churn (30-day refund rate), NPS, top 3 feature requests, top 3 friction points
- Channel ROI: per-channel CAC (operator-time + DM cost + content production cost / customers acquired)
- Pricing experiment readout: free-7d vs $1-trial — which converts better? Refund rate difference?
- Product backlog reorder: deferred items from upstream plan (Apollo, multi-YT, render benchmark) prioritized by customer-request count
- Scale-or-pivot decision: based on data, recommend
  - **SCALE** (double down): pick best channel, 3x outreach volume, automate D+1+3+7 lifecycle
  - **PIVOT** (segment shift): if AOV / NPS suggest wrong customer segment, refine ICP and redo Phase 02 copy

### Non-Functional

- Report bilingual VN+EN summary (full data in EN for clarity)
- Numbers honest — no rounding up, no hand-waving on small-sample-size caveats
- Open questions explicit (small N=10 limitations called out)

## Architecture

```
Phase 01 events + Phase 05 feedback log
                ↓
        SQL aggregation queries
                ↓
        Cohort report (markdown)
                ↓
        Decision: SCALE / PIVOT / STAY
                ↓
        Next plan (90-day) bootstrapped
```

## Related Code Files

### Read (no edits)
- D1 `events`, `users`, `user_purchases`, `refund_requests` tables
- `plans/reports/acquisition-feedback-260516.md`

### Write
- `plans/reports/cohort-report-260616-first-10.md` (date assumes phase-05 takes ~4 weeks; adjust)
- `plans/260616-XXXX-scale-or-pivot-plan/` (new plan dir if SCALE chosen)

## Implementation Steps

1. SQL aggregation queries → cohort_report.md draft
2. Channel ROI calculation (operator self-reports time spent per channel)
3. Pricing experiment readout (Phase 02 variants comparison)
4. Top-3 feature requests + friction points (from Phase 05 feedback log)
5. Decision section: SCALE / PIVOT / STAY with rationale
6. Open questions: small-N caveats, statistical confidence
7. If SCALE → bootstrap next plan dir with skeleton phases
8. Update `docs/development-roadmap.md` + `docs/project-changelog.md`
9. Commit + push

## Todo List

- [ ] SQL aggregation queries written
- [ ] Cohort report drafted
- [ ] Channel ROI table
- [ ] Pricing readout
- [ ] Decision: SCALE / PIVOT / STAY
- [ ] Next plan bootstrapped (if SCALE)
- [ ] Roadmap + changelog updated
- [ ] Commit + push

## Success Criteria

- Cohort report covers all 10 customers with no missing data points
- Channel ROI table has per-channel CAC
- Decision is explicit (not "let's see") with numerical rationale
- Either next plan dir created OR documented reason to pause
