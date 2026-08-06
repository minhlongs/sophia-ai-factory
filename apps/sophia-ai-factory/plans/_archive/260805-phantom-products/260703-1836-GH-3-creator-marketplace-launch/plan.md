---
title: "Creator Marketplace Launch — Phase 1"
description: "Lower creator gate, add payout UI, Stitch-redesign marketplace, add SEO + analytics, pre-launch QA"
status: pending
priority: P1
branch: "fix/3-critical-conversion-gaps"
tags: ["marketplace", "creators", "payouts", "stitch", "phase-1"]
blockedBy: []
blocks: []
created: "2026-07-03T11:45:07.213Z"
createdBy: "ck-cli"
source: cli
---

# Creator Marketplace Launch — Phase 1

## Overview

Launch the SOP Creator Marketplace to enable creators to publish, earn, and grow on Sophia AI Factory. This phase follows the 3 critical conversion-gap fixes and activates the supply side of the marketplace flywheel.

Based on brainstorm report: `plans/reports/brainstorm-creator-marketplace-260703-1836-GH-3-marketplace-report.md`
Red-team review: `plans/260703-1836-GH-3-creator-marketplace-launch/reports/red-team-adjudication-260703-1836-GH-3-marketplace-report.md`

## Phases

| Phase | Name | Status | Est. Effort |
|-------|------|--------|-------------|
| 1 | [Lower Creator Gate](./phase-01-lower-creator-gate.md) | Pending | Small+ (3-5h) |
| 2 | [Payout UI](./phase-02-payout-ui.md) | Pending | Medium+ (6-10h) |
| 3 | [Stitch Redesign](./phase-03-stitch-redesign.md) | Pending | Medium (4-6h) |
| 4 | [SEO + Analytics](./phase-04-seo-analytics.md) | Pending | Small (1-2h) |
| 5 | [Pre-Launch QA](./phase-05-pre-launch-qa.md) | Pending | Small (1-2h) |

## Dependencies

- **Prerequisite:** `fix/3-critical-conversion-gaps` branch (pricing page fix, checkout fix, auth links fix) — already merged
- **Phase 3 depends on Phase 1:** Stitch redesign should reference updated tier gate
- **Phase 5 depends on all prior phases:** QA must run on complete marketplace

## Key Decisions

- **Creator gate:** Application-based via beta invites, not tier-restricted (see brainstorm report)
- **Payouts:** NOWPayments wallet address entry + existing payout API
- **Marketplace locale:** Route under `[locale]/sop-marketplace/` for locale-aware URLs
- **Stitch theme:** Amber Saigon Factory theme, matching existing redesigned screens
